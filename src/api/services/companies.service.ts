import { subDays } from 'date-fns'

import type {
  Company,
  CompanySize,
  CompanyStatus,
  HealthScore,
  Integration,
  User,
  Issue,
  Activity,
  PaginatedResponse,
  ApiResponse
} from '../../types'
import { logger } from '../../utils/logger'
import { getHttpClient, type RequestOptions } from '../client/http-client'

interface ApiRequestOptions extends RequestOptions {
  priority?: 'low' | 'normal' | 'high' | 'critical'
  complexity?: 'simple' | 'moderate' | 'complex' | 'heavy'
}
import {
  createCompanyRequestSchema,
  updateCompanyRequestSchema,
  companyResponseSchema,
  companyFiltersSchema,
  paginationParamsSchema,
  paginatedResponseSchema,
  apiResponseSchema,
  type CreateCompanyRequest,
  type UpdateCompanyRequest,
  type CompanyResponse,
  type CompanyFilters
} from '../schemas'
import { fetchAllRecords } from '../utils/pagination'

import { ensureTenantSlug as ensureSharedTenantSlug } from './tenant.service'

const log = logger.api

/**
 * Service for company-related API operations
 *
 * Provides comprehensive company management including CRUD operations,
 * health scoring, integration management, and company analytics.
 */

// Request/Response types are now imported from schemas
// Legacy types for backward compatibility
export type {
  CreateCompanyRequest,
  UpdateCompanyRequest,
  CompanyResponse,
  CompanyFilters
} from '../schemas'

export interface CompanyStats {
  total: number
  byStatus: Record<CompanyStatus, number>
  bySize: Record<CompanySize, number>
  byTier: Record<string, number>
  avgHealthScore: number
  totalMrr: number
  totalArr: number
  churnRate: number
  growthRate: number
  activeIntegrations: number
  recentlyActive: number
  atRisk: number
}

export interface CompanyHealthMetrics {
  companyId: string
  score: number
  trend: 'up' | 'down' | 'stable'
  factors: {
    productUsage: number
    supportTickets: number
    billingHealth: number
    engagement: number
    integrationHealth: number
  }
  recommendations: string[]
  lastCalculated: string
  history: {
    date: string
    score: number
  }[]
}

export interface CompanyActivity {
  companyId: string
  activities: Activity[]
  summary: {
    totalActivities: number
    lastActivity: string
    mostCommonActivity: string
    activeUsers: number
    featureUsage: Record<string, number>
  }
}

export interface BulkCompanyOperation {
  companyIds: string[]
  operation: 'update' | 'delete' | 'tag' | 'change-status' | 'change-owner'
  data?: any
}

export interface CompanyIntegrationStatus {
  companyId: string
  integrations: {
    type: string
    name: string
    status: 'active' | 'inactive' | 'error' | 'setup-required'
    lastSync?: string
    syncStatus?: string
    errorMessage?: string
    config: Record<string, any>
  }[]
  totalIntegrations: number
  activeIntegrations: number
  healthScore: number
}

/**
 * Companies Service Class
 */
class CompaniesService {
  private get httpClient() {
    return getHttpClient()
  }

  /**
   * Ensure tenant slug is set before making API calls
   */
  private async ensureTenantSlug(): Promise<void> {
    await ensureSharedTenantSlug({ context: 'API calls', logger: log })
  }

