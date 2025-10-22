/**
 * Logz Query Hook
 *
 * TanStack Query hook for fetching logs with pagination,
 * entity resolution, and proper error handling.
 */

import { useCallback, useEffect } from 'react'

import { useQuery } from '@tanstack/react-query'

import { getTenantSlug } from '../api/client/http-client'
import { LogzService } from '../services/logz.service'
import {
  useLogzFilters,
  useLogzPagination,
  useLogzActions,
  useLogzLoading,
  useLogzError
} from '../stores/logz.store'
import type { ParsedLogEntry } from '../types/logz.types'
import { logger } from '../utils/logger'

const log = logger.api

/**
 * Create query key for logs
 */
function createLogsQueryKey(
  tenantSlug: string | null,
  filters: any,
  pagination: any
) {
  return ['logs', tenantSlug, filters, pagination] as const
}

/**
 * Main hook for querying logs
 */
export function useLogzQuery() {
  const filters = useLogzFilters()
  const pagination = useLogzPagination()
  const {
    setLogs,
    appendLogs,
    setLoading,
    setError,
    updatePagination
  } = useLogzActions()

  // Get current tenant slug
  const tenantSlug = getTenantSlug()

  // Validate filters before query
  const filterValidation = LogzService.validateFilters(filters)

  const query = useQuery({
    queryKey: createLogsQueryKey(tenantSlug ?? null, filters, pagination),
    queryFn: async () => {
      log.info('Fetching logs', { filters, pagination })

      // Validate filters
      if (filterValidation) {
        throw new Error(filterValidation.message)
      }

      // The service layer will now handle ensuring tenant slug is available
      return LogzService.fetchLogs(filters, pagination)
    },
    enabled: !filterValidation, // Remove tenant slug check since service handles it
    staleTime: 30 * 1000, // 30 seconds - logs should be relatively fresh
    gcTime: 5 * 60 * 1000, // 5 minutes
    retry: (failureCount, error) => {
      // Don't retry validation errors or tenant selection errors
      if (error.message.includes('Date range cannot exceed') ||
          error.message.includes('No tenant selected')) {
        return false
      }
      // Retry up to 3 times for other errors
      return failureCount < 3
    },
    retryDelay: attemptIndex => Math.min(1000 * 2 ** attemptIndex, 30000)
  })

  // Update store when query data changes
  useEffect(() => {
    if (query.data) {
      if (pagination.currentOffset === 0) {
        // First page - replace logs
        setLogs(query.data)
      } else {
        // Subsequent pages - append logs
        appendLogs(query.data)
      }
    }
  }, [query.data, pagination.currentOffset, setLogs, appendLogs])

  // Update loading state
  useEffect(() => {
    setLoading(query.isLoading || query.isFetching)
  }, [query.isLoading, query.isFetching, setLoading])

  // Update error state
  useEffect(() => {
    if (query.error) {
      const errorMessage = query.error instanceof Error ?
        query.error.message : 'An error occurred while fetching logs'
      setError(errorMessage)
    } else {
      setError(null)
    }
  }, [query.error, setError])

  // Load more functionality
  const loadMore = useCallback(() => {
    if (query.data && query.data.length === pagination.recordsPerPull) {
      const newOffset = pagination.currentOffset + pagination.recordsPerPull

      log.info('Loading more logs', {
        currentOffset: pagination.currentOffset,
        newOffset,
        recordsPerPull: pagination.recordsPerPull
      })

      updatePagination({
        currentOffset: newOffset,
        hasMore: true
      })
    }
  }, [query.data, pagination, updatePagination])

  // Refresh functionality
  const refresh = useCallback(() => {
    log.info('Refreshing logs')

    // Reset pagination to first page
    updatePagination({
      currentOffset: 0,
      totalLoaded: 0,
      hasMore: false
    })

    // Refetch query
    void query.refetch()
  }, [updatePagination, query])

  // Manual refetch
  const refetch = useCallback(() => {
    return query.refetch()
  }, [query])

  return {
    // Query state
    data: query.data,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    isError: query.isError,
    error: query.error,
    isSuccess: query.isSuccess,

    // Pagination info
    hasMore: query.data ? query.data.length === pagination.recordsPerPull : false,
    currentOffset: pagination.currentOffset,
    recordsPerPull: pagination.recordsPerPull,

    // Actions
    loadMore,
    refresh,
    refetch,

    // Validation
    filterValidation
  }
}

/**
 * Hook for logs metadata (counts, etc.)
 */
export function useLogzMetadata() {
  const logs = useLogzQuery()
  const isLoading = useLogzLoading()
  const error = useLogzError()

  // Calculate metadata from current logs
  const metadata = {
    totalLoaded: logs.data?.length ?? 0,
    isLoading,
    error,
    isEmpty: !isLoading && !error && (!logs.data || logs.data.length === 0),
    hasData: !!logs.data && logs.data.length > 0
  }

  return metadata
}

/**
 * Hook for logs actions
 */
export function useLogzQueryActions() {
  const { refresh, loadMore, refetch } = useLogzQuery()
  const { clearLogs, clearFilters, applyQuickDateFilter } = useLogzActions()

  return {
    refresh,
    loadMore,
    refetch,
    clearLogs,
    clearFilters,
    applyQuickDateFilter
  }
}