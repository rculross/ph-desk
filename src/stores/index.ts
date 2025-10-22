/**
 * Stores index file
 *
 * Centralized exports for all Zustand stores used throughout the application.
 */

import { create, type StoreApi } from 'zustand'
import { createJSONStorage, persist, subscribeWithSelector } from 'zustand/middleware'

import { logger } from '../utils/logger'

// Export all stores
export * from './auth.store'
export * from './tenant.store'
export * from './app.store'

// Export common store utilities
export { persist, createJSONStorage }
export { subscribeWithSelector }

// Re-export zustand create for convenience
export { create }

/**
 * Store initialization and cleanup utilities
 */

// Reset all stores to initial state
export const resetAllStores = async () => {
  const { useAuthStore } = await import('./auth.store')
  const { useTenantStore } = await import('./tenant.store')
  const { useAppStore } = await import('./app.store')

  // Clear authentication
  await useAuthStore.getState().logout()

  // Clear tenant context
  await useTenantStore.getState().clearCurrentTenant()

  // Reset app state
  useAppStore.getState().reset()

}

// Initialize all stores
export const initializeStores = async () => {
  // These imports will trigger the initialization code in each store module
  await Promise.all([
    import('./auth.store'), 
    import('./tenant.store'), 
    import('./app.store')
  ])
}

// Store health check - verify all stores are working correctly
export const checkStoreHealth = async (): Promise<{
  auth: boolean
  tenant: boolean
  app: boolean
  overall: boolean
}> => {
  try {
    // Import stores since they should already be loaded
    const [{ useAuthStore }, { useTenantStore }, { useAppStore }] = await Promise.all([
      import('./auth.store'),
      import('./tenant.store'),
      import('./app.store')
    ])

    const authHealth = typeof useAuthStore === 'function' && typeof useAuthStore.getState === 'function'

    const tenantHealth =
      typeof useTenantStore === 'function' && typeof useTenantStore.getState === 'function'

    const appHealth = typeof useAppStore === 'function' && typeof useAppStore.getState === 'function'


    return {
      auth: authHealth,
      tenant: tenantHealth,
      app: appHealth,
      overall: authHealth && tenantHealth && appHealth
    }
  } catch (error) {
    logger.extension.error('Store health check failed', { error: error instanceof Error ? error.message : 'Unknown error' })
    return {
      auth: false,
      tenant: false,
      app: false,
      overall: false
    }
  }
}

// Get combined state for debugging
export const getDebugState = async () => {
  const { useAuthStore } = await import('./auth.store')
  const { useTenantStore } = await import('./tenant.store')
  const { useAppStore } = await import('./app.store')

  return {
    auth: {
      isAuthenticated: useAuthStore.getState().isAuthenticated,
      user: useAuthStore.getState().user,
      tenant: useAuthStore.getState().tenantContext,
      lastActivity: useAuthStore.getState().lastActivity
    },
    tenant: {
      currentTenant: useTenantStore.getState().currentTenant,
      availableTenantsCount: useTenantStore.getState().availableTenants.length,
      isLoading: useTenantStore.getState().isLoading,
      hasSettings: !!useTenantStore.getState().tenantSettings
    },
    app: {
      theme: useAppStore.getState().theme,
      isOnline: useAppStore.getState().isOnline,
      notificationsCount: useAppStore.getState().notifications.length,
      unreadNotifications: useAppStore.getState().unreadNotifications,
      activeModals: Object.keys(useAppStore.getState().modals).filter(
        key => useAppStore.getState().modals[key]?.isOpen
      )
    }
  }
}

// Export types for store composition
export type StoreApi<T> = {
  getState: () => T
  setState: (
    partial: T | Partial<T> | ((state: T) => T | Partial<T>),
    replace?: boolean | undefined
  ) => void
  subscribe: (listener: (state: T, prevState: T) => void) => () => void
  destroy: () => void
}

// Utility types for store slices
export type StoreSlice<T, E = T> = (
  set: (partial: E | Partial<E> | ((state: E) => E | Partial<E>), replace?: boolean) => void,
  get: () => E,
  api: StoreApi<E>
) => T

// Middleware composition helper
export const createStore = <T>(
  initializer: StoreSlice<T>,
  middlewares: Array<(f: unknown) => unknown> = []
) => {
  const composed = middlewares.reduce((acc, middleware) => middleware(acc), initializer as unknown)

  return create<T>()(composed as StoreSlice<T>)
}

// Store persistence configuration
export const createPersistConfig = <T>(name: string, partialize?: (state: T) => Partial<T>) => {
  return {
    name,
    storage: createJSONStorage(() => ({
      getItem: async (name: string) => {
        const result = await chrome.storage.local.get([name])
        return (result[name] as string | null) ?? null
      },
      setItem: async (name: string, value: string) => {
        await chrome.storage.local.set({ [name]: value })
      },
      removeItem: async (name: string) => {
        await chrome.storage.local.remove([name])
      }
    })),
    partialize
  }
}
