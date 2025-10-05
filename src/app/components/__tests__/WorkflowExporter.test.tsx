import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const useWorkflowTemplatesQueryMock = vi.fn()
const useSharedExporterMock = vi.fn()
const getWorkflowTemplatesPageMock = vi.fn()
const useTableColumnsMock = vi.fn(() => [])
const useTableCoreMock = vi.fn(() => ({
  table: {
    getState: () => ({
      columnSizingInfo: { isResizingColumn: false }
    })
  }
}))
const useBadgeControlMock = vi.fn(() => ({ badge: null }))

vi.mock('../../shared/api/queries/workflows.queries', () => ({
  useWorkflowTemplatesQuery: useWorkflowTemplatesQueryMock
}))

vi.mock('../../shared/api/services/workflows.service', () => ({
  workflowsService: {
    getWorkflowTemplatesPage: getWorkflowTemplatesPageMock
  }
}))

vi.mock('../../shared/components/exporters', () => ({
  useSharedExporter: useSharedExporterMock
}))

vi.mock('../../shared/components/ui/FieldsDropdown', () => ({
  FieldsDropdownWrapper: () => <div data-testid="fields-dropdown" />
}))

vi.mock('../../shared/components/ui/OrderColumnsModal', () => ({
  OrderColumnsModal: () => null
}))

vi.mock('../../shared/components/ui/Table', () => ({
  Table: ({ data }: { data: unknown[] }) => (
    <div data-testid="workflow-table">Rows: {data.length}</div>
  )
}))

vi.mock('../../shared/hooks/useTableColumns', () => ({
  useTableColumns: useTableColumnsMock
}))

vi.mock('../../shared/hooks/useTableCore', () => ({
  useTableCore: useTableCoreMock
}))

vi.mock('../../shared/hooks/useToolHeaderControls', () => ({
  useBadgeControl: useBadgeControlMock,
  useToggleControl: () => ({ isActive: false, toggle: vi.fn(), setActive: vi.fn() }),
  useFormatControl: () => ({ selectedFormat: 'csv', setSelectedFormat: vi.fn() })
}))

describe('WorkflowTemplateExporter', () => {
  const mockWorkflowTemplates = [
    {
      _id: 'template-1',
      name: 'Template One',
      description: 'First template',
      type: 'automation',
      status: 'active',
      triggers: [],
      conditions: [],
      actions: [],
      config: {
        retryPolicy: { maxRetries: 1, retryDelay: 0, backoffMultiplier: 1 },
        notifications: { onSuccess: false, onFailure: false, onCompletion: false, recipients: [] }
      },
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

  const handleDirectExportMock = vi.fn()
  let capturedConfig: any
  let refetchMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    vi.clearAllMocks()

    refetchMock = vi.fn()

    useWorkflowTemplatesQueryMock.mockReturnValue({
      data: mockWorkflowTemplates,
      isLoading: false,
      error: null,
      refetch: refetchMock
    })

    getWorkflowTemplatesPageMock.mockResolvedValue({
      data: mockWorkflowTemplates,
      total: mockWorkflowTemplates.length,
      limit: 2,
      offset: 0,
      hasMore: false
    })

    useSharedExporterMock.mockImplementation((config: any) => {
      capturedConfig = config
      return {
        fieldsControl: { isActive: false, toggle: vi.fn(), setActive: vi.fn() },
        reorderControl: { isActive: false, setActive: vi.fn(), toggle: vi.fn() },
        columnSizing: {},
        handleColumnSizingChange: vi.fn(),
        fieldDetection: {
          isLoading: false,
          includedFields: [],
          fieldMappings: [],
          toggleFieldInclusion: vi.fn(),
          selectAllFields: vi.fn(),
          deselectAllFields: vi.fn(),
          setFieldMappings: vi.fn()
        },
        fieldMapping: {
          toggleFieldInclusion: vi.fn(),
          selectAllFields: vi.fn(),
          deselectAllFields: vi.fn(),
          setFieldMappings: vi.fn(),
          getIncludedFields: () => [],
          includedCount: 0
        },
        dataSelection: {
          deselectAll: vi.fn(),
          toggleItem: vi.fn(),
          selectedCount: 0
        },
        handleDirectExport: handleDirectExportMock,
        handleExport: vi.fn(),
        isExporting: false
      }
    })
  })

  it('wires query data into exporter configuration and streams via service', async () => {
    const { WorkflowTemplateExporter } = await import('../WorkflowExporter')
    render(<WorkflowTemplateExporter />)

    expect(useWorkflowTemplatesQueryMock).toHaveBeenCalledWith({
      pagination: { limit: 1000 }
    })
    expect(useSharedExporterMock).toHaveBeenCalled()
    expect(capturedConfig).toBeTruthy()
    expect(capturedConfig.items).toEqual(mockWorkflowTemplates)
    expect(capturedConfig.totalCount).toBe(mockWorkflowTemplates.length)

    const request = capturedConfig.streaming.createRequest({
      format: 'csv',
      filename: 'test.csv',
      exportOptions: {},
      exportConfig: {
        includeHeaders: true,
        includeCustomFields: false,
        includeRelatedData: true,
        includeExecutionStats: true,
        includeSteps: true,
        dateFormat: 'yyyy-MM-dd',
        format: 'csv'
      },
      selectedData: [],
      allData: mockWorkflowTemplates,
      fields: [],
      entityType: 'workflow',
      totalCount: mockWorkflowTemplates.length
    })

    const page = await request.dataProvider(0, 2)

    expect(getWorkflowTemplatesPageMock).toHaveBeenCalledWith(undefined, { offset: 0, limit: 2 })
    expect(page).toEqual({
      data: mockWorkflowTemplates,
      total: mockWorkflowTemplates.length
    })
  })

  it('triggers direct export when format buttons are clicked', async () => {
    const { WorkflowTemplateExporter } = await import('../WorkflowExporter')
    render(<WorkflowTemplateExporter />)

    const csvButton = screen.getByText('CSV')
    fireEvent.click(csvButton)

    expect(handleDirectExportMock).toHaveBeenCalledWith('csv')
  })
})
