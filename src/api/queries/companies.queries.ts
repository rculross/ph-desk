import React from 'react'

import {
  useQuery,
  useMutation,
  useQueryClient,
  useInfiniteQuery,
  keepPreviousData
} from '@tanstack/react-query'

import { useAuthStore } from '../../stores/auth.store'
import { logger } from '../../utils/logger'
import { getEntityCacheConfig } from '../config'
import { queryKeys, queryDefaults } from '../query-client'
import { companiesService } from '../services/companies.service'

const log = logger.api
import type {
  Company,
  Integration
} from '../../types'

// Request types
interface CreateCompanyRequest {
  name: string
  status: 'prospect' | 'trial' | 'customer' | 'churned' | 'paused'
  tags: string[]
  customFields: Record<string, any>
  slug?: string
  domain?: string
  description?: string
  industry?: string
  size?: 'startup' | 'small' | 'medium' | 'large' | 'enterprise'
  externalId?: string
  [key: string]: any
}

interface UpdateCompanyRequest {
  name?: string
  status?: 'prospect' | 'trial' | 'customer' | 'churned' | 'paused'
  tags?: string[]
  customFields?: Record<string, any>
  slug?: string
  domain?: string
  description?: string
  industry?: string
  size?: 'startup' | 'small' | 'medium' | 'large' | 'enterprise'
  externalId?: string
  [key: string]: any
}

// Additional missing types
interface CompanyFilters {
  search?: string
  industry?: string
  size?: 'startup' | 'small' | 'medium' | 'large' | 'enterprise' | ('startup' | 'small' | 'medium' | 'large' | 'enterprise')[]
  status?: 'prospect' | 'trial' | 'customer' | 'churned' | 'paused' | ('prospect' | 'trial' | 'customer' | 'churned' | 'paused')[]
  createdAt?: any
  updatedAt?: any
  lastActivityDate?: any
  [key: string]: any
}

interface CompanyStats {
  totalCompanies: number
  activeCompanies: number
  totalRevenue: number
  avgHealthScore: number
}

interface CompanyHealthMetrics {
  score: number
  trend: string
  factors: string[]
}

interface CompanyActivity {
  id: string
  type: string
  description: string
  timestamp: string
}

interface CompanyIntegrationStatus {
  connected: boolean
  lastSync?: string
  status: string
  integrations?: Integration[]
  totalIntegrations?: number
  activeIntegrations?: number
}

/**
 * Companies Query Hooks
 *
 * Custom hooks for company-related data fetching and mutations
 * with health scoring, integration management, and analytics.
 */

