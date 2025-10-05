/**
 * Table Persistence Hook
 *
 * Handles saving and loading table state (column widths, column order) using StorageManager.
 * Integrates with TanStack Table's built-in state management.
 */

import { useCallback, useEffect, useRef } from 'react'

import type { ColumnSizingState, ColumnOrderState } from '@tanstack/react-table'

import type { EntityType } from '../types/api'
import { logger } from '../utils/logger'
import { storageManager } from '../utils/storage-manager'

const log = logger.api

export interface TablePersistenceOptions {
  entityType: EntityType
  tenantSlug?: string
  enabled?: boolean
  debounceMs?: number
}

export interface TablePersistenceResult {
  saveColumnWidths: (widths: ColumnSizingState) => void
  saveColumnOrder: (order: ColumnOrderState) => void
  loadTableState: () => Promise<{
    columnSizing: ColumnSizingState
    columnOrder: ColumnOrderState
  }>
  clearTableState: () => Promise<void>
}

/**
 * Hook for persisting table state (column widths and order) to Chrome storage
 */
export function useTablePersistence({
  entityType,
  tenantSlug,
  enabled = true,
  debounceMs = 1000
}: TablePersistenceOptions): TablePersistenceResult {

  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Generate storage keys - memoized to prevent unnecessary re-computation
  const getStorageKeys = useCallback(() => {
    // Skip if tenant context is missing and we need it for proper key generation
    if (!tenantSlug) {
      log.debug('Skipping storage key generation - tenant context missing', { entityType })
      return {
        columnWidths: `table-column-widths-${entityType}`,
        columnOrder: `table-column-order-${entityType}`
      }
    }

    const base = `${entityType}-${tenantSlug}`
    return {
      columnWidths: `table-column-widths-${base}`,
      columnOrder: `table-column-order-${base}`
    }
  }, [entityType, tenantSlug])

  // Debounced save function
  const debouncedSave = useCallback((key: string, data: any) => {
    if (!enabled) {
      log.debug('Table persistence disabled, skipping save', { key })
      return
    }

    // Skip save if tenant context is missing for tenant-specific persistence
    if (!tenantSlug) {
      log.debug('Table persistence skipped - tenant context missing', { entityType, key })
      return
    }

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current)
    }

    saveTimeoutRef.current = setTimeout(async () => {
      try {
        await storageManager.safeSet({ [key]: data }, { priority: 'low' })
        log.debug('Table state saved', { key, dataSize: Object.keys(data).length, tenantSlug })
      } catch (error) {
        log.error('Failed to save table state', {
          key,
          tenantSlug,
          error: error instanceof Error ? error.message : 'Unknown error'
        })
      }
    }, debounceMs)
  }, [enabled, debounceMs, tenantSlug, entityType])

  // Save column widths
  const saveColumnWidths = useCallback((widths: ColumnSizingState) => {
    const keys = getStorageKeys()
    debouncedSave(keys.columnWidths, widths)
  }, [getStorageKeys, debouncedSave])

  // Save column order
  const saveColumnOrder = useCallback((order: ColumnOrderState) => {
    const keys = getStorageKeys()
    debouncedSave(keys.columnOrder, order)
  }, [getStorageKeys, debouncedSave])

  // Load table state
  const loadTableState = useCallback(async (): Promise<{
    columnSizing: ColumnSizingState
    columnOrder: ColumnOrderState
  }> => {
    if (!enabled) {
      log.debug('Table persistence disabled, returning empty state', { entityType })
      return { columnSizing: {}, columnOrder: [] }
    }

    // Skip load if tenant context is missing for tenant-specific persistence
    if (!tenantSlug) {
      log.debug('Table persistence skipped - tenant context missing', { entityType })
      return { columnSizing: {}, columnOrder: [] }
    }

    try {
      const keys = getStorageKeys()
      const stored = await storageManager.safeGet([keys.columnWidths, keys.columnOrder])

      const columnSizing = stored[keys.columnWidths] || {}
      const columnOrder = stored[keys.columnOrder] || []

      log.debug('Table state loaded', {
        entityType,
        tenantSlug,
        columnWidthsCount: Object.keys(columnSizing).length,
        columnOrderCount: columnOrder.length
      })

      return { columnSizing, columnOrder }
    } catch (error) {
      log.error('Failed to load table state', {
        entityType,
        tenantSlug,
        error: error instanceof Error ? error.message : 'Unknown error'
      })
      return { columnSizing: {}, columnOrder: [] }
    }
  }, [enabled, entityType, tenantSlug, getStorageKeys])

  // Clear table state
  const clearTableState = useCallback(async () => {
    if (!enabled) {
      log.debug('Table persistence disabled, skipping clear', { entityType })
      return
    }

    // Skip clear if tenant context is missing for tenant-specific persistence
    if (!tenantSlug) {
      log.debug('Table persistence clear skipped - tenant context missing', { entityType })
      return
    }

    try {
      const keys = getStorageKeys()
      await storageManager.safeRemove([keys.columnWidths, keys.columnOrder])

      log.debug('Table state cleared', { entityType, tenantSlug })
    } catch (error) {
      log.error('Failed to clear table state', {
        entityType,
        tenantSlug,
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  }, [enabled, entityType, tenantSlug, getStorageKeys])

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current)
      }
    }
  }, [])

  return {
    saveColumnWidths,
    saveColumnOrder,
    loadTableState,
    clearTableState
  }
}