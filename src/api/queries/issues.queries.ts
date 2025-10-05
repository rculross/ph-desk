import React from 'react'

import {
  useQuery,
  useMutation,
  useQueryClient,
  useInfiniteQuery,
  keepPreviousData
} from '@tanstack/react-query'

import { issuesService } from '../services/issues.service'
import { queryKeys, queryDefaults, queryUtils } from '../query-client'
import { getEntityCacheConfig } from '../config'
import { useAppStore } from '../../stores/app.store'
import { useAuthStore } from '../../stores/auth.store'
import { logger } from '../../utils/logger'

const log = logger.api
import type {
  Issue,
  IssueFilters,
  Comment,
  PaginatedResponse
} from '../../types'

interface IssueActivity {
  id: string
  type: string
  description: string
  timestamp: string
  userId?: string
  issueId: string
}

interface IssueStats {
  totalIssues: number
  openIssues: number
  closedIssues: number
  avgResolutionTime: number
  issuesByPriority: Record<string, number>
  issuesByType: Record<string, number>
}

// Request types
interface CreateIssueRequest {
  title: string
  description: string  // Required to match the schema
  type: 'bug' | 'feature' | 'support' | 'question' | 'task' | 'incident'
  priority: 'lowest' | 'low' | 'medium' | 'high' | 'highest' | 'critical'
  severity: 'minor' | 'major' | 'critical' | 'blocker'
  attachments: any[]
  assigneeId?: string
  companyId?: string
  reporterId?: string
  category?: string
  tags: string[]
  customFields: Record<string, any>  // Required to match the schema
  dueDate?: string
  [key: string]: any
}

interface UpdateIssueRequest {
  title?: string
  description?: string
  type?: 'bug' | 'feature' | 'support' | 'question' | 'task' | 'incident'
  priority?: 'lowest' | 'low' | 'medium' | 'high' | 'highest' | 'critical'
  status?: 'open' | 'in-progress' | 'resolved' | 'closed' | 'cancelled' | 'on-hold'
  severity?: 'minor' | 'major' | 'critical' | 'blocker'
  assigneeId?: string
  companyId?: string
  reporterId?: string
  category?: string
  tags?: string[]
  customFields?: Record<string, any>
  dueDate?: string
  resolution?: any
  [key: string]: any
}

interface BulkUpdateRequest {
  issueIds: string[]
  updates: UpdateIssueRequest
}

interface IssueSearchRequest {
  query: string
  filters?: IssueFilters
  fields?: string[]
  limit?: number
  offset?: number
}

/**
 * Issues Query Hooks
 *
 * Custom hooks for issue-related data fetching and mutations
 * with optimized caching, real-time updates, and bulk operations.
 */

// Query hooks
export function useIssues(
  filters?: IssueFilters,
  pagination?: { limit?: number; offset?: number; sort?: string; sortOrder?: 'asc' | 'desc' },
  options?: { enabled?: boolean }
) {
  const { isAuthenticated } = useAuthStore()

  return useQuery({
    queryKey: queryKeys.list('issues', filters, pagination),
    queryFn: async () => {
      const startTime = performance.now()
      log.debug('Initiating issues query', { 
        filters: filters ? Object.keys(filters) : [],
        pagination,
        hasFilters: !!filters && Object.keys(filters).length > 0,
        sortField: pagination?.sort,
        sortOrder: pagination?.sortOrder
      })
      
      try {
        const result = await issuesService.getIssues(filters, pagination)
        const endTime = performance.now()
        
        log.debug('Issues query completed successfully', {
          duration: Math.round(endTime - startTime),
          recordCount: result.data.length || 0,
          total: result.total,
          hasMore: result.hasMore,
          limit: result.limit,
          offset: result.offset
        })
        
        return result
      } catch (error) {
        const endTime = performance.now()
        log.error('Issues query failed', {
          duration: Math.round(endTime - startTime),
          error: error instanceof Error ? error.message : 'Unknown error',
          filters,
          pagination
        })
        throw error
      }
    },
    enabled: isAuthenticated && (options?.enabled ?? true),
    placeholderData: keepPreviousData,
    ...queryDefaults.standard,
    ...getEntityCacheConfig('issues') // Use unified config for issues cache timing
  })
}

