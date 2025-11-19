/**
 * Table Component
 *
 * Modern table implementation using TanStack Table with proper architecture.
 * Combines our custom components while following best practices.
 *
 * Persistence Features:
 * - Column widths: User-adjusted sizes saved per tenant
 * - Column order: Drag-and-drop arrangement saved per tenant
 * - Column visibility: Show/hide preferences saved per tenant
 *
 * All persistence features are automatically enabled when both entityType
 * and tenantSlug props are provided.
 */

import React, { useMemo, useCallback, useEffect, useRef } from 'react'

import type { ColumnDef, ColumnSizingInfoState, ColumnSizingState } from '@tanstack/react-table'

import { useTableCore, type UseTableCoreOptions, type UseTableCoreResult } from '../../hooks/useTableCore'
import type { EntityType } from '../../types/api'
import type { FieldMapping } from '../../types/export'
import { createColumnsFromFields, addSelectionColumn } from '../../utils/table-columns'

import { DataTable } from './DataTable'
import { TableToolbar } from './TableToolbar'

export interface TableRenderContext<TData> {
  table: UseTableCoreResult<TData>['table']
  state: UseTableCoreResult<TData>
}

type TableContentRenderer<TData> =
  | React.ReactNode
  | ((context: TableRenderContext<TData>) => React.ReactNode)

export interface TableProps<TData> extends Omit<UseTableCoreOptions<TData>, 'columns'> {
  // Data and columns
  fieldMappings?: FieldMapping[]
  entityType?: EntityType
  customColumns?: ColumnDef<TData>[]

  // Lookup maps for resolving IDs to names
  companyLookup?: Record<string, string>
  userLookup?: Record<string, string>

  // Persistence - enables column widths, order, and visibility persistence per tenant
  tenantSlug?: string          // Required for tenant-specific persistence
  enablePersistence?: boolean  // Master switch (default: true when tenantSlug provided)

  // Table display
  height?: number
  loading?: boolean
  stickyHeader?: boolean
  className?: string
  emptyMessage?: string

  // Toolbar
  showToolbar?: boolean
  title?: string
  toolbarChildren?: React.ReactNode

  // Column sizing
  customColumnSizing?: Record<string, number>

  // Column persistence (simplified options - rarely needed, use enablePersistence instead)
  persistColumnSizes?: boolean    // Override to disable width persistence
  persistenceContext?: string     // Legacy persistence context

  // Virtualization options
  enableRowVirtualization?: boolean
  enableColumnVirtualization?: boolean
  rowHeight?: number
  rowOverscan?: number
  columnOverscan?: number

  // Callbacks
  onColumnOrderClick?: () => void
  onColumnReorder?: (fromIndex: number, toIndex: number) => void
  onTableReady?: (context: TableRenderContext<TData>) => void
  onColumnSizingStateChange?: (payload: {
    columnSizing: ColumnSizingState
    columnSizingInfo: ColumnSizingInfoState
    table: UseTableCoreResult<TData>['table']
  }) => void

  // Debug
  debugResize?: boolean

  // Custom content slots
  topContent?: TableContentRenderer<TData>
  bottomContent?: TableContentRenderer<TData>
  footerContent?: TableContentRenderer<TData>
}

/**
 * Complete table solution with clean architecture
 */