  /**
   * Get paginated list of companies with optional filtering
   */
  async getCompanies(
    filters?: CompanyFilters,
    pagination?: { limit?: number; offset?: number; sort?: string; sortOrder?: 'asc' | 'desc' },
    options?: ApiRequestOptions
  ): Promise<PaginatedResponse<Company>> {
    // Ensure tenant slug is set before making API calls
    await this.ensureTenantSlug()

    try {
      const params = {
        limit: pagination?.limit || 500,
        offset: pagination?.offset || 0,
        sort: pagination?.sort || 'name',
        sortOrder: pagination?.sortOrder,
        ...filters
      }

      log.debug('Fetching companies via HTTP client', params)

      // Fetch companies using HTTP client
      const response = await this.httpClient.get<PaginatedResponse<Company>>(
        '/companies',
        params,
        {
          metadata: {
            priority: options?.priority || 'normal',
            complexity: options?.complexity || 'moderate'
          }
        }
      )

      // Companies endpoint returns paginated response
      return response || {
        data: [],
        total: 0,
        limit: pagination?.limit || 500,
        offset: pagination?.offset || 0,
        hasMore: false
      }
    } catch (error) {
      log.error('Failed to fetch companies:', error)
      throw error
    }
  }

  /**
   * Get a single company by ID
   */
  async getCompanyById(companyId: string, options?: ApiRequestOptions): Promise<Company | null> {
    // Ensure tenant slug is set before making API calls
    await this.ensureTenantSlug()

    try {
      const response = await this.httpClient.get<{ data: Company }>(
        `/companies/${companyId}`,
        undefined,
        {
          metadata: {
            priority: options?.priority || 'normal',
            complexity: options?.complexity || 'moderate'
          }
        }
      )
      return response.data || null
    } catch (error) {
      log.error('Failed to get company by ID:', error)
      return null
    }
  }

  /**
   * Get company by slug
   */
  async getCompanyBySlug(slug: string, options?: ApiRequestOptions): Promise<Company | null> {
    // Ensure tenant slug is set before making API calls
    await this.ensureTenantSlug()

    try {
      const response = await this.httpClient.get<{ data: Company }>(
        `/companies/slug/${slug}`,
        undefined,
        {
          metadata: {
            priority: options?.priority || 'normal',
            complexity: options?.complexity || 'moderate'
          }
        }
      )
      return response.data || null
    } catch (error) {
      log.error('Failed to get company by slug:', error)
      return null
    }
  }

  /**
   * Create a new company
   */
  async createCompany(companyData: CreateCompanyRequest, options?: ApiRequestOptions): Promise<Company> {
    // Ensure tenant slug is set before making API calls
    await this.ensureTenantSlug()

    try {
      const response = await this.httpClient.post<{ data: Company }>(
        '/companies',
        companyData,
        {
          metadata: {
            priority: options?.priority || 'normal',
            complexity: options?.complexity || 'moderate'
          }
        }
      )

      if (!response.data) {
        throw new Error('No data returned from company creation')
      }

      return response.data
    } catch (error) {
      log.error('Failed to create company:', error)
      throw error
    }
  }

  /**
   * Update an existing company
   */
  async updateCompany(companyId: string, updates: UpdateCompanyRequest, options?: ApiRequestOptions): Promise<Company> {
    // Ensure tenant slug is set before making API calls
    await this.ensureTenantSlug()

    try {
      const response = await this.httpClient.patch<{ data: Company }>(
        `/companies/${companyId}`,
        updates,
        {
          metadata: {
            priority: options?.priority || 'normal',
            complexity: options?.complexity || 'moderate'
          }
        }
      )

      if (!response.data) {
        throw new Error('No data returned from company update')
      }

      return response.data
    } catch (error) {
      log.error('Failed to update company:', error)
      throw error
    }
  }

  /**
   * Delete a company
   */
  async deleteCompany(companyId: string, options?: ApiRequestOptions): Promise<void> {
    // Ensure tenant slug is set before making API calls
    await this.ensureTenantSlug()

    try {
      await this.httpClient.delete<void>(
        `/companies/${companyId}`,
        {
          metadata: {
            priority: options?.priority || 'normal',
            complexity: options?.complexity || 'moderate'
          }
        }
      )
    } catch (error) {
      log.error('Failed to delete company:', error)
      throw error
    }
  }

