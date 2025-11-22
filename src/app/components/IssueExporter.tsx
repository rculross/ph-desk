/**
 * Issue Exporter Component for Planhat Extension
 *
 * Comprehensive issue export interface with advanced filtering,
 * field selection, and export format options.
 */

import { useState, useCallback, useEffect, useRef, useMemo } from 'react'

import { SettingOutlined } from '@ant-design/icons'
import { useQuery } from '@tanstack/react-query'
import type {
  VisibilityState,
  RowSelectionState
} from '@tanstack/react-table'
import { Typography, Button, Dropdown, Checkbox, InputNumber } from 'antd'
import { clsx } from 'clsx'
import { format as formatDate } from 'date-fns'
import { AlertCircleIcon } from 'lucide-react'

import { getTenantSlug } from '../../api/client/http-client'
import { issuesService } from '../../api/services/issues.service'
import { useUsersQuery } from '../../api/queries/users.queries'
import { ExportFormatButtons, useSharedExporter } from '../../components/exporters'
import { OrderColumnsModal } from '../../components/ui/OrderColumnsModal'
import { Table, type TableRenderContext } from '../../components/ui/Table'
import {
  ToolHeader,
  ToolHeaderButton,
  ToolHeaderControls
} from '../../components/ui/ToolHeader'
import { DEFAULT_VIRTUALIZATION } from '../../config/table-virtualization'
import { useTableColumns } from '../../hooks/useTableColumns'
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
  const [isLoadingAllData, setIsLoadingAllData] = useState(false)
  const [columnsDropdownOpen, setColumnsDropdownOpen] = useState(false)
  const [pendingVisibility, setPendingVisibility] = useState<VisibilityState | null>(null)
  const [maxRecords, setMaxRecords] = useState(2000)
  const loadingRef = useRef(false)
  const hasAutoLoaded = useRef(false)
  const log = logger.extension

  // Pagination state for incremental loading
  const [pagination, setPagination] = useState({
    currentOffset: 0,
    recordsPerPull: 2000, // Larger batches for more efficient loading
    totalLoaded: 0,
    hasMore: false
  })

  // All loaded issues (accumulated across pages)
  const [allIssues, setAllIssues] = useState<Issue[]>([])

  // Lookup maps for resolving IDs to names
  const [companyLookup, setCompanyLookup] = useState<Record<string, string>>({})
  const [userLookup, setUserLookup] = useState<Record<string, string>>({})

  const usersQuery = useUsersQuery({
    pagination: { limit: 5000 },
    enabled: true
  })

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

  // Build company lookup from issue payloads (names are included in response)
  useEffect(() => {
    if (allIssues.length === 0) {
      return
    }

    const derivedLookup: Record<string, string> = {}

    allIssues.forEach(issue => {
      issue.companies?.forEach(company => {
        if (company?.id && company.name) {
          derivedLookup[company.id] = company.name
        }
      })

      if (issue.company && issue.company._id && issue.company.name) {
        derivedLookup[issue.company._id] = issue.company.name
      }

      if (Array.isArray(issue.companyMatchingValue)) {
        issue.companyMatchingValue.forEach((entry: any) => {
          const companyId = entry?.id ?? entry?._id
          const companyName = entry?.name ?? entry?.label
          if (companyId && companyName) {
            derivedLookup[companyId] = companyName
          }
        })
      }

      if (issue.companyIds && Array.isArray(issue.companyIds) && issue.company && issue.company.name) {
        issue.companyIds.forEach(companyId => {
          if (companyId && !derivedLookup[companyId]) {
            derivedLookup[companyId] = issue.company?.name ?? companyId
          }
        })
      }
    })

    if (Object.keys(derivedLookup).length === 0) {
      return
    }

    setCompanyLookup(prev => {
      const next = { ...prev }
      let changed = false

      Object.entries(derivedLookup).forEach(([id, name]) => {
        if (!next[id] || next[id] !== name) {
          next[id] = name
          changed = true
        }
      })

      return changed ? next : prev
    })

    log.debug('Updated company lookup from issue payloads', {
      companyCount: Object.keys(derivedLookup).length
    })
  }, [allIssues, log])

  // Build user lookup once users are fetched via React Query
  useEffect(() => {
    if (!usersQuery.data?.data?.length) {
      return
    }

    const lookup = usersQuery.data.data.reduce<Record<string, string>>((acc, user) => {
      if (!user._id) {
        return acc
      }

      const fullName = [user.firstName, user.lastName].filter(Boolean).join(' ').trim()
      acc[user._id] = fullName || user.email || user._id
      return acc
    }, {})

    setUserLookup(lookup)

    log.debug('Updated user lookup from users query', {
      userCount: Object.keys(lookup).length
    })
  }, [usersQuery.data, log])

  // Use all loaded issues directly (no client-side date filtering)
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

  // Execute fetch with specified max records
  const executeLoad = useCallback(() => {
    log.info('Executing issues load', { maxRecords })

    // Reset pagination to first page with new maxRecords
    setPagination({
      currentOffset: 0,
      recordsPerPull: maxRecords,
      totalLoaded: 0,
      hasMore: false
    })

    // Clear accumulated issues
    setAllIssues([])

    // Refetch query
    void refetchQuery()
  }, [refetchQuery, maxRecords])

  // Auto-load on component mount
  useEffect(() => {
    if (!hasAutoLoaded.current) {
      hasAutoLoaded.current = true
      executeLoad()
    }
  }, [executeLoad])

  // Refresh functionality
  const refetch = useCallback(() => {
    log.info('Refreshing issues')

    // Reset pagination to first page
    setPagination({
      currentOffset: 0,
      recordsPerPull: 2000,
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
    buildFilename: format => {
      const now = new Date()
      const dateStr = formatDate(now, 'yyyy-MM-dd')
      const timeStr = formatDate(now, 'HH-mm')
      return `${tenantSlug || 'unknown'}_issues_export_${dateStr}_${timeStr}`
    },
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

  const tableContextRef = useRef<TableRenderContext<Issue> | null>(null)

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

  // Use ALL field mappings - let TanStack Table handle visibility via column visibility feature
  const allFieldMappings = useMemo(() => {
    // If no issues or no field mappings yet, return empty
    if (issues.length === 0 || fieldDetection.fieldMappings.length === 0) {
      return []
    }

    // Return ALL fields (not just included ones) - visibility is controlled by TanStack Table
    return fieldDetection.fieldMappings.map(field => ({
      key: field.key,
      label: field.label,
      type: field.type,
      include: true, // Always include - visibility managed by TanStack Table
      source: field.key.startsWith('custom.') ? 'custom' as const : 'standard' as const,
      customFieldConfig: field.customFieldConfig
    }))
  }, [fieldDetection.fieldMappings, issues.length])

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

  // Column visibility handlers with deferred updates
  useEffect(() => {
    if (columnsDropdownOpen && tableContextRef.current) {
      // Initialize pending visibility when dropdown opens
      const currentVisibility: VisibilityState = {}
      tableContextRef.current.table.getAllLeafColumns().forEach(column => {
        if (column.id !== 'select') {
          currentVisibility[column.id] = column.getIsVisible()
        }
      })
      setPendingVisibility(currentVisibility)
    }
  }, [columnsDropdownOpen])

  const handleDropdownOpenChange = useCallback((open: boolean) => {
    setColumnsDropdownOpen(open)

    if (!open && pendingVisibility && tableContextRef.current) {
      // Apply the pending visibility changes using setColumnVisibility from useTableCore
      tableContextRef.current.state.setColumnVisibility(pendingVisibility)
      setPendingVisibility(null)
    }
  }, [pendingVisibility])

  const handleColumnToggle = useCallback((columnId: string) => {
    if (!pendingVisibility) return

    setPendingVisibility(prev => ({
      ...prev!,
      [columnId]: !prev![columnId]
    }))
  }, [pendingVisibility])

  const handleSelectAll = useCallback(() => {
    if (!tableContextRef.current) return

    const newVisibility: VisibilityState = {}
    tableContextRef.current.table.getAllLeafColumns().forEach(column => {
      if (column.id !== 'select') {
        newVisibility[column.id] = true
      }
    })
    setPendingVisibility(newVisibility)
  }, [])

  const handleDeselectAll = useCallback(() => {
    if (!tableContextRef.current) return

    const newVisibility: VisibilityState = {}
    tableContextRef.current.table.getAllLeafColumns().forEach(column => {
      if (column.id !== 'select') {
        newVisibility[column.id] = false
      }
    })
    setPendingVisibility(newVisibility)
  }, [])

  return (
    <div className={clsx('space-y-6', className)}>
      {/* Tool Header */}
      <ToolHeader title='Issues' icon={AlertCircleIcon}>
        {/* Controls */}
        <ToolHeaderControls category={CONTROL_CATEGORIES.OUTPUT}>
          {/* Columns Button */}
          <Dropdown
            open={columnsDropdownOpen}
            onOpenChange={handleDropdownOpenChange}
            trigger={['click']}
            dropdownRender={() => (
              <div className="p-3 min-w-[200px] bg-white rounded-lg shadow-lg border border-gray-200">
                <div className="flex justify-between items-center mb-2">
                  <Typography.Text strong>Show Columns</Typography.Text>
                  <div className="flex gap-2">
                    <Button
                      type="text"
                      size="small"
                      onClick={handleSelectAll}
                    >
                      All
                    </Button>
                    <Button
                      type="text"
                      size="small"
                      onClick={handleDeselectAll}
                    >
                      None
                    </Button>
                  </div>
                </div>
                <div className="flex flex-col gap-1 max-h-[400px] overflow-y-auto">
                  {tableContextRef.current?.table.getAllLeafColumns()
                    .filter(col => col.id !== 'select')
                    .map(column => {
                      const isVisible = pendingVisibility
                        ? pendingVisibility[column.id] !== false
                        : column.getIsVisible()

                      return (
                        <Checkbox
                          key={column.id}
                          checked={isVisible}
                          onChange={() => handleColumnToggle(column.id)}
                        >
                          {typeof column.columnDef.header === 'string'
                            ? column.columnDef.header
                            : `Column ${column.id}`}
                        </Checkbox>
                      )
                    })}
                </div>
              </div>
            )}
          >
            <ToolHeaderButton
              category={CONTROL_CATEGORIES.OUTPUT}
              variant={columnsDropdownOpen ? 'primary' : 'secondary'}
              icon={<SettingOutlined />}
            >
              Columns
            </ToolHeaderButton>
          </Dropdown>

          {/* Max Records Input */}
          <InputNumber
            mode="spinner"
            value={maxRecords}
            onChange={(value) => setMaxRecords(value || 2000)}
            min={100}
            max={50000}
            step={2000}
            style={{ width: 120 }}
          />

          {/* Execute Button */}
          <Button
            size="small"
            type="primary"
            onClick={executeLoad}
            loading={isLoading || isLoadingAllData}
            style={{ minWidth: 75 }}
          >
            Execute
          </Button>

          {/* Export Controls */}
          <span className="font-medium text-sm -mr-1 ml-2">Export:</span>
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
        fieldMappings={allFieldMappings}
        entityType="issue"
        tenantSlug={tenantSlug ?? undefined}
        companyLookup={companyLookup}
        userLookup={userLookup}
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

        onTableReady={(context) => {
          tableContextRef.current = context
          log.debug('Issue table ready', {
            columnCount: context.table.getAllLeafColumns().length,
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