export function useIssuesInfinite(filters?: IssueFilters, limit: number = 25) {
  const { isAuthenticated } = useAuthStore()

  return useInfiniteQuery({
    queryKey: queryKeys.infinite('issues', filters),
    queryFn: async ({ pageParam }: { pageParam: number }) => {
      const offset = pageParam * limit
      const startTime = performance.now()
      
      log.debug('Initiating infinite issues query page', { 
        page: pageParam,
        offset,
        limit,
        filters: filters ? Object.keys(filters) : []
      })
      
      try {
        const result = await issuesService.getIssues(filters, { limit, offset })
        const endTime = performance.now()
        
        log.debug('Infinite issues query page completed', {
          duration: Math.round(endTime - startTime),
          page: pageParam,
          recordCount: result.data.length || 0,
          hasMore: result.hasMore,
          priorityBreakdown: result.data ? getPriorityBreakdown(result.data) : {}
        })
        
        return result
      } catch (error) {
        const endTime = performance.now()
        log.error('Infinite issues query page failed', {
          duration: Math.round(endTime - startTime),
          page: pageParam,
          error: error instanceof Error ? error.message : 'Unknown error'
        })
        throw error
      }
    },
    initialPageParam: 0,
    enabled: isAuthenticated,
    getNextPageParam: (lastPage: any, allPages: any[]) => {
      if (lastPage.hasMore) {
        const nextPage = allPages.length
        log.debug('Infinite query loading next page', { nextPage, totalPages: allPages.length })
        return nextPage
      }
      log.debug('Infinite query reached end of issues data')
      return undefined
    },
    maxPages: 50, // Circuit breaker: prevent loading too many pages
    retry: 3, // Limit retries to 3 attempts
    retryDelay: (attemptIndex) => Math.min(1000 * Math.pow(2, attemptIndex), 10000),
    ...queryDefaults.standard,
    ...getEntityCacheConfig('issues') // Use unified config for issues cache timing
  })
}

// Helper function for logging priority breakdown
function getPriorityBreakdown(issues: Issue[]): Record<string, number> {
  return issues.reduce((acc, issue) => {
    const priority = issue.priority || 'unknown'
    acc[priority] = (acc[priority] || 0) + 1
    return acc
  }, {} as Record<string, number>)
}

export function useIssue(issueId: string, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: queryKeys.issue(issueId),
    queryFn: () => issuesService.getIssueById(issueId),
    enabled: !!issueId && (options?.enabled ?? true),
    ...queryDefaults.standard,
    ...getEntityCacheConfig('issue') // Use unified config for issue cache timing
  })
}

export function useIssueComments(
  issueId: string,
  pagination?: { limit?: number; offset?: number }
) {
  return useQuery({
    queryKey: queryKeys.issueComments(issueId),
    queryFn: () => issuesService.getComments(issueId, pagination),
    enabled: !!issueId,
    ...queryDefaults.realtime,
    ...getEntityCacheConfig('issueComments') // Use unified config for issue comments cache timing
  })
}

export function useIssueActivity(
  issueId: string,
  pagination?: { limit?: number; offset?: number }
) {
  return useQuery({
    queryKey: queryKeys.issueActivity(issueId),
    queryFn: () => issuesService.getIssueActivity(issueId, pagination),
    enabled: !!issueId,
    ...queryDefaults.standard,
    ...getEntityCacheConfig('issueActivity') // Use unified config for issue activity cache timing
  })
}

export function useIssueStats(filters?: IssueFilters) {
  const { isAuthenticated } = useAuthStore()

  return useQuery({
    queryKey: queryKeys.issueStats(filters),
    queryFn: () => issuesService.getIssueStats(filters),
    enabled: isAuthenticated,
    ...queryDefaults.standard,
    ...getEntityCacheConfig('issueStats') // Use unified config for issue stats cache timing
  })
}

export function useMyIssues(status?: string[], pagination?: { limit?: number; offset?: number }) {
  const { isAuthenticated } = useAuthStore()

  return useQuery({
    queryKey: queryKeys.myIssues(),
    queryFn: () => issuesService.getMyIssues(status as any, pagination),
    enabled: isAuthenticated,
    ...queryDefaults.realtime,
    ...getEntityCacheConfig('myIssues') // Use unified config for my issues cache timing
  })
}