// Query hooks
export function useCompanies(
  filters?: CompanyFilters,
  pagination?: { limit?: number; offset?: number; sort?: string; sortOrder?: 'asc' | 'desc' },
  options?: { enabled?: boolean }
) {
  const { isAuthenticated } = useAuthStore()

  return useQuery({
    queryKey: queryKeys.list('companies', filters, pagination),
    queryFn: async () => {
      const startTime = performance.now()
      log.debug('Initiating companies query', { 
        filters: filters ? Object.keys(filters) : [],
        pagination,
        hasFilters: !!filters && Object.keys(filters).length > 0
      })
      
      try {
        const result = await companiesService.getCompanies(filters as any, pagination)
        const endTime = performance.now()
        
        log.debug('Companies query completed successfully', {
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
        log.error('Companies query failed', {
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
    ...getEntityCacheConfig('companies') // Use unified config for companies cache timing
  })
}

export function useCompaniesInfinite(filters?: CompanyFilters, limit: number = 25) {
  const { isAuthenticated } = useAuthStore()

  return useInfiniteQuery({
    queryKey: queryKeys.infinite('companies', filters),
    queryFn: async ({ pageParam }: { pageParam: number }) => {
      const offset = pageParam * limit
      const startTime = performance.now()
      
      log.debug('Initiating infinite companies query page', { 
        page: pageParam,
        offset,
        limit,
        filters: filters ? Object.keys(filters) : []
      })
      
      try {
        const result = await companiesService.getCompanies(filters as any, { limit, offset })
        const endTime = performance.now()
        
        log.debug('Infinite companies query page completed', {
          duration: Math.round(endTime - startTime),
          page: pageParam,
          recordCount: result.data.length || 0,
          hasMore: result.hasMore
        })
        
        return result
      } catch (error) {
        const endTime = performance.now()
        log.error('Infinite companies query page failed', {
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
      log.debug('Infinite query reached end of data')
      return undefined
    },
    maxPages: 50, // Circuit breaker: prevent loading too many pages
    retry: 3, // Limit retries to 3 attempts
    retryDelay: (attemptIndex) => Math.min(1000 * Math.pow(2, attemptIndex), 10000),
    ...queryDefaults.standard,
    ...getEntityCacheConfig('companies') // Use unified config for companies cache timing
  })
}

export function useCompany(companyId: string, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: queryKeys.company(companyId),
    queryFn: async () => {
      const startTime = performance.now()
      log.debug('Fetching individual company', { companyId })
      
      try {
        const result = await companiesService.getCompanyById(companyId)
        const endTime = performance.now()
        
        log.debug('Company fetch completed successfully', {
          duration: Math.round(endTime - startTime),
          companyId,
          companyName: result?.name,
          companyStatus: result?.status
        })
        
        return result
      } catch (error) {
        const endTime = performance.now()
        log.error('Company fetch failed', {
          duration: Math.round(endTime - startTime),
          companyId,
          error: error instanceof Error ? error.message : 'Unknown error'
        })
        throw error
      }
    },
    enabled: !!companyId && (options?.enabled ?? true),
    ...queryDefaults.standard,
    ...getEntityCacheConfig('company') // Use unified config for company cache timing
  })
}

export function useCompanyBySlug(slug: string, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: [...queryKeys.companies, 'slug', slug],
    queryFn: () => companiesService.getCompanyBySlug(slug),
    enabled: !!slug && (options?.enabled ?? true),
    ...queryDefaults.standard,
    ...getEntityCacheConfig('companyBySlug') // Use unified config for company by slug cache timing
  })
}

export function useCompanyStats(filters?: CompanyFilters) {
  const { isAuthenticated } = useAuthStore()

  return useQuery({
    queryKey: queryKeys.companyStats(filters),
    queryFn: () => companiesService.getCompanyStats(filters),
    enabled: isAuthenticated,
    ...queryDefaults.standard,
    ...getEntityCacheConfig('companyStats') // Use unified config for company stats cache timing
  })
}

export function useCompanyHealth(companyId: string, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: queryKeys.companyHealth(companyId),
    queryFn: () => companiesService.getCompanyHealth(companyId),
    enabled: !!companyId && (options?.enabled ?? true),
    ...queryDefaults.realtime,
    ...getEntityCacheConfig('companyHealth') // Use unified config for company health cache timing
  })
}

export function useCompanyActivity(
  companyId: string,
  pagination?: { limit?: number; offset?: number },
  filters?: { startDate?: string; endDate?: string; activityTypes?: string[] }
) {
  return useQuery({
    queryKey: queryKeys.companyActivity(companyId),
    queryFn: () => companiesService.getCompanyActivity(companyId, pagination, filters),
    enabled: !!companyId,
    ...queryDefaults.realtime,
    staleTime: 60 * 1000 // Activity is real-time
  })
}

export function useCompanyIssues(
  companyId: string,
  pagination?: { limit?: number; offset?: number },
  filters?: { status?: string[]; priority?: string[] }
) {
  return useQuery({
    queryKey: queryKeys.companyIssues(companyId),
    queryFn: () => companiesService.getCompanyIssues(companyId, pagination, filters),
    enabled: !!companyId,
    ...queryDefaults.standard,
    staleTime: 2 * 60 * 1000
  })
}

export function useCompanyIntegrations(companyId: string, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: queryKeys.companyIntegrations(companyId),
    queryFn: () => companiesService.getCompanyIntegrations(companyId),
    enabled: !!companyId && (options?.enabled ?? true),
    ...queryDefaults.standard,
    staleTime: 5 * 60 * 1000
  })
}

export function useAtRiskCompanies(
  threshold: number = 50,
  pagination?: { limit?: number; offset?: number }
) {
  const { isAuthenticated } = useAuthStore()

  return useQuery({
    queryKey: [...queryKeys.companies, 'at-risk', threshold],
    queryFn: () => companiesService.getAtRiskCompanies(threshold, pagination),
    enabled: isAuthenticated,
    ...queryDefaults.realtime,
    staleTime: 5 * 60 * 1000 // At-risk companies need frequent monitoring
  })
}

export function useHighValueCompanies(
  minArr: number = 50000,
  pagination?: { limit?: number; offset?: number }
) {
  const { isAuthenticated } = useAuthStore()

  return useQuery({
    queryKey: [...queryKeys.companies, 'high-value', minArr],
    queryFn: () => companiesService.getHighValueCompanies(minArr, pagination),
    enabled: isAuthenticated,
    ...queryDefaults.standard,
    staleTime: 10 * 60 * 1000
  })
}

export function useSearchCompanies(
  query: string,
  filters?: Partial<CompanyFilters>,
  pagination?: { limit?: number; offset?: number },
  options?: { enabled?: boolean }
) {
  return useQuery({
    queryKey: queryKeys.search(query, ['companies']),
    queryFn: () => companiesService.searchCompanies(query, filters, pagination),
    enabled: !!query && (options?.enabled ?? true),
    ...queryDefaults.standard,
    staleTime: 5 * 60 * 1000
  })
}

// Mutation hooks
export function useCreateCompany() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (data: CreateCompanyRequest) => {
      const startTime = performance.now()
      log.debug('Creating new company', { 
        companyName: data.name,
        fieldsProvided: Object.keys(data)
      })
      
      try {
        const result = await companiesService.createCompany(data)
        const endTime = performance.now()
        
        log.info('Company created successfully', {
          duration: Math.round(endTime - startTime),
          companyId: result._id,
          companyName: result.name
        })
        
        return result
      } catch (error) {
        const endTime = performance.now()
        log.error('Company creation failed', {
          duration: Math.round(endTime - startTime),
          companyName: data.name,
          error: error instanceof Error ? error.message : 'Unknown error'
        })
        throw error
      }
    },
    onSuccess: (newCompany: Company) => {
      log.debug('Updating cache after company creation', { companyId: newCompany._id })
      
      // Add to cache
      queryClient.setQueryData(queryKeys.company(newCompany._id), newCompany)

      // Invalidate lists
      queryClient.invalidateQueries({ queryKey: queryKeys.companies })
      queryClient.invalidateQueries({ queryKey: queryKeys.companyStats() })
    },
    onError: (error) => {
      log.error('Company creation mutation failed', {
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    },
    meta: {
      successMessage: 'Company created successfully'
    }
  })
}

