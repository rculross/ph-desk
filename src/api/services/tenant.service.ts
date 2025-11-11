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
import { tenantListCache, tenantStatusCache } from '../../stores/tenant-cache'
import { useAuthStore } from '../../stores/auth.store'

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
 * Ensure both authentication and tenant context are available before making API calls
 * This provides consistent behavior between hooks and direct service calls
 */
export const ensureAuthAndTenant = async (
  options: EnsureTenantSlugOptions = {}
): Promise<void> => {
  const {
    context = 'API calls',
    logger: customLogger
  } = options

  const loggerInstance = customLogger ?? log

  // Check authentication first - use auth store state
  const isAuthenticated = useAuthStore.getState().isAuthenticated

  if (!isAuthenticated) {
    logWithLevel(
      loggerInstance,
      'warn',
      `Not authenticated${context ? ` for ${context}` : ''} - User needs to log in`
    )
    throw new Error('Authentication required. Please log in to continue.')
  }

  // Check tenant slug
  const tenantSlug = await ensureTenantSlug(options)

  if (!tenantSlug) {
    throw new Error('Tenant context required. Please select a workspace to continue.')
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
  environment?: 'production' | 'demo'
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
      log.debug(`Fetching available tenants from all environments`)

      // Fetch from both production and demo environments
      // Uses lastProdTenant and lastDemoTenant from storage automatically
      const tenants = await this.fetchTenantsFromBothEnvironments(undefined, true)

      log.info(`Processing tenants from API: ${tenants.length} total tenants`)

      // Convert TenantListResponse[] to TenantInfo[] and apply filters
      const tenantInfos: TenantInfo[] = tenants.map(tenant => {
        // Normalize tenant slug to lowercase
        const normalizedSlug = tenant.tenantSlug.toLowerCase()

        // CRITICAL: Use _sourceDomain (actual API domain used) to determine tenant domain
        // This prevents domain confusion when switching between prod/demo environments
        // _sourceDomain is set when fetching and represents the actual API endpoint used
        const sourceDomain = (tenant as any)._sourceDomain
        let domain: string

        if (sourceDomain) {
          // Use actual source domain to construct tenant domain (most reliable)
          const isDemoSource = sourceDomain.includes('planhatdemo.com')
          domain = isDemoSource
            ? `ws.planhatdemo.com/${normalizedSlug}`
            : `ws.planhat.com/${normalizedSlug}`
        } else {
          // Fallback: infer from environment markers (for backwards compatibility)
          const environment: 'production' | 'demo' = (tenant as any)._environment || (tenant as any).environment || 'production'
          domain = environment === 'demo'
            ? `ws.planhatdemo.com/${normalizedSlug}`
            : `ws.planhat.com/${normalizedSlug}`
        }

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
   * Validate tenant connection by calling /myprofile with tenant slug
   * Simple check with no retries or fallbacks
   * @param tenantSlug - The tenant slug to validate
   * @param environment - The environment ('production' or 'demo')
   * @returns Promise<boolean> - true if connection succeeds, false otherwise
   */
  async validateTenantConnection(tenantSlug: string, environment: 'production' | 'demo'): Promise<boolean> {
    try {
      // Normalize tenant slug to lowercase
      const normalizedSlug = tenantSlug.toLowerCase()

      // Set the correct base URL for the environment
      const baseURL = environment === 'demo' ? 'https://api.planhatdemo.com' : 'https://api.planhat.com'
      updateHttpClient({ baseURL })

      // Try to call /myprofile with the tenant slug
      const response = await this.httpClient.get<UserProfile>(`/myprofile`, {
        tenantSlug: normalizedSlug
      })

      // If we got a response with an ID, the connection is valid
      if (response && response._id) {
        log.info(`Tenant connection validated: ${normalizedSlug} (${environment})`)
        return true
      }

      return false
    } catch (error) {
      log.debug(`Tenant connection validation failed for ${tenantSlug} (${environment})`)
      return false
    }
  }

  /**
   * Check if user has access to tenant using /myprofile validation
   * This is the preferred method for validating tenant access as it verifies
   * with the API that the current session can actually access the tenant
   *
   * @param tenantSlug - The tenant slug to validate
   * @param environment - Optional: specific environment to check. If not provided, tries production first, then demo
   * @returns Promise<boolean> - true if tenant is accessible, false otherwise
   */
  async hasAccessToTenant(tenantSlug: string, environment?: 'production' | 'demo'): Promise<boolean> {
    try {
      const normalizedSlug = tenantSlug.toLowerCase()

      // If environment specified, validate against that environment only
      if (environment) {
        return await this.validateTenantConnection(normalizedSlug, environment)
      }

      // Try production first, then demo
      const prodValid = await this.validateTenantConnection(normalizedSlug, 'production')
      if (prodValid) return true

      const demoValid = await this.validateTenantConnection(normalizedSlug, 'demo')
      return demoValid
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
   * Fetch all available tenants from specified environment
   * Uses /myprofile/tenants endpoint to get tenants user has access to
   *
   * @param tenantSlug - Tenant slug to use for the API call (required by Planhat API)
   * @param environment - Optional: specify 'production' or 'demo'. Defaults to 'production'
   * @returns Promise<TenantListResponse[]> - List of tenants with environment markers
   */
  async fetchAllAvailableTenants(tenantSlug: string, environment?: 'production' | 'demo'): Promise<TenantListResponse[]> {
    // Determine which environment to fetch from
    const env = environment || 'production'
    const baseURL = env === 'demo' ? 'https://api.planhatdemo.com' : 'https://api.planhat.com'

    try {
      log.debug(`Fetching tenants from ${env} environment using tenant slug: ${tenantSlug}`)

      const client = axios.create({
        baseURL,
        timeout: getTimeoutConfig('default'),
        headers: getStandardHeaders(),
        withCredentials: apiConfig.withCredentials
      })

      // Fetch tenants using /myprofile/tenants with required tenant slug parameter
      const response = await client.get<TenantListResponse[]>(`/myprofile/tenants?tenantSlug=${tenantSlug}`)
      const tenants = response.data || []

      // Extract domain from baseURL (e.g., 'api.planhat.com' from 'https://api.planhat.com')
      const sourceDomain = baseURL.replace(/^https?:\/\//, '')

      // Mark tenants with environment AND source domain (critical for preventing domain confusion)
      const markedTenants = tenants.map(t => ({
        ...t,
        _environment: env,
        _sourceDomain: sourceDomain,
        _verified: true
      }))

      log.info(`Fetched ${tenants.length} tenants from ${env} environment`)
      return markedTenants
    } catch (error) {
      log.warn(`Failed to fetch tenants from ${env}:`, error instanceof Error ? error.message : 'Unknown error')
      return []
    }
  }

  /**
   * Fetch tenants from production and optionally demo environments
   * Returns combined list with environment markers
   *
   * IMPORTANT: Uses separate tenant slugs for each environment
   * - Production: lastProdTenant (persistent storage) or 'planhat' fallback
   * - Demo: lastDemoTenant (in-memory, not persisted between sessions)
   *
   * @param prodTenantSlug - Slug to use for production fetch (optional, defaults to lastProdTenant or 'planhat')
   * @param includeDemoEnvironment - Whether to fetch from demo (default: false)
   * @returns Combined array of tenants from requested environments
   */
  async fetchTenantsFromBothEnvironments(
    prodTenantSlug?: string,
    includeDemoEnvironment = false
  ): Promise<TenantListResponse[]> {
    // Get production tenant from persistent storage
    const tenantStorage = await window.electron.tenant.getStorage()

    // Get demo tenant from in-memory Zustand store (not persisted between sessions)
    const { useTenantStore } = await import('../../stores/tenant.store')
    const lastDemoTenant = useTenantStore.getState().lastDemoTenant

    // Create environment key for cache (ensures prod-only and prod+demo caches don't mix)
    const envKey = includeDemoEnvironment ? 'prod+demo' : 'prod'

    // Check cache first with environment validation
    const cached = tenantListCache.get(envKey)
    if (cached) {
      log.debug(`Using cached tenant list (${cached.length} tenants) for environments: ${envKey}`)
      return cached
    }

    // Determine slugs for each environment
    const prodSlug = (prodTenantSlug || tenantStorage.lastProdTenant || 'planhat').toLowerCase()
    const demoSlug = lastDemoTenant?.toLowerCase() || ''

    log.info(`Fetching tenants from ${includeDemoEnvironment ? 'production + demo' : 'production only'} - Prod slug: ${prodSlug}${includeDemoEnvironment ? `, Demo slug: ${demoSlug || 'none'}` : ''}`)

    // Build list of environments to fetch from
    const fetchPromises = [this.fetchAllAvailableTenants(prodSlug, 'production')]

    // Only fetch from demo if requested AND we have a demo tenant slug
    if (includeDemoEnvironment && demoSlug) {
      fetchPromises.push(this.fetchAllAvailableTenants(demoSlug, 'demo'))
    } else if (includeDemoEnvironment && !demoSlug) {
      log.info('Skipping demo tenant fetch - no demo tenant available')
    }

    // Fetch from requested environments in parallel
    const results = await Promise.allSettled(fetchPromises)

    const allTenants: TenantListResponse[] = []

    // Add production tenants (always first in results array)
    if (results.length > 0) {
      const prodResult = results[0]
      if (prodResult && prodResult.status === 'fulfilled') {
        // Tenants already have _environment and _sourceDomain from fetchAllAvailableTenants
        allTenants.push(...prodResult.value)
        log.info(`Fetched ${prodResult.value.length} production tenants`)
      } else if (prodResult && prodResult.status === 'rejected') {
        log.warn('Failed to fetch production tenants:', prodResult.reason)
      }
    }

    // Add demo tenants if requested (second in results array)
    if (includeDemoEnvironment && results.length > 1) {
      const demoResult = results[1]
      if (demoResult && demoResult.status === 'fulfilled') {
        // Tenants already have _environment and _sourceDomain from fetchAllAvailableTenants
        allTenants.push(...demoResult.value)
        log.info(`Fetched ${demoResult.value.length} demo tenants`)
      } else if (demoResult && demoResult.status === 'rejected') {
        log.warn('Failed to fetch demo tenants:', demoResult.reason)
      }
    }

    log.info(`Total tenants fetched: ${allTenants.length}`)

    // Cache the result with environment key
    if (allTenants.length > 0) {
      tenantListCache.set(allTenants, undefined, envKey)
    }

    return allTenants
  }

  /**
   * Check if a tenant is active by calling /myprofile?tenantSlug=<tenant>
   * Uses cache to prevent redundant checks
   */
  async checkTenantStatus(tenantSlug: string, environment?: 'production' | 'demo'): Promise<boolean> {
    // Check cache first
    const cached = tenantStatusCache.get(tenantSlug)
    if (cached !== null) {
      return cached
    }

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
      const isActive = response !== null && response !== undefined

      // Cache the result
      tenantStatusCache.set(tenantSlug, isActive)

      return isActive
    } catch (error) {
      // Cache negative result as well (tenant not authenticated)
      tenantStatusCache.set(tenantSlug, false)
      return false
    }
  }


  /**
   * Fetch and check authentication status for all tenants
   *
   * Behavior:
   * - Production tenants: Show ALL (authenticated + unauthenticated)
   * - Demo tenants: Show ONLY authenticated
   *
   * Authentication check: Pings /myprofile?tenantSlug={slug} for each tenant
   * - Response with data = authenticated (isActive: true)
   * - No data or error = not authenticated (isActive: false)
   *
   * @param includeDemoEnvironment - Whether to check demo environment (default: false)
   * @returns Array of tenant statuses with authentication information
   */
  async fetchAllTenantsWithStatus(includeDemoEnvironment = false): Promise<TenantStatus[]> {
    try {
      // Step 1: Fetch tenants from requested environments
      // Uses lastProdTenant (persistent) and lastDemoTenant (in-memory) automatically
      const tenants = await this.fetchTenantsFromBothEnvironments(undefined, includeDemoEnvironment)

      log.info(`Checking authentication status for ${tenants.length} tenants`)

      if (tenants.length === 0) {
        log.warn('No tenants found to check status')
        return []
      }

      // Step 2: Check authentication status for each tenant by pinging /myprofile
      const statusPromises = tenants.map(async (tenant): Promise<TenantStatus> => {
        try {
          // Extract environment from tenant data
          const environment = (tenant as any)._environment as 'production' | 'demo' | undefined

          // Ping /myprofile?tenantSlug={slug} to check if authenticated
          const isActive = await this.checkTenantStatus(tenant.tenantSlug, environment)

          return {
            tenantSlug: tenant.tenantSlug,
            name: tenant.name,
            isActive,
            environment
          }
        } catch (error) {
          return {
            tenantSlug: tenant.tenantSlug,
            name: tenant.name,
            isActive: false,
            error: error instanceof Error ? error.message : 'Unknown error',
            environment: (tenant as any)._environment
          }
        }
      })

      const results = await Promise.all(statusPromises)

      // Step 3: Filter based on environment
      // Production: Show ALL (authenticated + unauthenticated)
      // Demo: Show ONLY authenticated
      const filteredResults = results.filter(tenant => {
        const environment = tenant.environment || 'production'
        return environment === 'production' || tenant.isActive
      })

      // Log summary (consolidated)
      const authenticatedCount = filteredResults.filter(t => t.isActive).length
      const unauthenticatedCount = filteredResults.filter(t => !t.isActive).length
      const prodCount = filteredResults.filter(t => (t.environment || 'production') === 'production').length
      const demoCount = filteredResults.filter(t => t.environment === 'demo').length

      log.info(`Status check complete: ${authenticatedCount} authenticated, ${unauthenticatedCount} not authenticated (${prodCount} prod, ${demoCount} demo)`)

      return filteredResults
    } catch (error) {
      log.error('Failed to fetch tenants with status:', error)
      return []
    }
  }

  /**
   * Refresh tenants for a specific environment
   * Fetches tenant list and checks authentication status
   * Returns tenant statuses with isActive indicating authentication
   *
   * @param environment - The environment to refresh ('production' or 'demo')
   * @returns Promise<TenantStatus[]> - List of tenant statuses
   */
  async refreshEnvironmentTenants(environment: 'production' | 'demo'): Promise<TenantStatus[]> {
    try {
      // CRITICAL: Use environment-appropriate tenant slug for fetching tenant lists
      // - Production: Use current tenant slug or fallback to 'planhat'
      // - Demo: Use current authenticated demo tenant (requires demo authentication first)
      let fetchSlug: string

      if (environment === 'demo') {
        // Demo tenants: Get from in-memory Zustand store (not persisted between sessions)
        const { useTenantStore } = await import('../../stores/tenant.store')
        const lastDemoTenant = useTenantStore.getState().lastDemoTenant
        fetchSlug = lastDemoTenant || ''

        if (!fetchSlug) {
          log.info('No demo tenant in memory - returning empty list (will trigger authentication)')
          return []
        }

        log.info(`Refreshing demo tenants using last demo tenant slug: ${fetchSlug}`)
      } else {
        // Production tenants: Get from persistent storage (electron-store)
        const tenantStorage = await window.electron.tenant.getStorage()
        fetchSlug = tenantStorage.lastProdTenant || 'planhat'
        log.info(`Refreshing production tenants using tenant slug: ${fetchSlug}`)
      }

      // Fetch tenants from the specific environment
      const tenants = await this.fetchAllAvailableTenants(fetchSlug, environment)

      if (tenants.length === 0) {
        log.warn(`No ${environment} tenants found`)
        return []
      }

      log.info(`Fetched ${tenants.length} ${environment} tenants, checking authentication status...`)

      // Check authentication status for each tenant
      const statusPromises = tenants.map(async (tenant): Promise<TenantStatus> => {
        try {
          const isActive = await this.checkTenantStatus(tenant.tenantSlug, environment)

          return {
            tenantSlug: tenant.tenantSlug,
            name: tenant.name,
            isActive,
            environment
          }
        } catch (error) {
          return {
            tenantSlug: tenant.tenantSlug,
            name: tenant.name,
            isActive: false,
            error: error instanceof Error ? error.message : 'Unknown error',
            environment
          }
        }
      })

      const results = await Promise.all(statusPromises)

      const activeCount = results.filter(t => t.isActive).length
      log.info(`${environment} refresh complete: ${activeCount}/${results.length} tenants authenticated`)

      return results
    } catch (error) {
      log.error(`Failed to refresh ${environment} tenants:`, error)
      throw error
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
