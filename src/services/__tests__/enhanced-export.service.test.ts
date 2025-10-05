import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { EnhancedExportService } from '../enhanced-export.service'
import type {
  EnhancedExportRequest,
  EnhancedFieldMapping,
  MultiSheetExportRequest
} from '../enhanced-export.service'

declare global {
  // eslint-disable-next-line no-var
  var Blob: typeof Blob
}

const originalURL = global.URL
const originalDocument = global.document
const originalBlob = global.Blob

const createCell = () => ({
  value: vi.fn().mockReturnThis(),
  style: vi.fn().mockReturnThis(),
  hyperlink: vi.fn().mockReturnThis()
})

const createWorksheet = () => {
  const cells = new Map<string, ReturnType<typeof createCell>>()
  return {
    name: vi.fn().mockReturnThis(),
    freezePanes: vi.fn(),
    autoFilter: vi.fn(),
    cell: vi.fn((row: number, column: number) => {
      const key = `${row}:${column}`
      if (!cells.has(key)) {
        cells.set(key, createCell())
      }
      return cells.get(key)!
    }),
    column: vi.fn(() => ({ width: vi.fn().mockReturnThis() })),
    pageSetup: vi.fn()
  }
}

const createWorkbook = () => {
  const sheets = [createWorksheet()]
  return {
    sheet: vi.fn((index: number) => sheets[index] ?? sheets[0]),
    addSheet: vi.fn(() => {
      const sheet = createWorksheet()
      sheets.push(sheet)
      return sheet
    }),
    property: vi.fn(),
    outputAsync: vi.fn(async () => new ArrayBuffer(8))
  }
}

const fromBlankAsyncMock = vi.fn(async () => createWorkbook())

vi.mock('xlsx-populate', () => ({
  default: {
    fromBlankAsync: fromBlankAsyncMock
  }
}))

function setupDomStubs() {
  global.URL = {
    createObjectURL: vi.fn(() => 'blob:enhanced-url'),
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

async function waitForCompletion(service: EnhancedExportService, jobId: string) {
  for (let attempt = 0; attempt < 10; attempt++) {
    const progress = service.getProgress(jobId)
    if (progress?.status === 'completed') {
      return progress
    }
    await new Promise(resolve => setTimeout(resolve, 0))
  }
  throw new Error('Enhanced export job did not complete in time')
}

beforeEach(() => {
  setupDomStubs()
  fromBlankAsyncMock.mockClear()
})

afterEach(() => {
  global.URL = originalURL
  global.document = originalDocument
  global.Blob = originalBlob
  vi.restoreAllMocks()
})

describe('EnhancedExportService job orchestration', () => {
  it('completes enhanced JSON exports and captures download URL', async () => {
    const service = new EnhancedExportService({ enableStyling: false })

    const request: EnhancedExportRequest<{ id: string; name: string }> = {
      data: [
        { id: '1', name: 'Record One' },
        { id: '2', name: 'Record Two' }
      ],
      format: 'json',
      filename: 'enhanced',
      options: {
        includeHeaders: true,
        includeCustomFields: true,
        includeRelatedData: false,
        dateFormat: 'yyyy-MM-dd',
        timezone: 'UTC'
      },
      fields: [
        { key: 'id', label: 'ID', type: 'string', include: true },
        { key: 'name', label: 'Name', type: 'string', include: true }
      ],
      entityType: 'issue',
      includeMetadata: true
    }

    const jobId = await service.startEnhancedExport(request)
    const result = await waitForCompletion(service, jobId)

    expect(result.status).toBe('completed')
    expect(result.downloadUrl).toBe('blob:enhanced-url')
    expect(service.getActiveJobs()).toHaveLength(1)
  })

  it('processes multi-sheet exports using the shared lifecycle', async () => {
    const service = new EnhancedExportService({ enableStyling: true })

    const baseFields: EnhancedFieldMapping[] = [
      { key: 'id', label: 'ID', type: 'string', include: true }
    ]

    const request: MultiSheetExportRequest = {
      sheets: [
        { name: 'Issues', data: [{ id: '1' }], fields: baseFields },
        { name: 'Workflows', data: [{ id: 'A' }], fields: baseFields }
      ],
      filename: 'multi-sheet',
      globalOptions: {
        includeHeaders: true,
        includeCustomFields: true,
        includeRelatedData: false,
        dateFormat: 'yyyy-MM-dd',
        timezone: 'UTC'
      }
    }

    const jobId = await service.startMultiSheetExport(request)
    const result = await waitForCompletion(service, jobId)

    expect(result.status).toBe('completed')
    expect(result.downloadUrl).toBe('blob:enhanced-url')
    expect(fromBlankAsyncMock).toHaveBeenCalled()
  })
})
