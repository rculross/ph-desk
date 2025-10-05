import axios from 'axios'

import type {
  TenantContext,
  Company,
  User,
  PaginatedResponse,
  BaseFilters,
  ApiResponse
} from '../../types'
import { logger } from '../../utils/logger'
import {
  detectApiBaseURL,
  setTenantSlug,
  getTenantSlug,
  updateClientForCurrentEnvironment,
  updateHttpClient,
  getHttpClient,
  type RequestOptions
} from '../client/http-client'
import { apiConfig, getTimeoutConfig, getStandardHeaders } from '../config/index'

interface ApiRequestOptions extends RequestOptions {
  priority?: 'low' | 'normal' | 'high' | 'critical'
  complexity?: 'simple' | 'moderate' | 'complex' | 'heavy'
}
import { paginationParamsSchema, paginatedResponseSchema, apiResponseSchema } from '../schemas'

const log = logger.api

type LogLevel = 'debug' | 'info' | 'warn' | 'error'

export interface EnsureTenantSlugOptions {
  /**
   * Context label for log messages.
   * Example: 'issues API calls', 'logz API calls'.
   */
  context?: string
  /**
   * Custom logger instance (defaults to API logger).
   */
  logger?: typeof log
  /**
   * Log level to use when tenant slug could not be detected.
   */
  missingLogLevel?: Exclude<LogLevel, 'debug'>
  /**
   * Log level to use when an unexpected error occurs.
   */
  failureLogLevel?: Exclude<LogLevel, 'debug'>
}

const logWithLevel = (
  loggerInstance: typeof log,
  level: LogLevel,
  message: string,
  details?: Record<string, unknown>
) => {
  switch (level) {
    case 'debug':
      details ? loggerInstance.debug(message, details) : loggerInstance.debug(message)
      break
    case 'info':
      details ? loggerInstance.info(message, details) : loggerInstance.info(message)
      break
    case 'warn':
      details ? loggerInstance.warn(message, details) : loggerInstance.warn(message)
      break
    case 'error':
      details ? loggerInstance.error(message, details) : loggerInstance.error(message)
      break
  }
}

/**
 * Ensure the tenant slug is available for API clients by checking Chrome storage first
 * and falling back to the active tab URL when necessary.
 */
export const ensureTenantSlug = async (
  options: EnsureTenantSlugOptions = {}
): Promise<string | undefined> => {
  const {
    context = 'API calls',
    logger: customLogger,
    missingLogLevel = 'warn',
    failureLogLevel = 'warn'
  } = options

  const loggerInstance = customLogger ?? log

  try {
    const result = await chrome.storage.local.get(['tenantSlug', 'currentTenant'])
    let tenantSlug = result.tenantSlug || result.currentTenant?.slug

    if (!tenantSlug) {
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true })
      const activeTab = tabs[0]

      if (activeTab?.url) {
        const url = new URL(activeTab.url)
        const pathSegments = url.pathname.split('/')

        if (pathSegments.length > 1 && pathSegments[1]) {
          tenantSlug = pathSegments[1]
        }
      }
    }

    if (tenantSlug) {
      setTenantSlug(tenantSlug)
      logWithLevel(
        loggerInstance,
        'debug',
        `Set tenant slug${context ? ` for ${context}` : ''}`,
        { tenantSlug }
      )
    } else {
      logWithLevel(
        loggerInstance,
        missingLogLevel,
        `No tenant slug found${context ? ` for ${context}` : ''} - API calls may fail`
      )
    }

    return tenantSlug
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)

    logWithLevel(
      loggerInstance,
      failureLogLevel,
      `Failed to ensure tenant slug${context ? ` for ${context}` : ''}`,
      {
        error: errorMessage
      }
    )

    return undefined
  }
}

/**
 * Service for tenant-related API operations
 *
 * Handles multi-tenant operations including tenant discovery,
 * switching, and tenant-specific data access management.
 */

export interface TenantInfo extends TenantContext {
  subscription: TenantSubscription
  members: number
  lastActivity: string
  tenantSlug?: string // Add tenantSlug for display purposes
  verified?: boolean // Mark tab-discovered tenants as verified (skip status checks)
}

export interface TenantSettings {
  timezone: string
  locale: string
  dateFormat: string
  currency: string
  language: string
  workingDays: number[]
  workingHours: {
    start: string
    end: string
  }
  customFields: Record<string, any>
  branding: TenantBranding
  features: string[]
  integrations: TenantIntegration[]
}

