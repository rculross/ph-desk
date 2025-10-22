import { QueryClient, QueryCache, MutationCache } from '@tanstack/react-query'

import { useAppStore } from '../stores/app.store'
import { useAuthStore } from '../stores/auth.store'
import { logger } from '../utils/logger'

import { apiConfig, getCacheConfig, type ApiConfigQueryDefaults } from './config'
import {
  createApiError,
  isApiError,
  shouldRetryError,
  getRetryDelay,
  logError,
  getUserFriendlyMessage,
  ERROR_CODES,
  type ApiError
} from './errors'

const log = logger.api

/**
 * TanStack Query Client Configuration
 *
 * Centralized query client setup with optimized defaults for Chrome extension,
 * error handling, cache management, and performance optimizations.
 */

// Query key factory for consistent key generation
export const queryKeys = {
  // Authentication
  auth: ['auth'] as const,
  session: () => [...queryKeys.auth, 'session'] as const,

  // Tenants
  tenants: ['tenants'] as const,
  tenant: (id: string) => [...queryKeys.tenants, id] as const,
  tenantSettings: (id: string) => [...queryKeys.tenant(id), 'settings'] as const,
  tenantUsage: (id: string, period?: string) => [...queryKeys.tenant(id), 'usage', period] as const,

  // Companies
  companies: ['companies'] as const,
  company: (id: string) => [...queryKeys.companies, id] as const,
  companyHealth: (id: string) => [...queryKeys.company(id), 'health'] as const,
  companyActivity: (id: string) => [...queryKeys.company(id), 'activity'] as const,
  companyIssues: (id: string) => [...queryKeys.company(id), 'issues'] as const,
  companyIntegrations: (id: string) => [...queryKeys.company(id), 'integrations'] as const,
  companyStats: (filters?: any) => [...queryKeys.companies, 'stats', filters] as const,

  // Issues
  issues: ['issues'] as const,
  issue: (id: string) => [...queryKeys.issues, id] as const,
  issueComments: (id: string) => [...queryKeys.issue(id), 'comments'] as const,
  issueActivity: (id: string) => [...queryKeys.issue(id), 'activity'] as const,
  issueStats: (filters?: any) => [...queryKeys.issues, 'stats', filters] as const,
  myIssues: () => [...queryKeys.issues, 'mine'] as const,
  overdueIssues: () => [...queryKeys.issues, 'overdue'] as const,

  // Workflows
  workflows: ['workflows'] as const,
  workflow: (id: string) => [...queryKeys.workflows, id] as const,
  workflowExecutions: (id?: string) => [...queryKeys.workflows, 'executions', id] as const,
  workflowExecution: (id: string) => [...queryKeys.workflowExecutions(), id] as const,
  workflowAnalytics: (id: string) => [...queryKeys.workflow(id), 'analytics'] as const,
  workflowTemplates: ['workflowtemplates'] as const,

  // Search
  search: (query: string, entityTypes?: string[]) => ['search', query, entityTypes] as const,

  // Lists with filters and pagination
  list: (entity: string, filters?: any, pagination?: any) =>
    [entity, 'list', filters, pagination] as const,
  infinite: (entity: string, filters?: any) => [entity, 'infinite', filters] as const
}

// Default query options for different types of queries (from unified config)
export const queryDefaults = apiConfig.queryDefaults

/**
 * Global error handler for queries
 */
function handleQueryError(error: unknown): void {
  // Convert any error to standardized ApiError
  const apiError = isApiError(error) ? error : createApiError(error)

  // Log the error with appropriate level
  logError(apiError, 'error')

  // Don't show notifications for certain error types
  const silentErrors = [ERROR_CODES.NOT_FOUND, ERROR_CODES.UNAUTHORIZED]

  if (!silentErrors.includes(apiError.code as any)) {
    // Add error notification with user-friendly message
    useAppStore.getState().addNotification({
      type: 'error',
      title: 'Query Error',
      message: getUserFriendlyMessage(apiError),
      actions: apiError.retryable
        ? [
            {
              label: 'Retry',
              action: () => {
                // Retry logic would be handled by the query hook
              }
            }
          ]
        : undefined
    })
  }

  // Handle specific error types
  if (apiError.code === ERROR_CODES.UNAUTHORIZED || apiError.code === ERROR_CODES.TOKEN_EXPIRED) {
    // Clear auth state if unauthorized
    useAuthStore.getState().setError({
      code: ERROR_CODES.TOKEN_EXPIRED,
      message: 'Your session has expired. Please log in again.',
      retryable: false
    })
  }
}

/**
 * Global error handler for mutations
 */