export function Table<TData>({
  data,
  fieldMappings = [],
  entityType = 'issue',
  customColumns,
  companyLookup = {},
  userLookup = {},

  tenantSlug,
  enablePersistence = true,

  height = 600,
  loading = false,
  stickyHeader = true,
  className,
  emptyMessage = 'No data available',

  showToolbar = true,
  title,
  toolbarChildren,

  customColumnSizing = {},

  persistColumnSizes = false,
  persistenceContext,

  // Virtualization options with sensible defaults
  enableRowVirtualization = true,
  enableColumnVirtualization = true,
  rowHeight = 48,
  rowOverscan = 10,
  columnOverscan = 5,

  enableSorting = true,
  enableFiltering = true,
  enableGlobalFilter = false,
  enableGrouping = false,
  enableSelection = false,
  enableColumnResizing = true,
  enablePagination = false,

  initialSorting,
  initialFilters,
  initialGlobalFilter,
  initialColumnVisibility,
  initialColumnSizing,
  initialColumnOrder,
  initialGrouping,

  globalFilterFn,

  onSortingChange,
  onFiltersChange,
  onGlobalFilterChange,
  onSelectionChange,
  onColumnSizingChange,
  onColumnOrderChange,
  onGroupingChange,
  onExpandedChange,
  onPaginationChange,
  onColumnOrderClick,
  onColumnReorder,
  onTableReady,
  onColumnSizingStateChange,

  pageSize,
  pageIndex,

  debugResize = false,

  topContent,
  bottomContent,
  footerContent
}: TableProps<TData>) {

  // Create columns from field mappings or use custom columns
  const columns = useMemo(() => {
    let cols: ColumnDef<TData>[] = []

    if (customColumns) {
      cols = customColumns
    } else if (fieldMappings.length > 0) {
      cols = createColumnsFromFields<TData>(fieldMappings, entityType, customColumnSizing, companyLookup, userLookup)
    }

    // Add selection column if enabled
    if (enableSelection && cols.length > 0) {
      cols = addSelectionColumn(cols)
    }

    return cols
  }, [
    customColumns,
    fieldMappings,
    entityType,
    customColumnSizing,
    enableSelection,
    companyLookup,
    userLookup
  ])

  // Initialize column order from initial props or column definitions
  const initialOrder = useMemo(() => {
    if (initialColumnOrder && initialColumnOrder.length > 0) {
      return initialColumnOrder
    }

    return columns.map(col => col.id).filter((id): id is string => !!id)
  }, [columns, initialColumnOrder])

  // Initialize column sizing from provided overrides
  const initialSizing = useMemo(() => {
    return {
      ...customColumnSizing,
      ...(initialColumnSizing ?? {})
    }
  }, [customColumnSizing, initialColumnSizing])

  const persistenceScope = useMemo(() => {
    if (!entityType) {
      return undefined
    }

    if (tenantSlug) {
      return { entityType, tenantSlug }
    }

    return { entityType }
  }, [entityType, tenantSlug])

  const persistenceEnabled = enablePersistence && Boolean(tenantSlug)

  // Debug logging for persistence configuration
  useEffect(() => {
    console.group('🔧 [Table] Persistence Configuration')
    console.log('Entity Type:', entityType)
    console.log('Tenant Slug:', tenantSlug)
    console.log('Enable Persistence (prop):', enablePersistence)
    console.log('Persistence Enabled (calculated):', persistenceEnabled)
    console.log('Persistence Scope:', persistenceScope)
    console.log('Will persist column sizes:', persistenceEnabled)
    console.log('Will persist column order:', persistenceEnabled)
    console.log('Will persist column visibility:', persistenceEnabled)
    console.groupEnd()
  }, [entityType, tenantSlug, enablePersistence, persistenceEnabled, persistenceScope])

  // Use the core table hook with new simplified persistence
  const tableCore = useTableCore<TData>({
    data,
    columns,

    enableSorting,
    enableFiltering,
    enableGlobalFilter,
    enableGrouping,
    enableSelection,
    enableColumnResizing,
    enablePagination,

    initialSorting,
    initialFilters,
    initialGlobalFilter,
    initialColumnVisibility,
    initialColumnSizing: initialSizing,
    initialColumnOrder: initialOrder,
    initialGrouping,

    globalFilterFn,

    persistColumnSizes: persistenceEnabled,
    persistenceContext: persistenceContext || (entityType ? `table-${entityType}` : 'table'),
    persistColumnOrder: persistenceEnabled,
    persistColumnVisibility: persistenceEnabled,
    enablePersistence: persistenceEnabled,
    persistenceScope,

    onSortingChange,
    onFiltersChange,
    onGlobalFilterChange,
    onSelectionChange,
    onColumnSizingChange,
    onColumnOrderChange,
    onGroupingChange,
    onExpandedChange,
    onPaginationChange,

    pageSize,
    pageIndex
  })

  const renderContext = useMemo<TableRenderContext<TData>>(() => ({
    table: tableCore.table,
    state: tableCore
  }), [tableCore])

  const isReadyRef = useRef(false)

  useEffect(() => {
    if (!onTableReady || isReadyRef.current || !tableCore.isPersistenceLoaded) {
      return
    }

    isReadyRef.current = true
    onTableReady(renderContext)
  }, [onTableReady, renderContext, tableCore.isPersistenceLoaded])

  const columnSizingInfo = tableCore.table.getState().columnSizingInfo

  useEffect(() => {
    if (!onColumnSizingStateChange) {
      return
    }

    onColumnSizingStateChange({
      columnSizing: tableCore.columnSizing,
      columnSizingInfo,
      table: tableCore.table
    })
  }, [columnSizingInfo, onColumnSizingStateChange, tableCore.columnSizing, tableCore.table])

  const renderSection = useCallback(
    (section?: TableContentRenderer<TData>) => {
      if (!section) {
        return null
      }

      if (typeof section === 'function') {
        return section(renderContext)
      }

      return section
    },
    [renderContext]
  )

  // Handle column reordering - delegates to TanStack Table
  const handleColumnReorder = useCallback((fromIndex: number, toIndex: number) => {
    console.log('Column reorder requested:', { fromIndex, toIndex })

    // Get current column order
    const allColumns = tableCore.table.getAllLeafColumns() // Use getAllLeafColumns for better accuracy
    console.log('All columns:', allColumns.map(col => ({ id: col.id, index: allColumns.indexOf(col) })))

    if (fromIndex >= 0 && fromIndex < allColumns.length && toIndex >= 0 && toIndex <= allColumns.length) {
      // Calculate new order based on current visible column order
      const currentOrder = allColumns.map(col => col.id)
      const newOrder = [...currentOrder]

      // Remove the column from its current position
      const [movedColumnId] = newOrder.splice(fromIndex, 1)
      if (movedColumnId) {
        // Adjust the insertion index when removing a column from before the target index.
        const targetIndex = fromIndex < toIndex ? toIndex - 1 : toIndex
        const finalIndex = Math.max(0, Math.min(targetIndex, newOrder.length))

        // Insert at new position
        newOrder.splice(finalIndex, 0, movedColumnId)

        console.log('New column order:', newOrder)

        // Apply the new order to TanStack Table
        tableCore.table.setColumnOrder(newOrder)

        // Notify parent component with the resolved final index
        if (onColumnReorder) {
          onColumnReorder(fromIndex, finalIndex)
        }
      }
      return
    }

    if (onColumnReorder) {
      onColumnReorder(fromIndex, toIndex)
    }
  }, [tableCore.table, onColumnReorder])

  // Don't render until persistence is loaded to avoid flashing
  if (!tableCore.isPersistenceLoaded) {
    return (
      <div className={className}>
        <div className="p-4 text-center text-gray-500">Loading table state...</div>
      </div>
    )
  }

  return (
    <div className={className}>
      {renderSection(topContent)}

      {showToolbar && (
        <TableToolbar
          table={tableCore.table}
          title={title}

          grouping={tableCore.grouping}
          columnFilters={tableCore.columnFilters}
          sorting={tableCore.sorting}
          columnVisibility={tableCore.columnVisibility}
          expanded={tableCore.expanded}
          rowSelection={tableCore.rowSelection}

          enableGrouping={enableGrouping}
          enableFiltering={enableFiltering}
          enableSorting={enableSorting}
          enableColumnVisibility={true}
          enableSelection={enableSelection}

          onResetFilters={tableCore.resetFilters}
          onResetSorting={tableCore.resetSorting}
          onClearSelection={tableCore.clearSelection}
          onGroupingChange={tableCore.setGrouping}
          onExpandedChange={tableCore.setExpanded}
          onColumnVisibilityChange={tableCore.setColumnVisibility}
          onColumnOrderClick={onColumnOrderClick}
        >
          {toolbarChildren}
        </TableToolbar>
      )}

      <DataTable
        table={tableCore.table}
        loading={loading}
        height={height}
        stickyHeader={stickyHeader}
        emptyMessage={emptyMessage}
        enableColumnResizing={enableColumnResizing}
        enableColumnDragging={true}
        onColumnReorder={handleColumnReorder}
        enableRowVirtualization={enableRowVirtualization}
        enableColumnVirtualization={enableColumnVirtualization}
        rowHeight={rowHeight}
        rowOverscan={rowOverscan}
        columnOverscan={columnOverscan}
        debugResize={debugResize}
      />

      {renderSection(bottomContent)}
      {renderSection(footerContent)}
    </div>
  )
}

// Export the table core hook for advanced usage
export { useTableCore } from '../../hooks/useTableCore'
export type { UseTableCoreResult } from '../../hooks/useTableCore'
