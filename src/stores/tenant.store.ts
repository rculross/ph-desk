import { create } from 'zustand'
import { persist, createJSONStorage, subscribeWithSelector } from 'zustand/middleware'

import { tenantService } from '../api/services/tenant.service'
import type { TenantInfo, TenantUsage, TenantFilters, TenantStatus } from '../api/services/tenant.service'
import { createMessage } from '../schemas/message-schemas'
import type { TenantContext, TenantSettings, TenantLimits } from '../types/api'
import { logger } from '../utils/logger'

/**
 * Tenant Store
 *
 * Manages multi-tenant state, tenant switching, and tenant-related operations
 * using Zustand with persistence and immutable updates.
 */

export interface TenantState {
  // Current tenant state
  currentTenant: TenantInfo | null
  isLoading: boolean
  error: string | null

  // Available tenants
  availableTenants: TenantInfo[]
  tenantsLoading: boolean
  tenantsError: string | null

  // Tenant status checking
  tenantStatuses: TenantStatus[]
  statusLoading: boolean
  statusError: string | null

  // Tenant data
  tenantSettings: TenantSettings | null
  tenantLimits: TenantLimits | null
  tenantUsage: TenantUsage | null

  // UI state
  isSwitchingTenant: boolean
  switchTenantError: string | null

  // Cache timestamps
  lastTenantsFetch: number | null
  lastUsageFetch: number | null
  lastStatusFetch: number | null

  // In-memory demo tenant tracking (not persisted between sessions)
  lastDemoTenant: string | null
}

export interface TenantActions {
  // Tenant management
  fetchAvailableTenants: (filters?: TenantFilters, forceRefresh?: boolean) => Promise<void>
  setCurrentTenant: (tenant: TenantInfo) => Promise<void>
  switchTenant: (tenantSlug: string) => Promise<void>
  clearCurrentTenant: () => Promise<void>

  // Tenant status checking
  fetchAllTenantStatuses: () => Promise<void>
  getTenantStatus: (tenantSlug: string) => TenantStatus | null
  getActiveTenants: () => TenantStatus[]
  getInactiveTenants: () => TenantStatus[]

  // Tenant data operations
  fetchTenantSettings: (tenantId?: string) => Promise<void>
  updateTenantSettings: (settings: Partial<TenantSettings>, tenantId?: string) => Promise<void>
  fetchTenantUsage: (tenantId?: string, period?: string) => Promise<void>

  // Tenant detection and validation
  detectTenantFromUrl: () => Promise<void>
  validateTenantAccess: (tenantSlug: string) => Promise<boolean>

  // Feature checks
  hasFeature: (feature: string) => boolean
  getTenantFeatures: () => string[]

  // In-memory demo tenant management
  setLastDemoTenant: (tenantSlug: string | null) => void
  getLastDemoTenant: () => string | null

  // Error handling and UI state
  clearError: () => void
  clearSwitchTenantError: () => void
  setLoading: (loading: boolean) => void
  setSwitchingTenant: (switching: boolean) => void

  // Cache management
  refreshTenantData: () => Promise<void>
  invalidateCache: () => void
}

export type TenantStore = TenantState & TenantActions

const initialState: TenantState = {
  currentTenant: null,
  isLoading: false,
  error: null,

  availableTenants: [],
  tenantsLoading: false,
  tenantsError: null,

  tenantStatuses: [],
  statusLoading: false,
  statusError: null,

  tenantSettings: null,
  tenantLimits: null,
  tenantUsage: null,

  isSwitchingTenant: false,
  switchTenantError: null,

  lastTenantsFetch: null,
  lastUsageFetch: null,
  lastStatusFetch: null,

  lastDemoTenant: null
}

// Cache duration constants
const TENANTS_CACHE_DURATION = 5 * 60 * 1000 // 5 minutes
const USAGE_CACHE_DURATION = 15 * 60 * 1000 // 15 minutes
// Session-long cache: no time-based expiry, only cleared on explicit refresh or app restart
const STATUS_CACHE_DURATION = Infinity // No time-based expiry

/**
 * Tenant Store Implementation
 */
