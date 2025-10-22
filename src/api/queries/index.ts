/**
 * Query hooks index file
 *
 * Centralized exports for all TanStack Query hooks used throughout the application.
 * Provides easy access to data fetching, mutations, and optimistic updates.
 */

import { logger } from '../../utils/logger'

const log = logger.api

// Export all query hooks
export * from './auth.queries'
export * from './issues.queries'
export * from './companies.queries'
export * from './workflows.queries'

// Query client configuration and utilities are exported from ../query-client directly
// Avoiding duplicate exports to prevent import conflicts

// Re-export TanStack Query core functions
export {
  useQuery,
  useMutation,
  useQueryClient,
  useInfiniteQuery,
  useQueries,
  useSuspenseQuery,
  useSuspenseInfiniteQuery,
  keepPreviousData
} from '@tanstack/react-query'

// Common query patterns and utilities
import React from 'react'

import { useQueryClient } from '@tanstack/react-query'

import { queryKeys } from '../query-client'

/**
 * Custom hook for managing search with debouncing
 */
export function useSearchQuery<T>(
  searchFn: (query: string) => Promise<T>,
  initialQuery: string = '',
  delay: number = 500
) {
  const [query, setQuery] = React.useState(initialQuery)
  const [debouncedQuery, setDebouncedQuery] = React.useState(initialQuery)

  React.useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query)
    }, delay)

    return () => clearTimeout(timer)
  }, [query, delay])

  return {
    query,
    debouncedQuery,
    setQuery,
    clearQuery: () => setQuery('')
  }
}

/**
 * Custom hook for optimistic updates with automatic rollback
 */
export function useOptimisticUpdate<T>() {
  const queryClient = useQueryClient()

  return React.useCallback(
    async <U>(
      queryKey: unknown[],
      updateFn: (oldData: T | undefined) => T | undefined,
      mutationFn: () => Promise<U>
    ) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey })

      // Snapshot previous value
      const previousData = queryClient.getQueryData<T>(queryKey)

      // Optimistically update
      queryClient.setQueryData(queryKey, updateFn)

      try {
        // Perform mutation
        const result = await mutationFn()

        // Invalidate to get fresh data
        void queryClient.invalidateQueries({ queryKey })

        return result
      } catch (error) {
        // Revert optimistic update on error
        queryClient.setQueryData(queryKey, previousData)
        throw error
      }
    },
    [queryClient]
  )
}

/**
 * Custom hook for batch operations with progress tracking
 */
export function useBatchOperation<TItem, TResult>() {
  const [progress, setProgress] = React.useState({ completed: 0, total: 0, errors: [] as string[] })
  const [isRunning, setIsRunning] = React.useState(false)

  const executeBatch = React.useCallback(
    async (
      items: TItem[],
      operation: (item: TItem, index: number) => Promise<TResult>,
      options?: {
        batchSize?: number
        onProgress?: (progress: { completed: number; total: number; current: TItem }) => void
        onError?: (error: Error, item: TItem, index: number) => void
      }
    ) => {
      const { batchSize = 5, onProgress, onError } = options ?? {}

      setIsRunning(true)
      setProgress({ completed: 0, total: items.length, errors: [] })

      const results: (TResult | null)[] = []
      const errors: string[] = []

      // Process items in batches
      for (let i = 0; i < items.length; i += batchSize) {
        const batch = items.slice(i, i + batchSize)

        const batchPromises = batch.map(async (item, batchIndex) => {
          const globalIndex = i + batchIndex

          try {
            const result = await operation(item, globalIndex)

            setProgress(prev => ({
              ...prev,
              completed: prev.completed + 1
            }))

            onProgress?.({
              completed: globalIndex + 1,
              total: items.length,
              current: item
            })

            return result
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error'
            errors.push(`Item ${globalIndex}: ${errorMessage}`)

            onError?.(error as Error, item, globalIndex)

            setProgress(prev => ({
              ...prev,
              completed: prev.completed + 1,
              errors: [...prev.errors, errorMessage]
            }))

            return null
          }
        })

        const batchResults = await Promise.allSettled(batchPromises)
        results.push(...batchResults.map(r => (r.status === 'fulfilled' ? r.value : null)))

        // Small delay between batches to avoid overwhelming the API
        if (i + batchSize < items.length) {
          await new Promise(resolve => setTimeout(resolve, 100))
        }
      }

      setIsRunning(false)

      return {
        results: results.filter(r => r !== null),
        errors,
        total: items.length,
        successful: results.filter(r => r !== null).length,
        failed: errors.length
      }
    },
    []
  )

  return {
    executeBatch,
    progress,
    isRunning,
    reset: () => setProgress({ completed: 0, total: 0, errors: [] })
  }
}

/**
 * Custom hook for managing paginated data with infinite scrolling
 */
