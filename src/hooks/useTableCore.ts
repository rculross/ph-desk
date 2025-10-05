/**
 * Core Table Hook
 *
 * Provides a clean, minimal TanStack Table implementation following best practices.
 * Separates table logic from UI rendering and state management.
 */

import { useMemo, useState, useCallback, useEffect, useRef } from 'react'

import {
  useReactTable,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  getGroupedRowModel,
  getExpandedRowModel,
  getPaginationRowModel,
  getFacetedRowModel,
  getFacetedUniqueValues,
  getFacetedMinMaxValues,
  type ColumnDef,
  type SortingState,
  type ColumnFiltersState,
  type VisibilityState,
  type RowSelectionState,
  type ColumnSizingState,
  type GroupingState,
  type ExpandedState,
  type PaginationState,
  type ColumnOrderState,
  type Table,
  type FilterFn
} from '@tanstack/react-table'

import { logger } from '../utils/logger'
import { storageManager } from '../utils/storage-manager'

const log = logger.content


const isValidColumnSizingState = (value: unknown): value is ColumnSizingState => {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

const isValidColumnOrderState = (value: unknown): value is ColumnOrderState => {
  return Array.isArray(value) && value.every(columnId => typeof columnId === 'string')
}


interface TablePersistenceScope {
  entityType: string
  tenantSlug?: string
}

export interface UseTableCoreOptions<TData> {
  data: TData[]
  columns: ColumnDef<TData>[]

  // Feature flags
  enableSorting?: boolean
  enableMultiSort?: boolean
  enableFiltering?: boolean
  enableGlobalFilter?: boolean
  enableGrouping?: boolean
  enableSelection?: boolean
  enableColumnResizing?: boolean
  enablePagination?: boolean

  // Multi-sort configuration
  maxMultiSortColCount?: number

  // Initial states
  initialSorting?: SortingState
  initialFilters?: ColumnFiltersState
  initialGlobalFilter?: any
  initialColumnVisibility?: VisibilityState
  initialColumnSizing?: ColumnSizingState
  initialColumnOrder?: ColumnOrderState
  initialGrouping?: GroupingState

  // Filter functions
  globalFilterFn?: FilterFn<TData>

  // Callbacks
  onSortingChange?: (sorting: SortingState) => void
  onFiltersChange?: (filters: ColumnFiltersState) => void
  onGlobalFilterChange?: (globalFilter: any) => void
  onSelectionChange?: (selection: RowSelectionState) => void
  onColumnSizingChange?: (sizing: ColumnSizingState) => void
  onColumnOrderChange?: (columnOrder: ColumnOrderState) => void
  onGroupingChange?: (grouping: GroupingState) => void
  onExpandedChange?: (expanded: ExpandedState) => void

  // Pagination
  pageSize?: number
  pageIndex?: number
  onPaginationChange?: (pagination: PaginationState) => void

  // Column persistence
  persistColumnSizes?: boolean
  persistenceContext?: string
  persistColumnOrder?: boolean
  enablePersistence?: boolean
  persistenceKey?: string
  persistenceScope?: TablePersistenceScope
}

export interface UseTableCoreResult<TData> {
  table: Table<TData>
  isPersistenceLoaded: boolean

  // State values
  sorting: SortingState
  columnFilters: ColumnFiltersState
  globalFilter: any
  columnVisibility: VisibilityState
  rowSelection: RowSelectionState
  columnSizing: ColumnSizingState
  columnOrder: ColumnOrderState
  grouping: GroupingState
  expanded: ExpandedState
  pagination: PaginationState

  // State setters
  setSorting: React.Dispatch<React.SetStateAction<SortingState>>
  setColumnFilters: React.Dispatch<React.SetStateAction<ColumnFiltersState>>
  setGlobalFilter: React.Dispatch<React.SetStateAction<any>>
  setColumnVisibility: React.Dispatch<React.SetStateAction<VisibilityState>>
  setRowSelection: React.Dispatch<React.SetStateAction<RowSelectionState>>
  setColumnSizing: React.Dispatch<React.SetStateAction<ColumnSizingState>>
  setColumnOrder: React.Dispatch<React.SetStateAction<ColumnOrderState>>
  setGrouping: React.Dispatch<React.SetStateAction<GroupingState>>
  setExpanded: React.Dispatch<React.SetStateAction<ExpandedState>>
  setPagination: React.Dispatch<React.SetStateAction<PaginationState>>

  // Helper functions
  resetFilters: () => void
  resetSorting: () => void
  clearSelection: () => void
  resetAll: () => void
}

/**
 * Core table hook that provides a clean TanStack Table implementation
 * Following the library's best practices for state management and performance
 */
export function useTableCore<TData>({
  data,
  columns,

  enableSorting = true,
  enableMultiSort = true,
  enableFiltering = true,
  enableGlobalFilter = false,
  enableGrouping = false,
  enableSelection = false,
  enableColumnResizing = true,
  enablePagination = false,

  maxMultiSortColCount,

  initialSorting = [],
  initialFilters = [],
  initialGlobalFilter = '',
  initialColumnVisibility = {},
  initialColumnSizing = {},
  initialColumnOrder = [],
  initialGrouping = [],

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

  pageSize = 50,
  pageIndex = 0,

  persistColumnSizes = false,
  persistenceContext = 'default',
  persistColumnOrder = false,
  enablePersistence,
  persistenceKey,
  persistenceScope
}: UseTableCoreOptions<TData>): UseTableCoreResult<TData> {

  // Pure TanStack Table state management with persistence loading
  const [sorting, setSorting] = useState<SortingState>(initialSorting)
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>(initialFilters)
  const [globalFilter, setGlobalFilter] = useState<any>(initialGlobalFilter)
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>(initialColumnVisibility)
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({})

  const [columnSizing, setColumnSizing] = useState<ColumnSizingState>(initialColumnSizing)
  const [columnOrder, setColumnOrder] = useState<ColumnOrderState>(initialColumnOrder)
  const [grouping, setGrouping] = useState<GroupingState>(initialGrouping)
  const [expanded, setExpanded] = useState<ExpandedState>({})
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex,
    pageSize
  })

  const [isPersistenceLoaded, setIsPersistenceLoaded] = useState<boolean>(
    !(enablePersistence ?? persistColumnSizes ?? persistColumnOrder)
  )

  const columnSizingDebounceRef = useRef<NodeJS.Timeout | null>(null)
  const columnOrderDebounceRef = useRef<NodeJS.Timeout | null>(null)

  const resolvedPersistenceBase = useMemo(() => {
    if (persistenceKey) {
      return persistenceKey
    }

    if (persistenceScope?.entityType) {
      const base = persistenceScope.entityType
      if (persistenceScope.tenantSlug) {
        return `${base}-${persistenceScope.tenantSlug}`
      }
      return base
    }

    return persistenceContext
  }, [persistenceKey, persistenceScope?.entityType, persistenceScope?.tenantSlug, persistenceContext])

  const resolvedEnablePersistence = Boolean(
    enablePersistence ?? persistColumnSizes ?? persistColumnOrder
  )

  const shouldPersistColumnSizing = Boolean(
    resolvedEnablePersistence && persistColumnSizes && enableColumnResizing && resolvedPersistenceBase
  )


  const shouldPersistColumnOrder = Boolean(
    resolvedEnablePersistence && persistColumnOrder && resolvedPersistenceBase
  )

  const primaryColumnSizingKey = shouldPersistColumnSizing
    ? `table-column-widths-${resolvedPersistenceBase}`
    : undefined


  const primaryColumnOrderKey = shouldPersistColumnOrder
    ? `table-column-order-${resolvedPersistenceBase}`
    : undefined


  const persistenceBackend = useMemo(() => {
    if (!resolvedEnablePersistence || !resolvedPersistenceBase) {
      return null
    }

    if (typeof chrome !== 'undefined' && chrome.storage.local) {
      return {
        type: 'storageManager' as const,
        get: storageManager.safeGet,
        set: (data: Record<string, unknown>) => storageManager.safeSet(data, { priority: 'low' }),
        remove: storageManager.safeRemove
      }
    }

    if (typeof window !== 'undefined' && window.localStorage) {
      return {
        type: 'localStorage' as const,
        get: async (keys: string[]) => {
          const result: Record<string, unknown> = {}
          for (const key of keys) {
            try {
              const value = window.localStorage.getItem(key)
              if (value) {
                result[key] = JSON.parse(value)
              }
            } catch (error) {
              log.error('Failed to read persisted table state from localStorage', {
                key,
                error: error instanceof Error ? error.message : 'Unknown error'
              })
            }
          }
          return result
        },
        set: async (data: Record<string, unknown>) => {
          for (const [key, value] of Object.entries(data)) {
            try {
              window.localStorage.setItem(key, JSON.stringify(value))
            } catch (error) {
              log.error('Failed to persist table state to localStorage', {
                key,
                error: error instanceof Error ? error.message : 'Unknown error'
              })
            }
          }
        },
        remove: async (keys: string[]) => {
          for (const key of keys) {
            try {
              window.localStorage.removeItem(key)
            } catch (error) {
              log.error('Failed to remove persisted table state from localStorage', {
                key,
                error: error instanceof Error ? error.message : 'Unknown error'
              })
            }
          }
        }
      }
    }

    log.debug('No persistence backend available, skipping table persistence', {
      context: resolvedPersistenceBase
    })
    return null
  }, [resolvedEnablePersistence, resolvedPersistenceBase])

  useEffect(() => {
    if (!shouldPersistColumnSizing && !shouldPersistColumnOrder) {
      setIsPersistenceLoaded(true)
      return
    }

    // Only load persistence once when the keys are established
    if (isPersistenceLoaded) {
      return
    }

    let isMounted = true

    const loadPersistedState = async () => {
      let persistedSizing: ColumnSizingState | undefined
      let persistedOrder: ColumnOrderState | undefined

      try {
        if (persistenceBackend) {
          const keysToLoad = [primaryColumnSizingKey, primaryColumnOrderKey].filter(
            (key): key is string => Boolean(key)
          )

          if (keysToLoad.length > 0) {
            const stored = await persistenceBackend.get(keysToLoad)
            if (primaryColumnSizingKey && stored[primaryColumnSizingKey]) {
              const candidateSizing = stored[primaryColumnSizingKey]
              if (isValidColumnSizingState(candidateSizing)) {
                persistedSizing = candidateSizing
              } else {
                log.warn('Ignoring invalid persisted column sizing state', {
                  context: resolvedPersistenceBase,
                  key: primaryColumnSizingKey
                })
              }
            }
            if (primaryColumnOrderKey && stored[primaryColumnOrderKey]) {
              const candidateOrder = stored[primaryColumnOrderKey]
              if (isValidColumnOrderState(candidateOrder)) {
                persistedOrder = candidateOrder
              } else {
                log.warn('Ignoring invalid persisted column order state', {
                  context: resolvedPersistenceBase,
                  key: primaryColumnOrderKey
                })
              }
            }
          }
        }
      } catch (error) {
        log.error('Failed to load persisted table state', {
          context: resolvedPersistenceBase,
          error: error instanceof Error ? error.message : 'Unknown error'
        })
      }


      if (!isMounted) {
        return
      }

      if (persistedSizing && isValidColumnSizingState(persistedSizing)) {
        setColumnSizing(prev => ({ ...prev, ...persistedSizing }))
      }


      if (persistedOrder && isValidColumnOrderState(persistedOrder) && persistedOrder.length > 0) {
        setColumnOrder(persistedOrder)
      }

      setIsPersistenceLoaded(true)
    }

    void loadPersistedState()

    return () => {
      isMounted = false
    }
  }, [
    shouldPersistColumnSizing,
    shouldPersistColumnOrder,
    isPersistenceLoaded,
    primaryColumnSizingKey,
    primaryColumnOrderKey,
    resolvedPersistenceBase,
    persistenceBackend
  ])

  useEffect(() => {
    return () => {
      if (columnSizingDebounceRef.current) {
        clearTimeout(columnSizingDebounceRef.current)
      }
      if (columnOrderDebounceRef.current) {
        clearTimeout(columnOrderDebounceRef.current)
      }
    }
  }, [])

  // Debounced persistence function
  const persistColumnSizingState = useCallback(
    (sizing: ColumnSizingState) => {
      if (!shouldPersistColumnSizing || !persistenceBackend || !primaryColumnSizingKey) {
        return
      }

      if (columnSizingDebounceRef.current) {
        clearTimeout(columnSizingDebounceRef.current)
      }

      columnSizingDebounceRef.current = setTimeout(async () => {
        try {
          await persistenceBackend.set({ [primaryColumnSizingKey]: sizing })
        } catch (error) {
          log.error('Failed to persist column sizes', {
            context: resolvedPersistenceBase,
            error: error instanceof Error ? error.message : 'Unknown error'
          })
        }
      }, 500)
    },
    [
      shouldPersistColumnSizing,
      persistenceBackend,
      primaryColumnSizingKey,
      resolvedPersistenceBase
    ]
  )


  const persistColumnOrderState = useCallback(
    (order: ColumnOrderState) => {
      if (!shouldPersistColumnOrder || !persistenceBackend || !primaryColumnOrderKey) {
        return
      }

      if (columnOrderDebounceRef.current) {
        clearTimeout(columnOrderDebounceRef.current)
      }

      columnOrderDebounceRef.current = setTimeout(async () => {
        try {
          await persistenceBackend.set({ [primaryColumnOrderKey]: order })
        } catch (error) {
          log.error('Failed to persist column order', {
            context: resolvedPersistenceBase,
            error: error instanceof Error ? error.message : 'Unknown error'
          })
        }
      }, 500)
    },
    [shouldPersistColumnOrder, persistenceBackend, primaryColumnOrderKey, resolvedPersistenceBase]
  )

  // Handle external callbacks and persistence through useEffect hooks
  // This ensures TanStack Table compliance by keeping state setters pure

  // Handle sorting changes
  useEffect(() => {
    onSortingChange?.(sorting)
  }, [sorting, onSortingChange])

  // Handle column filter changes
  useEffect(() => {
    onFiltersChange?.(columnFilters)
  }, [columnFilters, onFiltersChange])

  // Handle global filter changes
  useEffect(() => {
    onGlobalFilterChange?.(globalFilter)
  }, [globalFilter, onGlobalFilterChange])

  // Handle row selection changes
  useEffect(() => {
    onSelectionChange?.(rowSelection)
  }, [rowSelection, onSelectionChange])

  // Handle column sizing changes with persistence
  useEffect(() => {
    // Call external handler
    onColumnSizingChange?.(columnSizing)

    // Persist state if needed
    if (isPersistenceLoaded) {
      persistColumnSizingState(columnSizing)
    }
  }, [columnSizing, onColumnSizingChange, persistColumnSizingState, isPersistenceLoaded])


  // Handle column order changes with persistence
  useEffect(() => {
    // Call external handler
    onColumnOrderChange?.(columnOrder)

    // Persist state if needed
    if (isPersistenceLoaded) {
      persistColumnOrderState(columnOrder)
    }
  }, [columnOrder, onColumnOrderChange, persistColumnOrderState, isPersistenceLoaded])

  // Handle grouping changes
  useEffect(() => {
    onGroupingChange?.(grouping)
  }, [grouping, onGroupingChange])

  // Handle expanded state changes
  useEffect(() => {
    onExpandedChange?.(expanded)
  }, [expanded, onExpandedChange])

  // Handle pagination changes
  useEffect(() => {
    onPaginationChange?.(pagination)
  }, [pagination, onPaginationChange])

  // Memoize columns to prevent unnecessary recalculations
  const memoizedColumns = useMemo(() => columns, [columns])

  // Create table instance with minimal configuration
  const table = useReactTable<TData>({
    data,
    columns: memoizedColumns,

    // Default column sizing configuration following TanStack Table best practices
    defaultColumn: {
      minSize: 80,
      maxSize: 800,
      size: 150
    },

    // State
    state: {
      sorting,
      columnFilters,
      globalFilter,
      columnVisibility,
      rowSelection,
      columnSizing,
      columnOrder,
      grouping,
      expanded,
      pagination
    },

    // Pure state change handlers - TanStack Table compliant
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onGlobalFilterChange: setGlobalFilter,
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: setRowSelection,
    onColumnSizingChange: setColumnSizing,
    onColumnOrderChange: setColumnOrder,
    onGroupingChange: setGrouping,
    onExpandedChange: setExpanded,
    onPaginationChange: setPagination,

    // Feature flags
    enableRowSelection: enableSelection,
    enableSorting,
    enableMultiSort,
    maxMultiSortColCount,
    enableColumnFilters: enableFiltering,
    enableGlobalFilter,
    globalFilterFn,
    enableColumnResizing,
    enableGrouping,

    // Column resize mode - use 'onChange' for immediate feedback (TanStack recommended)
    columnResizeMode: enableColumnResizing ? 'onChange' : undefined,

    // Column resize direction - default is 'ltr' (left-to-right)
    columnResizeDirection: 'ltr',

    // Row models - only include what's needed
    getCoreRowModel: getCoreRowModel(),

    ...(enableSorting && {
      getSortedRowModel: getSortedRowModel(),
      manualSorting: false
    }),

    ...(enableFiltering && {
      getFilteredRowModel: getFilteredRowModel(),
      getFacetedRowModel: getFacetedRowModel(),
      getFacetedUniqueValues: getFacetedUniqueValues(),
      getFacetedMinMaxValues: getFacetedMinMaxValues(),
      manualFiltering: false
    }),

    ...(enableGrouping && {
      getGroupedRowModel: getGroupedRowModel(),
      getExpandedRowModel: getExpandedRowModel(),
      manualGrouping: false
    }),

    ...(enablePagination && {
      getPaginationRowModel: getPaginationRowModel(),
      manualPagination: false
    })
  })

  // Helper functions
  const resetFilters = () => {
    table.resetColumnFilters()
    table.resetGlobalFilter()
  }

  const resetSorting = () => {
    table.resetSorting()
  }

  const clearSelection = () => {
    table.resetRowSelection()
  }

  const resetAll = () => {
    resetFilters()
    resetSorting()
    clearSelection()
    table.resetColumnVisibility()
    table.resetColumnSizing()
    table.resetColumnOrder()
    table.resetGrouping()
    table.resetExpanded()
  }

  return {
    table,
    isPersistenceLoaded,

    // State values
    sorting,
    columnFilters,
    globalFilter,
    columnVisibility,
    rowSelection,
    columnSizing,
    columnOrder,
    grouping,
    expanded,
    pagination,

    // State setters
    setSorting,
    setColumnFilters,
    setGlobalFilter,
    setColumnVisibility,
    setRowSelection,
    setColumnSizing,
    setColumnOrder,
    setGrouping,
    setExpanded,
    setPagination,

    // Helper functions
    resetFilters,
    resetSorting,
    clearSelection,
    resetAll
  }
}