export const useTenantStore = create<TenantStore>()(
  subscribeWithSelector(
    persist(
      (set, get) => ({
        ...initialState,

        // Tenant management
        fetchAvailableTenants: async (filters?: TenantFilters, forceRefresh = false) => {
          // Extract all state BEFORE any async operations
          const now = Date.now()
          const lastFetch = get().lastTenantsFetch

          // If force refresh is requested, clear persisted data and bypass all caching
          if (forceRefresh) {
            logger.api.info('Force refresh requested - clearing tenant cache')
            set({
              availableTenants: [],
              lastTenantsFetch: null
            })
          }

          // Check cache freshness (skip if force refresh requested)
          if (!forceRefresh && lastFetch && now - lastFetch < TENANTS_CACHE_DURATION) {
            const currentTenants = get().availableTenants
            const demoCount = currentTenants.filter(t => t.domain?.includes('planhatdemo.com')).length
            const prodCount = currentTenants.filter(t => !t.domain?.includes('planhatdemo.com')).length
            logger.api.info(`Using cached tenant data: ${currentTenants.length} tenants (${prodCount} prod, ${demoCount} demo)`)
            return
          }

          try {
            logger.api.debug('Fetching available tenants...')
            set({
              tenantsLoading: true,
              tenantsError: null
            })

            const tenants = await tenantService.getTenants(filters)
            logger.api.debug(`Fetched tenants: ${tenants.length} found`)

            // Debug: Log tenant environments before storing
            const demoCount = tenants.filter(t => t.domain?.includes('planhatdemo.com')).length
            const prodCount = tenants.filter(t => !t.domain?.includes('planhatdemo.com')).length
            logger.api.info(`Store: About to store ${tenants.length} tenants (${prodCount} prod, ${demoCount} demo)`)

            if (demoCount > 0) {
              const demoTenants = tenants.filter(t => t.domain?.includes('planhatdemo.com'))
              logger.api.debug(`Store: Demo tenants being stored: ${demoTenants.map(t => t.slug).join(', ')}`)
            }

            // Log before setting to help debug persistence issues
            logger.api.debug(`Store: Setting availableTenants with ${tenants.length} tenants in state`)

            // Set state with fresh tenant data (always trust API response)
            set((prevState) => {
              logger.api.info(`Store: Updating availableTenants: ${prevState.availableTenants.length} → ${tenants.length} tenants`)
              return {
                availableTenants: tenants,
                tenantsLoading: false,
                lastTenantsFetch: now
              }
            })

            // Log final state for verification
            setTimeout(() => {
              const newState = get()
              const newDemoCount = newState.availableTenants.filter(t => t.domain?.includes('planhatdemo.com')).length
              const newProdCount = newState.availableTenants.filter(t => !t.domain?.includes('planhatdemo.com')).length
              logger.api.info(`Store: Post-update verification: ${newState.availableTenants.length} tenants (${newProdCount} prod, ${newDemoCount} demo)`)
            }, 100)

          } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to fetch tenants'
            logger.api.error('Failed to fetch tenants:', error instanceof Error ? error.message : 'Unknown error')

            set({
              tenantsLoading: false,
              tenantsError: message
            })
            
            // Re-throw the error so callers can handle it
            throw error
          }
        },

        setCurrentTenant: async (tenant: TenantInfo) => {
          logger.api.info('Setting current tenant', {
            tenantId: tenant.id,
            tenantSlug: tenant.slug,
            hasSettings: !!tenant.settings,
            hasLimits: !!tenant.limits
          })
          
          try {
            await tenantService.setCurrentTenant(tenant)

            set({
              currentTenant: tenant,
              tenantSettings: tenant.settings,
              tenantLimits: tenant.limits,
              error: null
            })

            // Tenant change complete - no need to notify in desktop app
            // The state change itself propagates through Zustand subscriptions
          } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to set current tenant'

            set({
              error: message
            })

            throw error
          }
        },

        switchTenant: async (tenantSlug: string) => {
          // Normalize tenant slug to lowercase
          const normalizedSlug = tenantSlug.toLowerCase()
          const currentTenantSlug = get().currentTenant?.slug
          logger.api.info('Switching tenant', {
            from: currentTenantSlug,
            to: normalizedSlug
          })

          try {
            set({
              isSwitchingTenant: true,
              switchTenantError: null
            })

            const tenant = await tenantService.switchTenant(normalizedSlug)

            // Determine environment from tenant domain
            const environment = tenant.domain?.includes('planhatdemo.com') ? 'demo' : 'production'

            // Save tenant to appropriate storage
            try {
              if (environment === 'production') {
                // Production tenants: Save to electron-store (persistent between sessions)
                await window.electron.tenant.saveStorage(normalizedSlug)
                logger.api.info(`Saved production tenant to persistent storage: ${normalizedSlug}`)
              } else {
                // Demo tenants: Save to Zustand in-memory store (cleared on app restart)
                get().setLastDemoTenant(normalizedSlug)
                logger.api.info(`Saved demo tenant to in-memory storage: ${normalizedSlug}`)
              }
            } catch (error) {
              logger.api.warn('Failed to save tenant storage:', error instanceof Error ? error.message : 'Unknown error')
            }

            // Single set() call to avoid proxy lifecycle issues
            set({
              currentTenant: tenant,
              tenantSettings: tenant.settings,
              tenantLimits: tenant.limits,
              isSwitchingTenant: false,

              // Clear ALL state when switching tenants (important!)
              tenantUsage: null,
              tenantStatuses: [],
              lastUsageFetch: null,
              lastStatusFetch: null,
              statusError: null
            })
          } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to switch tenant'

            set({
              isSwitchingTenant: false,
              switchTenantError: message
            })

            throw error
          }
        },

        clearCurrentTenant: async () => {
          // Perform async operation FIRST to avoid proxy issues
          try {
            await tenantService.clearCurrentTenant()
          } catch (error) {
            logger.api.error('Failed to clear current tenant in service:', error instanceof Error ? error.message : 'Unknown error')
            // Continue to clear local state even if service fails
          }

          // Clear state after async operation completes
          set({
            currentTenant: null,
            tenantSettings: null,
            tenantLimits: null,
            tenantUsage: null,
            tenantStatuses: [],
            lastUsageFetch: null,
            lastStatusFetch: null,
            statusError: null,
            error: null
          })
        },

        // Tenant status checking
        fetchAllTenantStatuses: async () => {
          // Extract all state BEFORE any async operations
          const now = Date.now()
          const lastFetch = get().lastStatusFetch

          // Check cache freshness
          if (lastFetch && now - lastFetch < STATUS_CACHE_DURATION) {
            return
          }

          try {
            set({
              statusLoading: true,
              statusError: null
            })

            // Only fetch production environment by default
            const statuses = await tenantService.fetchAllTenantsWithStatus(false)

            set({
              tenantStatuses: statuses,
              statusLoading: false,
              lastStatusFetch: now
            })
          } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to fetch tenant statuses'

            set({
              statusLoading: false,
              statusError: message
            })
          }
        },

        getTenantStatus: (tenantSlug: string): TenantStatus | null => {
          const state = get()
          return state.tenantStatuses.find(status => status.tenantSlug === tenantSlug) ?? null
        },

        getActiveTenants: (): TenantStatus[] => {
          const state = get()
          return state.tenantStatuses.filter(status => status.isActive)
        },

        getInactiveTenants: (): TenantStatus[] => {
          const state = get()
          return state.tenantStatuses.filter(status => !status.isActive)
        },

        // Tenant data operations
        fetchTenantSettings: async (tenantId?: string) => {
          try {
            // Extract state BEFORE any async operations
            const currentTenant = get().currentTenant
            const id = tenantId ?? currentTenant?.id
            if (!id) {
              logger.api.error('Cannot fetch tenant settings - no tenant ID provided')
              throw new Error('No tenant ID provided')
            }

            logger.api.debug('Fetching tenant settings for ID:', id)
            const tenant = await tenantService.getTenantById(id)
            if (tenant) {
              set(state => {
                const updatedState = {
                  ...state,
                  tenantSettings: tenant.settings
                }
                
                if (state.currentTenant && state.currentTenant.id === id) {
                  updatedState.currentTenant = tenant
                }
                
                return updatedState
              })
            }
          } catch (error) {
            const message =
              error instanceof Error ? error.message : 'Failed to fetch tenant settings'

            set({
              error: message
            })
          }
        },

        updateTenantSettings: async (settings: Partial<TenantSettings>, tenantId?: string) => {
          logger.api.info('Updating tenant settings', {
            tenantId,
            settingKeys: Object.keys(settings)
          })
          
          try {
            set({
              isLoading: true,
              error: null
            })

            const tenant = await tenantService.updateTenantSettings(settings, tenantId)

            set(state => {
              const updatedState = {
                ...state,
                tenantSettings: tenant.settings,
                isLoading: false
              }
              
              if (state.currentTenant && state.currentTenant.id === tenant.id) {
                updatedState.currentTenant = tenant
              }
              
              return updatedState
            })
          } catch (error) {
            const message =
              error instanceof Error ? error.message : 'Failed to update tenant settings'

            set({
              isLoading: false,
              error: message
            })

            throw error
          }
        },

        fetchTenantUsage: async (tenantId?: string, period?: string) => {
          // Extract all state BEFORE any async operations
          const now = Date.now()
          const lastFetch = get().lastUsageFetch

          // Check cache freshness
          if (lastFetch && now - lastFetch < USAGE_CACHE_DURATION && !period) {
            return
          }

          try {
            const usage = await tenantService.getTenantUsage(tenantId, period)

            set({
              tenantUsage: usage,
              lastUsageFetch: now
            })
          } catch (error) {
            logger.api.error('Failed to fetch tenant usage:', error instanceof Error ? error.message : 'Unknown error')
          }
        },

        // Tenant detection and validation
        detectTenantFromUrl: async () => {
          try {
            set({
              isLoading: true
            })

            const tenant = await tenantService.detectTenantFromUrl()

            if (tenant) {
              // Call setCurrentTenant directly without getting it from store
              await useTenantStore.getState().setCurrentTenant(tenant)
            }

            set({
              isLoading: false
            })
          } catch (error) {
            logger.api.error('Failed to detect tenant from URL:', error instanceof Error ? error.message : 'Unknown error')

            set({
              isLoading: false
            })
          }
        },

        validateTenantAccess: async (tenantSlug: string): Promise<boolean> => {
          try {
            return await tenantService.hasAccessToTenant(tenantSlug)
          } catch (error) {
            logger.api.error('Failed to validate tenant access:', error instanceof Error ? error.message : 'Unknown error')
            return false
          }
        },

        // Feature checks
        hasFeature: (feature: string): boolean => {
          const state = get()
          const hasFeature = state.currentTenant?.features.includes(feature) ?? false
          
          logger.api.debug('Feature check', {
            feature,
            hasFeature,
            tenantSlug: state.currentTenant?.slug
          })
          
          return hasFeature
        },

        getTenantFeatures: (): string[] => {
          const state = get()
          return state.currentTenant?.features ?? []
        },

        // In-memory demo tenant management
        setLastDemoTenant: (tenantSlug: string | null) => {
          logger.api.debug('Setting last demo tenant (in-memory):', tenantSlug)
          set({ lastDemoTenant: tenantSlug })
        },

        getLastDemoTenant: (): string | null => {
          const state = get()
          return state.lastDemoTenant
        },

        // Error handling and UI state
        clearError: () => {
          logger.api.debug('Tenant store errors cleared')
          set({
            error: null,
            tenantsError: null,
            statusError: null
          })
        },

        clearSwitchTenantError: () => {
          logger.api.debug('Switch tenant error cleared')
          set({
            switchTenantError: null
          })
        },

        setLoading: (loading: boolean) => {
          set({
            isLoading: loading
          })
        },

        setSwitchingTenant: (switching: boolean) => {
          set({
            isSwitchingTenant: switching
          })
        },

        // Cache management
        refreshTenantData: async () => {
          // Extract all needed data BEFORE any async operations
          const currentTenant = get().currentTenant

          if (currentTenant) {
            const tenantId = currentTenant.id
            
            // Force refresh by clearing cache timestamps FIRST
            set({
              lastTenantsFetch: null,
              lastUsageFetch: null
            })

            // Get fresh store instance after state update to avoid proxy issues
            const storeInstance = useTenantStore.getState()

            // Use fresh store references to avoid proxy issues
            await Promise.all([
              storeInstance.fetchAvailableTenants(),
              storeInstance.fetchTenantSettings(tenantId),
              storeInstance.fetchTenantUsage(tenantId)
            ])
          }
        },

        invalidateCache: () => {
          logger.api.info('Tenant cache invalidated')
          set({
            lastTenantsFetch: null,
            lastUsageFetch: null,
            lastStatusFetch: null
          })
        }
      }),
      {
        name: 'tenant-store',
        storage: createJSONStorage(() => ({
          getItem: async (name: string) => {
            const result = await window.electron.storage.get([name])
            return result[name] ?? null
          },
          setItem: async (name: string, value: string) => {
            await window.electron.storage.set({ [name]: value })
          },
          removeItem: async (name: string) => {
            await window.electron.storage.remove([name])
          }
        })),
        partialize: state => ({
          // Only persist essential state - DON'T persist tenant statuses or demo tenants
          currentTenant: state.currentTenant,
          // CRITICAL: Only persist production tenants (demo tenants cleared on app restart)
          availableTenants: state.availableTenants.filter(t =>
            !t.domain?.includes('planhatdemo.com')
          ),
          tenantSettings: state.tenantSettings,
          tenantLimits: state.tenantLimits,
          lastTenantsFetch: state.lastTenantsFetch
          // Intentionally exclude: tenantStatuses, lastStatusFetch, demo tenants
        }),
        onRehydrateStorage: () => (state) => {
          if (state) {
            const demoCount = state.availableTenants.filter(t => t.domain?.includes('planhatdemo.com')).length
            const prodCount = state.availableTenants.filter(t => !t.domain?.includes('planhatdemo.com')).length
            logger.api.info(`Store rehydrated from persistence: ${state.availableTenants.length} tenants (${prodCount} prod, ${demoCount} demo - should be 0)`)

            // CRITICAL: Demo tenants should NEVER be in rehydrated state (filtered by partialize)
            if (demoCount > 0) {
              logger.api.warn(`WARNING: ${demoCount} demo tenants found in rehydrated state - this should not happen! Filtering them out now.`)
              state.availableTenants = state.availableTenants.filter(t => !t.domain?.includes('planhatdemo.com'))
            }

            // CRITICAL FIX: Clear stale availableTenants if no currentTenant
            // This prevents useTenantSelector from trying to fetch statuses with stale data
            if (!state.currentTenant && state.availableTenants.length > 0) {
              logger.api.info('Clearing stale availableTenants - no current tenant (not properly initialized)')
              state.availableTenants = []
              state.lastTenantsFetch = null
              return
            }

            // Log domains to help identify if this is stale data
            if (state.availableTenants.length > 0) {
              const domains = [...new Set(state.availableTenants.map(t => t.domain).filter(d => d))]
              logger.api.debug(`Rehydrated tenant domains: ${domains.join(', ')}`)
            }
          }
        }
      }
    )
  )
)

