/**
 * Core Table Hook
 *
 * Provides a clean, minimal TanStack Table implementation following best practices.
 * Separates table logic from UI rendering and state management.
 *
 * Features:
 * - Tenant-specific persistence for column widths, order, and visibility
 * - Debounced state saving (500ms) to prevent excessive storage operations
 * - Automatic state loading on mount with validation
 * - Storage backend abstraction (electron-store or localStorage)
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

const isValidColumnVisibilityState = (value: unknown): value is VisibilityState => {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
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

  // Column persistence - all three features enabled when tenantSlug is provided
  persistColumnSizes?: boolean         // Persist column widths (requires enableColumnResizing)
  persistenceContext?: string          // Legacy persistence context identifier
  persistColumnOrder?: boolean         // Persist column order (drag-and-drop arrangement)
  persistColumnVisibility?: boolean    // Persist column visibility (show/hide columns)
  enablePersistence?: boolean          // Master switch to enable all persistence features
  persistenceKey?: string              // Custom persistence key (overrides auto-generated keys)
  persistenceScope?: TablePersistenceScope  // Tenant-specific persistence scope
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
  persistColumnVisibility = false,
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
    !(enablePersistence ?? persistColumnSizes ?? persistColumnOrder ?? persistColumnVisibility)
  )

  const columnSizingDebounceRef = useRef<NodeJS.Timeout | null>(null)
  const columnOrderDebounceRef = useRef<NodeJS.Timeout | null>(null)
  const columnVisibilityDebounceRef = useRef<NodeJS.Timeout | null>(null)

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
    enablePersistence ?? persistColumnSizes ?? persistColumnOrder ?? persistColumnVisibility
  )

  const shouldPersistColumnSizing = Boolean(
    resolvedEnablePersistence && persistColumnSizes && enableColumnResizing && resolvedPersistenceBase
  )


  const shouldPersistColumnOrder = Boolean(
    resolvedEnablePersistence && persistColumnOrder && resolvedPersistenceBase
  )

  const shouldPersistColumnVisibility = Boolean(
    resolvedEnablePersistence && persistColumnVisibility && resolvedPersistenceBase
  )

  const primaryColumnSizingKey = shouldPersistColumnSizing
    ? `table-column-widths-${resolvedPersistenceBase}`
    : undefined


  const primaryColumnOrderKey = shouldPersistColumnOrder
    ? `table-column-order-${resolvedPersistenceBase}`
    : undefined

  const primaryColumnVisibilityKey = shouldPersistColumnVisibility
    ? `table-column-visibility-${resolvedPersistenceBase}`
    : undefined


  const persistenceBackend = useMemo(() => {
    if (!resolvedEnablePersistence || !resolvedPersistenceBase) {
      return null
    }

    if (typeof window !== 'undefined' && window.electron.storage) {
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
    if (!shouldPersistColumnSizing && !shouldPersistColumnOrder && !shouldPersistColumnVisibility) {
      setIsPersistenceLoaded(true)
      return
    }

    // Only load persistence once when the keys are established
    if (isPersistenceLoaded) {
      return
    }

    let isMounted = true

    const loadPersistedState = async () => {
      console.group('📦 [useTableCore] Loading persisted table state')
      console.log('Persistence scope:', {
        shouldPersistColumnSizing,
        shouldPersistColumnOrder,
        shouldPersistColumnVisibility,
        resolvedPersistenceBase
      })
      console.log('Storage keys:', {
        primaryColumnSizingKey,
        primaryColumnOrderKey,
        primaryColumnVisibilityKey
      })

      let persistedSizing: ColumnSizingState | undefined
      let persistedOrder: ColumnOrderState | undefined
      let persistedVisibility: VisibilityState | undefined

      try {
        if (persistenceBackend) {
          const keysToLoad = [primaryColumnSizingKey, primaryColumnOrderKey, primaryColumnVisibilityKey].filter(
            (key): key is string => Boolean(key)
          )

          console.log('Keys to load:', keysToLoad)

          if (keysToLoad.length > 0) {
            const stored = await persistenceBackend.get(keysToLoad)
            console.log('Raw stored data:', stored)
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
            if (primaryColumnVisibilityKey && stored[primaryColumnVisibilityKey]) {
              const candidateVisibility = stored[primaryColumnVisibilityKey]
              console.log('📥 [useTableCore] Found persisted column visibility', {
                key: primaryColumnVisibilityKey,
                candidateVisibility,
                isValid: isValidColumnVisibilityState(candidateVisibility)
              })
              if (isValidColumnVisibilityState(candidateVisibility)) {
                persistedVisibility = candidateVisibility
              } else {
                console.warn('⚠️ [useTableCore] Invalid persisted column visibility state')
                log.warn('Ignoring invalid persisted column visibility state', {
                  context: resolvedPersistenceBase,
                  key: primaryColumnVisibilityKey
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

      if (persistedVisibility && isValidColumnVisibilityState(persistedVisibility)) {
        console.log('📥 [useTableCore] Applying persisted column visibility', {
          persistedVisibility,
          previousVisibility: columnVisibility
        })
        setColumnVisibility(prev => ({ ...prev, ...persistedVisibility }))
      } else {
        console.log('📥 [useTableCore] No valid persisted visibility to apply')
      }

      setIsPersistenceLoaded(true)
      console.log('✅ Persistence loaded successfully')
      console.groupEnd()
    }

    void loadPersistedState()

    return () => {
      isMounted = false
    }
  }, [
    shouldPersistColumnSizing,
    shouldPersistColumnOrder,
    shouldPersistColumnVisibility,
    isPersistenceLoaded,
    primaryColumnSizingKey,
    primaryColumnOrderKey,
    primaryColumnVisibilityKey,
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
      if (columnVisibilityDebounceRef.current) {
        clearTimeout(columnVisibilityDebounceRef.current)
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

  const persistColumnVisibilityState = useCallback(
    (visibility: VisibilityState) => {
      console.log('🟡 [useTableCore] persistColumnVisibilityState called', {
        shouldPersistColumnVisibility,
        hasPersistenceBackend: !!persistenceBackend,
        primaryColumnVisibilityKey,
        visibility
      })

      if (!shouldPersistColumnVisibility || !persistenceBackend || !primaryColumnVisibilityKey) {
        console.log('🟡 [useTableCore] Skipping persistence - conditions not met', {
          shouldPersistColumnVisibility,
          hasPersistenceBackend: !!persistenceBackend,
          primaryColumnVisibilityKey
        })
        return
      }

      if (columnVisibilityDebounceRef.current) {
        clearTimeout(columnVisibilityDebounceRef.current)
        console.log('🟡 [useTableCore] Cleared previous debounce timer')
      }

      console.log('🟡 [useTableCore] Setting up debounced save (500ms)...')
      columnVisibilityDebounceRef.current = setTimeout(async () => {
        try {
          console.log('🟢 [useTableCore] SAVING column visibility to storage', {
            key: primaryColumnVisibilityKey,
            visibility
          })
          await persistenceBackend.set({ [primaryColumnVisibilityKey]: visibility })
          console.log('✅ [useTableCore] Column visibility saved successfully')
        } catch (error) {
          console.error('❌ [useTableCore] Failed to persist column visibility', error)
          log.error('Failed to persist column visibility', {
            context: resolvedPersistenceBase,
            error: error instanceof Error ? error.message : 'Unknown error'
          })
        }
      }, 500)
    },
    [shouldPersistColumnVisibility, persistenceBackend, primaryColumnVisibilityKey, resolvedPersistenceBase]
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

  // Handle column visibility changes with persistence
  useEffect(() => {
    console.log('🔷 [useTableCore] Column visibility changed', {
      columnVisibility,
      isPersistenceLoaded,
      willPersist: isPersistenceLoaded
    })

    // Persist state if needed
    if (isPersistenceLoaded) {
      persistColumnVisibilityState(columnVisibility)
    } else {
      console.log('🔷 [useTableCore] Skipping persistence - not loaded yet')
    }
  }, [columnVisibility, persistColumnVisibilityState, isPersistenceLoaded])

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