  /**
   * Get company statistics
   */
  async getCompanyStats(filters?: CompanyFilters, options?: ApiRequestOptions): Promise<CompanyStats> {
    try {
      // Ensure tenant slug is set before making API calls
      await this.ensureTenantSlug()

      const queryParams = new URLSearchParams()

      if (filters) {
        Object.entries(filters).forEach(([key, value]) => {
          if (value !== undefined && value !== null) {
            if (Array.isArray(value)) {
              value.forEach(v => queryParams.append(key, v))
            } else if (typeof value === 'object') {
              Object.entries(value).forEach(([operator, operatorValue]) => {
                queryParams.append(`${key}[${operator}]`, String(operatorValue))
              })
            } else {
              queryParams.append(key, String(value))
            }
          }
        })
      }

      const url = `/companies/stats${queryParams.toString() ? `?${queryParams.toString()}` : ''}`

      const response = await this.httpClient.get<ApiResponse<CompanyStats>>(
        url,
        undefined,
        {
          metadata: {
            priority: options?.priority || 'normal',
            complexity: options?.complexity || 'moderate'
          }
        }
      )

      return (
        response.data || {
          total: 0,
          byStatus: {} as Record<CompanyStatus, number>,
          bySize: {} as Record<CompanySize, number>,
          byTier: {},
          avgHealthScore: 0,
          totalMrr: 0,
          totalArr: 0,
          churnRate: 0,
          growthRate: 0,
          activeIntegrations: 0,
          recentlyActive: 0,
          atRisk: 0
        }
      )
    } catch (error) {
      log.error('Failed to get company stats:', error)
      throw error
    }
  }

  /**
   * Get company health metrics
   */
  async getCompanyHealth(companyId: string, options?: ApiRequestOptions): Promise<CompanyHealthMetrics | null> {
    try {
      // Ensure tenant slug is set before making API calls
      await this.ensureTenantSlug()

      const response = await this.httpClient.get<ApiResponse<CompanyHealthMetrics>>(
        `/companies/${companyId}/health`,
        undefined,
        {
          metadata: {
            priority: options?.priority || 'normal',
            complexity: options?.complexity || 'moderate'
          }
        }
      )
      return response.data || null
    } catch (error) {
      log.error('Failed to get company health:', error)
      return null
    }
  }

  /**
   * Update company health score
   */
  async updateHealthScore(companyId: string, options?: ApiRequestOptions): Promise<HealthScore> {
    try {
      // Ensure tenant slug is set before making API calls
      await this.ensureTenantSlug()

      const response = await this.httpClient.post<ApiResponse<HealthScore>>(
        `/companies/${companyId}/health/calculate`,
        undefined,
        {
          metadata: {
            priority: options?.priority || 'normal',
            complexity: options?.complexity || 'moderate'
          }
        }
      )

      if (!response.data) {
        throw new Error('No data returned from health score update')
      }

      return response.data
    } catch (error) {
      log.error('Failed to update health score:', error)
      throw error
    }
  }

  /**
   * Get company activity
   */
  async getCompanyActivity(
    companyId: string,
    pagination?: { limit?: number; offset?: number },
    filters?: { startDate?: string; endDate?: string; activityTypes?: string[] },
    options?: ApiRequestOptions
  ): Promise<CompanyActivity> {
    try {
      // Ensure tenant slug is set before making API calls
      await this.ensureTenantSlug()

      const queryParams = new URLSearchParams()

      if (pagination?.limit) queryParams.append('limit', pagination.limit.toString())
      if (pagination?.offset) queryParams.append('offset', pagination.offset.toString())
      if (filters?.startDate) queryParams.append('startDate', filters.startDate)
      if (filters?.endDate) queryParams.append('endDate', filters.endDate)
      if (filters?.activityTypes) {
        filters.activityTypes.forEach(type => queryParams.append('activityTypes', type))
      }

      const url = `/companies/${companyId}/activity${queryParams.toString() ? `?${queryParams.toString()}` : ''}`

      const response = await this.httpClient.get<ApiResponse<CompanyActivity>>(
        url,
        undefined,
        {
          metadata: {
            priority: options?.priority || 'normal',
            complexity: options?.complexity || 'moderate'
          }
        }
      )

      return (
        response.data || {
          companyId,
          activities: [],
          summary: {
            totalActivities: 0,
            lastActivity: '',
            mostCommonActivity: '',
            activeUsers: 0,
            featureUsage: {}
          }
        }
      )
    } catch (error) {
      log.error('Failed to get company activity:', error)
      throw error
    }
  }