// Selectors for common use cases
export const useActiveTenant = () => useTenantStore(state => state.currentTenant)
export const useAvailableTenants = () => useTenantStore(state => state.availableTenants)
export const useTenantLoading = () =>
  useTenantStore(state => state.isLoading || state.tenantsLoading)
export const useTenantError = () => useTenantStore(state => state.error ?? state.tenantsError)
export const useTenantFeatures = () => useTenantStore(state => state.getTenantFeatures())
export const useTenantSettings = () => useTenantStore(state => state.tenantSettings)
export const useTenantUsage = () => useTenantStore(state => state.tenantUsage)

// Tenant status selectors
export const useTenantStatuses = () => useTenantStore(state => state.tenantStatuses)
export const useTenantStatusLoading = () => useTenantStore(state => state.statusLoading)
export const useTenantStatusError = () => useTenantStore(state => state.statusError)
export const useActiveTenants = () => useTenantStore(state => state.getActiveTenants())
export const useInactiveTenants = () => useTenantStore(state => state.getInactiveTenants())
export const useTenantStatus = (tenantSlug: string) => 
  useTenantStore(state => state.getTenantStatus(tenantSlug))

export const useHasFeature = (feature: string) => useTenantStore(state => state.hasFeature(feature))

export const useTenantSwitch = () =>
  useTenantStore(state => ({
    isSwitching: state.isSwitchingTenant,
    error: state.switchTenantError,
    switchTenant: state.switchTenant,
    clearError: state.clearSwitchTenantError
  }))

