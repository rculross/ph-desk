import React from 'react'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

import { useAuthStore } from '../../stores/auth.store'
import { useTenantStore } from '../../stores/tenant.store'
import type { TenantContext, AuthError } from '../../types'
import { logger } from '../../utils/logger'
import { authService, type AuthSession } from '../auth'
import { getEntityCacheConfig } from '../config'
import { queryKeys, queryDefaults } from '../query-client'

const log = logger.api

/**
 * Authentication Query Hooks
 *
 * Custom hooks for authentication-related data fetching and mutations
 * using TanStack Query with optimized caching and error handling.
 */

// Query hooks
export function useAuthSession() {
  const { isAuthenticated } = useAuthStore()
  const currentTenant = useTenantStore(state => state.currentTenant)

  return useQuery({
    queryKey: queryKeys.session(),
    queryFn: async () => {
      const startTime = performance.now()
      log.debug('Fetching authentication session')

      try {
        const result = await authService.getCurrentSession()
        const endTime = performance.now()

        log.debug('Authentication session fetched successfully', {
          duration: Math.round(endTime - startTime),
          isAuthenticated: result.isAuthenticated,
          userId: result.user?.id,
          tenantId: result.tenantContext?.id,
          lastActivity: result.lastActivity ? new Date(result.lastActivity).toISOString() : undefined
        })

        return result
      } catch (error) {
        const endTime = performance.now()
        log.error('Failed to fetch authentication session', {
          duration: Math.round(endTime - startTime),
          error: error instanceof Error ? error.message : 'Unknown error'
        })
        throw error
      }
    },
    // CRITICAL FIX: Only fetch session when BOTH authenticated AND tenant selected
    // /myprofile and /tenant endpoints require a tenant slug parameter
    enabled: isAuthenticated && currentTenant !== null,
    ...queryDefaults.realtime,
    ...getEntityCacheConfig('session'), // Use unified config for session cache timing
    select: (data: AuthSession) => {
      const isValid = data.isAuthenticated && !isSessionExpired(data)
      log.debug('Session validation result', {
        isAuthenticated: data.isAuthenticated,
        isValid,
        userId: data.user?.id
      })
      return {
        ...data,
        isValid
      }
    }
  })
}

export function useCurrentUser() {
  const { isAuthenticated } = useAuthStore()
  const currentTenant = useTenantStore(state => state.currentTenant)

  return useQuery({
    queryKey: [...queryKeys.auth, 'user'],
    queryFn: async () => {
      const startTime = performance.now()
      log.debug('Fetching current user profile from session')

      try {
        const session = await authService.getCurrentSession()
        const endTime = performance.now()

        log.debug('Current user profile obtained from session', {
          duration: Math.round(endTime - startTime),
          userId: session.user?.id,
          userEmail: session.user?.email ? `${session.user.email.substring(0, 3)}***` : undefined,
          role: session.user?.role,
          permissionCount: session.user?.permissions.length ?? 0
        })

        return session.user
      } catch (error) {
        const endTime = performance.now()
        log.error('Failed to fetch current user from session', {
          duration: Math.round(endTime - startTime),
          error: error instanceof Error ? error.message : 'Unknown error'
        })
        throw error
      }
    },
    // CRITICAL FIX: Only fetch user when BOTH authenticated AND tenant selected
    // getCurrentSession() calls /myprofile and /tenant which require a tenant slug
    enabled: isAuthenticated && currentTenant !== null,
    ...queryDefaults.standard,
    ...getEntityCacheConfig('currentUser') // Use unified config for current user cache timing
  })
}

export function useSessionValidity() {
  const { isAuthenticated } = useAuthStore()
  const currentTenant = useTenantStore(state => state.currentTenant)

  return useQuery({
    queryKey: [...queryKeys.auth, 'validity'],
    queryFn: () => authService.isAuthenticated(),
    // CRITICAL FIX: Only fetch validity when BOTH authenticated AND tenant selected
    // isAuthenticated() may call APIs that require a tenant slug
    enabled: isAuthenticated && currentTenant !== null,
    ...queryDefaults.realtime,
    ...getEntityCacheConfig('sessionValidity'), // Use unified config for session validity cache timing
    refetchIntervalInBackground: false
  })
}