  /**
   * Get company issues
   */
  async getCompanyIssues(
    companyId: string,
    pagination?: { limit?: number; offset?: number },
    filters?: { status?: string[]; priority?: string[] },
    options?: ApiRequestOptions
  ): Promise<PaginatedResponse<Issue>> {
    try {
      // Ensure tenant slug is set before making API calls
      await this.ensureTenantSlug()

      const queryParams = new URLSearchParams()

      queryParams.append('companyId', companyId)
      if (pagination?.limit) queryParams.append('limit', pagination.limit.toString())
      if (pagination?.offset) queryParams.append('offset', pagination.offset.toString())
      if (filters?.status) {
        filters.status.forEach(status => queryParams.append('status', status))
      }
      if (filters?.priority) {
        filters.priority.forEach(priority => queryParams.append('priority', priority))
      }

      const url = `/issues${queryParams.toString() ? `?${queryParams.toString()}` : ''}`

      const response = await this.httpClient.get<ApiResponse<PaginatedResponse<Issue>>>(
        url,
        undefined,
        {
          metadata: {
            priority: options?.priority || 'normal',
            complexity: options?.complexity || 'moderate'
          }
        }
      )

      return (
        response.data || {
          data: [],
          total: 0,
          limit: pagination?.limit || 2000,
          offset: pagination?.offset || 0,
          hasMore: false
        }
      )
    } catch (error) {
      log.error('Failed to get company issues:', error)
      throw error
    }
  }

  /**
   * Get company integrations
   */
  async getCompanyIntegrations(companyId: string, options?: ApiRequestOptions): Promise<CompanyIntegrationStatus> {
    try {
      // Ensure tenant slug is set before making API calls
      await this.ensureTenantSlug()

      const response = await this.httpClient.get<ApiResponse<CompanyIntegrationStatus>>(
        `/companies/${companyId}/integrations`,
        undefined,
        {
          metadata: {
            priority: options?.priority || 'normal',
            complexity: options?.complexity || 'moderate'
          }
        }
      )

      return (
        response.data || {
          companyId,
          integrations: [],
          totalIntegrations: 0,
          activeIntegrations: 0,
          healthScore: 0
        }
      )
    } catch (error) {
      log.error('Failed to get company integrations:', error)
      throw error
    }
  }

  /**
   * Add integration to company
   */
  async addIntegration(
    companyId: string,
    integration: Omit<Integration, '_id'>,
    options?: ApiRequestOptions
  ): Promise<Integration> {
    try {
      // Ensure tenant slug is set before making API calls
      await this.ensureTenantSlug()

      const response = await this.httpClient.post<ApiResponse<Integration>>(
        `/companies/${companyId}/integrations`,
        integration,
        {
          metadata: {
            priority: options?.priority || 'normal',
            complexity: options?.complexity || 'moderate'
          }
        }
      )

      if (!response.data) {
        throw new Error('No data returned from integration creation')
      }

      return response.data
    } catch (error) {
      log.error('Failed to add integration:', error)
      throw error
    }
  }

  /**
   * Update company integration
   */
  async updateIntegration(
    companyId: string,
    integrationId: string,
    updates: Partial<Integration>,
    options?: ApiRequestOptions
  ): Promise<Integration> {
    try {
      // Ensure tenant slug is set before making API calls
      await this.ensureTenantSlug()

      const response = await this.httpClient.patch<ApiResponse<Integration>>(
        `/companies/${companyId}/integrations/${integrationId}`,
        updates,
        {
          metadata: {
            priority: options?.priority || 'normal',
            complexity: options?.complexity || 'moderate'
          }
        }
      )

      if (!response.data) {
        throw new Error('No data returned from integration update')
      }

      return response.data
    } catch (error) {
      log.error('Failed to update integration:', error)
      throw error
    }
  }