export const useTenantStatusActions = () =>
  useTenantStore(state => ({
    fetchAllTenantStatuses: state.fetchAllTenantStatuses,
    getTenantStatus: state.getTenantStatus,
    getActiveTenants: state.getActiveTenants,
    getInactiveTenants: state.getInactiveTenants,
    loading: state.statusLoading,
    error: state.statusError
  }))

// Track initialization state to prevent multiple simultaneous initializations
let isInitializing = false
let hasInitialized = false

/**
 * Reset initialization flags and reinitialize tenant store
 * Called after successful login to fetch tenants with new auth session
 */
export const reinitializeTenantStore = async () => {
  logger.api.info('=== Reinitializing Tenant Store After Login ===')

  // Reset initialization flags
  hasInitialized = false
  isInitializing = false

  // Run initialization with authenticated session
  await initializeTenantStore()
}

/**
 * Initialize tenant store - called by API layer after HTTP client is ready
 *
 * SIMPLIFIED FLOW (trusts auth service validation):
 * 0. Guard: Check if already initialized - return early if true
 * 1. Guard: Check if authenticated - if not, skip (will init after login)
 * 2. Get lastTenantSlug from electron-store (via IPC)
 * 3. If lastTenantSlug exists:
 *    a. Trust that auth service already validated it
 *    b. Fetch tenants, switch to last tenant, DONE
 * 4. If no lastTenantSlug, try 'planhat' fallback:
 *    a. Fetch tenants, try to switch to 'planhat', DONE
 * 5. If both failed: Show home screen with tenant dropdown
 *
 * NOTE: No redundant validation - auth service already validated tenant access during login
 */