export function useOverdueIssues(pagination?: { limit?: number; offset?: number }) {
  const { isAuthenticated } = useAuthStore()

  return useQuery({
    queryKey: queryKeys.overdueIssues(),
    queryFn: () => issuesService.getOverdueIssues(pagination),
    enabled: isAuthenticated,
    ...queryDefaults.realtime,
    ...getEntityCacheConfig('overdueIssues') // Use unified config for overdue issues cache timing
  })
}

export function useSearchIssues(request: IssueSearchRequest, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: queryKeys.search(request.query, ['issues']),
    queryFn: async () => {
      const startTime = performance.now()
      log.debug('Searching issues', { 
        query: request.query,
        searchFields: request.fields,
        filters: request.filters ? Object.keys(request.filters) : []
      })
      
      try {
        const result = await issuesService.searchIssues(request)
        const endTime = performance.now()
        
        log.debug('Issues search completed', {
          duration: Math.round(endTime - startTime),
          query: request.query,
          resultCount: result.data.length || 0,
          total: result.total
        })
        
        return result
      } catch (error) {
        const endTime = performance.now()
        log.error('Issues search failed', {
          duration: Math.round(endTime - startTime),
          query: request.query,
          error: error instanceof Error ? error.message : 'Unknown error'
        })
        throw error
      }
    },
    enabled: !!request.query && (options?.enabled ?? true),
    ...queryDefaults.standard,
    ...getEntityCacheConfig('search') // Use unified config for search cache timing
  })
}

// Mutation hooks
export function useCreateIssue() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (data: CreateIssueRequest) => {
      const startTime = performance.now()
      log.debug('Creating new issue', { 
        title: data.title.substring(0, 50),
        priority: data.priority,
        assigneeId: data.assigneeId,
        companyId: data.companyId,
        fieldsProvided: Object.keys(data)
      })
      
      try {
        const result = await issuesService.createIssue(data)
        const endTime = performance.now()
        
        log.info('Issue created successfully', {
          duration: Math.round(endTime - startTime),
          issueId: result._id,
          title: result.title.substring(0, 50),
          priority: result.priority
        })
        
        return result
      } catch (error) {
        const endTime = performance.now()
        log.error('Issue creation failed', {
          duration: Math.round(endTime - startTime),
          title: data.title.substring(0, 50),
          error: error instanceof Error ? error.message : 'Unknown error'
        })
        throw error
      }
    },
    onSuccess: (newIssue: Issue) => {
      log.debug('Updating cache after issue creation', { issueId: newIssue._id })
      
      // Add to query cache optimistically
      queryClient.setQueryData(queryKeys.issue(newIssue._id), newIssue)

      // Invalidate lists to include new issue
      queryClient.invalidateQueries({ queryKey: queryKeys.issues })
      queryClient.invalidateQueries({ queryKey: queryKeys.issueStats() })

      // Update my issues if assigned to current user
      const session = queryClient.getQueryData(queryKeys.session())
      if (session && newIssue.assigneeId === (session as any).user?.id) {
        log.debug('Updating my issues cache - issue assigned to current user')
        queryClient.invalidateQueries({ queryKey: queryKeys.myIssues() })
      }
    },
    onError: (error) => {
      log.error('Issue creation mutation failed', {
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    },
    meta: {
      successMessage: 'Issue created successfully'
    }
  })
}

export function useUpdateIssue() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ issueId, updates }: { issueId: string; updates: UpdateIssueRequest }) =>
      issuesService.updateIssue(issueId, updates),
    onMutate: async ({ issueId, updates }) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: queryKeys.issue(issueId) })

      // Snapshot previous value
      const previousIssue = queryClient.getQueryData(queryKeys.issue(issueId))

      // Optimistically update
      queryClient.setQueryData(queryKeys.issue(issueId), (old: Issue | undefined) => {
        if (!old) return old
        return { ...old, ...updates, updatedAt: new Date().toISOString() }
      })

      return { previousIssue }
    },
    onError: (err, { issueId }, context) => {
      // Revert optimistic update
      if (context?.previousIssue) {
        queryClient.setQueryData(queryKeys.issue(issueId), context.previousIssue)
      }
    },
    onSettled: (data, error, { issueId }) => {
      // Refresh the issue
      queryClient.invalidateQueries({ queryKey: queryKeys.issue(issueId) })

      // Invalidate related queries
      queryClient.invalidateQueries({ queryKey: queryKeys.issues })
      queryClient.invalidateQueries({ queryKey: queryKeys.issueStats() })
    },
    meta: {
      successMessage: 'Issue updated successfully'
    }
  })
}

