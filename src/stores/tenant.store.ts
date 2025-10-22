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
  lastStatusFetch: null
}

// Cache duration constants
const TENANTS_CACHE_DURATION = 5 * 60 * 1000 // 5 minutes
const USAGE_CACHE_DURATION = 15 * 60 * 1000 // 15 minutes
const STATUS_CACHE_DURATION = 2 * 60 * 1000 // 2 minutes (tenant status changes less frequently)

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

            // Store the selected tenant in Electron storage for persistence
            try {
              await window.electron.storage.set({
                'last-selected-tenant': normalizedSlug
              })
            } catch (storageError) {
              // Don't fail tenant switch if storage fails
              logger.api.warn('Failed to store last selected tenant:', storageError instanceof Error ? storageError.message : 'Unknown error')
            }

            // Save last production tenant to electron-store (main process) if this is a production tenant
            const isProdTenant = !tenant.domain?.includes('planhatdemo.com')
            if (isProdTenant) {
              try {
                logger.api.info(`Saving last production tenant: ${normalizedSlug}`)
                await window.electron.auth.saveLastProdTenant(normalizedSlug)
              } catch (error) {
                logger.api.warn('Failed to save last production tenant:', error instanceof Error ? error.message : 'Unknown error')
              }
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

            const statuses = await tenantService.fetchAllTenantsWithStatus()

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
          // Only persist essential state - DON'T persist tenant statuses
          currentTenant: state.currentTenant,
          availableTenants: state.availableTenants,
          tenantSettings: state.tenantSettings,
          tenantLimits: state.tenantLimits,
          lastTenantsFetch: state.lastTenantsFetch
          // Intentionally exclude: tenantStatuses, lastStatusFetch
        }),
        onRehydrateStorage: () => (state) => {
          if (state) {
            const demoCount = state.availableTenants.filter(t => t.domain?.includes('planhatdemo.com')).length
            const prodCount = state.availableTenants.filter(t => !t.domain?.includes('planhatdemo.com')).length
            logger.api.info(`Store rehydrated from persistence: ${state.availableTenants.length} tenants (${prodCount} prod, ${demoCount} demo)`)
            if (demoCount > 0) {
              const demoTenants = state.availableTenants.filter(t => t.domain?.includes('planhatdemo.com'))
              logger.api.debug(`Rehydrated demo tenants: ${demoTenants.map(t => t.slug).join(', ')}`)
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

// Initialize store on module load
const initializeTenantStore = async () => {
  // Prevent multiple simultaneous initializations
  if (isInitializing || hasInitialized) {
    logger.api.debug('Tenant store initialization already in progress or completed, skipping')
    return
  }

  isInitializing = true

  try {
    // Step 1: Try to load last production tenant from electron-store (main process)
    let lastProdTenantSlug: string | null = null
    try {
      const storedAuth = await window.electron.auth.getStoredAuth()
      lastProdTenantSlug = storedAuth?.tenantSlug ?? null

      if (lastProdTenantSlug) {
        logger.api.info(`Tenant store initialization: Found last production tenant: ${lastProdTenantSlug}`)
      }
    } catch (error) {
      logger.api.debug('No stored auth data found:', error instanceof Error ? error.message : 'Unknown error')
    }

    // Step 2: If we have a last production tenant, validate it using /myprofile
    if (lastProdTenantSlug) {
      try {
        logger.api.info(`Tenant store initialization: Validating access to ${lastProdTenantSlug}`)

        // Use tenantService to validate tenant access
        const hasAccess = await tenantService.hasAccessToTenant(lastProdTenantSlug)

        if (hasAccess) {
          logger.api.info(`Tenant store initialization: Verified access to ${lastProdTenantSlug}`)

          // Fetch tenant list to get full tenant object
          await useTenantStore.getState().fetchAvailableTenants(undefined, true)

          // Switch to the validated tenant
          const freshState = useTenantStore.getState()
          const targetTenant = freshState.availableTenants.find(
            t => t.slug === lastProdTenantSlug || t.tenantSlug === lastProdTenantSlug
          )

          if (targetTenant) {
            await useTenantStore.getState().switchTenant(targetTenant.slug)
            hasInitialized = true
            return
          } else {
            logger.api.warn(`Tenant ${lastProdTenantSlug} not found in available tenants list`)
          }
        } else {
          logger.api.warn(`Tenant store initialization: No access to ${lastProdTenantSlug}`)
          // Clear auth since tenant is no longer accessible
          if ((window as any).authService) {
            await (window as any).authService.handleUnauthorized()
          }
        }
      } catch (error) {
        logger.api.warn(`Failed to validate tenant ${lastProdTenantSlug}:`, error instanceof Error ? error.message : 'Unknown error')
        // Clear auth on validation error
        if ((window as any).authService) {
          await (window as any).authService.handleUnauthorized()
        }
      }
    }

    // Step 3: If we get here, we don't have a valid tenant
    // User needs to authenticate
    logger.api.info('Tenant store initialization: No valid tenant found, user needs to login')

    hasInitialized = true
  } catch (error) {
    logger.api.error('Failed to initialize tenant store:', error instanceof Error ? error.message : 'Unknown error')
    hasInitialized = true // Mark as initialized even on error to prevent infinite retries
  } finally {
    isInitializing = false
  }
}

// Auto-initialize when the module loads
initializeTenantStore()

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