export const initializeTenantStore = async () => {
  // GUARD 1: Prevent duplicate initialization
  if (isInitializing || hasInitialized) {
    logger.api.debug('Tenant store initialization already in progress or completed, skipping')
    return
  }

  // GUARD 2: Check authentication before initializing
  const { authService } = await import('../services/auth.service')
  const isAuthenticated = authService.isAuthenticated()

  if (!isAuthenticated) {
    logger.api.info('=== Tenant Store Initialization Skipped (not authenticated) ===')
    logger.api.info('Tenant store will initialize after successful login')
    hasInitialized = true
    return
  }

  isInitializing = true
  logger.api.info('=== Tenant Store Initialization Started ===')

  try {
    // Helper function to process and store tenant data
    const processTenants = (tenantsWithStatus: any[]) => {
      useTenantStore.setState({
        availableTenants: tenantsWithStatus.map(t => {
          const normalizedSlug = t.tenantSlug.toLowerCase()

          // CRITICAL: Use _sourceDomain (actual API domain used) to determine tenant domain
          // This prevents domain confusion when switching between prod/demo environments
          // _sourceDomain is set when fetching and represents the actual API endpoint used
          const sourceDomain = (t as any)._sourceDomain
          let domain: string

          if (sourceDomain) {
            // Use actual source domain to construct tenant domain (most reliable)
            const isDemoSource = sourceDomain.includes('planhatdemo.com')
            domain = isDemoSource
              ? `ws.planhatdemo.com/${normalizedSlug}`
              : `ws.planhat.com/${normalizedSlug}`
          } else {
            // Fallback: infer from environment markers (for backwards compatibility)
            const environment = (t as any).environment || (t as any)._environment || 'production'
            domain = environment === 'demo'
              ? `ws.planhatdemo.com/${normalizedSlug}`
              : `ws.planhat.com/${normalizedSlug}`
          }

          return {
            id: t.tenantSlug,
            slug: normalizedSlug,
            name: t.name,
            tenantSlug: normalizedSlug,
            verified: true,
            domain,
            logo: undefined,
            settings: {} as any,
            features: [],
            limits: {} as any,
            billing: {} as any,
            isActive: t.isActive,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            subscription: {} as any,
            members: 0,
            lastActivity: new Date().toISOString()
          }
        }),
        tenantStatuses: tenantsWithStatus,
        lastTenantsFetch: Date.now(),
        lastStatusFetch: Date.now()
      })
    }

    // Get last production tenant from persistent storage
    // NOTE: Demo tenants are NOT persisted and require re-authentication each session
    let tenantStorage: any = null
    try {
      tenantStorage = await window.electron.tenant.getStorage()
      logger.api.info(`Retrieved tenant storage - Prod: ${tenantStorage?.lastProdTenant || 'none'}`)
    } catch (error) {
      logger.api.debug('Failed to retrieve tenant storage')
    }

    // STEP 1: Try last production tenant if available
    if (tenantStorage?.lastProdTenant) {
      const lastProdTenant = tenantStorage.lastProdTenant
      logger.api.info(`Step 1: Using last production tenant (already validated by auth): ${lastProdTenant}`)

      try {
        // Fetch and check all tenants (production only, no demo)
        const tenantsWithStatus = await tenantService.fetchAllTenantsWithStatus(false)

        if (tenantsWithStatus.length > 0) {
          processTenants(tenantsWithStatus)

          // Find and switch to the last tenant
          const targetTenant = useTenantStore.getState().availableTenants.find(
            t => t.slug === lastProdTenant.toLowerCase()
          )

          if (targetTenant) {
            await useTenantStore.getState().switchTenant(targetTenant.slug)
            logger.api.info(`=== Initialization Complete (last production tenant: ${lastProdTenant}) ===`)
            hasInitialized = true
            return
          } else {
            logger.api.warn(`Step 1: Last tenant '${lastProdTenant}' not found in tenant list, trying fallback`)
          }
        }
      } catch (error) {
        logger.api.warn(`Step 1: Failed to switch to last tenant '${lastProdTenant}', trying fallback:`, error instanceof Error ? error.message : 'Unknown error')
      }
    }

    // STEP 2: Fallback to production default tenant
    // Note: Demo tenants require explicit authentication, no fallback
    const environment = authService.getEnvironment()

    if (environment === 'production') {
      const fallbackTenant = 'planhat'
      logger.api.info(`Step 2: Trying fallback tenant: ${fallbackTenant} (${environment})`)

      try {
        // Fetch and check all tenants (production only, no demo)
        const tenantsWithStatus = await tenantService.fetchAllTenantsWithStatus(false)

        if (tenantsWithStatus.length > 0) {
          processTenants(tenantsWithStatus)

          // Try to switch to fallback tenant
          const fallbackTenantData = useTenantStore.getState().availableTenants.find(
            t => t.slug === fallbackTenant
          )

          if (fallbackTenantData) {
            await useTenantStore.getState().switchTenant(fallbackTenant)
            logger.api.info(`=== Initialization Complete (fallback tenant: ${fallbackTenant}) ===`)
            hasInitialized = true
            return
          } else {
            logger.api.warn(`Step 2: Fallback tenant '${fallbackTenant}' not found in tenant list`)
          }
        }
      } catch (error) {
        logger.api.warn(`Step 2: Failed to fetch tenants or switch to ${fallbackTenant}:`, error instanceof Error ? error.message : 'Unknown error')
      }
    } else {
      logger.api.info(`Step 2: Demo environment detected, skipping fallback (demo tenants require explicit authentication)`)
    }

    // STEP 3: No valid tenant found, clear storage and show home
    logger.api.info('Step 3: No valid tenant connection, clearing storage')

    try {
      await window.electron.tenant.clearStorage()
    } catch (error) {
      // Ignore storage clear errors
    }

    logger.api.info('=== Initialization Complete (no tenant connected - showing home) ===')
    hasInitialized = true

  } catch (error) {
    logger.api.error('Tenant store initialization error:', error instanceof Error ? error.message : 'Unknown error')
    hasInitialized = true
  } finally {
    isInitializing = false
  }
}