export function useDeleteIssue() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (issueId: string) => issuesService.deleteIssue(issueId),
    onSuccess: (_, issueId) => {
      // Remove from cache
      queryClient.removeQueries({ queryKey: queryKeys.issue(issueId) })

      // Update lists
      queryClient.invalidateQueries({ queryKey: queryKeys.issues })
      queryClient.invalidateQueries({ queryKey: queryKeys.issueStats() })
      queryClient.invalidateQueries({ queryKey: queryKeys.myIssues() })
    },
    meta: {
      successMessage: 'Issue deleted successfully'
    }
  })
}

export function useBulkUpdateIssues() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (request: BulkUpdateRequest) => {
      const startTime = performance.now()
      log.debug('Starting bulk update of issues', { 
        issueCount: request.issueIds.length || 0,
        updateFields: Object.keys(request.updates || {})
      })
      
      try {
        const result = await issuesService.bulkUpdateIssues(request)
        const endTime = performance.now()
        
        log.info('Bulk issue update completed successfully', {
          duration: Math.round(endTime - startTime),
          updatedCount: result.length,
          requestedCount: request.issueIds.length || 0
        })
        
        return result
      } catch (error) {
        const endTime = performance.now()
        log.error('Bulk issue update failed', {
          duration: Math.round(endTime - startTime),
          issueCount: request.issueIds.length || 0,
          error: error instanceof Error ? error.message : 'Unknown error'
        })
        throw error
      }
    },
    onSuccess: (updatedIssues, request) => {
      log.debug('Updating caches after bulk issue update', { 
        updatedCount: updatedIssues.length 
      })
      
      // Update individual issue caches
      updatedIssues.forEach((issue: Issue) => {
        queryClient.setQueryData(queryKeys.issue(issue._id), issue)
      })

      // Invalidate list queries
      queryClient.invalidateQueries({ queryKey: queryKeys.issues })
      queryClient.invalidateQueries({ queryKey: queryKeys.issueStats() })
    },
    onError: (error) => {
      log.error('Bulk issue update mutation failed', {
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    },
    meta: {
      successMessage: 'Issues updated successfully'
    }
  })
}

export function useAddComment() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      issueId,
      content,
      isInternal = false,
      attachments
    }: {
      issueId: string
      content: string
      isInternal?: boolean
      attachments?: string[]
    }) => issuesService.addComment(issueId, content, isInternal, attachments),
    onSuccess: (newComment, { issueId }) => {
      // Update comments cache
      queryClient.setQueryData(
        queryKeys.issueComments(issueId),
        (old: PaginatedResponse<Comment> | undefined) => {
          if (!old) return old
          return {
            ...old,
            data: [newComment, ...old.data],
            total: old.total + 1
          }
        }
      )

      // Invalidate activity to include new comment
      queryClient.invalidateQueries({ queryKey: queryKeys.issueActivity(issueId) })
    },
    meta: {
      successMessage: 'Comment added successfully'
    }
  })
}

export function useAssignIssue() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ issueId, assigneeId }: { issueId: string; assigneeId: string }) =>
      issuesService.assignIssue(issueId, assigneeId),
    onSuccess: (updatedIssue, { issueId }) => {
      queryClient.setQueryData(queryKeys.issue(issueId), updatedIssue)
      queryClient.invalidateQueries({ queryKey: queryKeys.issues })
      queryClient.invalidateQueries({ queryKey: queryKeys.myIssues() })
    },
    meta: {
      successMessage: 'Issue assigned successfully'
    }
  })
}

