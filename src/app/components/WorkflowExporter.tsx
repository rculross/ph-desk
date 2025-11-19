/**
 * Workflow Template Exporter Component for Planhat Extension
 *
 * Comprehensive workflow template export interface with advanced filtering,
 * field selection, and export format options.
 */

import { useCallback, useEffect, useRef, useMemo } from 'react'

import { ReloadOutlined, SettingOutlined, ClearOutlined } from '@ant-design/icons'
import type {
  GroupingState,
  ExpandedState,
  ColumnFiltersState,
  SortingState,
  VisibilityState,
  RowSelectionState,
  Table as TanStackTable
} from '@tanstack/react-table'
// Radio removed - not used
import { clsx } from 'clsx'
import { format as formatDate } from 'date-fns'
import {
  WorkflowIcon,
  AlertCircle as AlertCircleIcon,
  ChevronDownIcon
} from 'lucide-react'

import { getTenantSlug } from '../../api/client/http-client'
import { useUsersQuery } from '../../api/queries/users.queries'
import { useWorkflowTemplatesQuery } from '../../api/queries/workflows.queries'
import { workflowsService } from '../../api/services/workflows.service'
import { ExportFormatButtons, useSharedExporter } from '../../components/exporters'
import { FieldsDropdownWrapper } from '../../components/ui/FieldsDropdown'
import { OrderColumnsModal } from '../../components/ui/OrderColumnsModal'
import { Table } from '../../components/ui/Table'
import {
  ToolHeader,
  ToolHeaderButton,
  ToolHeaderControls,
  ToolHeaderDivider
} from '../../components/ui/ToolHeader'
import { DEFAULT_VIRTUALIZATION } from '../../config/table-virtualization'
import { useTableColumns } from '../../hooks/useTableColumns'
import { useBadgeControl } from '../../hooks/useToolHeaderControls'
import type {
  Workflow,
  WorkflowFilters,
  WorkflowType,
  WorkflowStatus
} from '../../types/api'
import { CONTROL_CATEGORIES } from '../../types/ui'
import { logger } from '../../utils/logger'

// Component Props
export interface WorkflowTemplateExporterProps {
  className?: string
}

// Filter state interface
interface WorkflowTemplateExportFilters extends WorkflowFilters {
  dateRange?: {
    from: string
    to: string
  }
  executionStats?: {
    minExecutions?: number
    maxExecutions?: number
    successRateMin?: number
  }
  // customFields removed - workflow templates don't have custom fields
}

// Export configuration interface
interface WorkflowExportConfiguration {
  includeHeaders: boolean
  includeCustomFields: boolean
  includeRelatedData: boolean
  includeExecutionStats: boolean
  includeSteps: boolean
  dateFormat: string
}

/**
 * Main WorkflowTemplateExporter component
 */