// NOTE: Initialization is deferred until after HTTP client is ready
// See api/index.ts utils.initialize() for initialization sequence

// Subscribe to auth changes to handle tenant context
if (typeof window !== 'undefined') {
  // Import auth store to subscribe to changes
  import('./auth.store').then(({ useAuthStore }) => {
    let previousIsAuthenticated = useAuthStore.getState().isAuthenticated

    useAuthStore.subscribe(state => {
      const isAuthenticated = state.isAuthenticated

      if (isAuthenticated && !previousIsAuthenticated) {
        // User just logged in, reset initialization flag and initialize tenant data
        hasInitialized = false
        initializeTenantStore()
      } else if (!isAuthenticated && previousIsAuthenticated) {
        // User logged out, clear tenant data synchronously
        // Clear state directly without async operation to avoid proxy issues
        useTenantStore.setState({
          currentTenant: null,
          tenantSettings: null,
          tenantLimits: null,
          tenantUsage: null,
          tenantStatuses: [],
          lastUsageFetch: null,
          lastStatusFetch: null,
          statusError: null,
          error: null,
          availableTenants: [],
          lastTenantsFetch: null
        })
        
        // Clear service data in the background (don't await)
        tenantService.clearCurrentTenant().catch(error => {
          logger.api.error('Failed to clear tenant service on logout:', error instanceof Error ? error.message : 'Unknown error')
        })
      }

      previousIsAuthenticated = isAuthenticated
    })
  })
}

// Export store type for testing
export type TenantStoreType = typeof useTenantStore
