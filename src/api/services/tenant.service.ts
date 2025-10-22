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
    const result = await window.electron.storage.get(['tenantSlug', 'currentTenant'])
    const tenantSlug = result.tenantSlug || result.currentTenant?.slug

    // In desktop app, there's no browser tab to query
    // If no tenantSlug in storage, user needs to select a tenant

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
        `No tenant slug found${context ? ` for ${context}` : ''} - User needs to select a tenant`
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
        const environment: 'production' | 'demo' = (tenant as any)._environment ?? 'production'
        // Normalize tenant slug to lowercase
        const normalizedSlug = tenant.tenantSlug.toLowerCase()
        const domain = environment === 'demo'
          ? `ws.planhatdemo.com/${normalizedSlug}`
          : `ws.planhat.com/${normalizedSlug}`

        // Preserve verified flag from tab discovery
        const verified = (tenant as any)._verified || false

        return {
          id: tenant._id,
          slug: normalizedSlug,
          name: tenant.name,
          tenantSlug: normalizedSlug, // Preserve tenantSlug for display
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
      const result = await window.electron.storage.get(['currentTenant'])
      if (result.currentTenant) {
        this.currentTenant = result.currentTenant
        return await this.getTenantById(result.currentTenant.id)
      }

      // No tenant found - desktop app requires explicit tenant selection
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
      return tenants.find(tenant => tenant.id === tenantId) ?? null
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
      return tenants.find(tenant => tenant.slug.toLowerCase() === slug.toLowerCase()) ?? null
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
      // Normalize tenant slug to lowercase
      const normalizedTenant = {
        ...tenant,
        slug: tenant.slug.toLowerCase()
      }
      this.currentTenant = normalizedTenant

      // Update API client with tenant slug
      log.debug(`TenantService: Setting HTTP client tenant slug to '${normalizedTenant.slug}'`)
      setTenantSlug(normalizedTenant.slug)

      // Verify the tenant slug was set
      const currentSlug = getTenantSlug()
      log.debug(`TenantService: HTTP client tenant slug verified as '${currentSlug}'`)

      // Update API client base URL based on tenant's environment
      if (tenant.domain) {
        await updateClientForCurrentEnvironment(tenant.domain)
      }

      // Store in Electron storage
      await window.electron.storage.set({
        currentTenant: normalizedTenant,
        tenantSlug: normalizedTenant.slug
      })

      // Tenant change propagates through Zustand store subscriptions in desktop app
      // No need for runtime messaging
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
      // Normalize tenant slug to lowercase
      const normalizedSlug = tenantSlug.toLowerCase()
      const tenant = await this.getTenantBySlug(normalizedSlug)

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
   * NOTE: Not applicable in desktop app - tenants must be explicitly selected
   * This method is kept for API compatibility but always returns null
   */
  async detectTenantFromUrl(): Promise<TenantInfo | null> {
    log.debug('detectTenantFromUrl: Not applicable in desktop app')
    return null
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
      limit: pagination?.limit ?? 2000,
      offset: pagination?.offset ?? 0,
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
   * Check if user has access to tenant using /myprofile validation
   * This is the preferred method for validating tenant access as it verifies
   * with the API that the current session can actually access the tenant
   */
  async hasAccessToTenant(tenantSlug: string): Promise<boolean> {
    try {
      // Normalize tenant slug to lowercase
      const normalizedSlug = tenantSlug.toLowerCase()

      // Try production first (most common)
      const prodClient = axios.create({
        baseURL: 'https://api.planhat.com',
        timeout: getTimeoutConfig('default'),
        headers: getStandardHeaders(),
        withCredentials: apiConfig.withCredentials
      })

      try {
        const response = await prodClient.get<UserProfile>(`/myprofile?tenantSlug=${normalizedSlug}`)
        if (response && response.data) {
          log.info(`Tenant access validated (production): ${normalizedSlug}`)
          return true
        }
      } catch (error) {
        // If not in production, try demo
        if (axios.isAxiosError(error) && (error.response?.status === 401 || error.response?.status === 403)) {
          const demoClient = axios.create({
            baseURL: 'https://api.planhatdemo.com',
            timeout: getTimeoutConfig('default'),
            headers: getStandardHeaders(),
            withCredentials: apiConfig.withCredentials
          })

          try {
            const demoResponse = await demoClient.get<UserProfile>(`/myprofile?tenantSlug=${normalizedSlug}`)
            if (demoResponse && demoResponse.data) {
              log.info(`Tenant access validated (demo): ${normalizedSlug}`)
              return true
            }
          } catch (demoError) {
            log.debug(`Tenant access check failed for ${normalizedSlug} in both environments`)
            return false
          }
        }

        log.debug(`Tenant access check failed for ${normalizedSlug}`)
        return false
      }

      return false
    } catch (error) {
      log.error(`Error checking tenant access for ${tenantSlug}:`, error instanceof Error ? error.message : 'Unknown error')
      return false
    }
  }

  /**
   * Get available features for current tenant
   */
  async getTenantFeatures(tenantId?: string): Promise<string[]> {
    try {
      const tenant = tenantId ? await this.getTenantById(tenantId) : await this.getCurrentTenant()

      return tenant?.features ?? []
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
   * Fetch all available tenants using API-first approach
   * 1. Try to connect to /myprofile with 'Planhat' tenant first
   * 2. If successful, fetch all tenants from /myprofile/tenants
   * 3. Check both production and demo environments
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

    const allTenants: TenantListResponse[] = []
    const tenantSlugs = new Set<string>()

    // Check if user has authenticated session before attempting API discovery
    // This avoids noisy 401 errors in console during initial app load
    try {
      const storageCheck = await window.electron.storage.get(['tenantSlug', 'currentTenant'])
      if (!storageCheck.tenantSlug && !storageCheck.currentTenant?.slug) {
        log.debug('No tenant context found - skipping API discovery (user not authenticated)')
        return allTenants
      }
    } catch (error) {
      log.debug('Failed to check storage for tenant context, proceeding with discovery')
    }

    // Step 1: Try to connect to production API with 'planhat' tenant
    try {
      log.debug('API-first discovery: Attempting to connect to production with planhat tenant')

      const prodClient = axios.create({
        baseURL: 'https://api.planhat.com',
        timeout: getTimeoutConfig('default'),
        headers: getStandardHeaders(),
        withCredentials: apiConfig.withCredentials
      })

      // First, verify we can connect with the planhat tenant
      const profileResponse = await prodClient.get('/myprofile?tenantSlug=planhat')

      if (profileResponse.data) {
        log.debug('API-first discovery: Successfully connected to production API with planhat tenant')

        // Now fetch all available tenants
        const tenantsResponse = await prodClient.get<TenantListResponse[]>('/myprofile/tenants?tenantSlug=planhat')
        const responseData = tenantsResponse.data

        if (responseData && responseData.length > 0) {
          const prodTenantResponses = responseData.map((t: any) => ({
            ...t,
            _environment: 'production',
            _verified: true // All API-discovered tenants are verified
          }))

          allTenants.push(...prodTenantResponses)
          responseData.forEach(t => tenantSlugs.add(t.tenantSlug))

          log.info(`API discovery (prod): Found ${responseData.length} production tenants`)
        }
      }
    } catch (error) {
      // Check if this is a 401 (expected when not authenticated)
      const is401 = axios.isAxiosError(error) && error.response?.status === 401
      const logLevel = is401 ? 'debug' : 'warn'

      if (is401) {
        log.debug('API discovery failed with 401 - user not authenticated with planhat tenant')
      } else {
        log.warn(`Failed to fetch production tenants via planhat: ${error instanceof Error ? error.message : 'Unknown error'}`)
      }

      // Fallback: Try using stored tenant slug if available
      try {
        const result = await window.electron.storage.get(['tenantSlug', 'currentTenant'])
        const storedSlug = result.tenantSlug || result.currentTenant?.slug

        if (storedSlug && storedSlug !== 'planhat') {
          log.debug(`API-first discovery: Trying fallback with stored tenant: ${storedSlug}`)

          const prodClient = axios.create({
            baseURL: 'https://api.planhat.com',
            timeout: getTimeoutConfig('default'),
            headers: getStandardHeaders(),
            withCredentials: apiConfig.withCredentials
          })

          const response = await prodClient.get<TenantListResponse[]>(`/myprofile/tenants?tenantSlug=${storedSlug}`)
          const responseData = response.data

          if (responseData && responseData.length > 0) {
            const prodTenantResponses = responseData.map((t: any) => ({
              ...t,
              _environment: 'production',
              _verified: false // Fallback tenants need verification
            }))

            // Only add tenants not already in the list
            prodTenantResponses.forEach(t => {
              if (!tenantSlugs.has(t.tenantSlug)) {
                allTenants.push(t)
                tenantSlugs.add(t.tenantSlug)
              }
            })

            log.debug(`API discovery (prod fallback): Found ${responseData.length} tenants via ${storedSlug}`)
          }
        }
      } catch (fallbackError) {
        // Check if this is a 401 (expected when not authenticated)
        const is401 = axios.isAxiosError(fallbackError) && fallbackError.response?.status === 401
        if (is401) {
          log.debug('Fallback API discovery failed with 401 - user not authenticated')
        } else {
          log.debug(`Production fallback discovery failed: ${fallbackError instanceof Error ? fallbackError.message : 'Unknown'}`)
        }
      }
    }

    // Desktop app: Don't proactively discover demo tenants
    // Demo tenant discovery only happens after user authenticates via login window

    // Desktop app: If no tenants found via API, user needs to authenticate
    if (allTenants.length === 0) {
      log.info('No tenants found via API - user needs to login to Planhat')
    }

    const verifiedCount = allTenants.filter(t => (t as any)._verified).length
    const unverifiedCount = allTenants.length - verifiedCount

    log.info(`API-first discovery complete: ${allTenants.length} total tenants (${verifiedCount} verified, ${unverifiedCount} unverified)`)

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
   * Fetch and check status for all tenants
   * Desktop app: Always check status with /myprofile for all tenants
   */
  async fetchAllTenantsWithStatus(): Promise<TenantStatus[]> {
    try {
      const tenants = await this.fetchAllAvailableTenants()
      const tenantStatuses: TenantStatus[] = []

      // Desktop app: Check status for ALL tenants with /myprofile API calls
      // No browser tab context, so we must validate every tenant
      log.info(`Checking status for ${tenants.length} tenants via /myprofile API calls`)

      if (tenants.length > 0) {
        const statusPromises = tenants.map(async (tenant): Promise<TenantStatus> => {
          try {
            // Extract environment from tenant data (added by fetchAllAvailableTenants)
            const environment = (tenant as any)._environment as 'production' | 'demo' | undefined

            log.debug(`Checking status for tenant: ${tenant.tenantSlug} (${environment})`)
            const isActive = await this.checkTenantStatus(tenant.tenantSlug, environment)

            log.debug(`Status check result for ${tenant.tenantSlug}: ${isActive ? 'ACTIVE' : 'INACTIVE'}`)

            return {
              tenantSlug: tenant.tenantSlug,
              name: tenant.name,
              isActive
            }
          } catch (error) {
            log.warn(`Status check failed for ${tenant.tenantSlug}:`, error instanceof Error ? error.message : 'Unknown error')
            return {
              tenantSlug: tenant.tenantSlug,
              name: tenant.name,
              isActive: false,
              error: error instanceof Error ? error.message : 'Unknown error'
            }
          }
        })

        const results = await Promise.all(statusPromises)
        tenantStatuses.push(...results)

        // Log status check results
        const activeTenants = results.filter(t => t.isActive).map(t => t.tenantSlug)
        const inactiveTenants = results.filter(t => !t.isActive).map(t => t.tenantSlug)

        if (activeTenants.length > 0) {
          log.info(`Active tenants: [${activeTenants.join(', ')}]`)
        }
        if (inactiveTenants.length > 0) {
          log.info(`Inactive tenants: [${inactiveTenants.join(', ')}]`)
        }
      }

      log.info(`Status check complete: ${tenantStatuses.filter(t => t.isActive).length} active / ${tenantStatuses.length} total tenants`)

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

      await window.electron.storage.remove(['currentTenant', 'tenantSlug'])

      // Tenant clear propagates through Zustand store subscriptions
      // No need for runtime messaging in desktop app
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