// Mutation hooks
export function useAuthenticate() {
  const queryClient = useQueryClient()
  const { setSession, setLoading, setError } = useAuthStore()

  return useMutation({
    mutationFn: async ({ apiKey, tenantSlug }: { apiKey: string; tenantSlug?: string }) => {
      const startTime = performance.now()
      log.debug('Starting authentication process', { 
        hasApiKey: !!apiKey,
        tenantSlug,
        apiKeyLength: apiKey.length ?? 0
      })
      
      try {
        const result = await authService.authenticate(apiKey, tenantSlug)
        const endTime = performance.now()
        
        log.info('Authentication completed successfully', {
          duration: Math.round(endTime - startTime),
          userId: result.user?.id,
          tenantId: result.tenantContext?.id,
          tenantSlug: result.tenantContext?.slug
        })
        
        return result
      } catch (error) {
        const endTime = performance.now()
        log.error('Authentication failed', {
          duration: Math.round(endTime - startTime),
          tenantSlug,
          error: error instanceof Error ? error.message : 'Unknown error',
          errorCode: (error as any)?.code
        })
        throw error
      }
    },
    onMutate: () => {
      log.debug('Setting authentication loading state')
      setLoading(true)
      setError(null)
    },
    onSuccess: (session: AuthSession) => {
      log.debug('Authentication success - updating caches and store', {
        userId: session.user?.id,
        tenantId: session.tenantContext?.id
      })
      
      // Update store state
      setSession(session)
      setLoading(false)

      // Update query cache
      queryClient.setQueryData(queryKeys.session(), session)
      queryClient.setQueryData([...queryKeys.auth, 'user'], session.user)
      queryClient.setQueryData([...queryKeys.auth, 'validity'], true)

      // Invalidate related queries
      void queryClient.invalidateQueries({ queryKey: queryKeys.tenants })
    },
    onError: (error: AuthError) => {
      log.warn('Authentication error - clearing cache and updating store', {
        errorCode: error.code,
        retryable: error.retryable
      })
      
      setError(error)
      setLoading(false)

      // Clear invalid session data from cache
      queryClient.removeQueries({ queryKey: queryKeys.auth })
    },
    meta: {
      successMessage: 'Successfully authenticated'
    }
  })
}

export function useLogout() {
  const queryClient = useQueryClient()
  const { setSession, setLoading } = useAuthStore()

  return useMutation({
    mutationFn: async () => {
      const startTime = performance.now()
      log.debug('Starting logout process')
      
      try {
        const result = await authService.clearSession()
        const endTime = performance.now()
        
        log.info('Logout completed successfully', {
          duration: Math.round(endTime - startTime)
        })
        
        return result
      } catch (error) {
        const endTime = performance.now()
        log.warn('Logout process encountered error but will continue with cleanup', {
          duration: Math.round(endTime - startTime),
          error: error instanceof Error ? error.message : 'Unknown error'
        })
        // Don't throw - we'll clean up anyway
        return null
      }
    },
    onMutate: () => {
      log.debug('Setting logout loading state')
      setLoading(true)
    },
    onSuccess: () => {
      log.debug('Logout success - clearing all caches and store state')
      
      // Clear store state
      setSession(null)
      setLoading(false)

      // Clear all cached data
      queryClient.clear()
    },
    onError: error => {
      log.error('Logout error - forcing cleanup anyway', { 
        error: error instanceof Error ? error.message : error 
      })
      setLoading(false)

      // Force clear even if logout failed
      setSession(null)
      queryClient.clear()
    }
  })
}