function handleMutationError(error: unknown): void {
  // Convert any error to standardized ApiError
  const apiError = isApiError(error) ? error : createApiError(error)

  // Log the error
  logError(apiError, 'error')

  // Show notification for mutation errors (they're usually user-initiated)
  useAppStore.getState().addNotification({
    type: 'error',
    title: 'Operation Failed',
    message: getUserFriendlyMessage(apiError),
    actions: apiError.retryable
      ? [
          {
            label: 'Try Again',
            action: () => {
              // Retry logic would be handled by the mutation hook
            }
          }
        ]
      : undefined
  })
}

/**
 * Create and configure the query client
 */
export function createQueryClient(): QueryClient {
  return new QueryClient({
    queryCache: new QueryCache({
      onError: handleQueryError,
      onSuccess: (data, query) => {
        // Optional: Track successful queries for analytics
        log.debug('Query succeeded', { queryKey: query.queryKey.join('.') })
      }
    }),

    mutationCache: new MutationCache({
      onError: handleMutationError,
      onSuccess: (data, variables, context, mutation) => {
        // Show success notification for mutations
        if (mutation.meta?.successMessage) {
          useAppStore.getState().addNotification({
            type: 'success',
            title: 'Success',
            message: mutation.meta.successMessage as string
          })
        }
      }
    }),

    defaultOptions: {
      queries: {
        // Default configuration for all queries (from unified config)
        staleTime: apiConfig.cache.defaultStaleTime,
        gcTime: apiConfig.cache.defaultGcTime,
        refetchOnWindowFocus: apiConfig.cache.refetchOnWindowFocus,
        refetchOnMount: apiConfig.cache.refetchOnMount,
        retry: (failureCount, error) => {
          // Use centralized retry logic
          const apiError = isApiError(error) ? error : createApiError(error)
          const shouldRetry = shouldRetryError(apiError, failureCount)

          log.debug('Query retry decision', {
            code: apiError.code,
            status: apiError.status,
            attempt: failureCount + 1,
            shouldRetry,
            retryable: apiError.retryable
          })

          // Circuit breaker: Stop retries if we've had too many failures recently
          if (shouldRetry) {
            const errorCount = queryClient.getMutationCache().getAll()
              .filter(m => m.state.error && m.state.failureCount > 0).length

            if (errorCount > 10) {
              log.warn('Circuit breaker: Too many recent failures, stopping retries temporarily')
              return false
            }
          }

          return shouldRetry
        },
        retryDelay: attemptIndex => {
          // Use centralized retry delay calculation
          return getRetryDelay(attemptIndex)
        },

        // Network mode configuration for offline support
        networkMode: 'online',

        // Enable request deduplication
        refetchOnReconnect: 'always',
        refetchInterval: false,

        // Prevent duplicate requests within short time window (from unified config)
        structuralSharing: apiConfig.cache.structuralSharing,
        refetchIntervalInBackground: false
      },

      mutations: {
        // Default configuration for all mutations
        retry: (failureCount, error) => {
          // Use centralized retry logic, but be more conservative for mutations
          const apiError = isApiError(error) ? error : createApiError(error)

          // For mutations, be more conservative - only retry network errors and rate limits
          let shouldRetry = false
          if (apiError.code === ERROR_CODES.NETWORK_ERROR ||
              apiError.code === ERROR_CODES.NETWORK_TYPE_ERROR ||
              apiError.code === ERROR_CODES.TIMEOUT) {
            shouldRetry = failureCount < 2 // Max 2 retries for network errors
          } else if (apiError.code === ERROR_CODES.RATE_LIMITED) {
            shouldRetry = failureCount < 1 // Max 1 retry for rate limits
          }

          log.debug('Mutation retry decision', {
            code: apiError.code,
            status: apiError.status,
            attempt: failureCount + 1,
            shouldRetry,
            retryable: apiError.retryable
          })

          return shouldRetry
        },
        retryDelay: attemptIndex => {
          // Use centralized retry delay, but with shorter max delay for mutations
          return Math.min(getRetryDelay(attemptIndex), 5000)
        },

        networkMode: 'online'
      }
    }
  })
}

// Singleton query client instance
export const queryClient = createQueryClient()

