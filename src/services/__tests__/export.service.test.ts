import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { ExportService } from '../export.service'
import type { ExportRequest, StreamingExportRequest } from '../export.service'

declare global {
  // eslint-disable-next-line no-var
  var Blob: typeof Blob
}

const originalURL = global.URL
const originalDocument = global.document
const originalBlob = global.Blob

function setupDomStubs() {
  global.URL = {
    createObjectURL: vi.fn(() => 'blob:mock-url'),
    revokeObjectURL: vi.fn()
  } as unknown as typeof globalThis.URL

  const anchor = {
    href: '',
    download: '',
    style: {},
    click: vi.fn()
  }

  global.document = {
    createElement: vi.fn(() => ({ ...anchor })),
    body: {
      appendChild: vi.fn(),
      removeChild: vi.fn()
    }
  } as unknown as Document

  global.Blob = class {
    public size: number
    public type: string

    constructor(parts: any[], options?: { type?: string }) {
      this.size = parts.reduce((total, part) => {
        if (part instanceof ArrayBuffer) {
          return total + part.byteLength
        }
        if (typeof part === 'string') {
          return total + part.length
        }
        return total
      }, 0)
      this.type = options?.type ?? ''
    }
  } as unknown as typeof Blob
}

async function waitForCompletion(service: ExportService, jobId: string) {
  for (let attempt = 0; attempt < 10; attempt++) {
    const progress = service.getProgress(jobId)
    if (progress?.status === 'completed') {
      return progress
    }
    await new Promise(resolve => setTimeout(resolve, 0))
  }
  throw new Error('Export job did not complete in time')
}

beforeEach(() => {
  setupDomStubs()
})

afterEach(() => {
  global.URL = originalURL
  global.document = originalDocument
  global.Blob = originalBlob
  vi.restoreAllMocks()
})

describe('ExportService job orchestration', () => {
  it('completes immediate exports and records progress', async () => {
    const service = new ExportService({ batchSize: 2 })

    const request: ExportRequest<{ id: string; title: string }> = {
      data: [
        { id: '1', title: 'Issue one' },
        { id: '2', title: 'Issue two' }
      ],
      format: 'json',
      filename: 'issues',
      options: {
        includeHeaders: true,
        includeCustomFields: false,
        includeRelatedData: false,
        dateFormat: 'yyyy-MM-dd',
        timezone: 'UTC'
      },
      fields: [
        { key: 'id', label: 'ID', type: 'string', include: true },
        { key: 'title', label: 'Title', type: 'string', include: true }
      ],
      entityType: 'issue'
    }

    const jobId = await service.startExport(request)
    const result = await waitForCompletion(service, jobId)

    expect(result.status).toBe('completed')
    expect(result.progress).toBe(100)
    expect(result.downloadUrl).toBe('blob:mock-url')
    expect(service.getActiveJobs()).toHaveLength(1)
  })

  it('processes streaming exports and updates progress increments', async () => {
    const service = new ExportService({ batchSize: 2 })

    const streamingRequest: StreamingExportRequest<{ id: string; value: number }> = {
      dataProvider: vi.fn(async (offset: number, limit: number) => {
        const data = Array.from({ length: Math.min(limit, 4 - offset) }, (_, index) => ({
          id: `${offset + index + 1}`,
          value: offset + index + 1
        }))
        return { data, total: 4 }
      }),
      format: 'json',
      filename: 'streaming',
      options: {
        includeHeaders: true,
        includeCustomFields: false,
        includeRelatedData: false,
        dateFormat: 'yyyy-MM-dd',
        timezone: 'UTC'
      },
      fields: [
        { key: 'id', label: 'ID', type: 'string', include: true },
        { key: 'value', label: 'Value', type: 'number', include: true }
      ],
      entityType: 'issue',
      totalRecords: 4
    }

    const jobId = await service.startStreamingExport(streamingRequest)
    const result = await waitForCompletion(service, jobId)

    expect(result.status).toBe('completed')
    expect(result.processedRecords).toBe(4)
    expect(result.downloadUrl).toBe('blob:mock-url')
    expect(streamingRequest.dataProvider).toHaveBeenCalledTimes(2)
  })
})
