import { subDays } from 'date-fns'

import type {
  Issue,
  IssueFilters,
  IssueType,
  IssuePriority,
  IssueStatus,
  IssueSeverity,
  IssueResolution,
  Comment,
  Attachment,
  PaginatedResponse,
  ApiResponse,
  User,
  Company
} from '../../types'
import { logger } from '../../utils/logger'
import { getHttpClient, type RequestOptions } from '../client/http-client'

interface ApiRequestOptions extends RequestOptions {
  priority?: 'low' | 'normal' | 'high' | 'critical'
  complexity?: 'simple' | 'moderate' | 'complex' | 'heavy'
}
import {
  createIssueRequestSchema,
  updateIssueRequestSchema,
  issueResponseSchema,
  apiResponseSchema,
  type CreateIssueRequest,
  type UpdateIssueRequest
} from '../schemas'
import { fetchAllRecords, fetchAllIssuesWithDateFilter } from '../utils/pagination'

import { ensureAuthAndTenant } from './tenant.service'

const log = logger.api

/**
 * Service for issue-related API operations
 *
 * Provides comprehensive issue management including CRUD operations,
 * filtering, bulk operations, and issue lifecycle management.
 */

// Request/Response types are now imported from schemas
// Legacy types for backward compatibility
export type { CreateIssueRequest, UpdateIssueRequest } from '../schemas'

export interface BulkUpdateRequest {
  issueIds: string[]
  updates: UpdateIssueRequest
}

export interface IssueSearchRequest {
  query: string
  filters?: Partial<IssueFilters>
  limit?: number
  offset?: number
  highlight?: boolean
}

export interface IssueStats {
  total: number
  byStatus: Record<IssueStatus, number>
  byPriority: Record<IssuePriority, number>
  byType: Record<IssueType, number>
  bySeverity: Record<IssueSeverity, number>
  avgResolutionTime: number
  openIssues: number
  overdueIssues: number
  recentlyCreated: number
  recentlyResolved: number
}

export interface IssueActivity {
  id: string
  issueId: string
  userId: string
  user: User
  action: IssueActivityAction
  field?: string
  oldValue?: any
  newValue?: any
  timestamp: string
  comment?: string
}

export type IssueActivityAction =
  | 'created'
  | 'updated'
  | 'status_changed'
  | 'assigned'
  | 'commented'
  | 'resolved'
  | 'closed'
  | 'reopened'
  | 'priority_changed'
  | 'due_date_changed'

export interface IssueExportOptions {
  format: 'csv' | 'xlsx' | 'json' | 'pdf'
  filters?: IssueFilters
  fields?: string[]
  includeComments?: boolean
  includeAttachments?: boolean
  includeCustomFields?: boolean
}

/**
 * Issues Service Class
 */
class IssuesService {
  private get httpClient() {
    return getHttpClient()
  }

  /**
   * Ensure authentication and tenant slug are set before making API calls
   * This provides consistent behavior with TanStack Query hooks
   */
  private async ensureAuthAndTenantContext(): Promise<void> {
    await ensureAuthAndTenant({ context: 'issues API calls', logger: log })
  }