export interface TenantBranding {
  logo?: string
  primaryColor: string
  secondaryColor: string
  favicon?: string
}

export interface TenantIntegration {
  type: string
  name: string
  enabled: boolean
  config: Record<string, any>
  lastSync?: string
  status: 'active' | 'inactive' | 'error'
}

export interface TenantLimits {
  maxUsers: number
  maxCompanies: number
  maxIssues: number
  maxWorkflows: number
  apiCallsPerHour: number
  storageGB: number
}

export interface TenantSubscription {
  plan: string
  status: 'active' | 'trialing' | 'past_due' | 'canceled' | 'unpaid'
  currentPeriodStart: string
  currentPeriodEnd: string
  trialEnd?: string
  cancelAtPeriodEnd: boolean
}

export interface TenantMember {
  userId: string
  user: User
  role: string
  permissions: string[]
  joinedAt: string
  lastActive: string
  isActive: boolean
}

export interface TenantUsage {
  period: string
  users: number
  companies: number
  issues: number
  workflows: number
  apiCalls: number
  storageUsed: number
  lastUpdated: string
}

export interface TenantListResponse {
  _id: string
  name: string
  tenantSlug: string
}

export interface TenantStatus {
  tenantSlug: string
  name: string
  isActive: boolean
  error?: string
}

export interface TenantWithEnvironment {
  tenantSlug: string
  environment: 'production' | 'demo'
}

export interface UserProfile {
  _id: string
  email: string
  firstName: string
  lastName: string
  role?: string
  [key: string]: any
}

export interface CreateTenantRequest {
  name: string
  slug: string
  plan?: string
  settings?: Partial<TenantSettings>
  adminUser: {
    email: string
    firstName: string
    lastName: string
    password: string
  }
}

export interface UpdateTenantRequest {
  name?: string
  slug?: string
  settings?: Partial<TenantSettings>
}

export interface TenantFilters extends BaseFilters {
  name?: string
  slug?: string
  plan?: string
  status?: string[]
  features?: string[]
}

// Global counter outside the class to prevent reset on re-instantiation
let globalFetchAttempts = 0
let lastFetchTime = 0

/**
 * Tenant Service Class
 */
class TenantService {
  private currentTenant: TenantContext | null = null

  private get httpClient() {
    return getHttpClient()
  }

  /**
   * Get list of tenants accessible to current user
   * Uses the /myprofile/tenants endpoint instead of /tenants
   */
  async getTenants(filters?: TenantFilters): Promise<TenantInfo[]> {
    try {
      // Use fetchAllAvailableTenants which now makes separate calls for prod and demo
      const tenants = await this.fetchAllAvailableTenants()

      log.info(`Processing tenants from API: ${tenants.length} total tenants`)

      // Convert TenantListResponse[] to TenantInfo[] and apply filters
      const tenantInfos: TenantInfo[] = tenants.map(tenant => {
        // Use the environment marker from the API response, or determine from tenant data
        const environment: 'production' | 'demo' = (tenant as any)._environment || 'production'
        const domain = environment === 'demo'
          ? `ws.planhatdemo.com/${tenant.tenantSlug}`
          : `ws.planhat.com/${tenant.tenantSlug}`

        // Preserve verified flag from tab discovery
        const verified = (tenant as any)._verified || false

        return {
          id: tenant._id,
          slug: tenant.tenantSlug,
          name: tenant.name,
          tenantSlug: tenant.tenantSlug, // Preserve tenantSlug for display
          verified, // Mark tab-discovered tenants as verified
          domain,
          logo: undefined,
          settings: {} as TenantSettings,
          features: [],
          limits: {
            maxUsers: 100,
            maxProjects: 100,
            maxStorageGB: 100,
            maxApiCallsPerMonth: 100000,
            maxExportRecords: 100000,
            // Additional properties for local TenantLimits interface
            maxCompanies: 1000,
            maxIssues: 10000,
            maxWorkflows: 100,
            apiCallsPerHour: 5000,
            storageGB: 100
          } as any,
          billing: {
            plan: 'unknown',
            status: 'active',
            trialEnd: null,
            nextBillingDate: new Date().toISOString()
          } as any,
          isActive: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          subscription: {
            plan: 'unknown',
            status: 'active',
            currentPeriodStart: new Date().toISOString(),
            currentPeriodEnd: new Date().toISOString(),
            cancelAtPeriodEnd: false
          },
          members: 0,
          lastActivity: new Date().toISOString()
        }
      })

      // Log grouped tenant discovery results
      const prodTenants = tenantInfos.filter(t => t.domain?.includes('planhat.com') && !t.domain.includes('planhatdemo.com'))
      const demoTenants = tenantInfos.filter(t => t.domain?.includes('planhatdemo.com'))
      log.debug(`Fetched tenants - Production: [${prodTenants.map(t => t.slug).join(', ')}], Demo: [${demoTenants.map(t => t.slug).join(', ')}]`)

      // Apply filters if provided
      if (!filters) {
        return tenantInfos
      }

      return tenantInfos.filter(tenant => {
        if (filters.name && !tenant.name.toLowerCase().includes(filters.name.toLowerCase())) {
          return false
        }
        if (filters.slug && !tenant.slug.toLowerCase().includes(filters.slug.toLowerCase())) {
          return false
        }
        return true
      })
    } catch (error) {
      log.error('Failed to fetch tenants:', error)
      throw error
    }
  }

