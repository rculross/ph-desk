import type { PaginatedResponse, Workflow, WorkflowFilters } from '../../types'
import { logger } from '../../utils/logger'
import { getHttpClient, type RequestOptions } from '../client/http-client'

import { ensureTenantSlug as ensureSharedTenantSlug } from './tenant.service'

interface ApiRequestOptions extends RequestOptions {
  priority?: 'low' | 'normal' | 'high' | 'critical'
  complexity?: 'simple' | 'moderate' | 'complex' | 'heavy'
}

const log = logger.api

export interface WorkflowTemplatePaginationOptions {
  limit?: number
  offset?: number
  sort?: string
}

const DEFAULT_LIMIT = 1000
const DEFAULT_OFFSET = 0
const DEFAULT_SORT = '-updatedAt'

class WorkflowsService {
  private get httpClient() {
    return getHttpClient()
  }

  private async ensureTenantSlug(): Promise<void> {
    await ensureSharedTenantSlug({ context: 'Workflow templates API', logger: log })
  }

  async getWorkflowTemplates(
    filters?: WorkflowFilters,
    pagination?: WorkflowTemplatePaginationOptions,
    options?: ApiRequestOptions
  ): Promise<Workflow[]> {
    await this.ensureTenantSlug()

    const params = {
      limit: pagination?.limit ?? DEFAULT_LIMIT,
      offset: pagination?.offset ?? DEFAULT_OFFSET,
      sort: pagination?.sort ?? DEFAULT_SORT,
      ...filters
    }

    log.debug('Fetching workflow templates via HTTP client', params)

    const response = await this.httpClient.get<Workflow[]>(
      '/workflowtemplates',
      params,
      {
        metadata: {
          priority: options?.priority || 'normal',
          complexity: options?.complexity || 'moderate'
        }
      }
    )

    return response || []
  }

  async getWorkflowTemplatesPage(
    filters?: WorkflowFilters,
    pagination?: WorkflowTemplatePaginationOptions,
    options?: ApiRequestOptions
  ): Promise<PaginatedResponse<Workflow>> {
    const limit = pagination?.limit ?? DEFAULT_LIMIT
    const offset = pagination?.offset ?? DEFAULT_OFFSET
    const sort = pagination?.sort ?? DEFAULT_SORT

    const data = await this.getWorkflowTemplates(filters, { limit, offset, sort }, options)

    return {
      data,
      total: data.length,
      limit,
      offset,
      hasMore: data.length === limit
    }
  }
}

export const workflowsService = new WorkflowsService()
export { WorkflowsService }
