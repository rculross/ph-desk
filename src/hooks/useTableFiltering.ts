/**
 * Table Filtering Hook
 *
 * Handles all filtering-related logic and UI components.
 * Provides clean separation of filtering concerns.
 */

import { useMemo } from 'react'

import type { ColumnFiltersState, Table } from '@tanstack/react-table'

export interface UseTableFilteringOptions<TData> {
  table: Table<TData>
  columnFilters: ColumnFiltersState
  onFiltersChange?: (filters: ColumnFiltersState) => void
}

export interface UseTableFilteringResult {
  hasActiveFilters: boolean
  activeFilterCount: number
  resetAllFilters: () => void
  getColumnFilter: (columnId: string) => any
  setColumnFilter: (columnId: string, value: any) => void
  clearColumnFilter: (columnId: string) => void
}

/**
 * Hook for managing table filtering state and actions
 */
export function useTableFiltering<TData>({
  table,
  columnFilters,
  onFiltersChange
}: UseTableFilteringOptions<TData>): UseTableFilteringResult {

  const hasActiveFilters = useMemo(() => columnFilters.length > 0, [columnFilters])
  const activeFilterCount = useMemo(() => columnFilters.length, [columnFilters])

  const resetAllFilters = () => {
    table.resetColumnFilters()
  }

  const getColumnFilter = (columnId: string) => {
    const filter = columnFilters.find(f => f.id === columnId)
    return filter?.value
  }

  const setColumnFilter = (columnId: string, value: any) => {
    const column = table.getColumn(columnId)
    if (column) {
      column.setFilterValue(value)
    }
  }

  const clearColumnFilter = (columnId: string) => {
    setColumnFilter(columnId, undefined)
  }

  return {
    hasActiveFilters,
    activeFilterCount,
    resetAllFilters,
    getColumnFilter,
    setColumnFilter,
    clearColumnFilter
  }
}