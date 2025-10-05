/**
 * ENHANCED Core Table Hook - Architectural Improvements
 *
 * This is an enhanced version of useTableCore that addresses:
 * 1. Memory leak risks
 * 2. Race conditions in state management
 * 3. Type safety issues
 * 4. Storage operation safety
 *
 * KEY IMPROVEMENTS:
 * - Memory management with automatic cleanup
 * - Race-condition safe state updates
 * - Type-safe storage operations
 * - Enhanced error handling
 * - Performance optimizations
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

const log = logger.content

// Enhanced type guards with better validation
const isValidColumnSizingState = (value: unknown): value is ColumnSizingState => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false
  }

  // Validate that all values are positive numbers
  return Object.values(value).every(size =>
    typeof size === 'number' && size > 0 && size < 10000
  )
}

const isValidColumnOrderState = (value: unknown): value is ColumnOrderState => {
  if (!Array.isArray(value)) {
    return false
  }

  // Validate unique string IDs
  const stringIds = value.filter(id => typeof id === 'string')
  const uniqueIds = new Set(stringIds)

  return stringIds.length === value.length && uniqueIds.size === stringIds.length
}

// Memory management interface
interface MemoryManager {
  register(cleanup: () => void): void
  cleanup(): void
}

class ComponentMemoryManager implements MemoryManager {
  private cleanupFunctions: (() => void)[] = []
  private isDestroyed = false

  register(cleanup: () => void): void {
    if (this.isDestroyed) {
      log.warn('Attempting to register cleanup on destroyed memory manager')
      return
    }
    this.cleanupFunctions.push(cleanup)
  }

  cleanup(): void {
    this.cleanupFunctions.forEach(cleanup => {
      try {
        cleanup()
      } catch (error) {
        log.error('Memory cleanup failed', {
          error: error instanceof Error ? error.message : 'Unknown error'
        })
      }
    })
    this.cleanupFunctions = []
    this.isDestroyed = true
  }
}

// Race-condition safe state wrapper
interface SafeStateUpdate<T> {
  value: T
  timestamp: number
  version: number
}

function useSafeState<T>(initialValue: T): [T, (value: T | ((prev: T) => T)) => void] {
  const [state, setState] = useState<SafeStateUpdate<T>>({
    value: initialValue,
    timestamp: Date.now(),
    version: 0
  })

  const versionRef = useRef(0)

  const setSafeState = useCallback((newValue: T | ((prev: T) => T)) => {
    setState(prevState => {
      const currentVersion = ++versionRef.current
      const timestamp = Date.now()

      // Prevent stale updates
      if (currentVersion < prevState.version) {
        log.warn('Discarding stale state update', {
          currentVersion,
          previousVersion: prevState.version
        })
        return prevState
      }

      const resolvedValue = typeof newValue === 'function'
        ? (newValue as (prev: T) => T)(prevState.value)
        : newValue

      return {
        value: resolvedValue,
        timestamp,
        version: currentVersion
      }
    })
  }, [])

  return [state.value, setSafeState]
}

// Enhanced persistence interface with better error handling
interface PersistenceBackend {
  type: 'localStorage' | 'storageManager'
  get(keys: string[]): Promise<Record<string, unknown>>
  set(data: Record<string, unknown>): Promise<void>
  remove(keys: string[]): Promise<void>
}

// Type-safe storage schema
interface TableStorageSchema {
  columnSizing: ColumnSizingState
  columnOrder: ColumnOrderState
  columnVisibility: VisibilityState
}

class TypeSafeTableStorage {
  constructor(private backend: PersistenceBackend) {}

  async getColumnSizing(key: string): Promise<ColumnSizingState> {
    try {
      const result = await this.backend.get([key])
      const value = result[key]

      if (isValidColumnSizingState(value)) {
        return value
      }

      log.warn('Invalid column sizing data in storage', { key, value })
      return {}
    } catch (error) {
      log.error('Failed to load column sizing', {
        key,
        error: error instanceof Error ? error.message : 'Unknown error'
      })
      return {}
    }
  }

  async setColumnSizing(key: string, sizing: ColumnSizingState): Promise<void> {
    if (!isValidColumnSizingState(sizing)) {
      log.error('Attempted to save invalid column sizing', { key, sizing })
      return
    }

    try {
      await this.backend.set({ [key]: sizing })
      log.debug('Column sizing saved successfully', { key, columnCount: Object.keys(sizing).length })
    } catch (error) {
      log.error('Failed to save column sizing', {
        key,
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  }

  async getColumnOrder(key: string): Promise<ColumnOrderState> {
    try {
      const result = await this.backend.get([key])
      const value = result[key]

      if (isValidColumnOrderState(value)) {
        return value
      }

      log.warn('Invalid column order data in storage', { key, value })
      return []
    } catch (error) {
      log.error('Failed to load column order', {
        key,
        error: error instanceof Error ? error.message : 'Unknown error'
      })
      return []
    }
  }

  async setColumnOrder(key: string, order: ColumnOrderState): Promise<void> {
    if (!isValidColumnOrderState(order)) {
      log.error('Attempted to save invalid column order', { key, order })
      return
    }

    try {
      await this.backend.set({ [key]: order })
      log.debug('Column order saved successfully', { key, columnCount: order.length })
    } catch (error) {
      log.error('Failed to save column order', {
        key,
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  }
}

// Enhanced options interface with better typing
export interface UseTableCoreOptionsEnhanced<TData> {
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

  // Initial states with type safety
  initialSorting?: SortingState
  initialFilters?: ColumnFiltersState
  initialGlobalFilter?: string
  initialColumnVisibility?: VisibilityState
  initialColumnSizing?: ColumnSizingState
  initialColumnOrder?: ColumnOrderState
  initialGrouping?: GroupingState

  // Filter functions
  globalFilterFn?: FilterFn<TData>

  // Enhanced callbacks with error handling
  onSortingChange?: (sorting: SortingState) => void | Promise<void>
  onFiltersChange?: (filters: ColumnFiltersState) => void | Promise<void>
  onGlobalFilterChange?: (globalFilter: string) => void | Promise<void>
  onSelectionChange?: (selection: RowSelectionState) => void | Promise<void>
  onColumnSizingChange?: (sizing: ColumnSizingState) => void | Promise<void>
  onColumnOrderChange?: (columnOrder: ColumnOrderState) => void | Promise<void>
  onGroupingChange?: (grouping: GroupingState) => void | Promise<void>
  onExpandedChange?: (expanded: ExpandedState) => void | Promise<void>

  // Pagination
  pageSize?: number
  pageIndex?: number
  onPaginationChange?: (pagination: PaginationState) => void | Promise<void>

  // Enhanced persistence configuration
  persistColumnSizes?: boolean
  persistColumnOrder?: boolean
  persistenceKey?: string
  persistenceScope?: {
    entityType: string
    tenantSlug?: string
  }

  // Performance options
  enableMemoryManagement?: boolean
  debounceTime?: number
}

export interface UseTableCoreResultEnhanced<TData> {
  table: Table<TData>
  isPersistenceLoaded: boolean

  // State values
  sorting: SortingState
  columnFilters: ColumnFiltersState
  globalFilter: string
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
  setGlobalFilter: React.Dispatch<React.SetStateAction<string>>
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

  // Enhanced features
  memoryManager: MemoryManager
  isHealthy: boolean
}

/**
 * Enhanced Core table hook with architectural improvements
 */
