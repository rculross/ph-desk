/**
 * Centralized Pagination Utilities for HTTP API Client
 *
 * Provides utilities for fetching all pages of data from paginated endpoints,
 * with support for progress tracking and different response formats.
 */

import type { PaginatedResponse, Issue } from '../../types'
import { logger } from '../../utils/logger'
import { getHttpClient } from '../client/http-client'
import { endpointConfig, type EntityType, type EndpointAlias } from '../config/endpoints'

const log = logger.api

// ==================================================
// Pagination Utility Types
// ==================================================

export interface PaginationOptions {
  /** Maximum number of records per page */
  limit?: number
  /** Starting offset */
  offset?: number
  /** Sort field */
  sort?: string
  /** Progress callback */
  onProgress?: (loaded: number, total?: number) => void
  /** Stop condition callback */
  shouldStop?: (data: any[], currentBatch: any[]) => boolean
  /** Maximum total records to fetch */
  maxRecords?: number
}

export interface FetchAllOptions<T = any> extends PaginationOptions {
  /** Additional filters to apply */
  filters?: Record<string, any>
  /** Request priority for rate limiting */
  priority?: 'low' | 'normal' | 'high' | 'critical'
  /** Request complexity for rate limiting */
  complexity?: 'simple' | 'moderate' | 'complex' | 'heavy'
}

export interface PaginationResult<T> {
  data: T[]
  total: number
  pages: number
  hasMore: boolean
  lastOffset: number
}

// ==================================================
// Generic Pagination Functions
// ==================================================

/**
 * Fetch all pages from a paginated endpoint using a custom fetch function
 */
export async function fetchAllPages<T>(
  fetchPage: (offset: number, limit: number) => Promise<{ data: T[]; total?: number; hasMore?: boolean }>,
  options: PaginationOptions = {}
): Promise<PaginationResult<T>> {
  const {
    limit = 1000,
    offset: startOffset = 0,
    onProgress,
    shouldStop,
    maxRecords
  } = options

  const results: T[] = []
  let offset = startOffset
  let hasMore = true
  let totalRecords: number | undefined
  let pages = 0

  log.debug('Starting paginated fetch', {
    initialLimit: limit,
    startOffset,
    maxRecords
  })

  while (hasMore) {
    try {
      const effectiveLimit = maxRecords
        ? Math.min(limit, maxRecords - results.length)
        : limit

      if (effectiveLimit <= 0) {
        log.debug('Reached max records limit', { maxRecords, currentCount: results.length })
        break
      }

      log.debug(`Fetching page ${pages + 1}`, { offset, limit: effectiveLimit })

      const page = await fetchPage(offset, effectiveLimit)
      pages++

      if (!page.data || page.data.length === 0) {
        log.debug('No more data available', { offset, pageCount: pages })
        hasMore = false
        break
      }

      // Add data to results
      results.push(...page.data)

      // Update total if provided
      if (page.total !== undefined) {
        totalRecords = page.total
      }

      // Progress callback
      if (onProgress) {
        onProgress(results.length, totalRecords)
      }

      // Check stop condition
      if (shouldStop && shouldStop(results, page.data)) {
        log.debug('Stop condition met', { currentCount: results.length })
        hasMore = false
        break
      }

      // Check if we have more data
      if (page.hasMore !== undefined) {
        hasMore = page.hasMore
      } else {
        // Infer hasMore from data length
        hasMore = page.data.length === effectiveLimit
      }

      if (hasMore) {
        offset += page.data.length
      }

      // Safety check to prevent infinite loops
      if (pages > 1000) {
        log.warn('Reached maximum page limit (1000), stopping fetch')
        break
      }

    } catch (error) {
      // Stop pagination immediately on rate limit errors
      if ((error as any)?.status === 429) {
        log.warn('Rate limit hit, stopping pagination', {
          offset,
          page: pages + 1,
          recordsFetched: results.length
        })
        throw error
      }

      log.error('Error during paginated fetch', {
        error: error instanceof Error ? error.message : 'Unknown error',
        offset,
        page: pages + 1
      })
      throw error
    }
  }

  const result: PaginationResult<T> = {
    data: results,
    total: totalRecords || results.length,
    pages,
    hasMore: hasMore && results.length < (totalRecords || Infinity),
    lastOffset: offset
  }

  log.debug('Paginated fetch completed', {
    totalRecords: result.total,
    fetchedRecords: result.data.length,
    pages: result.pages,
    hasMore: result.hasMore
  })

  return result
}

/**
 * Fetch all records for a specific entity type using HTTP client
 */