  /**
   * Get paginated list of issues with optional filtering
   */
  async getIssues(
    filters?: IssueFilters,
    pagination?: { limit?: number; offset?: number; sort?: string },
    options?: ApiRequestOptions
  ): Promise<PaginatedResponse<Issue>> {
    // Ensure authentication and tenant context before making API calls
    await this.ensureAuthAndTenantContext()

    // Build query params safely - exclude date filters which need client-side handling
    const queryParams: Record<string, any> = {
      limit: pagination?.limit ?? 2000,
      offset: pagination?.offset ?? 0,
      sort: pagination?.sort ?? '-createdAt'
    }

    // Add non-date filters to query params
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        // Skip date filters - these need client-side filtering since API doesn't support date filtering
        if (key === 'createdAt' || key === 'updatedAt') {
          return
        }
        if (value !== undefined && value !== null) {
          queryParams[key] = value
        }
      })
    }

    log.debug('Fetching issues via HTTP client', queryParams)

    try {
      // Fetch issues using HTTP client - endpoint returns direct array
      const data = await this.httpClient.get<Issue[]>(
        '/issues',
        queryParams,
        {
          metadata: {
            priority: options?.priority ?? 'normal',
            complexity: options?.complexity ?? 'moderate'
          }
        }
      )

      // Wrap array response in pagination structure for consistency
      return {
        data: data ?? [],
        total: (data ?? []).length,
        limit: pagination?.limit ?? 2000,
        offset: pagination?.offset ?? 0,
        hasMore: (data ?? []).length === (pagination?.limit ?? 2000)
      }
    } catch (error) {
      log.error('Failed to fetch issues:', error)
      throw error
    }
  }

  /**
   * Get a single issue by ID
   */
  async getIssueById(issueId: string, options?: ApiRequestOptions): Promise<Issue | null> {
    // Validate issue ID format (should be ObjectId)
    if (!issueId || !/^[a-f\d]{24}$/i.test(issueId)) {
      throw new Error('Invalid issue ID format')
    }

    // Ensure authentication and tenant context before making API calls
    await this.ensureAuthAndTenantContext()

    try {
      const response = await this.httpClient.get<{ data: Issue }>(
        `/issues/${issueId}`,
        undefined,
        {
          metadata: {
            priority: options?.priority ?? 'normal',
            complexity: options?.complexity ?? 'moderate'
          }
        }
      )

      return response.data ?? null
    } catch (error) {
      log.error('Failed to fetch issue by ID:', error)
      throw error
    }
  }

  /**
   * Create a new issue
   */
  async createIssue(issueData: CreateIssueRequest, options?: ApiRequestOptions): Promise<Issue> {
    // Ensure authentication and tenant context before making API calls
    await this.ensureAuthAndTenantContext()

    try {
      const response = await this.httpClient.post<{ data: Issue }>(
        '/issues',
        issueData,
        {
          metadata: {
            priority: options?.priority ?? 'normal',
            complexity: options?.complexity ?? 'moderate'
          }
        }
      )

      if (!response.data) {
        throw new Error('No data returned from issue creation')
      }

      return response.data
    } catch (error) {
      log.error('Failed to create issue:', error)
      throw error
    }
  }

  /**
   * Update an existing issue
   */
  async updateIssue(issueId: string, updates: UpdateIssueRequest, options?: ApiRequestOptions): Promise<Issue> {
    try {
      // Validate issue ID format
      if (!issueId || !/^[a-f\d]{24}$/i.test(issueId)) {
        throw new Error('Invalid issue ID format')
      }

      // Ensure tenant slug is set before making API calls
      await this.ensureAuthAndTenantContext()

      const response = await this.httpClient.patch<{ data: Issue }>(
        `/issues/${issueId}`,
        updates,
        {
          metadata: {
            priority: options?.priority ?? 'normal',
            complexity: options?.complexity ?? 'moderate'
          }
        }
      )

      if (!response.data) {
        throw new Error('No data returned from issue update')
      }

      return response.data
    } catch (error) {
      log.error('Failed to update issue:', error)
      throw error
    }
  }

  /**
   * Delete an issue
   */
  async deleteIssue(issueId: string, options?: ApiRequestOptions): Promise<void> {
    try {
      // Validate issue ID format
      if (!issueId || !/^[a-f\d]{24}$/i.test(issueId)) {
        throw new Error('Invalid issue ID format')
      }

      // Ensure tenant slug is set before making API calls
      await this.ensureAuthAndTenantContext()

      await this.httpClient.delete<void>(
        `/issues/${issueId}`,
        {
          metadata: {
            priority: options?.priority ?? 'normal',
            complexity: options?.complexity ?? 'moderate'
          }
        }
      )
    } catch (error) {
      log.error('Failed to delete issue:', error)
      throw error
    }
  }

  /**
   * Bulk update multiple issues
   */
  async bulkUpdateIssues(request: BulkUpdateRequest, options?: ApiRequestOptions): Promise<Issue[]> {
    try {
      // Ensure tenant slug is set before making API calls
      await this.ensureAuthAndTenantContext()

      const response = await this.httpClient.patch<ApiResponse<Issue[]>>(
        '/issues/bulk',
        request,
        {
          metadata: {
            priority: options?.priority ?? 'normal',
            complexity: options?.complexity ?? 'moderate'
          }
        }
      )

      return response.data ?? []
    } catch (error) {
      log.error('Failed to bulk update issues:', error)
      throw error
    }
  }

  /**
   * Bulk delete multiple issues
   */
  async bulkDeleteIssues(issueIds: string[], options?: ApiRequestOptions): Promise<void> {
    try {
      // Ensure tenant slug is set before making API calls
      await this.ensureAuthAndTenantContext()

      await this.httpClient.post<void>(
        '/issues/bulk-delete',
        { issueIds },
        {
          metadata: {
            priority: options?.priority ?? 'normal',
            complexity: options?.complexity ?? 'moderate'
          }
        }
      )
    } catch (error) {
      log.error('Failed to bulk delete issues:', error)
      throw error
    }
  }

  /**
   * Search issues with full-text search
   */
  async searchIssues(request: IssueSearchRequest, options?: ApiRequestOptions): Promise<PaginatedResponse<Issue>> {
    try {
      // Ensure tenant slug is set before making API calls
      await this.ensureAuthAndTenantContext()

      const response = await this.httpClient.post<ApiResponse<PaginatedResponse<Issue>>>(
        '/issues/search',
        request,
        {
          metadata: {
            priority: options?.priority ?? 'normal',
            complexity: options?.complexity ?? 'moderate'
          }
        }
      )

      return (
        response.data ?? {
          data: [],
          total: 0,
          limit: request.limit ?? 2000,
          offset: request.offset ?? 0,
          hasMore: false
        }
      )
    } catch (error) {
      log.error('Failed to search issues:', error)
      throw error
    }
  }

  /**
   * Get issue statistics
   */
  async getIssueStats(filters?: IssueFilters, options?: ApiRequestOptions): Promise<IssueStats> {
    try {
      // Ensure tenant slug is set before making API calls
      await this.ensureAuthAndTenantContext()

      const queryParams = new URLSearchParams()

      if (filters) {
        Object.entries(filters).forEach(([key, value]) => {
          if (value !== undefined && value !== null) {
            if (Array.isArray(value)) {
              value.forEach(v => queryParams.append(key, v))
            } else {
              queryParams.append(key, String(value))
            }
          }
        })
      }

      const url = `/issues/stats${queryParams.toString() ? `?${queryParams.toString()}` : ''}`

      const response = await this.httpClient.get<ApiResponse<IssueStats>>(
        url,
        undefined,
        {
          metadata: {
            priority: options?.priority ?? 'normal',
            complexity: options?.complexity ?? 'moderate'
          }
        }
      )

      return (
        response.data ?? {
          total: 0,
          byStatus: {} as Record<IssueStatus, number>,
          byPriority: {} as Record<IssuePriority, number>,
          byType: {} as Record<IssueType, number>,
          bySeverity: {} as Record<IssueSeverity, number>,
          avgResolutionTime: 0,
          openIssues: 0,
          overdueIssues: 0,
          recentlyCreated: 0,
          recentlyResolved: 0
        }
      )
    } catch (error) {
      log.error('Failed to get issue stats:', error)
      throw error
    }
  }

  /**
   * Get issue activity history
   */
  async getIssueActivity(
    issueId: string,
    pagination?: { limit?: number; offset?: number },
    options?: ApiRequestOptions
  ): Promise<PaginatedResponse<IssueActivity>> {
    try {
      // Ensure tenant slug is set before making API calls
      await this.ensureAuthAndTenantContext()

      const queryParams = new URLSearchParams()
      if (pagination?.limit) queryParams.append('limit', pagination.limit.toString())
      if (pagination?.offset) queryParams.append('offset', pagination.offset.toString())

      const url = `/issues/${issueId}/activity${queryParams.toString() ? `?${queryParams.toString()}` : ''}`

      const response = await this.httpClient.get<ApiResponse<PaginatedResponse<IssueActivity>>>(
        url,
        undefined,
        {
          metadata: {
            priority: options?.priority ?? 'normal',
            complexity: options?.complexity ?? 'moderate'
          }
        }
      )

      return (
        response.data ?? {
          data: [],
          total: 0,
          limit: pagination?.limit ?? 2000,
          offset: pagination?.offset ?? 0,
          hasMore: false
        }
      )
    } catch (error) {
      log.error('Failed to get issue activity:', error)
      throw error
    }
  }

  /**
   * Add comment to issue
   */
  async addComment(
    issueId: string,
    content: string,
    isInternal: boolean = false,
    attachments?: string[],
    options?: ApiRequestOptions
  ): Promise<Comment> {
    try {
      // Ensure tenant slug is set before making API calls
      await this.ensureAuthAndTenantContext()

      const response = await this.httpClient.post<ApiResponse<Comment>>(
        `/issues/${issueId}/comments`,
        {
          content,
          isInternal,
          attachments: attachments ?? []
        },
        {
          metadata: {
            priority: options?.priority ?? 'normal',
            complexity: options?.complexity ?? 'moderate'
          }
        }
      )

      if (!response.data) {
        throw new Error('No data returned from comment creation')
      }

      return response.data
    } catch (error) {
      log.error('Failed to add comment:', { error: error instanceof Error ? error.message : error })
      throw error
    }
  }

  /**
   * Get all issues with date filter support
   * Since we're sorting by -createdAt, we fetch pages until we find a record before createdAtFrom
   */
  async getAllIssuesWithDateFilter(
    createdAtFrom?: string,
    createdAtTo?: string,
    options?: {
      onProgress?: (loaded: number, total: number) => void
      additionalFilters?: IssueFilters
      apiOptions?: ApiRequestOptions
    }
  ): Promise<Issue[]> {
    const allIssues: Issue[] = []
    let offset = 0
    const limit = 2000 // Maximum allowed limit
    let hasMore = true

    // Parse date filters for client-side filtering
    const fromDate = createdAtFrom ? new Date(createdAtFrom) : null
    const toDate = createdAtTo ? new Date(createdAtTo) : null

    log.debug('Starting date-filtered issues fetch', {
      createdAtFrom,
      createdAtTo,
      fromDate: fromDate?.toISOString(),
      toDate: toDate?.toISOString()
    })

    while (hasMore) {
      // Fetch issues without date filters (API doesn't support them)
      const result = await this.getIssues(
        options?.additionalFilters, // Only non-date filters
        { limit, offset, sort: '-createdAt' }, // Ensure sorting by createdAt desc
        options?.apiOptions
      )

      if (result.data && result.data.length > 0) {
        let addedToResult = 0

        for (const issue of result.data) {
          const issueDate = new Date(issue.createdAt)

          // Since we're sorted by -createdAt, if we hit a record before fromDate, we can stop
          if (fromDate && issueDate < fromDate) {
            log.debug('Found record before fromDate, stopping pagination', {
              issueDate: issueDate.toISOString(),
              fromDate: fromDate.toISOString(),
              totalIssuesFound: allIssues.length,
              currentOffset: offset
            })
            hasMore = false
            break
          }

          // Check if issue is within date range
          const withinFromDate = !fromDate || issueDate >= fromDate
          const withinToDate = !toDate || issueDate <= toDate

          if (withinFromDate && withinToDate) {
            allIssues.push(issue)
            addedToResult++
          }
        }

        log.debug('Processed page of issues', {
          pageSize: result.data.length,
          addedToResult,
          totalIssuesFound: allIssues.length,
          currentOffset: offset
        })

        // Call progress callback if provided
        if (options?.onProgress) {
          options.onProgress(allIssues.length, allIssues.length)
        }

        // Check if we should continue - either we got a full page and haven't hit the date limit,
        // or we haven't been stopped by the date filter
        if (hasMore && result.data.length < limit) {
          hasMore = false // No more records available from API
        }

        offset += limit
      } else {
        hasMore = false
      }
    }

    log.debug('Date-filtered issues fetch completed', {
      totalIssues: allIssues.length,
      finalOffset: offset
    })

    return allIssues
  }

  /**
   * Get comments for an issue
   */
  async getComments(issueId: string, pagination?: { limit?: number; offset?: number }): Promise<any[]> {
    try {
      const params = pagination ? `?limit=${pagination.limit ?? 50}&offset=${pagination.offset ?? 0}` : ''
      const response = await this.httpClient.get(`/issues/${issueId}/comments${params}`)
      return response.data ?? []
    } catch (error) {
      log.error('Failed to get comments:', { error: error instanceof Error ? error.message : error })
      throw error
    }
  }

  /**
   * Get issues assigned to current user
   */
  async getMyIssues(
    status?: string[],
    pagination?: { limit?: number; offset?: number },
    options?: ApiRequestOptions
  ): Promise<PaginatedResponse<Issue>> {
    const filters: IssueFilters = {}
    if (status && status.length > 0) {
      filters.status = status as any
    }
    return this.getIssues(filters, pagination, options)
  }

  /**
   * Get overdue issues
   */
  async getOverdueIssues(filters?: IssueFilters, options?: ApiRequestOptions): Promise<PaginatedResponse<Issue>> {
    const overdueFilters: IssueFilters = {
      ...filters,
      dueDate: { $lt: new Date().toISOString() }
    }
    return this.getIssues(overdueFilters, undefined, options)
  }

  /**
   * Assign an issue to a user
   */
  async assignIssue(issueId: string, assigneeId: string, options?: ApiRequestOptions): Promise<Issue> {
    return this.updateIssue(issueId, { assigneeId }, options)
  }

  /**
   * Resolve an issue
   */
  async resolveIssue(issueId: string, resolution?: any, options?: ApiRequestOptions): Promise<Issue> {
    const updates: any = { status: 'resolved' }
    if (resolution) {
      updates.resolution = resolution
    }
    return this.updateIssue(issueId, updates, options)
  }

  /**
   * Export issues to a specific format
   */
  async exportIssues(
    options: {
      format?: 'csv' | 'xlsx' | 'json'
      filters?: IssueFilters
      fields?: string[]
    },
    requestOptions?: ApiRequestOptions
  ): Promise<string> {
    try {
      // Ensure tenant slug is set before making API calls
      await this.ensureAuthAndTenantContext()

      const response = await this.httpClient.post<{ downloadUrl: string }>(
        '/issues/export',
        {
          format: options.format ?? 'csv',
          filters: options.filters,
          fields: options.fields,
          includeComments: false,
          includeAttachments: false
        },
        {
          metadata: {
            priority: requestOptions?.priority ?? 'normal',
            complexity: requestOptions?.complexity ?? 'moderate'
          }
        }
      )

      if (!response.downloadUrl) {
        throw new Error('No download URL returned from export')
      }

      return response.downloadUrl
    } catch (error) {
      log.error('Failed to export issues:', error)
      throw error
    }
  }
}

// Export singleton instance
export const issuesService = new IssuesService()

// Export types and class for advanced usage
export { IssuesService }