  /**
   * Get current tenant information
   */
  async getCurrentTenant(): Promise<TenantInfo | null> {
    try {
      // First check if we have a cached current tenant
      if (this.currentTenant) {
        return await this.getTenantById(this.currentTenant.id)
      }

      // Try to get from storage
      const result = await chrome.storage.local.get(['currentTenant'])
      if (result.currentTenant) {
        this.currentTenant = result.currentTenant
        return await this.getTenantById(result.currentTenant.id)
      }

      // Try to detect from URL
      const detectedTenant = await this.detectTenantFromUrl()
      if (detectedTenant) {
        await this.setCurrentTenant(detectedTenant)
        return detectedTenant
      }

      return null
    } catch (error) {
      log.error('Failed to get current tenant:', error)
      return null
    }
  }

  /**
   * Get tenant by ID
   * Note: This method is limited since /tenants/* endpoints don't exist.
   * It will try to find the tenant by matching the ID in the available tenants list.
   */
  async getTenantById(tenantId: string): Promise<TenantInfo | null> {
    try {
      const tenants = await this.getTenants()
      return tenants.find(tenant => tenant.id === tenantId) || null
    } catch (error) {
      log.error('Failed to get tenant by ID:', error)
      return null
    }
  }

  /**
   * Get tenant by slug
   * Uses the available tenants list since /tenants/slug/* endpoints don't exist.
   */
  async getTenantBySlug(slug: string): Promise<TenantInfo | null> {
    try {
      const tenants = await this.getTenants()
      return tenants.find(tenant => tenant.slug.toLowerCase() === slug.toLowerCase()) || null
    } catch (error) {
      log.error('Failed to get tenant by slug:', error)
      return null
    }
  }

  /**
   * Set current tenant context
   */
  async setCurrentTenant(tenant: TenantContext): Promise<void> {
    try {
      this.currentTenant = tenant

      // Update API client with tenant slug
      log.debug(`TenantService: Setting HTTP client tenant slug to '${tenant.slug}'`)
      setTenantSlug(tenant.slug)

      // Verify the tenant slug was set
      const currentSlug = getTenantSlug()
      log.debug(`TenantService: HTTP client tenant slug verified as '${currentSlug}'`)

      // Update API client base URL based on tenant's environment
      if (tenant.domain) {
        await updateClientForCurrentEnvironment(tenant.domain)
      }

      // Store in Chrome storage
      await chrome.storage.local.set({
        currentTenant: tenant,
        tenantSlug: tenant.slug
      })

      // Notify other parts of the extension about tenant change
      chrome.runtime
        .sendMessage({
          action: 'TENANT_CHANGED',
          payload: {
            tenant: tenant.slug,
            url: tenant.domain || `ws.planhat.com/${tenant.slug}`,
            previousTenant: this.currentTenant.slug
          }
        })
        .catch(() => {
          // Silently handle message failures
        })
    } catch (error) {
      log.error('Failed to set current tenant:', error)
      throw error
    }
  }

  /**
   * Switch to a different tenant
   */
  async switchTenant(tenantSlug: string): Promise<TenantInfo> {
    try {
      const tenant = await this.getTenantBySlug(tenantSlug)

      if (!tenant) {
        throw new Error(`Tenant with slug "${tenantSlug}" not found`)
      }

      await this.setCurrentTenant({
        id: tenant.id,
        slug: tenant.slug,
        name: tenant.name,
        domain: tenant.domain,
        logo: tenant.logo,
        settings: tenant.settings,
        features: tenant.features,
        limits: tenant.limits,
        billing: tenant.billing,
        isActive: tenant.isActive,
        createdAt: tenant.createdAt,
        updatedAt: tenant.updatedAt
      })

      return tenant
    } catch (error) {
      log.error('Failed to switch tenant:', error)
      throw error
    }
  }

