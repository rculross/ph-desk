/**
 * Salesforce Integration TanStack Query Hook
 *
 * Provides React hooks for fetching and managing Salesforce integration data
 * using TanStack Query for optimal caching and state management. Follows the
 * established state management patterns for server state.
 *
 * @fileVersion 3.1.2
 * @author Claude Code AI Assistant
 */

import { useCallback, useMemo, useState, useEffect } from 'react'

import { useQuery, useMutation, useQueryClient, type UseQueryResult, type UseMutationResult } from '@tanstack/react-query'

import { salesforceIntegrationService } from '../api/services/salesforce-integration.service'
import { salesforceDataProcessorService } from '../services/salesforce-data-processor.service'
import { salesforceSearchService } from '../services/salesforce-search.service'
import type {
  SalesforceIntegrationData,
  SalesforceRawConfiguration,
  SalesforceIntegrationOverview,
  SalesforceProcessingOptions,
  SalesforceSearchFilters,
  SalesforceIntegrationError,
  SalesforceSearchResult
} from '../types/integrations/salesforce.types'
import { logSanitizer } from '../utils/log-sanitizer'
import { logger } from '../utils/logger'

const log = logger.api

/**
 * Query keys for consistent cache management
 */
export const salesforceQueryKeys = {
  all: ['salesforce'] as const,
  integration: () => [...salesforceQueryKeys.all, 'integration'] as const,
  configuration: (tenantSlug?: string) =>
    [...salesforceQueryKeys.integration(), 'configuration', tenantSlug] as const,
  processed: (tenantSlug?: string, options?: SalesforceProcessingOptions) =>
    [...salesforceQueryKeys.integration(), 'processed', tenantSlug, options] as const,
  connectivity: (tenantSlug?: string) =>
    [...salesforceQueryKeys.integration(), 'connectivity', tenantSlug] as const,
  search: (term: string, filters?: SalesforceSearchFilters) =>
    [...salesforceQueryKeys.all, 'search', term, filters] as const
} as const

/**
 * Hook options for Salesforce integration queries
 */
export interface UseSalesforceIntegrationOptions {
  /** Tenant slug for multi-tenant environments */
  tenantSlug?: string
  /** Enable automatic background refetch */
  enableBackgroundRefetch?: boolean
  /** Custom stale time (defaults to 5 minutes) */
  staleTime?: number
  /** Custom gc time (defaults to 10 minutes) */
  gcTime?: number
  /** Enable retry on error */
  retry?: boolean
  /** Processing options for data transformation */
  processingOptions?: SalesforceProcessingOptions
}

/**
 * Hook result for Salesforce integration data
 */
export interface UseSalesforceIntegrationResult {
  /** Processed integration data */
  data: SalesforceIntegrationData | undefined
  /** Raw configuration data */
  rawData: SalesforceRawConfiguration | undefined
  /** Integration overview */
  overview: SalesforceIntegrationOverview | undefined
  /** Loading state */
  isLoading: boolean
  /** Initial loading state */
  isInitialLoading: boolean
  /** Background refetch state */
  isFetching: boolean
  /** Error state */
  error: Error | null
  /** Whether data is stale */
  isStale: boolean
  /** Last successful fetch timestamp */
  dataUpdatedAt: number
  /** Manual refetch function */
  refetch: () => void
  /** Invalidate cached data */
  invalidate: () => Promise<void>
}

/**
 * Hook result for search functionality
 */
export interface UseSalesforceSearchResult {
  /** Search results */
  results: SalesforceSearchResult | undefined
  /** Search loading state */
  isSearching: boolean
  /** Search error */
  searchError: Error | null
  /** Search function */
  search: (term: string, filters?: SalesforceSearchFilters) => Promise<void>
  /** Clear search results */
  clearSearch: () => void
  /** Get search suggestions */
  getSuggestions: (partialTerm: string, maxSuggestions?: number) => Promise<string[]>
  /** Search index statistics */
  indexStats: () => {
    indexSize: number
    totalFields: number
    lastBuildTime: number
    cacheSize: number
  }
}

/**
 * Main hook for Salesforce integration data
 *
 * Fetches, processes, and caches Salesforce integration configuration with
 * automatic error handling and performance optimization.
 */
