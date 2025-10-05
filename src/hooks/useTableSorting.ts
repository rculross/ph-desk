/**
 * Table Sorting Hook
 *
 * Handles all sorting-related logic and actions.
 * Provides clean separation of sorting concerns.
 */

import { useMemo } from 'react'

import type { SortingState, Table } from '@tanstack/react-table'

export interface UseTableSortingOptions<TData> {
  table: Table<TData>
  sorting: SortingState
  onSortingChange?: (sorting: SortingState) => void
}

export interface UseTableSortingResult {
  hasActiveSorting: boolean
  activeSortCount: number
  resetAllSorting: () => void
  getColumnSort: (columnId: string) => 'asc' | 'desc' | false
  getSortIndex: (columnId: string) => number
  toggleColumnSort: (columnId: string, desc?: boolean, multi?: boolean) => void
  clearColumnSort: (columnId: string) => void
}

/**
 * Hook for managing table sorting state and actions
 */
export function useTableSorting<TData>({
  table,
  sorting,
  onSortingChange
}: UseTableSortingOptions<TData>): UseTableSortingResult {

  const hasActiveSorting = useMemo(() => sorting.length > 0, [sorting])
  const activeSortCount = useMemo(() => sorting.length, [sorting])

  const resetAllSorting = () => {
    table.resetSorting()
  }

  const getColumnSort = (columnId: string): 'asc' | 'desc' | false => {
    const sort = sorting.find(s => s.id === columnId)
    if (!sort) return false
    return sort.desc ? 'desc' : 'asc'
  }

  const getSortIndex = (columnId: string): number => {
    return sorting.findIndex(s => s.id === columnId)
  }

  const toggleColumnSort = (columnId: string, desc?: boolean, multi = false) => {
    const column = table.getColumn(columnId)
    if (column && column.getCanSort()) {
      column.toggleSorting(desc, multi)
    }
  }

  const clearColumnSort = (columnId: string) => {
    const column = table.getColumn(columnId)
    if (column) {
      column.clearSorting()
    }
  }

  return {
    hasActiveSorting,
    activeSortCount,
    resetAllSorting,
    getColumnSort,
    getSortIndex,
    toggleColumnSort,
    clearColumnSort
  }
}