export function usePaginatedData<T>(
  queryFn: (
    page: number,
    pageSize: number
  ) => Promise<{ data: T[]; hasMore: boolean; total: number }>,
  queryKey: unknown[],
  pageSize: number = 25
) {
  const [page, setPage] = React.useState(0)
  const [allData, setAllData] = React.useState<T[]>([])
  const [hasMore, setHasMore] = React.useState(true)
  const [isLoading, setIsLoading] = React.useState(false)
  const [error, setError] = React.useState<Error | null>(null)

  const loadMore = React.useCallback(async () => {
    if (isLoading || !hasMore) return

    setIsLoading(true)
    setError(null)

    try {
      const result = await queryFn(page, pageSize)

      setAllData(prev => [...prev, ...result.data])
      setHasMore(result.hasMore)
      setPage(prev => prev + 1)
    } catch (err) {
      setError(err as Error)
    } finally {
      setIsLoading(false)
    }
  }, [page, pageSize, queryFn, isLoading, hasMore])

  const reset = React.useCallback(() => {
    setPage(0)
    setAllData([])
    setHasMore(true)
    setError(null)
  }, [])

  // Load initial data
  React.useEffect(() => {
    if (allData.length === 0 && hasMore) {
      void loadMore()
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return {
    data: allData,
    loadMore,
    hasMore,
    isLoading,
    error,
    reset,
    total: allData.length
  }
}

/**
 * Custom hook for real-time data subscriptions
 */
export function useRealTimeQuery<T>(
  queryKey: unknown[],
  queryFn: () => Promise<T>,
  options?: {
    interval?: number
    enabled?: boolean
    onData?: (data: T) => void
  }
) {
  const queryClient = useQueryClient()
  const { interval = 30000, enabled = true, onData } = options ?? {}

  React.useEffect(() => {
    if (!enabled) return undefined

    const intervalId = setInterval(async () => {
      try {
        const data = await queryFn()
        queryClient.setQueryData(queryKey, data)
        onData?.(data)
      } catch (error) {
        log.error('Real-time query failed', { error: error instanceof Error ? error.message : error })
      }
    }, interval)

    return () => clearInterval(intervalId)
  }, [queryKey, queryFn, interval, enabled, onData, queryClient])

  return null // This hook doesn't return data, it just manages real-time updates
}

/**
 * Custom hook for query invalidation patterns
 */
export function useQueryInvalidation() {
  const queryClient = useQueryClient()

  return {
    // Invalidate all data for a specific entity
    invalidateEntity: (entityType: keyof typeof queryKeys) => {
      const key = queryKeys[entityType]
      // Only invalidate if it's a base key (not a function)
      if (typeof key !== 'function') {
        void queryClient.invalidateQueries({ queryKey: key })
      }
    },

    // Invalidate all list queries
    invalidateLists: () => {
      void queryClient.invalidateQueries({
        predicate: query => query.queryKey.includes('list')
      })
    },

    // Invalidate all search queries
    invalidateSearches: () => {
      void queryClient.invalidateQueries({
        predicate: query => query.queryKey[0] === 'search'
      })
    },

    // Invalidate all stats/analytics queries
    invalidateStats: () => {
      void queryClient.invalidateQueries({
        predicate: query => query.queryKey.includes('stats') || query.queryKey.includes('analytics')
      })
    },

    // Invalidate everything (nuclear option)
    invalidateAll: () => {
      void queryClient.invalidateQueries()
    }
  }
}

/**
 * Query health monitoring for debugging
 */
export function useQueryHealth() {
  const queryClient = useQueryClient()

  return {
    getStats: () => {
      const cache = queryClient.getQueryCache()
      const mutations = queryClient.getMutationCache()

      return {
        queries: {
          total: cache.getAll().length,
          fresh: cache.getAll().filter(q => !q.isStale()).length,
          stale: cache.getAll().filter(q => q.isStale()).length,
          fetching: cache.getAll().filter(q => q.state.fetchStatus === 'fetching').length,
          error: cache.getAll().filter(q => q.state.status === 'error').length
        },
        mutations: {
          total: mutations.getAll().length,
          pending: mutations.getAll().filter(m => m.state.status === 'pending').length,
          success: mutations.getAll().filter(m => m.state.status === 'success').length,
          error: mutations.getAll().filter(m => m.state.status === 'error').length
        }
      }
    },

    getSlowestQueries: (limit: number = 10) => {
      const cache = queryClient.getQueryCache()

      return cache
        .getAll()
        .map(query => ({
          queryKey: query.queryKey,
          lastFetch: query.state.dataUpdatedAt ?? 0,
          age: Date.now() - (query.state.dataUpdatedAt ?? 0)
        }))
        .sort((a, b) => b.age - a.age)
        .slice(0, limit)
    },

    getMostUsedQueries: (limit: number = 10) => {
      const cache = queryClient.getQueryCache()

      return cache
        .getAll()
        .map(query => ({
          queryKey: query.queryKey,
          observers: query.getObserversCount()
        }))
        .sort((a, b) => b.observers - a.observers)
        .slice(0, limit)
    }
  }
}
