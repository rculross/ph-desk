import { create } from 'zustand'

import { authService } from '../api/auth'
import type { UserInfo, TenantContext, AuthError } from '../types'
import { logger } from '../utils/logger'

/**
 * Simplified Authentication Store
 *
 * Uses browser session cookies - no complex token management needed
 */

export interface AuthState {
  // Authentication state
  isAuthenticated: boolean
  isLoading: boolean
  error: AuthError | null

  // User and session data
  user: UserInfo | null
  tenantContext: TenantContext | null

  // Timestamps for activity tracking
  lastActivity: number
}

export interface AuthActions {
  // Check authentication status
  checkAuth: () => Promise<void>
  loadUser: () => Promise<void>
  loadTenant: () => Promise<void>
  clearError: () => void

  // Session management
  updateLastActivity: () => void
  logout: () => Promise<void>
  setSession: (session: import('../api/auth').AuthSession | null) => void

  // Internal state updates
  setLoading: (loading: boolean) => void
  setError: (error: AuthError | null) => void
  setUser: (user: UserInfo | null) => void
  setTenant: (tenant: TenantContext | null) => void
  setAuthenticated: (authenticated: boolean) => void
}

export type AuthStore = AuthState & AuthActions

const initialState: AuthState = {
  isAuthenticated: false,
  isLoading: false,
  error: null,
  user: null,
  tenantContext: null,
  lastActivity: Date.now()
}

/**
 * Simplified Auth Store Implementation
 */
export const useAuthStore = create<AuthStore>()((set, get) => ({
  ...initialState,

  // Check authentication status
  checkAuth: async () => {
    logger.api.debug('Checking authentication status')
    
    try {
      set({ isLoading: true, error: null })

      const isAuthenticated = await authService.isAuthenticated()
      
      logger.api.info(`Authentication check completed: ${isAuthenticated ? 'authenticated' : 'not authenticated'}`)
      set({ isAuthenticated, isLoading: false })

      if (isAuthenticated) {
        logger.api.debug('User authenticated, loading user and tenant data')
        // Also load user and tenant data
        await get().loadUser()
        await get().loadTenant()
      }
    } catch (error) {
      logger.api.error('Authentication check failed', {
        error: error instanceof Error ? error.message : 'Unknown error'
      })
      
      set({
        isLoading: false,
        error: {
          code: 'AUTH_CHECK_FAILED',
          message: error instanceof Error ? error.message : 'Authentication check failed',
          retryable: true
        }
      })
    }
  },

  // Load user information
  loadUser: async () => {
    logger.api.debug('Loading user information')
    
    try {
      const user = await authService.getCurrentUser()
      
      logger.api.info(`User loaded successfully: ${user?.email} (ID: ${user?.id})`)
      
      set({ user })
    } catch (error) {
      logger.api.warn('Failed to load user', {
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  },

  // Load tenant information
  loadTenant: async () => {
    logger.api.debug('Loading tenant context')
    
    try {
      const tenantContext = await authService.getTenantContext()
      
      logger.api.info(`Tenant context loaded successfully: ${tenantContext?.slug} (ID: ${tenantContext?.id})`)
      
      set({ tenantContext })
    } catch (error) {
      logger.api.warn('Failed to load tenant', {
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  },

  // Clear error state
  clearError: () => {
    logger.api.debug('Auth errors cleared')
    set({ error: null })
  },

  // Update last activity timestamp
  updateLastActivity: () => {
    const now = Date.now()
    const previous = get().lastActivity
    const timeSinceLastActivity = now - previous
    
    // Only log if significant time has passed to avoid spam
    if (timeSinceLastActivity > 60000) { // 1 minute
      logger.api.debug(`User activity updated - ${Math.round(timeSinceLastActivity / 1000)} seconds since last activity`)
    }
    
    set({ lastActivity: now })
  },

  // Logout (simplified - just clear state)
  logout: async () => {
    logger.api.info('User logout initiated')
    
    try {
      await authService.logout()
      
      logger.api.info('Logout successful, clearing auth state')
      set({
        ...initialState,
        lastActivity: Date.now()
      })
    } catch (error) {
      logger.api.warn('Logout error, but clearing state anyway', {
        error: error instanceof Error ? error.message : 'Unknown error'
      })
      
      // Still clear state even if logout fails
      set({
        ...initialState,
        lastActivity: Date.now()
      })
    }
  },

  // Internal state setters
  setLoading: (isLoading: boolean) => {
    logger.api.debug(`Auth loading state changed: ${isLoading ? 'loading' : 'not loading'}`)
    set({ isLoading })
  },
  setError: (error: AuthError | null) => {
    if (error) {
      logger.api.error(`Auth error set: ${error.code} - ${error.message}`)
    } else {
      logger.api.debug('Auth error cleared')
    }
    set({ error })
  },
  setUser: (user: UserInfo | null) => {
    logger.api.info(`User state updated: ${user ? `${user.email} (${user.id})` : 'no user'}`)
    set({ user })
  },
  setTenant: (tenantContext: TenantContext | null) => {
    logger.api.info(`Tenant context updated: ${tenantContext ? `${tenantContext.slug} (${tenantContext.id})` : 'no tenant'}`)
    set({ tenantContext })
  },
  setAuthenticated: (isAuthenticated: boolean) => {
    const previousState = get().isAuthenticated
    if (previousState !== isAuthenticated) {
      logger.api.info(`Authentication state changed: ${previousState} -> ${isAuthenticated}`)
    }
    set({ isAuthenticated })
  },
  setSession: (session: import('../api/auth').AuthSession | null) => {
    if (session) {
      logger.api.info(`Session updated - User: ${session.user?.email ?? 'none'}, Tenant: ${session.tenantContext?.slug ?? 'none'}, Auth: ${session.isAuthenticated}`)
      set({
        isAuthenticated: session.isAuthenticated,
        user: session.user ?? null,
        tenantContext: session.tenantContext ?? null,
        lastActivity: session.lastActivity
      })
    } else {
      logger.api.info('Session cleared')
      set({
        ...initialState,
        lastActivity: Date.now()
      })
    }
  }
}))

/**
 * Hook to get current user
 */
export const useCurrentUser = () => useAuthStore(state => state.user)

/**
 * Hook to get current tenant
 */
export const useCurrentTenant = () => useAuthStore(state => state.tenantContext)

/**
 * Hook to get authentication status
 */
export const useIsAuthenticated = () => useAuthStore(state => state.isAuthenticated)

/**
 * Hook to get authentication loading state
 */
export const useAuthLoading = () => useAuthStore(state => state.isLoading)

/**
 * Hook to get authentication error
 */
export const useAuthError = () => useAuthStore(state => state.error)