  /**
   * Remove integration from company
   */
  async removeIntegration(companyId: string, integrationId: string, options?: ApiRequestOptions): Promise<void> {
    try {
      // Ensure tenant slug is set before making API calls
      await this.ensureTenantSlug()

      await this.httpClient.delete<void>(
        `/companies/${companyId}/integrations/${integrationId}`,
        {
          metadata: {
            priority: options?.priority || 'normal',
            complexity: options?.complexity || 'moderate'
          }
        }
      )
    } catch (error) {
      log.error('Failed to remove integration:', error)
      throw error
    }
  }

  /**
   * Sync company integration
   */
  async syncIntegration(
    companyId: string,
    integrationId: string,
    options?: ApiRequestOptions
  ): Promise<{
    success: boolean
    message: string
    lastSync: string
    recordsSynced?: number
  }> {
    try {
      // Ensure tenant slug is set before making API calls
      await this.ensureTenantSlug()

      const response = await this.httpClient.post<ApiResponse<any>>(
        `/companies/${companyId}/integrations/${integrationId}/sync`,
        undefined,
        {
          metadata: {
            priority: options?.priority || 'normal',
            complexity: options?.complexity || 'moderate'
          }
        }
      )

      return (
        response.data || {
          success: false,
          message: 'Sync failed',
          lastSync: new Date().toISOString()
        }
      )
    } catch (error) {
      log.error('Failed to sync integration:', error)
      throw error
    }
  }

  /**
   * Add tags to company
   */
  async addTags(companyId: string, tags: string[], options?: ApiRequestOptions): Promise<Company> {
    try {
      // Ensure tenant slug is set before making API calls
      await this.ensureTenantSlug()

      const response = await this.httpClient.patch<ApiResponse<Company>>(
        `/companies/${companyId}/tags`,
        {
          tags,
          action: 'add'
        },
        {
          metadata: {
            priority: options?.priority || 'normal',
            complexity: options?.complexity || 'moderate'
          }
        }
      )

      if (!response.data) {
        throw new Error('No data returned from adding tags')
      }

      return response.data
    } catch (error) {
      log.error('Failed to add tags:', error)
      throw error
    }
  }

  /**
   * Remove tags from company
   */
  async removeTags(companyId: string, tags: string[], options?: ApiRequestOptions): Promise<Company> {
    try {
      // Ensure tenant slug is set before making API calls
      await this.ensureTenantSlug()

      const response = await this.httpClient.patch<ApiResponse<Company>>(
        `/companies/${companyId}/tags`,
        {
          tags,
          action: 'remove'
        },
        {
          metadata: {
            priority: options?.priority || 'normal',
            complexity: options?.complexity || 'moderate'
          }
        }
      )

      if (!response.data) {
        throw new Error('No data returned from removing tags')
      }

      return response.data
    } catch (error) {
      log.error('Failed to remove tags:', error)
      throw error
    }
  }

  /**
   * Bulk operations on companies
   */
  async bulkOperation(operation: BulkCompanyOperation, options?: ApiRequestOptions): Promise<{
    success: number
    failed: number
    errors: string[]
  }> {
    try {
      // Ensure tenant slug is set before making API calls
      await this.ensureTenantSlug()

      const response = await this.httpClient.post<ApiResponse<any>>(
        '/companies/bulk',
        operation,
        {
          metadata: {
            priority: options?.priority || 'normal',
            complexity: options?.complexity || 'moderate'
          }
        }
      )

      return (
        response.data || {
          success: 0,
          failed: operation.companyIds.length,
          errors: ['Bulk operation failed']
        }
      )
    } catch (error) {
      log.error('Failed to perform bulk operation:', error)
      throw error
    }
  }