export function useUpdateCompany() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ companyId, updates }: { companyId: string; updates: UpdateCompanyRequest }) => {
      const startTime = performance.now()
      log.debug('Updating company', { 
        companyId,
        updateFields: Object.keys(updates)
      })
      
      try {
        const result = await companiesService.updateCompany(companyId, updates)
        const endTime = performance.now()
        
        log.info('Company updated successfully', {
          duration: Math.round(endTime - startTime),
          companyId,
          updateFields: Object.keys(updates)
        })
        
        return result
      } catch (error) {
        const endTime = performance.now()
        log.error('Company update failed', {
          duration: Math.round(endTime - startTime),
          companyId,
          error: error instanceof Error ? error.message : 'Unknown error'
        })
        throw error
      }
    },
    onMutate: async ({ companyId, updates }) => {
      log.debug('Applying optimistic update for company', { companyId })
      await queryClient.cancelQueries({ queryKey: queryKeys.company(companyId) })

      const previousCompany = queryClient.getQueryData(queryKeys.company(companyId))

      queryClient.setQueryData(queryKeys.company(companyId), (old: Company | undefined) => {
        if (!old) return old
        return { ...old, ...updates, updatedAt: new Date().toISOString() }
      })

      return { previousCompany }
    },
    onError: (err, { companyId }, context) => {
      log.warn('Reverting optimistic update due to error', { 
        companyId,
        error: err instanceof Error ? err.message : 'Unknown error'
      })
      if (context?.previousCompany) {
        queryClient.setQueryData(queryKeys.company(companyId), context.previousCompany)
      }
    },
    onSettled: (data, error, { companyId }) => {
      log.debug('Invalidating company caches after update', { companyId })
      queryClient.invalidateQueries({ queryKey: queryKeys.company(companyId) })
      queryClient.invalidateQueries({ queryKey: queryKeys.companies })
      queryClient.invalidateQueries({ queryKey: queryKeys.companyStats() })
    },
    meta: {
      successMessage: 'Company updated successfully'
    }
  })
}

export function useDeleteCompany() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (companyId: string) => companiesService.deleteCompany(companyId),
    onSuccess: (_, companyId) => {
      queryClient.removeQueries({ queryKey: queryKeys.company(companyId) })
      queryClient.invalidateQueries({ queryKey: queryKeys.companies })
      queryClient.invalidateQueries({ queryKey: queryKeys.companyStats() })
    },
    meta: {
      successMessage: 'Company deleted successfully'
    }
  })
}

export function useUpdateHealthScore() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (companyId: string) => companiesService.updateHealthScore(companyId),
    onSuccess: (healthScore, companyId) => {
      // Update company cache with new health score
      queryClient.setQueryData(queryKeys.company(companyId), (old: Company | undefined) => {
        if (!old) return old
        return { ...old, health: healthScore }
      })

      // Invalidate health-specific query
      queryClient.invalidateQueries({ queryKey: queryKeys.companyHealth(companyId) })

      // Invalidate at-risk companies as health score changed
      queryClient.invalidateQueries({ queryKey: [...queryKeys.companies, 'at-risk'] })
    },
    meta: {
      successMessage: 'Health score updated successfully'
    }
  })
}