// Query client utilities
export const queryUtils = {
  /**
   * Invalidate all queries for a specific entity type
   */
  invalidateEntity: (entityType: keyof typeof queryKeys) => {
    const key = queryKeys[entityType]
    // Only invalidate if it's a base key (not a function)
    if (typeof key !== 'function') {
      return queryClient.invalidateQueries({ queryKey: key })
    }
    return Promise.resolve()
  },

  /**
   * Remove all queries from cache for a specific entity
   */
  removeEntity: (entityType: keyof typeof queryKeys) => {
    const key = queryKeys[entityType]
    // Only remove if it's a base key (not a function)
    if (typeof key !== 'function') {
      return queryClient.removeQueries({ queryKey: key })
    }
  },

  /**
   * Prefetch data for better performance
   */
  prefetch: async (queryKey: unknown[], queryFn: () => Promise<any>, options?: any) => {
    return queryClient.prefetchQuery({
      queryKey,
      queryFn,
      ...options
    })
  },

  /**
   * Set query data manually (for optimistic updates)
   */
  setQueryData: (queryKey: unknown[], data: any) => {
    return queryClient.setQueryData(queryKey, data)
  },

  /**
   * Get cached query data
   */
  getQueryData: <T>(queryKey: unknown[]): T | undefined => {
    return queryClient.getQueryData<T>(queryKey)
  },

  /**
   * Clear all caches (useful for logout)
   */
  clear: () => {
    queryClient.clear()
  },

  /**
   * Cancel all ongoing queries (useful for component unmount)
   */
  cancelQueries: (queryKey?: unknown[]) => {
    return queryClient.cancelQueries({ queryKey })
  },

  /**
   * Get cache stats for debugging
   */
  getCacheStats: () => {
    const queryCache = queryClient.getQueryCache()
    const mutationCache = queryClient.getMutationCache()

    return {
      queries: {
        total: queryCache.getAll().length,
        fresh: queryCache.getAll().filter(q => {
          const staleTime = (q.options as any)?.staleTime ?? 0
          return q.state.dataUpdatedAt > Date.now() - staleTime
        }).length,
        stale: queryCache.getAll().filter(q => q.isStale()).length,
        fetching: queryCache.getAll().filter(q => q.state.fetchStatus === 'fetching').length
      },
      mutations: {
        total: mutationCache.getAll().length,
        pending: mutationCache.getAll().filter(m => m.state.status === 'pending').length
      }
    }
  }
}

// Performance monitoring
export const queryPerformance = {
  /**
   * Log slow queries for optimization
   */
  logSlowQueries: (threshold: number = 5000) => {
    const cache = queryClient.getQueryCache()

    cache.getAll().forEach(query => {
      const { dataUpdatedAt, errorUpdatedAt } = query.state
      const lastUpdate = Math.max(dataUpdatedAt ?? 0, errorUpdatedAt ?? 0)
      const duration = Date.now() - lastUpdate

      if (duration > threshold) {
        log.warn('Slow query detected', { queryKey: query.queryKey.join('.'), duration })
      }
    })
  },

  /**
   * Monitor cache memory usage
   */
  getMemoryUsage: () => {
    const cache = queryClient.getQueryCache()
    const queries = cache.getAll()

    let totalSize = 0
    queries.forEach(query => {
      if (query.state.data) {
        // Rough estimate of memory usage
        totalSize += JSON.stringify(query.state.data).length
      }
    })

    return {
      queries: queries.length,
      estimatedSize: totalSize,
      averageSize: queries.length > 0 ? totalSize / queries.length : 0
    }
  }
}

// Chrome extension specific optimizations
export const extensionOptimizations = {
  /**
   * Reduce cache size when memory is low
   */
  reduceCacheSize: () => {
    const cache = queryClient.getQueryCache()
    const queries = cache.getAll()

    // Remove oldest queries if cache is too large
    if (queries.length > 100) {
      const sortedQueries = queries.sort((a, b) => {
        const aTime = Math.max(a.state.dataUpdatedAt ?? 0, a.state.errorUpdatedAt ?? 0)
        const bTime = Math.max(b.state.dataUpdatedAt ?? 0, b.state.errorUpdatedAt ?? 0)
        return aTime - bTime
      })

      // Remove oldest 20% of queries
      const toRemove = sortedQueries.slice(0, Math.floor(queries.length * 0.2))
      toRemove.forEach(query => {
        cache.remove(query)
      })
    }
  },

  /**
   * Pause queries when tab is not active
   */
  pauseQueriesOnInactive: () => {
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        queryClient
          .getQueryCache()
          .getAll()
          .forEach(query => {
            query.cancel()
          })
      }
    })
  }
}

// Initialize extension-specific optimizations
if (typeof document !== 'undefined') {
  extensionOptimizations.pauseQueriesOnInactive()

  // Periodically clean up cache
  setInterval(
    () => {
      extensionOptimizations.reduceCacheSize()
    },
    10 * 60 * 1000
  ) // Every 10 minutes
}