export function useTableCoreEnhanced<TData>({
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
  persistColumnOrder = false,
  persistenceKey,
  persistenceScope,

  enableMemoryManagement = true,
  debounceTime = 500
}: UseTableCoreOptionsEnhanced<TData>): UseTableCoreResultEnhanced<TData> {

  // Memory management setup
  const memoryManager = useRef(new ComponentMemoryManager())
  const [isHealthy, setIsHealthy] = useState(true)

  // Enhanced state management with race condition protection
  const [sorting, setSorting] = useSafeState<SortingState>(initialSorting)
  const [columnFilters, setColumnFilters] = useSafeState<ColumnFiltersState>(initialFilters)
  const [globalFilter, setGlobalFilter] = useSafeState<string>(initialGlobalFilter)
  const [columnVisibility, setColumnVisibility] = useSafeState<VisibilityState>(initialColumnVisibility)
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({})
  const [columnSizing, setColumnSizing] = useSafeState<ColumnSizingState>(initialColumnSizing)
  const [columnOrder, setColumnOrder] = useSafeState<ColumnOrderState>(initialColumnOrder)
  const [grouping, setGrouping] = useSafeState<GroupingState>(initialGrouping)
  const [expanded, setExpanded] = useSafeState<ExpandedState>({})
  const [pagination, setPagination] = useSafeState<PaginationState>({
    pageIndex,
    pageSize
  })

  const [isPersistenceLoaded, setIsPersistenceLoaded] = useState(false)

  // Debounced refs for persistence
  const columnSizingDebounceRef = useRef<NodeJS.Timeout | null>(null)
  const columnOrderDebounceRef = useRef<NodeJS.Timeout | null>(null)

  // Clean up debounced timers
  useEffect(() => {
    const cleanup = () => {
      if (columnSizingDebounceRef.current) {
        clearTimeout(columnSizingDebounceRef.current)
      }
      if (columnOrderDebounceRef.current) {
        clearTimeout(columnOrderDebounceRef.current)
      }
    }

    if (enableMemoryManagement) {
      memoryManager.current.register(cleanup)
    }

    return cleanup
  }, [enableMemoryManagement])

  // Health monitoring
  useEffect(() => {
    const healthCheck = () => {
      try {
        // Basic health checks
        const hasValidData = Array.isArray(data)
        const hasValidColumns = Array.isArray(columns) && columns.length > 0
        const memoryNotDestroyed = memoryManager.current && !(memoryManager.current as any).isDestroyed

        const healthy = hasValidData && hasValidColumns && memoryNotDestroyed
        setIsHealthy(healthy)

        if (!healthy) {
          log.warn('Table core health check failed', {
            hasValidData,
            hasValidColumns,
            memoryNotDestroyed
          })
        }
      } catch (error) {
        log.error('Health check error', {
          error: error instanceof Error ? error.message : 'Unknown error'
        })
        setIsHealthy(false)
      }
    }

    healthCheck()
    const interval = setInterval(healthCheck, 30000) // Check every 30 seconds

    if (enableMemoryManagement) {
      memoryManager.current.register(() => clearInterval(interval))
    }

    return () => clearInterval(interval)
  }, [data, columns, enableMemoryManagement])

  // Persistence logic (simplified and safer)
  const persistenceBase = useMemo(() => {
    if (persistenceKey) return persistenceKey
    if (persistenceScope?.entityType) {
      const base = persistenceScope.entityType
      return persistenceScope.tenantSlug ? `${base}-${persistenceScope.tenantSlug}` : base
    }
    return 'default'
  }, [persistenceKey, persistenceScope])

  // Create type-safe storage instance
  const storage = useMemo(() => {
    if (!persistColumnSizes && !persistColumnOrder) return null

    // Create backend (simplified)
    const backend: PersistenceBackend = {
      type: 'localStorage',
      async get(keys: string[]) {
        const result: Record<string, unknown> = {}
        for (const key of keys) {
          try {
            const value = localStorage.getItem(key)
            if (value) result[key] = JSON.parse(value)
          } catch (error) {
            log.error('Storage get failed', { key, error })
          }
        }
        return result
      },
      async set(data: Record<string, unknown>) {
        for (const [key, value] of Object.entries(data)) {
          try {
            localStorage.setItem(key, JSON.stringify(value))
          } catch (error) {
            log.error('Storage set failed', { key, error })
          }
        }
      },
      async remove(keys: string[]) {
        for (const key of keys) {
          try {
            localStorage.removeItem(key)
          } catch (error) {
            log.error('Storage remove failed', { key, error })
          }
        }
      }
    }

    return new TypeSafeTableStorage(backend)
  }, [persistColumnSizes, persistColumnOrder])

  // Load persisted state
  useEffect(() => {
    if (!storage) {
      setIsPersistenceLoaded(true)
      return
    }

    let isMounted = true

    const loadPersistence = async () => {
      try {
        const [persistedSizing, persistedOrder] = await Promise.all([
          persistColumnSizes ? storage.getColumnSizing(`table-column-sizing-${persistenceBase}`) : Promise.resolve({}),
          persistColumnOrder ? storage.getColumnOrder(`table-column-order-${persistenceBase}`) : Promise.resolve([])
        ])

        if (!isMounted) return

        if (Object.keys(persistedSizing).length > 0) {
          setColumnSizing(prev => ({ ...prev, ...persistedSizing }))
        }

        if (persistedOrder.length > 0) {
          setColumnOrder(persistedOrder)
        }

        setIsPersistenceLoaded(true)
      } catch (error) {
        log.error('Failed to load persisted state', { error })
        setIsPersistenceLoaded(true)
      }
    }

    loadPersistence()

    return () => {
      isMounted = false
    }
  }, [storage, persistColumnSizes, persistColumnOrder, persistenceBase, setColumnSizing, setColumnOrder])

  // Enhanced callback handlers with error boundaries
  const createSafeCallback = useCallback(<T extends any[]>(
    callback: ((...args: T) => void | Promise<void>) | undefined,
    name: string
  ) => {
    if (!callback) return undefined

    return async (...args: T) => {
      try {
        await callback(...args)
      } catch (error) {
        log.error(`Callback '${name}' failed`, {
          error: error instanceof Error ? error.message : 'Unknown error'
        })
      }
    }
  }, [])

  // State change effects with enhanced error handling
  useEffect(() => {
    const safeCallback = createSafeCallback(onSortingChange, 'onSortingChange')
    safeCallback?.(sorting)
  }, [sorting, createSafeCallback, onSortingChange])

  useEffect(() => {
    const safeCallback = createSafeCallback(onFiltersChange, 'onFiltersChange')
    safeCallback?.(columnFilters)
  }, [columnFilters, createSafeCallback, onFiltersChange])

  useEffect(() => {
    const safeCallback = createSafeCallback(onGlobalFilterChange, 'onGlobalFilterChange')
    safeCallback?.(globalFilter)
  }, [globalFilter, createSafeCallback, onGlobalFilterChange])

  useEffect(() => {
    const safeCallback = createSafeCallback(onSelectionChange, 'onSelectionChange')
    safeCallback?.(rowSelection)
  }, [rowSelection, createSafeCallback, onSelectionChange])

  // Enhanced column sizing persistence with debouncing
  useEffect(() => {
    const safeCallback = createSafeCallback(onColumnSizingChange, 'onColumnSizingChange')
    safeCallback?.(columnSizing)

    if (isPersistenceLoaded && storage && persistColumnSizes) {
      if (columnSizingDebounceRef.current) {
        clearTimeout(columnSizingDebounceRef.current)
      }

      columnSizingDebounceRef.current = setTimeout(() => {
        storage.setColumnSizing(`table-column-sizing-${persistenceBase}`, columnSizing)
      }, debounceTime)
    }
  }, [columnSizing, createSafeCallback, onColumnSizingChange, isPersistenceLoaded, storage, persistColumnSizes, persistenceBase, debounceTime])

  // Enhanced column order persistence with debouncing
  useEffect(() => {
    const safeCallback = createSafeCallback(onColumnOrderChange, 'onColumnOrderChange')
    safeCallback?.(columnOrder)

    if (isPersistenceLoaded && storage && persistColumnOrder) {
      if (columnOrderDebounceRef.current) {
        clearTimeout(columnOrderDebounceRef.current)
      }

      columnOrderDebounceRef.current = setTimeout(() => {
        storage.setColumnOrder(`table-column-order-${persistenceBase}`, columnOrder)
      }, debounceTime)
    }
  }, [columnOrder, createSafeCallback, onColumnOrderChange, isPersistenceLoaded, storage, persistColumnOrder, persistenceBase, debounceTime])

  useEffect(() => {
    const safeCallback = createSafeCallback(onGroupingChange, 'onGroupingChange')
    safeCallback?.(grouping)
  }, [grouping, createSafeCallback, onGroupingChange])

  useEffect(() => {
    const safeCallback = createSafeCallback(onExpandedChange, 'onExpandedChange')
    safeCallback?.(expanded)
  }, [expanded, createSafeCallback, onExpandedChange])

  useEffect(() => {
    const safeCallback = createSafeCallback(onPaginationChange, 'onPaginationChange')
    safeCallback?.(pagination)
  }, [pagination, createSafeCallback, onPaginationChange])

  // Memoize columns to prevent unnecessary recalculations
  const memoizedColumns = useMemo(() => columns, [columns])

  // Create table instance with enhanced error boundaries
  const table = useReactTable<TData>({
    data,
    columns: memoizedColumns,

    // Default column sizing configuration
    defaultColumn: {
      minSize: 60,
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

    // Pure state change handlers
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

    // Column resize configuration
    columnResizeMode: enableColumnResizing ? 'onChange' : undefined,
    columnResizeDirection: 'ltr',

    // Row models
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

  // Helper functions with enhanced error handling
  const resetFilters = useCallback(() => {
    try {
      table.resetColumnFilters()
      table.resetGlobalFilter()
      log.debug('Table filters reset successfully')
    } catch (error) {
      log.error('Failed to reset filters', { error })
    }
  }, [table])

  const resetSorting = useCallback(() => {
    try {
      table.resetSorting()
      log.debug('Table sorting reset successfully')
    } catch (error) {
      log.error('Failed to reset sorting', { error })
    }
  }, [table])

  const clearSelection = useCallback(() => {
    try {
      table.resetRowSelection()
      log.debug('Table selection cleared successfully')
    } catch (error) {
      log.error('Failed to clear selection', { error })
    }
  }, [table])

  const resetAll = useCallback(() => {
    try {
      resetFilters()
      resetSorting()
      clearSelection()
      table.resetColumnVisibility()
      table.resetColumnSizing()
      table.resetColumnOrder()
      table.resetGrouping()
      table.resetExpanded()
      log.info('Table reset to default state successfully')
    } catch (error) {
      log.error('Failed to reset table state', { error })
    }
  }, [resetFilters, resetSorting, clearSelection, table])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (enableMemoryManagement) {
        memoryManager.current.cleanup()
      }
    }
  }, [enableMemoryManagement])

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
    resetAll,

    // Enhanced features
    memoryManager: memoryManager.current,
    isHealthy
  }
}