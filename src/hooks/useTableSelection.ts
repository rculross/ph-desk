/**
 * Table Selection Hook
 *
 * Handles all row selection logic and actions.
 * Provides clean separation of selection concerns.
 */

import { useMemo } from 'react'

import type { RowSelectionState, Table } from '@tanstack/react-table'

export interface UseTableSelectionOptions<TData> {
  table: Table<TData>
  rowSelection: RowSelectionState
  onSelectionChange?: (selection: RowSelectionState) => void
}

export interface UseTableSelectionResult<TData> {
  hasSelection: boolean
  selectedCount: number
  isAllSelected: boolean
  isSomeSelected: boolean
  selectedRows: TData[]
  selectedRowIds: string[]
  clearSelection: () => void
  selectAll: () => void
  toggleRowSelection: (rowId: string) => void
  isRowSelected: (rowId: string) => boolean
}

/**
 * Hook for managing table row selection state and actions
 */
export function useTableSelection<TData>({
  table,
  rowSelection,
  onSelectionChange
}: UseTableSelectionOptions<TData>): UseTableSelectionResult<TData> {

  const selectedCount = useMemo(() => Object.keys(rowSelection).length, [rowSelection])
  const hasSelection = useMemo(() => selectedCount > 0, [selectedCount])

  const isAllSelected = useMemo(() => table.getIsAllPageRowsSelected(), [table, rowSelection])
  const isSomeSelected = useMemo(() => table.getIsSomePageRowsSelected(), [table, rowSelection])

  const selectedRows = useMemo(() => {
    return table.getSelectedRowModel().rows.map(row => row.original)
  }, [table, rowSelection])

  const selectedRowIds = useMemo(() => {
    return Object.keys(rowSelection).filter(id => rowSelection[id])
  }, [rowSelection])

  const clearSelection = () => {
    table.resetRowSelection()
  }

  const selectAll = () => {
    table.toggleAllPageRowsSelected(true)
  }

  const toggleRowSelection = (rowId: string) => {
    const row = table.getRow(rowId)
    if (row) {
      row.toggleSelected()
    }
  }

  const isRowSelected = (rowId: string): boolean => {
    return !!rowSelection[rowId]
  }

  return {
    hasSelection,
    selectedCount,
    isAllSelected,
    isSomeSelected,
    selectedRows,
    selectedRowIds,
    clearSelection,
    selectAll,
    toggleRowSelection,
    isRowSelected
  }
}