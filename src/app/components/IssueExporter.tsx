/**
 * Issue Exporter Component for Planhat Extension
 *
 * Comprehensive issue export interface with advanced filtering,
 * field selection, and export format options.
 */

import { useState, useCallback, useEffect, useRef, useMemo } from 'react'

import { ReloadOutlined, SettingOutlined, ClearOutlined, PlusOutlined } from '@ant-design/icons'
import { useQuery } from '@tanstack/react-query'
import type {
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
import { AlertCircleIcon } from 'lucide-react'

import { getTenantSlug } from '../../api/client/http-client'
import { issuesService } from '../../api/services/issues.service'
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
import type { Issue, IssueFilters } from '../../types/api'
import { CONTROL_CATEGORIES } from '../../types/ui'
import { logger } from '../../utils/logger'

// Component Props
export interface IssueExporterProps {
  className?: string
}

// Filter state interface
interface IssueExportFilters extends IssueFilters {
  dateRange?: {
    from: string
    to: string
  }
  customFields?: Record<string, any>
}


// Export configuration interface
interface IssueExportConfiguration {
  includeHeaders: boolean
  includeCustomFields: boolean
  includeRelatedData: boolean
  dateFormat: string
}

/**
 * Main IssueExporter component
 */
export function IssueExporter({ className }: IssueExporterProps) {
  // State management - Initialize with empty filters (issues endpoint doesn't support date filtering)
  const [filters, _setFilters] = useState<IssueExportFilters>({})
  const fieldDropdownRef = useRef<HTMLDivElement>(null)
  const [isLoadingAllData, setIsLoadingAllData] = useState(false)
  const loadingRef = useRef(false)
  const log = logger.extension

  // Pagination state for incremental loading
  const [pagination, setPagination] = useState({
    currentOffset: 0,
    recordsPerPull: 500, // Smaller batches for better UX
    totalLoaded: 0,
    hasMore: false
  })

  // All loaded issues (accumulated across pages)
  const [allIssues, setAllIssues] = useState<Issue[]>([])

  // Dynamic field detection hook with tenant-aware custom fields
  const tenantSlug = getTenantSlug()

  // Fetch issues data with pagination
  const {
    data: issuesData,
    isLoading,
    error: _error,
    refetch: refetchQuery,
    isFetching
  } = useQuery({
    queryKey: ['issues-paginated', filters, pagination.currentOffset],
    queryFn: async () => {
      // Prevent concurrent loads
      if (loadingRef.current) {
        return { data: [], total: 0, limit: 0, offset: 0, hasMore: false }
      }

      loadingRef.current = true
      setIsLoadingAllData(true)

      try {
        log.debug('Fetching issues with pagination', {
          offset: pagination.currentOffset,
          limit: pagination.recordsPerPull,
          filters
        })

        // Use paginated API method
        const result = await issuesService.getIssues(
          filters,
          {
            limit: pagination.recordsPerPull,
            offset: pagination.currentOffset,
            sort: '-createdAt'
          }
        )

        log.debug('Issues fetch completed', {
          fetched: result.data.length,
          offset: pagination.currentOffset,
          hasMore: result.hasMore
        })

        return result
      } finally {
        loadingRef.current = false
        setIsLoadingAllData(false)
      }
    },
    enabled: true,
    staleTime: 30 * 1000, // 30 seconds
    gcTime: 5 * 60 * 1000 // 5 minutes
  })

  // Update accumulated issues when new data arrives
  useEffect(() => {
    if (issuesData?.data) {
      if (pagination.currentOffset === 0) {
        // First page - replace all issues
        setAllIssues(issuesData.data)
        log.debug('First page loaded', { count: issuesData.data.length })
      } else {
        // Subsequent pages - append to existing issues
        setAllIssues(prev => [...prev, ...issuesData.data])
        log.debug('Page appended', {
          newCount: issuesData.data.length,
          totalCount: allIssues.length + issuesData.data.length
        })
      }

      // Update pagination metadata (use callback to avoid dependency on pagination)
      setPagination(prev => ({
        ...prev,
        totalLoaded: prev.currentOffset === 0
          ? issuesData.data.length
          : prev.totalLoaded + issuesData.data.length,
        hasMore: issuesData.hasMore || false
      }))
    }
  }, [issuesData])

  const issues = allIssues
  const totalCount = pagination.totalLoaded

  // Load more functionality
  const loadMore = useCallback(() => {
    if (pagination.hasMore && !isFetching) {
      const newOffset = pagination.currentOffset + pagination.recordsPerPull

      log.info('Loading more issues', {
        currentOffset: pagination.currentOffset,
        newOffset,
        recordsPerPull: pagination.recordsPerPull
      })

      setPagination(prev => ({
        ...prev,
        currentOffset: newOffset
      }))
    }
  }, [pagination, isFetching])

  // Refresh functionality
  const refetch = useCallback(() => {
    log.info('Refreshing issues')

    // Reset pagination to first page
    setPagination({
      currentOffset: 0,
      recordsPerPull: 500,
      totalLoaded: 0,
      hasMore: false
    })

    // Clear accumulated issues
    setAllIssues([])

    // Refetch query
    void refetchQuery()
  }, [refetchQuery])

  const exportDefaults = useMemo<IssueExportConfiguration>(
    () => ({
      includeHeaders: true,
      includeCustomFields: true,
      includeRelatedData: false,
      dateFormat: 'yyyy-MM-dd'
    }),
    []
  )

  const exporter = useSharedExporter<Issue, IssueExportConfiguration>({
    entityType: 'issue',
    items: issues,
    totalCount,
    tenantSlug: tenantSlug ?? undefined,
    defaultExportConfig: exportDefaults,
    buildFilename: format => `issues_export_${formatDate(new Date(), 'yyyy-MM-dd')}`,
    streaming: {
      threshold: 5000,
      createRequest: context => ({
        dataProvider: async (offset, limit) => {
          const result = await issuesService.getIssues({
            ...filters,
            offset,
            limit
          })
          return {
            data: result.data,
            total: result.total
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
      sampleSize: 10
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

  // Generate table columns using centralized hook with tenant-aware caching
  const tableColumns = useTableColumns<Issue>({
    fieldDetection,
    entityType: 'issue',
    columnSizing,
    tenantSlug
  })

  const tableRef = useRef<TanStackTable<Issue> | null>(null)

  // CRITICAL DEBUG: Log field detection state changes (optimized dependencies)
  useEffect(() => {
    // Only log when field detection actually changes, not on every render
    if (fieldDetection.isLoading || fieldDetection.isError) {
      log.debug('Field detection state updated', {
        'fieldMappings length': fieldDetection.fieldMappings.length ?? 0,
        'includedFields length': fieldDetection.includedFields.length ?? 0,
        'isLoading': fieldDetection.isLoading,
        'isError': fieldDetection.isError,
        'error': fieldDetection.error,
        'issues length': issues.length,
        'enabled condition': issues !== undefined && issues.length > 0,
        'timestamp': new Date().toISOString()
      })
    }
  }, [
    fieldDetection.isLoading,
    fieldDetection.isError,
    fieldDetection.error?.message // Only track error message, not error object
  ])

  // Close dropdown when clicking outside
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

  // DEBUG: Log field detection results (only when field detection state changes)
  useEffect(() => {
    // Only log significant changes, not every render
    if (fieldDetection.fieldMappings.length > 0 && !fieldDetection.isLoading) {
      log.debug('Field detection results', {
        'fieldDetection.fieldMappings length': fieldDetection.fieldMappings.length,
        'fieldDetection.includedFields length': fieldDetection.includedFields.length,
        'fieldDetection.isLoading': fieldDetection.isLoading,
        'fieldDetection.error': fieldDetection.error,
        'first few field mappings': fieldDetection.fieldMappings.slice(0, 5)
      })
    }
  }, [fieldDetection.fieldMappings.length, fieldDetection.isLoading])

  // Badge control for selected items
  const selectedBadge = useBadgeControl(
    dataSelection.selectedCount > 0 ? Array(dataSelection.selectedCount).fill(null) : []
  )

  // PERFORMANCE OPTIMIZATION: Memoize fieldMappings calculation separately for tenant-aware caching
  const optimizedFieldMappings = useMemo(() => {
    // Only recalculate when field detection is stable and we have meaningful data
    if (fieldDetection.isLoading || fieldDetection.fieldMappings.length === 0) {
      return []
    }

    // Get included fields (already filtered by the field detection hook)
    const includedFields = fieldDetection.includedFields

    // If no fields are included but we have issues, provide basic default fields
    if (includedFields.length === 0 && issues.length > 0) {
      // Create basic fields from the first issue
      const firstIssue = issues[0] as any
      const basicFields: Array<{
        key: string;
        label: string;
        type: 'string' | 'date' | 'number' | 'boolean' | 'array' | 'object';
        include: boolean;
        source: 'standard' | 'custom';
        customFieldConfig?: any;
      }> = []

      // Add essential fields if they exist
      const essentialFields = ['_id', 'title', 'status', 'createdAt', 'updatedAt']
      essentialFields.forEach(key => {
        if (firstIssue[key] !== undefined) {
          basicFields.push({
            key,
            label: key === '_id' ? 'ID' : key.charAt(0).toUpperCase() + key.slice(1),
            type: key.includes('At') ? 'date' : 'string',
            include: true,
            source: 'standard'
          })
        }
      })

      log.debug('Using fallback field mappings', {
        originalIncludedCount: includedFields.length,
        fallbackFieldCount: basicFields.length,
        fallbackFields: basicFields.map(f => f.key)
      })

      return basicFields
    }

    // Return the normal included fields
    return includedFields.map(field => ({
      key: field.key,
      label: field.label,
      type: field.type,
      include: field.include,
      source: field.key.startsWith('custom.') ? 'custom' as const : 'standard' as const,
      customFieldConfig: field.customFieldConfig
    }))
  }, [fieldDetection.includedFields, fieldDetection.isLoading, issues.length > 0])

  // Use dynamic field detection results
  // Table columns are now handled by the Table component internally

  // Handle column reordering
  const handleColumnsReorder = useCallback((reorderedColumns: { key: string; label: string; include: boolean }[]) => {
    log.info('Column reorder requested', {
      totalColumns: reorderedColumns.length,
      visibleColumns: reorderedColumns.filter(c => c.include).length,
      columnOrder: reorderedColumns.map(c => c.key)
    })

    // Log current order before change
    log.info('Current field mappings order before reorder', {
      currentOrder: fieldDetection.fieldMappings.map((f, i) => `${i}:${f.key}`).slice(0, 15),
      currentIncluded: fieldDetection.includedFields.map((f, i) => `${i}:${f.key}`),
      currentIncludedKeys: fieldDetection.includedFields.map(f => f.key)
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

    log.info('About to set new field mappings', {
      reorderedColumnKeys: reorderedColumns.map((col, i) => `${i}:${col.key}`).slice(0, 15),
      newMappingsOrder: newFieldMappings.map((f, i) => `${i}:${f.key}`).slice(0, 15),
      newIncludedOrder: newFieldMappings.filter(f => f.include).map((f, i) => `${i}:${f.key}`),
      newIncludedKeys: newFieldMappings.filter(f => f.include).map(f => f.key)
    })

    fieldDetection.setFieldMappings(newFieldMappings)

    // Log immediately after setting to see if state updated
    setTimeout(() => {
      log.info('Field mappings state AFTER setFieldMappings', {
        afterSetOrder: fieldDetection.fieldMappings.map((f, i) => `${i}:${f.key}`).slice(0, 15),
        afterSetIncluded: fieldDetection.includedFields.map((f, i) => `${i}:${f.key}`),
        afterSetIncludedKeys: fieldDetection.includedFields.map(f => f.key)
      })
    }, 10)

    log.info('Column order updated successfully', {
      newOrder: reorderedColumns.map(c => c.key).slice(0, 10) // Log first 10 for brevity
    })
  }, [log, fieldDetection])


  return (
    <div className={clsx('space-y-6', className)}>
      {/* Tool Header */}
      <ToolHeader title='Issues' icon={AlertCircleIcon}>
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
              entityType="issue"
              customFieldSupport={true}
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
            loading={isLoading || isLoadingAllData}
          >
            Refresh
          </ToolHeaderButton>

          {pagination.hasMore && (
            <ToolHeaderButton
              category={CONTROL_CATEGORIES.OUTPUT}
              variant="secondary"
              icon={<PlusOutlined />}
              onClick={loadMore}
              loading={isFetching}
              disabled={!pagination.hasMore}
            >
              Load More ({pagination.totalLoaded} loaded, +{pagination.recordsPerPull} more)
            </ToolHeaderButton>
          )}
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
            disabled={issues.length === 0 || isExporting}
            loading={isExporting}
          />
        </ToolHeaderControls>
      </ToolHeader>
      {/* Loading indicator overlay */}
      {isLoadingAllData && (
        <div className='fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50'>
          <div className='rounded-lg bg-white p-6 shadow-xl'>
            <div className='flex items-center gap-3'>
              <div className='h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent'></div>
              <span className='text-lg font-medium'>
                Loading issues... ({pagination.totalLoaded} loaded)
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Data Table */}
      <Table
        data={issues}
        fieldMappings={optimizedFieldMappings}
        entityType="issue"
        tenantSlug={tenantSlug ?? undefined}
        enablePersistence={true}
        persistColumnSizes={true}
        loading={isLoading && !isLoadingAllData}
        customColumnSizing={columnSizing}
        showToolbar={false}
        height={600}
        className="shadow-sm"
        emptyMessage="No issues found. Try adjusting your filters or create some issues first."

        enableSorting={true}
        enableFiltering={true}
        enableGrouping={false}
        enableSelection={true}
        enableColumnResizing={true}
        debugResize={false}

        // Optimized virtualization settings for better performance
        rowOverscan={DEFAULT_VIRTUALIZATION.rowOverscan}
        columnOverscan={DEFAULT_VIRTUALIZATION.columnOverscan}
        rowHeight={DEFAULT_VIRTUALIZATION.rowHeight}
        enableRowVirtualization={DEFAULT_VIRTUALIZATION.enableRowVirtualization}
        enableColumnVirtualization={DEFAULT_VIRTUALIZATION.enableColumnVirtualization}

        onSelectionChange={(selection) => {
          // Efficiently sync selection without clearing all first
          const currentlySelected = dataSelection.selectedItems
          const newSelection = new Set<string>()

          // Build new selection set
          issues.forEach((issue, index) => {
            if (selection[index]) {
              newSelection.add(issue._id)
            }
          })

          // Only make changes if selection actually changed
          const hasChanges = newSelection.size !== currentlySelected.size ||
            !Array.from(newSelection).every(id => currentlySelected.has(id))

          if (hasChanges) {
            // Remove items that are no longer selected
            currentlySelected.forEach(id => {
              if (!newSelection.has(id)) {
                dataSelection.toggleItem(id)
              }
            })

            // Add items that are newly selected
            newSelection.forEach(id => {
              if (!currentlySelected.has(id)) {
                dataSelection.toggleItem(id)
              }
            })

            log.debug('Table selection changed', { count: newSelection.size })
          }
        }}

        onTableReady={({ table }) => {
          tableRef.current = table
          log.debug('Issue table ready', {
            columnCount: table.getAllLeafColumns().length,
            hasPersistence: Boolean(tenantSlug)
          })
        }}

        onColumnSizingChange={handleColumnSizingChange}

        onColumnSizingStateChange={({ columnSizing, columnSizingInfo }) => {
          // Column sizing state change tracking (removed verbose logging)
        }}

        // Column sizing is now handled by useTableCore via onColumnSizingChange prop
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

    </div>
  )
}