export function useRefreshSession() {
  const queryClient = useQueryClient()
  const { setSession, setLoading, setError } = useAuthStore()

  return useMutation({
    mutationFn: async () => {
      const startTime = performance.now()
      log.debug('Starting session refresh')
      
      try {
        const result = await authService.refreshAuthentication()
        const endTime = performance.now()
        
        log.info('Session refresh completed successfully', {
          duration: Math.round(endTime - startTime),
          userId: result.user?.id,
          newExpiresAt: new Date(result.expiresAt).toISOString()
        })
        
        return result
      } catch (error) {
        const endTime = performance.now()
        log.error('Session refresh failed - user will need to re-authenticate', {
          duration: Math.round(endTime - startTime),
          error: error instanceof Error ? error.message : 'Unknown error',
          errorCode: (error as any)?.code
        })
        throw error
      }
    },
    onMutate: () => {
      log.debug('Setting session refresh loading state')
      setLoading(true)
      setError(null)
    },
    onSuccess: (session: AuthSession) => {
      log.debug('Session refresh success - updating cache and store')
      
      setSession(session)
      setLoading(false)

      // Update query cache
      queryClient.setQueryData(queryKeys.session(), session)
      void queryClient.invalidateQueries({ queryKey: queryKeys.auth })
    },
    onError: (error: AuthError) => {
      log.warn('Session refresh error - clearing session data', {
        errorCode: error.code,
        retryable: error.retryable
      })
      
      setError(error)
      setLoading(false)

      // If refresh fails, user needs to re-authenticate
      setSession(null)
      queryClient.removeQueries({ queryKey: queryKeys.auth })
    }
  })
}

export function useSwitchTenant() {
  const queryClient = useQueryClient()
  const { tenantContext, setTenant } = useAuthStore()

  return useMutation({
    mutationFn: (tenantSlug: string) => authService.switchTenant(tenantSlug),
    onSuccess: (newTenantContext: TenantContext) => {
      // Update tenant context
      setTenant(newTenantContext)

      // Invalidate tenant-specific queries
      void queryClient.invalidateQueries({ queryKey: queryKeys.tenants })
      void queryClient.invalidateQueries({ queryKey: queryKeys.companies })
      void queryClient.invalidateQueries({ queryKey: queryKeys.issues })
      void queryClient.invalidateQueries({ queryKey: queryKeys.workflows })
    },
    meta: {
      successMessage: 'Switched tenant successfully'
    }
  })
}

export function useUpdateActivity() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: () => authService.updateSessionActivity(),
    onSuccess: () => {
      // Update session cache with new activity timestamp
      const currentSession = queryClient.getQueryData<AuthSession>(queryKeys.session())
      if (currentSession) {
        queryClient.setQueryData(queryKeys.session(), {
          ...currentSession,
          lastActivity: Date.now()
        })
      }
    }
  })
}

// Utility functions
function isSessionExpired(session: AuthSession): boolean {
  const now = Date.now()
  const SESSION_TIMEOUT = 24 * 60 * 60 * 1000 // 24 hours

  // Check if session token is expired
  if (session.expiresAt && session.expiresAt < now) {
    return true
  }

  // Check if session has been inactive too long
  if (now - session.lastActivity > SESSION_TIMEOUT) {
    return true
  }

  return false
}

// Custom hooks for derived state
export function useAuthStatus() {
  const sessionQuery = useAuthSession()
  const validityQuery = useSessionValidity()

  return {
    isAuthenticated: sessionQuery.data?.isAuthenticated ?? false,
    isLoading: sessionQuery.isLoading || validityQuery.isLoading,
    isValid: sessionQuery.data?.isValid ?? false,
    hasError: sessionQuery.isError || validityQuery.isError,
    error: sessionQuery.error ?? validityQuery.error,
    session: sessionQuery.data,
    refetch: () => {
      void sessionQuery.refetch()
      void validityQuery.refetch()
    }
  }
}

export function useUserPermissions() {
  const userQuery = useCurrentUser()

  return {
    permissions: userQuery.data?.permissions ?? [],
    roles: userQuery.data?.role ? [userQuery.data.role] : [], // Convert single role to array
    hasPermission: (permission: string) => {
      return userQuery.data?.permissions.includes(permission) ?? false
    },
    hasRole: (role: string) => {
      return (userQuery.data?.role === role) ?? false // Check single role
    },
    isLoading: userQuery.isLoading
  }
}

// Auto-refresh session validity
export function useAutoRefreshSession() {
  const refreshMutation = useRefreshSession()
  const { isAuthenticated } = useAuthStore()

  // Set up automatic session refresh
  React.useEffect(() => {
    if (!isAuthenticated) return

    const interval = setInterval(
      () => {
        // Only refresh if not currently refreshing
        if (!refreshMutation.isPending) {
          refreshMutation.mutate()
        }
      },
      30 * 60 * 1000
    ) // Every 30 minutes

    return () => clearInterval(interval)
  }, [isAuthenticated, refreshMutation])

  return refreshMutation
}