export function useAddIntegration() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      companyId,
      integration
    }: {
      companyId: string
      integration: Omit<Integration, '_id'>
    }) => companiesService.addIntegration(companyId, integration),
    onSuccess: (newIntegration, { companyId }) => {
      // Update integrations cache
      queryClient.setQueryData(
        queryKeys.companyIntegrations(companyId),
        (old: CompanyIntegrationStatus | undefined) => {
          if (!old) return old
          return {
            ...old,
            integrations: [
              ...(old.integrations || []),
              {
                type: newIntegration.type,
                name: newIntegration.name,
                status: newIntegration.status,
                lastSync: newIntegration.lastSync,
                config: newIntegration.config
              }
            ],
            totalIntegrations: (old.totalIntegrations || 0) + 1,
            activeIntegrations:
              newIntegration.status === 'active'
                ? (old.activeIntegrations || 0) + 1
                : (old.activeIntegrations || 0)
          }
        }
      )
    },
    meta: {
      successMessage: 'Integration added successfully'
    }
  })
}

export function useSyncIntegration() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ companyId, integrationId }: { companyId: string; integrationId: string }) =>
      companiesService.syncIntegration(companyId, integrationId),
    onSuccess: (result, { companyId }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.companyIntegrations(companyId) })
      queryClient.invalidateQueries({ queryKey: queryKeys.companyActivity(companyId) })
    },
    meta: {
      successMessage: 'Integration synced successfully'
    }
  })
}

export function useAddTags() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ companyId, tags }: { companyId: string; tags: string[] }) =>
      companiesService.addTags(companyId, tags),
    onSuccess: (updatedCompany, { companyId }) => {
      queryClient.setQueryData(queryKeys.company(companyId), updatedCompany)
      queryClient.invalidateQueries({ queryKey: queryKeys.companies })
    },
    meta: {
      successMessage: 'Tags added successfully'
    }
  })
}

export function useExportCompanies() {
  return useMutation({
    mutationFn: async ({
      format,
      filters,
      fields
    }: {
      format: 'csv' | 'xlsx' | 'json'
      filters?: CompanyFilters
      fields?: string[]
    }) => {
      const startTime = performance.now()
      log.debug('Starting companies export', { 
        format,
        hasFilters: !!filters && Object.keys(filters).length > 0,
        fieldCount: fields?.length || 0
      })
      
      try {
        const result = await companiesService.exportCompanies(format, filters, fields)
        const endTime = performance.now()
        
        log.info('Companies export completed successfully', {
          duration: Math.round(endTime - startTime),
          format,
          downloadUrl: `${result.substring(0, 50)}...` // Log partial URL for privacy
        })
        
        return result
      } catch (error) {
        const endTime = performance.now()
        log.error('Companies export failed', {
          duration: Math.round(endTime - startTime),
          format,
          error: error instanceof Error ? error.message : 'Unknown error'
        })
        throw error
      }
    },
    onSuccess: downloadUrl => {
      log.debug('Triggering companies export download')
      const link = document.createElement('a')
      link.href = downloadUrl
      link.download = 'companies-export'
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
    },
    meta: {
      successMessage: 'Export started successfully'
    }
  })
}

// Custom hooks for derived state
export function useCompanyFilters() {
  const [filters, setFilters] = React.useState<CompanyFilters>({})
  const [debouncedFilters, setDebouncedFilters] = React.useState<CompanyFilters>({})

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
    updateFilter: (key: keyof CompanyFilters, value: any) => {
      setFilters(prev => ({ ...prev, [key]: value }))
    },
    clearFilters: () => setFilters({}),
    hasActiveFilters: Object.keys(filters).length > 0
  }
}

export function useCompanyActions(companyId: string) {
  const updateMutation = useUpdateCompany()
  const deleteMutation = useDeleteCompany()
  const updateHealthMutation = useUpdateHealthScore()
  const addTagsMutation = useAddTags()

  return {
    update: (updates: UpdateCompanyRequest) => updateMutation.mutate({ companyId, updates }),
    delete: () => deleteMutation.mutate(companyId),
    updateHealth: () => updateHealthMutation.mutate(companyId),
    addTags: (tags: string[]) => addTagsMutation.mutate({ companyId, tags }),
    isLoading:
      updateMutation.isPending ||
      deleteMutation.isPending ||
      updateHealthMutation.isPending ||
      addTagsMutation.isPending
  }
}

export function useCompanyHealthMonitoring(companyId: string) {
  const queryClient = useQueryClient()

  React.useEffect(() => {
    if (!companyId) return

    // Set up periodic health score updates
    const interval = setInterval(
      () => {
        queryClient.invalidateQueries({ queryKey: queryKeys.companyHealth(companyId) })
      },
      5 * 60 * 1000
    ) // Every 5 minutes

    return () => clearInterval(interval)
  }, [companyId, queryClient])
}