export function useSalesforceIntegration(
  options: UseSalesforceIntegrationOptions = {}
): UseSalesforceIntegrationResult {
  const {
    tenantSlug,
    enableBackgroundRefetch = true,
    staleTime = 5 * 60 * 1000, // 5 minutes - integration data changes moderately
    gcTime = 10 * 60 * 1000, // 10 minutes
    retry = true,
    processingOptions = {
      filterUserFields: true,
      maxFields: 10000,
      includeFieldMetadata: true,
      validateData: true
    }
  } = options

  const queryClient = useQueryClient()

  // Fetch raw configuration
  const configQuery = useQuery({
    queryKey: salesforceQueryKeys.configuration(tenantSlug),
    queryFn: async () => {
      log.debug('Fetching Salesforce configuration', logSanitizer.forDebug({ tenantSlug }))

      const response = await salesforceIntegrationService.loadConfiguration({
        tenantSlug,
        priority: 'high',
        complexity: 'moderate'
      })

      if (!response.data) {
        throw new Error('No Salesforce integration configuration found')
      }

      log.info('Salesforce configuration loaded', logSanitizer.forApi({
        tenantSlug,
        configVersion: response.data.key,
        processingTime: response.metadata.processingTime
      }))

      return response.data
    },
    staleTime,
    gcTime,
    retry: retry ? 3 : false,
    retryDelay: attemptIndex => Math.min(1000 * 2 ** attemptIndex, 30000),
    refetchOnWindowFocus: enableBackgroundRefetch,
    refetchOnReconnect: enableBackgroundRefetch,
    enabled: true // Always enabled - integration data is fundamental
  })

  // Process raw configuration into standardized format
  const processedQuery = useQuery({
    queryKey: salesforceQueryKeys.processed(tenantSlug, processingOptions),
    queryFn: async () => {
      const rawData = configQuery.data
      if (!rawData) {
        throw new Error('Raw configuration not available for processing')
      }

      log.debug('Processing Salesforce configuration', logSanitizer.forDebug({
        tenantSlug,
        configVersion: rawData.key,
        processingOptions
      }))

      const result = await salesforceDataProcessorService.processConfiguration(
        rawData,
        processingOptions
      )

      log.info('Salesforce configuration processed', logSanitizer.forApi({
        tenantSlug,
        processingTime: result.metrics.duration,
        objectCount: result.metrics.objectCount,
        fieldCount: result.metrics.fieldCount,
        warningCount: result.warnings.length
      }))

      // Update search index in background
      salesforceSearchService.buildSearchIndex(result.data).catch(error => {
        log.warn('Failed to update search index', logSanitizer.forError({
          tenantSlug,
          error: error.message
        }))
      })

      return result.data
    },
    staleTime,
    gcTime,
    enabled: !!configQuery.data && configQuery.isSuccess,
    retry: retry ? 2 : false // Fewer retries for processing
  })

  // Memoized overview extraction
  const overview = useMemo(() => {
    return processedQuery.data?.overview
  }, [processedQuery.data])

  // Manual refetch function
  const refetch = useCallback(() => {
    configQuery.refetch()
  }, [configQuery])

  // Cache invalidation function
  const invalidate = useCallback(async () => {
    await queryClient.invalidateQueries({
      queryKey: salesforceQueryKeys.integration()
    })
  }, [queryClient])

  // Determine loading states
  const isInitialLoading = configQuery.isInitialLoading ||
                          (configQuery.isSuccess && processedQuery.isInitialLoading)
  const isLoading = configQuery.isLoading || processedQuery.isLoading
  const isFetching = configQuery.isFetching || processedQuery.isFetching

  // Determine error state
  const error = configQuery.error || processedQuery.error

  // Determine stale state
  const isStale = configQuery.isStale || processedQuery.isStale

  // Last update timestamp
  const dataUpdatedAt = Math.max(
    configQuery.dataUpdatedAt ?? 0,
    processedQuery.dataUpdatedAt ?? 0
  )

  return {
    data: processedQuery.data,
    rawData: configQuery.data,
    overview,
    isLoading,
    isInitialLoading,
    isFetching,
    error,
    isStale,
    dataUpdatedAt,
    refetch,
    invalidate
  }
}

/**
 * Hook for Salesforce integration search functionality
 *
 * Provides debounced search across Salesforce objects and fields with
 * intelligent caching and performance optimization.
 */