export function WorkflowTemplateExporter({ className }: WorkflowTemplateExporterProps) {
  const fieldDropdownRef = useRef<HTMLDivElement>(null)
  const log = logger.extension

  // Get tenant slug for tenant-aware caching
  const tenantSlug = getTenantSlug()

  // Fetch workflow templates data
  const {
    data: workflowTemplatesData,
    isLoading,
    error,
    refetch
  } = useWorkflowTemplatesQuery({
    pagination: { limit: 1000 }
  })

  // Fetch users data for user name lookup in Created By column
  useUsersQuery()

  const workflowTemplates = workflowTemplatesData ?? []
  const totalCount = workflowTemplates.length

  const exportDefaults = useMemo<WorkflowExportConfiguration>(
    () => ({
      includeHeaders: true,
      includeCustomFields: false,
      includeRelatedData: true,
      includeExecutionStats: true,
      includeSteps: true,
      dateFormat: 'yyyy-MM-dd'
    }),
    []
  )

  const exporter = useSharedExporter<Workflow, WorkflowExportConfiguration>({
    entityType: 'workflow',
    items: workflowTemplates,
    totalCount,
    defaultExportConfig: exportDefaults,
    buildFilename: format => {
      const now = new Date()
      const dateStr = formatDate(now, 'yyyy-MM-dd')
      const timeStr = formatDate(now, 'HH-mm')
      return `${tenantSlug || 'unknown'}_workflow_templates_export_${dateStr}_${timeStr}`
    },
    streaming: {
      threshold: 5000,
      createRequest: context => ({
        dataProvider: async (offset, limit) => {
          const page = await workflowsService.getWorkflowTemplatesPage(undefined, { offset, limit })
          return {
            data: page.data,
            total: page.total
          }
        },
        format: context.format,
        filename: context.filename,
        options: context.exportOptions,
        fields: context.fields,
        entityType: context.entityType,
        totalRecords: context.totalCount
      })
    },
    fieldDetection: {
      sampleSize: 10,
      tenantSlug: undefined
    }
  })

  const {
    fieldsControl,
    reorderControl,
    formatControl,
    columnSizing,
    handleColumnSizingChange,
    fieldDetection,
    fieldMapping,
    dataSelection,
    handleDirectExport,
    isExporting
  } = exporter

  const templateBadge = useBadgeControl(workflowTemplates)

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (fieldDropdownRef.current && !fieldDropdownRef.current.contains(event.target as Node)) {
        fieldsControl.setActive(false)
      }
    }

    if (fieldsControl.isActive) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }

    return undefined
  }, [fieldsControl.isActive, fieldsControl.setActive])

  // Generate table columns using centralized hook with tenant-aware caching
  const tableColumns = useTableColumns<Workflow>({
    fieldDetection,
    entityType: 'workflow',
    columnSizing,
    tenantSlug
  })

  const tableRef = useRef<TanStackTable<Workflow> | null>(null)

  // Handle table row selection changes
  const { deselectAll, toggleItem } = dataSelection

  const handleSelectionChange = useCallback(
    (selection: RowSelectionState) => {
      // Clear current selection before syncing the table's state
      deselectAll()

      // Add selected items by ID
      workflowTemplates.forEach((template, index) => {
        if (selection[index]) {
          toggleItem(template._id)
        }
      })

      log.debug('Table selection changed', {
        count: Object.keys(selection).length
      })
    },
    [workflowTemplates, deselectAll, toggleItem, log]
  )

  // Handle column reordering
  const handleColumnsReorder = useCallback((reorderedColumns: { key: string; label: string; include: boolean }[]) => {
    log.info('Column reorder requested', {
      totalColumns: reorderedColumns.length,
      visibleColumns: reorderedColumns.filter(c => c.include).length,
      columnOrder: reorderedColumns.map(c => c.key)
    })

    // Update the field mappings with the new order
    const newFieldMappings = reorderedColumns.map(col => {
      // Find the original field mapping and preserve its data
      const originalField = fieldDetection.fieldMappings.find(f => f.key === col.key)
      return originalField ? { ...originalField, include: col.include } : {
        key: col.key,
        label: col.label,
        type: 'string' as const,
        include: col.include,
        source: 'discovered' as const
      }
    })

    fieldDetection.setFieldMappings(newFieldMappings)

    log.info('Column order updated successfully', {
      newOrder: reorderedColumns.map(c => c.key).slice(0, 10) // Log first 10 for brevity
    })
  }, [log, fieldDetection])

  return (
    <div className={clsx('space-y-0', className)}>
      {/* Tool Header */}
      <ToolHeader title='Workflow Templates' icon={WorkflowIcon}>
        {/* Output Controls */}
        <ToolHeaderControls category={CONTROL_CATEGORIES.OUTPUT}>
          <div className='relative' ref={fieldDropdownRef}>
            <ToolHeaderButton
              category={CONTROL_CATEGORIES.OUTPUT}
              variant={fieldsControl.isActive ? 'primary' : 'secondary'}
              icon={<SettingOutlined />}
              onClick={fieldsControl.toggle}
            >
              Columns
            </ToolHeaderButton>

            {/* Centralized Fields Dropdown */}
            <FieldsDropdownWrapper
              fieldsControl={fieldsControl}
              fieldDetection={fieldDetection}
              entityType="workflow"
              customFieldSupport={false}
              onToggleField={fieldMapping.toggleFieldInclusion}
              onSelectAll={fieldMapping.selectAllFields}
              onDeselectAll={fieldMapping.deselectAllFields}
              onManage={() => reorderControl.setActive(true)}
            />
          </div>


          <ToolHeaderButton
            category={CONTROL_CATEGORIES.OUTPUT}
            variant="secondary"
            icon={<ReloadOutlined />}
            onClick={() => refetch()}
            loading={isLoading}
          >
            Refresh
          </ToolHeaderButton>
        </ToolHeaderControls>

        <ToolHeaderDivider />

        {/* Table Controls */}
        <ToolHeaderControls category={CONTROL_CATEGORIES.TABLE}>
          <ToolHeaderButton
            category={CONTROL_CATEGORIES.TABLE}
            variant="secondary"
            icon={<ClearOutlined />}
            onClick={() => {
              alert('To clear filters: Use the built-in table controls below. Reset individual column filters or use the table toolbar.')
            }}
          >
            Clear Filters
          </ToolHeaderButton>
        </ToolHeaderControls>

        <ToolHeaderDivider />

        {/* Export Controls */}
        <ToolHeaderControls category={CONTROL_CATEGORIES.EXPORT}>
          <span className="font-medium text-sm -mr-1">Export:</span>
          <ExportFormatButtons
            selectedFormat={formatControl.selectedFormat}
            onSelect={(format) => {
              formatControl.selectFormat(format)
              void handleDirectExport(format)
            }}
            disabled={workflowTemplates.length === 0 || isExporting}
            loading={isExporting}
          />
        </ToolHeaderControls>
      </ToolHeader>
      



      {/* Data Table */}
      <Table
        data={workflowTemplates}
        customColumns={tableColumns}
        loading={isLoading}
        showToolbar={false}
        className="shadow-sm"
        height={600}
        emptyMessage="No workflow templates found. Create some workflow templates to get started."
        customColumnSizing={columnSizing}

        enableSorting={true}
        enableFiltering={true}
        enableSelection={true}
        enableGrouping={false}
        enableColumnResizing={true}
        persistColumnSizes={true}
        persistenceContext="workflowtemplates"

        // Optimized virtualization settings for better performance
        rowOverscan={DEFAULT_VIRTUALIZATION.rowOverscan}
        columnOverscan={DEFAULT_VIRTUALIZATION.columnOverscan}
        rowHeight={DEFAULT_VIRTUALIZATION.rowHeight}
        enableRowVirtualization={DEFAULT_VIRTUALIZATION.enableRowVirtualization}
        enableColumnVirtualization={DEFAULT_VIRTUALIZATION.enableColumnVirtualization}

        onSelectionChange={handleSelectionChange}

        onTableReady={({ table }) => {
          tableRef.current = table
          log.debug('Workflow table ready', {
            columnCount: table.getAllLeafColumns().length
          })
        }}

        onColumnSizingChange={handleColumnSizingChange}

        onColumnSizingStateChange={({ columnSizing, columnSizingInfo }) => {
          // Column sizing state change tracking (removed verbose logging)
        }}
      />

      {/* Order Columns Modal */}
      <OrderColumnsModal
        visible={reorderControl.isActive}
        onClose={reorderControl.setActive.bind(null, false)}
        columns={fieldDetection.fieldMappings ?? []}
        onColumnsReorder={handleColumnsReorder}
        title="Reorder Table Columns"
        loading={fieldDetection.isLoading}
      />


      {/* Error state */}
      {error && (
        <div className='rounded-lg border border-red-200 bg-red-50 p-4'>
          <div className='flex items-center gap-2 text-red-800'>
            <AlertCircleIcon className='h-5 w-5' />
            <span className='font-medium'>Failed to load workflow templates</span>
          </div>
          <p className='mt-1 text-sm text-red-700'>
            {error instanceof Error ? error.message : 'Unknown error occurred'}
          </p>
          <button
            onClick={() => refetch()}
            className='mt-3 text-sm font-medium text-red-600 hover:text-red-800'
          >
            Try again
          </button>
        </div>
      )}
    </div>
  )
}

// Helper functions for styling
function getTypeColor(type: string): string {
  const colors = {
    onboarding: 'bg-blue-100 text-blue-800',
    retention: 'bg-green-100 text-green-800',
    expansion: 'bg-purple-100 text-purple-800',
    support: 'bg-yellow-100 text-yellow-800',
    automation: 'bg-gray-100 text-gray-800',
    custom: 'bg-orange-100 text-orange-800'
  }
  return colors[type as keyof typeof colors] ?? 'bg-gray-100 text-gray-800'
}

function getStatusColor(status: string): string {
  const colors = {
    draft: 'bg-gray-100 text-gray-800',
    active: 'bg-green-100 text-green-800',
    paused: 'bg-yellow-100 text-yellow-800',
    archived: 'bg-red-100 text-red-800'
  }
  return colors[status as keyof typeof colors] ?? 'bg-gray-100 text-gray-800'
}