export function useResolveIssue() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ issueId, resolution }: { issueId: string; resolution: any }) =>
      issuesService.resolveIssue(issueId, resolution),
    onSuccess: (updatedIssue, { issueId }) => {
      queryClient.setQueryData(queryKeys.issue(issueId), updatedIssue)
      queryClient.invalidateQueries({ queryKey: queryKeys.issues })
      queryClient.invalidateQueries({ queryKey: queryKeys.issueStats() })
    },
    meta: {
      successMessage: 'Issue resolved successfully'
    }
  })
}

export function useExportIssues() {
  return useMutation({
    mutationFn: async (options: any) => {
      const startTime = performance.now()
      log.debug('Starting issues export', { 
        format: options.format,
        hasFilters: !!options.filters && Object.keys(options.filters).length > 0,
        fieldCount: options.fields?.length || 0
      })
      
      try {
        const result = await issuesService.exportIssues(options)
        const endTime = performance.now()
        
        log.info('Issues export completed successfully', {
          duration: Math.round(endTime - startTime),
          format: options.format,
          downloadUrl: `${result.substring(0, 50)}...` // Log partial URL for privacy
        })
        
        return result
      } catch (error) {
        const endTime = performance.now()
        log.error('Issues export failed', {
          duration: Math.round(endTime - startTime),
          format: options.format,
          error: error instanceof Error ? error.message : 'Unknown error'
        })
        throw error
      }
    },
    onSuccess: downloadUrl => {
      log.debug('Triggering issues export download')
      // Trigger download
      const link = document.createElement('a')
      link.href = downloadUrl
      link.download = 'issues-export'
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
    },
    meta: {
      successMessage: 'Export started successfully'
    }
  })
}

// Real-time subscriptions
export function useIssueSubscription(issueId: string) {
  const queryClient = useQueryClient()

  React.useEffect(() => {
    if (!issueId) return

    // Set up real-time subscription (WebSocket, SSE, or polling)
    const interval = setInterval(() => {
      queryClient.invalidateQueries({ queryKey: queryKeys.issue(issueId) })
      queryClient.invalidateQueries({ queryKey: queryKeys.issueComments(issueId) })
      queryClient.invalidateQueries({ queryKey: queryKeys.issueActivity(issueId) })
    }, 30000) // Poll every 30 seconds

    return () => clearInterval(interval)
  }, [issueId, queryClient])
}

// Custom hooks for derived state
export function useIssueFilters() {
  const [filters, setFilters] = React.useState<IssueFilters>({})
  const [debouncedFilters, setDebouncedFilters] = React.useState<IssueFilters>({})

  // Debounce filter changes to avoid too many API calls
  React.useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedFilters(filters)
    }, 500)

    return () => clearTimeout(timer)
  }, [filters])

  return {
    filters,
    debouncedFilters,
    setFilters,
    updateFilter: (key: keyof IssueFilters, value: any) => {
      setFilters(prev => ({ ...prev, [key]: value }))
    },
    clearFilters: () => setFilters({}),
    hasActiveFilters: Object.keys(filters).length > 0
  }
}

export function useIssueActions(issueId: string) {
  const updateMutation = useUpdateIssue()
  const deleteMutation = useDeleteIssue()
  const assignMutation = useAssignIssue()
  const resolveMutation = useResolveIssue()

  return {
    update: (updates: UpdateIssueRequest) => updateMutation.mutate({ issueId, updates }),
    delete: () => deleteMutation.mutate(issueId),
    assign: (assigneeId: string) => assignMutation.mutate({ issueId, assigneeId }),
    resolve: (resolution: any) => resolveMutation.mutate({ issueId, resolution }),
    isLoading:
      updateMutation.isPending ||
      deleteMutation.isPending ||
      assignMutation.isPending ||
      resolveMutation.isPending
  }
}

// Optimistic updates helper
export function useOptimisticIssueUpdate() {
  const queryClient = useQueryClient()

  return React.useCallback(
    (issueId: string, updates: Partial<Issue>) => {
      queryClient.setQueryData(queryKeys.issue(issueId), (old: Issue | undefined) => {
        if (!old) return old
        return { ...old, ...updates }
      })
    },
    [queryClient]
  )
}