export function useSalesforceSearch(): UseSalesforceSearchResult {
  const [searchResults, setSearchResults] = useState<SalesforceSearchResult | undefined>()
  const [isSearching, setIsSearching] = useState(false)
  const [searchError, setSearchError] = useState<Error | null>(null)

  const search = useCallback(async (
    term: string,
    filters: SalesforceSearchFilters = {}
  ) => {
    if (!term.trim()) {
      setSearchResults(undefined)
      return
    }

    setIsSearching(true)
    setSearchError(null)

    try {
      log.debug('Performing Salesforce search', logSanitizer.forSearch({
        term: term.substring(0, 50),
        filtersCount: Object.keys(filters).length
      }))

      const results = await salesforceSearchService.search(term, filters, {
        fuzzyMatching: true,
        minMatchScore: 0.3,
        maxResults: 100,
        enableHighlighting: true
      })

      setSearchResults(results)

      log.debug('Search completed', logSanitizer.forSearch({
        term: term.substring(0, 50),
        totalMatches: results.totalMatches,
        searchTime: results.searchTime
      }))

    } catch (error) {
      const searchError = error instanceof Error ? error : new Error('Search failed')
      setSearchError(searchError)

      log.error('Salesforce search failed', logSanitizer.forError({
        term: term.substring(0, 50),
        error: searchError.message
      }))
    } finally {
      setIsSearching(false)
    }
  }, [])

  const clearSearch = useCallback(() => {
    setSearchResults(undefined)
    setSearchError(null)
  }, [])

  const getSuggestions = useCallback(async (
    partialTerm: string,
    maxSuggestions: number = 10
  ): Promise<string[]> => {
    try {
      return await salesforceSearchService.getSuggestions(partialTerm, maxSuggestions)
    } catch (error) {
      log.warn('Failed to get search suggestions', logSanitizer.forError({
        partialTerm: partialTerm.substring(0, 20),
        error: error instanceof Error ? error.message : 'Unknown error'
      }))
      return []
    }
  }, [])

  const indexStats = useCallback(() => {
    return salesforceSearchService.getIndexStats()
  }, [])

  return {
    results: searchResults,
    isSearching,
    searchError,
    search,
    clearSearch,
    getSuggestions,
    indexStats
  }
}

/**
 * Hook for testing Salesforce integration connectivity
 *
 * Provides a mutation for testing the connection to Salesforce integration endpoint.
 */
export function useSalesforceConnectivity(tenantSlug?: string): UseMutationResult<
  { success: boolean; responseTime: number; error?: string },
  Error,
  void
> {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async () => {
      log.debug('Testing Salesforce connectivity', logSanitizer.forDebug({ tenantSlug }))
      return await salesforceIntegrationService.testConnectivity(tenantSlug)
    },
    onSuccess: (result) => {
      log.info('Salesforce connectivity test completed', logSanitizer.forApi({
        tenantSlug,
        success: result.success,
        responseTime: result.responseTime
      }))

      // Cache the connectivity result
      queryClient.setQueryData(
        salesforceQueryKeys.connectivity(tenantSlug),
        result,
        {
          updatedAt: Date.now()
        }
      )
    },
    onError: (error) => {
      log.error('Salesforce connectivity test failed', logSanitizer.forError({
        tenantSlug,
        error: error.message
      }))
    }
  })
}

/**
 * Hook for getting cached Salesforce connectivity status
 *
 * Returns cached connectivity test results without triggering new tests.
 */
export function useSalesforceConnectivityStatus(tenantSlug?: string) {
  return useQuery({
    queryKey: salesforceQueryKeys.connectivity(tenantSlug),
    queryFn: () => null, // We only use cached data
    staleTime: 60 * 1000, // 1 minute
    gcTime: 5 * 60 * 1000, // 5 minutes
    enabled: false // Only read from cache
  })
}

/**
 * Utility hook for managing Salesforce integration cache
 *
 * Provides utilities for cache management and optimization.
 */
export function useSalesforceCache() {
  const queryClient = useQueryClient()

  const clearCache = useCallback(async () => {
    await queryClient.removeQueries({
      queryKey: salesforceQueryKeys.all
    })
    salesforceSearchService.clearCache()
    log.info('Salesforce cache cleared')
  }, [queryClient])

  const prefetchConfiguration = useCallback(async (tenantSlug?: string) => {
    await queryClient.prefetchQuery({
      queryKey: salesforceQueryKeys.configuration(tenantSlug),
      queryFn: async () => {
        const response = await salesforceIntegrationService.loadConfiguration({ tenantSlug })
        return response.data
      },
      staleTime: 5 * 60 * 1000
    })
  }, [queryClient])

  const getCacheStats = useCallback(() => {
    const cache = queryClient.getQueryCache()
    const salesforceQueries = cache.getAll().filter(query =>
      query.queryKey[0] === 'salesforce'
    )

    return {
      queryCount: salesforceQueries.length,
      activeQueries: salesforceQueries.filter(q => q.getObserversCount() > 0).length,
      staleQueries: salesforceQueries.filter(q => q.isStale()).length,
      searchIndexStats: salesforceSearchService.getIndexStats()
    }
  }, [queryClient])

  return {
    clearCache,
    prefetchConfiguration,
    getCacheStats
  }
}