  /**
   * Detect tenant from current browser tab URL
   * Planhat URL format: ws.planhat.com/<tenant>/...
   */
  async detectTenantFromUrl(): Promise<TenantInfo | null> {
    try {
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true })
      const activeTab = tabs[0]

      if (!activeTab?.url) {
        return null
      }

      const url = new URL(activeTab.url)

      // Check if it's a Planhat URL (ws.planhat.com or ws.planhatdemo.com)
      if (!url.hostname.includes('planhat.com') && !url.hostname.includes('planhatdemo.com')) {
        return null
      }

      // For ws.planhat.com or ws.planhatdemo.com, extract tenant from the first path segment
      if (url.hostname === 'ws.planhat.com' || url.hostname === 'ws.planhatdemo.com') {
        const pathSegments = url.pathname.split('/').filter(Boolean)
        
        if (pathSegments.length === 0) {
          return null
        }

        // The first path segment is the tenant slug
        const tenantSlug = pathSegments[0]?.toLowerCase()
        
        if (!tenantSlug) {
          return null
        }

        // Skip if it looks like a generic path rather than a tenant
        if (['login', 'logout', 'auth', 'api', 'static'].includes(tenantSlug)) {
          return null
        }

        // Try to get tenant info by slug
        const tenant = await this.getTenantBySlug(tenantSlug)

        // If tenant found, update API client for tenant's environment
        if (tenant?.domain) {
          await updateClientForCurrentEnvironment(tenant.domain)
        }

        return tenant
      }

