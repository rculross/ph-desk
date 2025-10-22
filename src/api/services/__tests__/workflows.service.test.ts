import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { Workflow } from '../../../types'

vi.mock('../../client/http-client', () => ({
  getHttpClient: vi.fn()
}))

vi.mock('../tenant.service', () => ({
  ensureTenantSlug: vi.fn(() => Promise.resolve('mock-tenant'))
}))

const mockClient = {
  getWorkflowTemplates: vi.fn()
}

const { workflowsService } = await import('../workflows.service')
const { getHttpClient } = await import('../../client/http-client')
const { ensureTenantSlug } = await import('../tenant.service')

describe('workflowsService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getHttpClient).mockReturnValue(mockClient as any)
    mockClient.getWorkflowTemplates.mockResolvedValue([])
  })

  it('fetches workflow templates with default pagination', async () => {
    const data: Workflow[] = [
      {
        _id: '1',
        name: 'Workflow 1',
        description: 'First workflow',
        type: 'automation',
        status: 'active',
        triggers: [],
        conditions: [],
        actions: [],
        config: { retryPolicy: { maxRetries: 1, retryDelay: 0, backoffMultiplier: 1 }, notifications: { onSuccess: false, onFailure: false, onCompletion: false, recipients: [] } },
        isActive: true,
        executionStats: {
          totalExecutions: 0,
          successfulExecutions: 0,
          failedExecutions: 0,
          averageExecutionTime: 0
        },
        version: 1,
        tags: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    ]

    mockClient.getWorkflowTemplates.mockResolvedValueOnce(data)

    const result = await workflowsService.getWorkflowTemplates()

    expect(ensureTenantSlug).toHaveBeenCalledWith({
      context: 'Workflow templates API',
      logger: expect.anything()
    })
    expect(mockClient.getWorkflowTemplates).toHaveBeenCalledWith({
      limit: 1000,
      offset: 0,
      sort: '-updatedAt'
    })
    expect(result).toEqual(data)
  })

  it('returns paginated metadata from getWorkflowTemplatesPage', async () => {
    const data: Workflow[] = []
    mockClient.getWorkflowTemplates.mockResolvedValueOnce(data)

    const page = await workflowsService.getWorkflowTemplatesPage(undefined, { limit: 500, offset: 100 })

    expect(mockClient.getWorkflowTemplates).toHaveBeenCalledWith({
      limit: 500,
      offset: 100,
      sort: '-updatedAt'
    })
    expect(page).toEqual({
      data,
      total: data.length,
      limit: 500,
      offset: 100,
      hasMore: false
    })
  })
})