  /**
   * Search companies
   */
  async searchCompanies(
    query: string,
    filters?: Partial<CompanyFilters>,
    pagination?: { limit?: number; offset?: number },
    options?: ApiRequestOptions
  ): Promise<PaginatedResponse<Company>> {
    try {
      // Ensure tenant slug is set before making API calls
      await this.ensureTenantSlug()

      const searchRequest = {
        query,
        filters,
        limit: pagination?.limit,
        offset: pagination?.offset
      }

      const response = await this.httpClient.post<ApiResponse<PaginatedResponse<Company>>>(
        '/companies/search',
        searchRequest,
        {
          metadata: {
            priority: options?.priority || 'normal',
            complexity: options?.complexity || 'moderate'
          }
        }
      )

      return (
        response.data || {
          data: [],
          total: 0,
          limit: pagination?.limit || 2000,
          offset: pagination?.offset || 0,
          hasMore: false
        }
      )
    } catch (error) {
      log.error('Failed to search companies:', error)
      throw error
    }
  }

  /**
   * Get companies at risk (low health scores)
   */
  async getAtRiskCompanies(
    threshold: number = 50,
    pagination?: { limit?: number; offset?: number }
  ): Promise<PaginatedResponse<Company>> {
    const filters: CompanyFilters = {
      healthScore: {
        $lte: threshold
      } as any,
      status: { $in: ['customer'] } as any
    }

    return this.getCompanies(filters, pagination)
  }

  /**
   * Get high-value companies
   */
  async getHighValueCompanies(
    minArr: number = 50000,
    pagination?: { limit?: number; offset?: number }
  ): Promise<PaginatedResponse<Company>> {
    const filters: CompanyFilters = {
      arr: {
        $gte: minArr
      } as any,
      status: { $in: ['customer'] } as any
    }

    return this.getCompanies(filters, pagination)
  }

  /**
   * Get recently active companies
   */
  async getRecentlyActiveCompanies(
    days: number = 7,
    pagination?: { limit?: number; offset?: number }
  ): Promise<PaginatedResponse<Company>> {
    const since = subDays(new Date(), days)

    const filters: CompanyFilters = {
      lastActivityDate: {
        $gte: since.toISOString()
      }
    }

    return this.getCompanies(filters, pagination)
  }

  /**
   * Export companies
   */
  async exportCompanies(
    format: 'csv' | 'xlsx' | 'json',
    filters?: CompanyFilters,
    fields?: string[]
  ): Promise<string> {
    try {
      const httpClient = getHttpClient()
      // Export companies via HTTP client
      const response = await httpClient.post('/companies/export', {
        format,
        filters,
        fields,
        includeCustomFields: true,
        includeHealthScore: true
      })

      if (!response?.downloadUrl) {
        throw new Error('No download URL returned from export')
      }

      return response.downloadUrl
    } catch (error) {
      log.error('Failed to export companies:', error)
      throw error
    }
  }

  /**
   * Get all companies with optional filtering (uses centralized pagination)
   */
  async getAllCompanies(
    filters?: CompanyFilters,
    options?: {
      onProgress?: (loaded: number, total?: number) => void
      maxRecords?: number
      priority?: 'low' | 'normal' | 'high' | 'critical'
      complexity?: 'simple' | 'moderate' | 'complex' | 'heavy'
    }
  ): Promise<Company[]> {
    try {
      log.debug('Fetching all companies via centralized pagination', { filters, options })

      const result = await fetchAllRecords<Company>('companies', {
        filters,
        onProgress: options?.onProgress,
        maxRecords: options?.maxRecords,
        priority: options?.priority || 'normal',
        complexity: options?.complexity || 'moderate'
      })

      return result.data
    } catch (error) {
      log.error('Failed to fetch all companies:', error)
      throw error
    }
  }
}

// Export singleton instance
export const companiesService = new CompaniesService()

// Export types and class for advanced usage
export { CompaniesService }