      return null
    } catch (error) {
      log.warn('Failed to detect tenant from URL:', error)
      return null
    }
  }

  /**
   * Get tenant members
   * Note: /tenants/* endpoints don't exist in Planhat API
   * This method is disabled and returns empty results
   */
  async getTenantMembers(
    tenantId?: string,
    pagination?: { limit?: number; offset?: number }
  ): Promise<PaginatedResponse<TenantMember>> {
    log.warn('getTenantMembers: /tenants/{id}/members endpoint does not exist in Planhat API')
    
    return {
      data: [],
      total: 0,
      limit: pagination?.limit || 2000,
      offset: pagination?.offset || 0,
      hasMore: false
    }
  }

  /**
   * Get tenant usage statistics
   * Note: /tenants/* endpoints don't exist in Planhat API
   * This method is disabled and returns null
   */
  async getTenantUsage(tenantId?: string, period?: string): Promise<TenantUsage | null> {
    log.warn('getTenantUsage: /tenants/{id}/usage endpoint does not exist in Planhat API')
    return null
  }

  /**
   * Update tenant settings
   * Note: /tenants/* endpoints don't exist in Planhat API
   * This method is disabled
   */
  async updateTenantSettings(
    settings: Partial<TenantSettings>,
    tenantId?: string
  ): Promise<TenantInfo> {
    log.warn('updateTenantSettings: /tenants/{id}/settings endpoint does not exist in Planhat API')
    throw new Error('updateTenantSettings is not supported - /tenants/* endpoints do not exist in Planhat API')
  }

  /**
   * Create a new tenant (admin operation)
   * Note: /tenants endpoint doesn't exist in Planhat API
   * This method is disabled
   */
  async createTenant(request: CreateTenantRequest): Promise<TenantInfo> {
    log.warn('createTenant: /tenants endpoint does not exist in Planhat API')
    throw new Error('createTenant is not supported - /tenants endpoint does not exist in Planhat API')
  }

  /**
   * Update tenant information (admin operation)
   * Note: /tenants/* endpoints don't exist in Planhat API
   * This method is disabled
   */
  async updateTenant(tenantId: string, updates: UpdateTenantRequest): Promise<TenantInfo> {
    log.warn('updateTenant: /tenants/{id} endpoint does not exist in Planhat API')
    throw new Error('updateTenant is not supported - /tenants/* endpoints do not exist in Planhat API')
  }

  /**
   * Delete a tenant (admin operation)
   * Note: /tenants/* endpoints don't exist in Planhat API
   * This method is disabled
   */
  async deleteTenant(tenantId: string): Promise<void> {
    log.warn('deleteTenant: /tenants/{id} endpoint does not exist in Planhat API')
    throw new Error('deleteTenant is not supported - /tenants/* endpoints do not exist in Planhat API')
  }

  /**
   * Check if user has access to tenant
   */
  async hasAccessToTenant(tenantSlug: string): Promise<boolean> {
    try {
      const tenant = await this.getTenantBySlug(tenantSlug)
      return tenant !== null
    } catch (error) {
      return false
    }
  }

  /**
   * Get available features for current tenant
   */
  async getTenantFeatures(tenantId?: string): Promise<string[]> {
    try {
      const tenant = tenantId ? await this.getTenantById(tenantId) : await this.getCurrentTenant()

      return tenant?.features || []
    } catch (error) {
      log.error('Failed to get tenant features:', error)
      return []
    }
  }

  /**
   * Check if tenant has specific feature
   */
  async hasFeature(feature: string, tenantId?: string): Promise<boolean> {
    try {
      const features = await this.getTenantFeatures(tenantId)
      return features.includes(feature)
    } catch (error) {
      return false
    }
  }

  /**
   * Fetch all available tenants using tab-first approach for efficiency
   * 1. Scan Chrome tabs first to find guaranteed accessible tenants
   * 2. Add tab tenants to results as verified (skip status checks)
   * 3. Use one tab tenant to discover additional tenants via API
   * 4. Mark API-discovered tenants as unverified (require status checks)
   */
  async fetchAllAvailableTenants(): Promise<TenantListResponse[]> {
    // Reset counter if more than 10 seconds have passed since last attempt
    const now = Date.now()
    if (now - lastFetchTime > 10000) {
      globalFetchAttempts = 0
    }
    lastFetchTime = now

    globalFetchAttempts++

    // Prevent more than 3 attempts in a short time period
    if (globalFetchAttempts > 3) {
      log.error('Maximum tenant fetch attempts exceeded, aborting to prevent infinite loop')
      // Don't reset here - let the time-based reset handle it
      throw new Error('Maximum tenant fetch attempts exceeded')
    }

    // Step 1: Scan Chrome tabs to find tenants (these are 100% accessible)
    const tabTenants = await this.scanChromeTabsForTenantsWithEnvironment()
    log.info(`Tab-first discovery: Found ${tabTenants.length} tenants in open tabs`)

    const allTenants: TenantListResponse[] = []
    const tabTenantSlugs = new Set<string>()

    // Step 2: Add tab tenants as verified (guaranteed accessible)
    for (const tabTenant of tabTenants) {
      const tenantResponse: TenantListResponse & { _environment: string; _verified: boolean } = {
        _id: `tab-${tabTenant.tenantSlug}`, // Temporary ID for tab tenants
        name: tabTenant.tenantSlug, // Will be updated from API if available
        tenantSlug: tabTenant.tenantSlug,
        _environment: tabTenant.environment,
        _verified: true // Tab tenants are verified accessible
      }

      allTenants.push(tenantResponse)
      tabTenantSlugs.add(tabTenant.tenantSlug)

      log.debug(`Added verified tab tenant: ${tabTenant.tenantSlug} (${tabTenant.environment})`)
    }

    // Step 3: Use tab tenants to discover additional tenants via API
    // Group tab tenants by environment for efficient API calls
    const prodTabTenants = tabTenants.filter(t => t.environment === 'production')
    const demoTabTenants = tabTenants.filter(t => t.environment === 'demo')

    // Fetch additional production tenants if we have prod tabs
    if (prodTabTenants.length > 0 && prodTabTenants[0]) {
      try {
        const prodSlug = prodTabTenants[0].tenantSlug

        const prodClient = axios.create({
          baseURL: 'https://api.planhat.com',
          timeout: getTimeoutConfig('default'),
          headers: getStandardHeaders(),
          withCredentials: apiConfig.withCredentials
        })

        const response = await prodClient.get<TenantListResponse[]>(`/myprofile/tenants?tenantSlug=${prodSlug}`)
        const responseData = response.data

        if (responseData && responseData.length > 0) {
          // Add API-discovered tenants (excluding those already found in tabs)
          const newTenants = responseData.filter(t => !tabTenantSlugs.has(t.tenantSlug))

          const prodTenantResponses = newTenants.map((t: any) => ({
            ...t,
            _environment: 'production',
            _verified: false // API-discovered tenants need status verification
          }))

          allTenants.push(...prodTenantResponses)
          log.info(`API discovery (prod): Found ${newTenants.length} additional tenants via ${prodSlug}`)

          // Update names for tab tenants from API data
          responseData.forEach(apiTenant => {
            const tabTenant = allTenants.find(t => t.tenantSlug === apiTenant.tenantSlug && (t as any)._verified)
            if (tabTenant) {
              tabTenant.name = apiTenant.name
              tabTenant._id = apiTenant._id
            }
          })
        }
      } catch (error) {
        log.error(`Failed to fetch additional production tenants: ${error instanceof Error ? error.message : 'Unknown error'}`)
      }
    }

    // Fetch additional demo tenants if we have demo tabs
    if (demoTabTenants.length > 0 && demoTabTenants[0]) {
      try {
        const demoSlug = demoTabTenants[0].tenantSlug

        const demoClient = axios.create({
          baseURL: 'https://api.planhatdemo.com',
          timeout: getTimeoutConfig('default'),
          headers: getStandardHeaders(),
          withCredentials: apiConfig.withCredentials
        })

        const response = await demoClient.get<TenantListResponse[]>(`/myprofile/tenants?tenantSlug=${demoSlug}`)
        const responseData = response.data

        if (responseData && responseData.length > 0) {
          // Add API-discovered tenants (excluding those already found in tabs)
          const newTenants = responseData.filter(t => !tabTenantSlugs.has(t.tenantSlug))

          const demoTenantResponses = newTenants.map((t: any) => ({
            ...t,
            _environment: 'demo',
            _verified: false // API-discovered tenants need status verification
          }))

          allTenants.push(...demoTenantResponses)
          log.info(`API discovery (demo): Found ${newTenants.length} additional tenants via ${demoSlug}`)

          // Update names for tab tenants from API data
          responseData.forEach(apiTenant => {
            const tabTenant = allTenants.find(t => t.tenantSlug === apiTenant.tenantSlug && (t as any)._verified)
            if (tabTenant) {
              tabTenant.name = apiTenant.name
              tabTenant._id = apiTenant._id
            }
          })
        }
      } catch (error) {
        log.error(`Failed to fetch additional demo tenants: ${error instanceof Error ? error.message : 'Unknown error'}`)
      }
    }

    // Step 4: Fallback for no open tabs - try storage
    if (allTenants.length === 0) {
      log.warn('No tenants found via Chrome tabs, trying fallback methods')

      try {
        const result = await chrome.storage.local.get(['tenantSlug', 'currentTenant'])
        const storedSlug = result.tenantSlug || result.currentTenant?.slug

        if (storedSlug) {
          // Try 'planhat' production tenant as safe fallback
          const fallbackSlug = storedSlug === 'planhat' ? 'planhat' : 'planhat'

          const prodClient = axios.create({
            baseURL: 'https://api.planhat.com',
            timeout: getTimeoutConfig('default'),
            headers: getStandardHeaders(),
            withCredentials: apiConfig.withCredentials
          })

          const response = await prodClient.get<TenantListResponse[]>(`/myprofile/tenants?tenantSlug=${fallbackSlug}`)
          const responseData = response.data

          if (responseData && responseData.length > 0) {
            const fallbackTenants = responseData.map((t: any) => ({
              ...t,
              _environment: 'production',
              _verified: false // Fallback tenants need status verification
            }))

            allTenants.push(...fallbackTenants)
            log.info(`Fallback discovery: Found ${responseData.length} tenants via ${fallbackSlug}`)
          }
        }
      } catch (error) {
        log.debug(`Fallback discovery failed: ${error instanceof Error ? error.message : 'Unknown'}`)
      }
    }

    const verifiedCount = allTenants.filter(t => (t as any)._verified).length
    const unverifiedCount = allTenants.length - verifiedCount

    log.info(`Tab-first discovery complete: ${allTenants.length} total tenants (${verifiedCount} verified, ${unverifiedCount} unverified)`)

    if (allTenants.length > 0) {
      const summary = allTenants.map(t =>
        `${t.tenantSlug}(${(t as any)._environment}${(t as any)._verified ? ',verified' : ''})`
      ).join(', ')
      log.debug(`Tenant summary: ${summary}`)
    }

    // Reset attempt counter on successful fetch
    globalFetchAttempts = 0

    return allTenants
  }

  /**
   * Check if a tenant is active by calling /myprofile?tenantSlug=<tenant>
   */
  async checkTenantStatus(tenantSlug: string, environment?: 'production' | 'demo'): Promise<boolean> {
    try {
      let baseURL: string

      if (environment) {
        // Use the provided environment to determine the correct API base URL
        baseURL = environment === 'demo' ? 'https://api.planhatdemo.com' : 'https://api.planhat.com'
      } else {
        // Fall back to tab-based detection if environment is not provided
        baseURL = await detectApiBaseURL()
      }

      // Create separate HTTP client for status checking to avoid modifying global client
      const statusClient = axios.create({
        baseURL,
        timeout: getTimeoutConfig('default'),
        headers: getStandardHeaders(),
        withCredentials: apiConfig.withCredentials
      })

      // Add tenant slug to request params without modifying global state
      const response = await statusClient.get<UserProfile>(
        `/myprofile?tenantSlug=${tenantSlug}`
      )
      return response !== null && response !== undefined
    } catch (error) {
      // Silently return false for inactive tenants (expected behavior)
      return false
    }
  }

  /**
   * Scan Chrome tabs for open Planhat tabs and extract tenant slugs with environment
   * Planhat URL format: ws.planhat.com/<tenant>/... or ws.planhatdemo.com/<tenant>/...
   */
  async scanChromeTabsForTenantsWithEnvironment(): Promise<TenantWithEnvironment[]> {
    try {
      // Query both production and demo Planhat tabs
      const [prodTabs, demoTabs] = await Promise.all([
        chrome.tabs.query({ url: 'https://ws.planhat.com/*' }),
        chrome.tabs.query({ url: 'https://ws.planhatdemo.com/*' })
      ])

      log.info(`Scanning Chrome tabs: ${prodTabs.length} production, ${demoTabs.length} demo tabs found`)
      const tenants: TenantWithEnvironment[] = []

      // Process production tabs
      for (const tab of prodTabs) {
        if (!tab.url) continue

        try {
          const url = new URL(tab.url)
          if (url.hostname !== 'ws.planhat.com') continue

          const pathSegments = url.pathname.split('/').filter(Boolean)
          if (pathSegments.length === 0) continue

          const tenantSlug = pathSegments[0]?.toLowerCase().trim()
          if (!tenantSlug) continue

          // Skip generic paths that aren't tenant slugs
          const skipPaths = ['login', 'logout', 'auth', 'api', 'static', 'assets', 'favicon.ico']
          if (skipPaths.includes(tenantSlug)) continue

          // Basic validation: tenant slugs should be alphanumeric with possible hyphens/underscores
          if (!/^[a-z0-9_-]+$/.test(tenantSlug)) continue

          // Add to list if not already present
          if (!tenants.find(t => t.tenantSlug === tenantSlug && t.environment === 'production')) {
            tenants.push({ tenantSlug, environment: 'production' })
          }
        } catch (urlError) {
          log.warn(`Failed to parse production tab URL ${tab.url}:`, urlError instanceof Error ? urlError.message : 'Unknown error')
        }
      }

      // Process demo tabs
      for (const tab of demoTabs) {
        if (!tab.url) continue

        try {
          const url = new URL(tab.url)
          if (url.hostname !== 'ws.planhatdemo.com') continue

          const pathSegments = url.pathname.split('/').filter(Boolean)
          if (pathSegments.length === 0) continue

          const tenantSlug = pathSegments[0]?.toLowerCase().trim()
          if (!tenantSlug) continue

          // Skip generic paths that aren't tenant slugs
          const skipPaths = ['login', 'logout', 'auth', 'api', 'static', 'assets', 'favicon.ico']
          if (skipPaths.includes(tenantSlug)) continue

          // Basic validation: tenant slugs should be alphanumeric with possible hyphens/underscores
          if (!/^[a-z0-9_-]+$/.test(tenantSlug)) continue

          // Add to list if not already present
          if (!tenants.find(t => t.tenantSlug === tenantSlug && t.environment === 'demo')) {
            tenants.push({ tenantSlug, environment: 'demo' })
          }
        } catch (urlError) {
          log.warn(`Failed to parse demo tab URL ${tab.url}:`, urlError instanceof Error ? urlError.message : 'Unknown error')
        }
      }

      log.info(`Chrome tab scan complete: ${tenants.length} tenants found`)
      if (tenants.length > 0) {
        const prodTenants = tenants.filter(t => t.environment === 'production').map(t => t.tenantSlug)
        const demoTenants = tenants.filter(t => t.environment === 'demo').map(t => t.tenantSlug)
        log.debug(`Open tabs - Production: [${prodTenants.join(', ')}], Demo: [${demoTenants.join(', ')}]`)
      }

      return tenants
    } catch (error) {
      log.error('Failed to scan Chrome tabs for tenants:', error)
      return []
    }
  }

  /**
   * Scan Chrome tabs for open Planhat tabs and extract tenant slugs (legacy method)
   * Planhat URL format: ws.planhat.com/<tenant>/... or ws.planhatdemo.com/<tenant>/...
   */
  async scanChromeTabsForTenants(): Promise<string[]> {
    const tenantsWithEnv = await this.scanChromeTabsForTenantsWithEnvironment()
    return tenantsWithEnv.map(t => t.tenantSlug)
  }

  /**
   * Fetch and check status for all tenants
   * Optimized: Skip status checks for verified tab tenants (guaranteed accessible)
   */
  async fetchAllTenantsWithStatus(): Promise<TenantStatus[]> {
    try {
      const tenants = await this.fetchAllAvailableTenants()
      const tenantStatuses: TenantStatus[] = []

      // Separate verified (tab) tenants from unverified (API-discovered) tenants
      const verifiedTenants = tenants.filter(t => (t as any)._verified)
      const unverifiedTenants = tenants.filter(t => !(t as any)._verified)

      log.info(`Status check optimization: ${verifiedTenants.length} verified tenants (skip check), ${unverifiedTenants.length} unverified tenants (check required)`)

      // Add verified tenants as active (no status check needed)
      verifiedTenants.forEach(tenant => {
        tenantStatuses.push({
          tenantSlug: tenant.tenantSlug,
          name: tenant.name,
          isActive: true // Tab tenants are guaranteed active
        })
      })

      // Only check status for unverified (API-discovered) tenants
      if (unverifiedTenants.length > 0) {
        const statusPromises = unverifiedTenants.map(async (tenant): Promise<TenantStatus> => {
          try {
            // Extract environment from tenant data (added by fetchAllAvailableTenants)
            const environment = (tenant as any)._environment as 'production' | 'demo' | undefined
            const isActive = await this.checkTenantStatus(tenant.tenantSlug, environment)
            return {
              tenantSlug: tenant.tenantSlug,
              name: tenant.name,
              isActive
            }
          } catch (error) {
            return {
              tenantSlug: tenant.tenantSlug,
              name: tenant.name,
              isActive: false,
              error: error instanceof Error ? error.message : 'Unknown error'
            }
          }
        })

        const unverifiedResults = await Promise.all(statusPromises)
        tenantStatuses.push(...unverifiedResults)

        // Log status check results for unverified tenants
        const activeUnverified = unverifiedResults.filter(t => t.isActive).map(t => t.tenantSlug)
        const inactiveUnverified = unverifiedResults.filter(t => !t.isActive).map(t => t.tenantSlug)

        if (activeUnverified.length > 0) {
          log.debug(`Active unverified tenants: [${activeUnverified.join(', ')}]`)
        }
        if (inactiveUnverified.length > 0) {
          log.debug(`Inactive unverified tenants: [${inactiveUnverified.join(', ')}]`)
        }
      }

      // Log overall results
      const allActiveTenants = tenantStatuses.filter(t => t.isActive).map(t => t.tenantSlug)
      const verifiedActiveTenants = verifiedTenants.map(t => t.tenantSlug)

      log.info(`Status check complete: ${allActiveTenants.length} active tenants total (${verifiedActiveTenants.length} verified, ${allActiveTenants.length - verifiedActiveTenants.length} unverified)`)

      return tenantStatuses
    } catch (error) {
      log.error('Failed to fetch tenants with status:', error)
      return []
    }
  }

  /**
   * Clear current tenant context
   */
  async clearCurrentTenant(): Promise<void> {
    try {
      this.currentTenant = null
      
      // Clear tenant slug from API client
      setTenantSlug(undefined)
      
      await chrome.storage.local.remove(['currentTenant', 'tenantSlug'])

      // Notify about tenant change
      chrome.runtime
        .sendMessage({
          action: 'TENANT_CLEARED',
          payload: null
        })
        .catch(() => {
          // Silently handle message failures
        })
    } catch (error) {
      log.error('Failed to clear current tenant:', error)
    }
  }

  /**
   * Get tenant context for API calls
   */
  getTenantContext(): TenantContext | null {
    return this.currentTenant
  }
}

// Export singleton instance
export const tenantService = new TenantService()

// Export class for advanced usage
export { TenantService }