export async function fetchAllRecords<T>(
  entityType: EntityType,
  options: FetchAllOptions<T> = {}
): Promise<PaginationResult<T>> {
  let httpClient: any

  try {
    httpClient = getHttpClient()
  } catch (error) {
    if (error instanceof Error && error.message.includes('HTTP client not initialized')) {
      throw new Error('HTTP client not initialized. Please ensure the client is properly set up before using centralized pagination.')
    }
    throw error
  }

  const config = endpointConfig[entityType]

  if (!config) {
    throw new Error(`Unknown entity type: ${entityType}`)
  }

  const {
    filters = {},
    priority = 'normal',
    complexity = 'simple',
    limit = config.defaultLimit,
    ...paginationOptions
  } = options

  log.debug(`Fetching all ${entityType} records`, {
    entityType,
    limit,
    filters,
    priority,
    complexity
  })

  const fetchPage = async (offset: number, pageLimit: number) => {
    const params = {
      ...filters,
      limit: pageLimit,
      offset,
      sort: options.sort || config.defaultSort
    }

    // Add request options for rate limiting
    const requestOptions = {
      priority,
      complexity,
      skipRateLimit: false
    }

    let response: any

    try {
      switch (entityType) {
        case 'issues':
          response = await httpClient.get('/issues', params, {
            metadata: { priority, complexity }
          })
          // Issues endpoint returns array directly
          return {
            data: response || [],
            total: response?.length || 0,
            hasMore: response?.length === pageLimit
          }

        case 'companies':
          response = await httpClient.get('/companies', params, {
            metadata: { priority, complexity }
          })
          // Companies endpoint returns paginated response
          return {
            data: response?.data || [],
            total: response?.total || 0,
            hasMore: response?.hasMore || false
          }

        case 'workflows':
          response = await httpClient.get('/workflowtemplates', params, {
            metadata: { priority, complexity }
          })
          // Workflows endpoint returns array directly
          return {
            data: response || [],
            total: response?.length || 0,
            hasMore: response?.length === pageLimit
          }

        case 'tenants':
          response = await httpClient.get('/myprofile/tenants', params, {
            metadata: { priority, complexity }
          })
          // Tenants endpoint returns array directly
          return {
            data: response || [],
            total: response?.length || 0,
            hasMore: false // Tenants are not paginated
          }

        default:
          throw new Error(`Unsupported entity type: ${entityType}`)
      }
    } catch (error) {
      log.error(`Failed to fetch ${entityType} page`, {
        error: error instanceof Error ? error.message : 'Unknown error',
        params,
        offset,
        pageLimit
      })
      throw error
    }
  }

  return fetchAllPages(fetchPage, {
    limit,
    ...paginationOptions
  })
}

/**
 * Fetch all issues with client-side date filtering
 * This is a specialized function for the issues endpoint that handles
 * client-side filtering because the API doesn't handle date filters correctly
 */
export async function fetchAllIssuesWithDateFilter(
  options: FetchAllOptions & {
    createdAtFrom?: string
    createdAtTo?: string
  } = {}
): Promise<PaginationResult<any>> {
  const {
    createdAtFrom,
    createdAtTo,
    onProgress,
    ...fetchOptions
  } = options

  log.debug('Fetching all issues with date filter', {
    createdAtFrom,
    createdAtTo,
    clientSideFiltering: !!(createdAtFrom || createdAtTo)
  })

  // Create a custom shouldStop condition for date filtering
  const shouldStop = createdAtFrom
    ? (results: any[], currentBatch: any[]) => {
        if (currentBatch.length === 0) return true

        // Check if the last issue in this batch is older than our from date
        const lastIssue = currentBatch[currentBatch.length - 1]
        if (lastIssue?.createdAt) {
          const lastIssueDate = new Date(lastIssue.createdAt)
          const fromDate = new Date(createdAtFrom)
          return lastIssueDate < fromDate
        }
        return false
      }
    : undefined

  // Fetch all issues (without date filters in API call)
  const result = await fetchAllRecords('issues', {
    ...fetchOptions,
    shouldStop,
    onProgress: createdAtFrom || createdAtTo
      ? undefined // We'll handle progress after filtering
      : onProgress
  })

  // Apply client-side date filtering if needed
  if (createdAtFrom || createdAtTo) {
    const filteredData = result.data.filter((issue: any) => {
      if (!issue.createdAt) return true

      const issueDate = new Date(issue.createdAt)
      let includeIssue = true

      if (createdAtFrom) {
        const fromDate = new Date(createdAtFrom)
        if (issueDate < fromDate) {
          includeIssue = false
        }
      }

      if (createdAtTo && includeIssue) {
        const toDate = new Date(createdAtTo)
        if (issueDate > toDate) {
          includeIssue = false
        }
      }

      return includeIssue
    })

    log.debug('Applied client-side date filtering', {
      originalCount: result.data.length,
      filteredCount: filteredData.length,
      filterPercentage: ((filteredData.length / result.data.length) * 100).toFixed(1)
    })

    // Final progress callback with filtered data
    if (onProgress) {
      onProgress(filteredData.length, filteredData.length)
    }

    return {
      ...result,
      data: filteredData,
      total: filteredData.length
    }
  }

  return result
}

/**
 * Create a paginated data provider for streaming exports
 */
export function createPaginatedDataProvider<T>(
  entityType: EntityType,
  filters: Record<string, any> = {}
) {
  return async (offset: number, limit: number) => {
    const result = await fetchAllRecords<T>(entityType, {
      filters,
      offset,
      limit,
      maxRecords: limit // Only fetch exactly what's requested
    })

    return {
      data: result.data,
      total: result.total
    }
  }
}

// ==================================================
// Legacy Compatibility Functions
// ==================================================

/**
 * @deprecated Use fetchAllRecords instead
 */
export const getAllIssues = (filters?: any, options?: PaginationOptions) =>
  fetchAllRecords('issues', { filters, ...options })

/**
 * @deprecated Use fetchAllRecords instead
 */
export const getAllCompanies = (filters?: any, options?: PaginationOptions) =>
  fetchAllRecords('companies', { filters, ...options })

/**
 * @deprecated Use fetchAllRecords instead
 */
export const getAllWorkflows = (filters?: any, options?: PaginationOptions) =>
  fetchAllRecords('workflows', { filters, ...options })