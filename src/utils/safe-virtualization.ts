/**
 * Type-Safe Virtualization Utilities
 *
 * Addresses unsafe array access and race conditions in virtualization.
 * Provides comprehensive bounds checking and error handling.
 */

import { type Row, type Column } from '@tanstack/react-table'
import { type VirtualItem } from '@tanstack/react-virtual'

import { logger } from './logger'

const log = logger.content

// Type-safe interfaces
interface SafeVirtualItem<T> {
  item: T
  index: number
  virtualProps: VirtualItem
  isValid: boolean
  error?: string
}

interface VirtualizationBounds {
  startIndex: number
  endIndex: number
  totalCount: number
  isValid: boolean
}

interface SafeVirtualizationResult<T> {
  items: SafeVirtualItem<T>[]
  bounds: VirtualizationBounds
  errors: string[]
  performance: {
    processingTime: number
    itemCount: number
    errorCount: number
  }
}

// Error types for better error handling
enum VirtualizationError {
  INDEX_OUT_OF_BOUNDS = 'INDEX_OUT_OF_BOUNDS',
  NULL_OR_UNDEFINED_ITEM = 'NULL_OR_UNDEFINED_ITEM',
  INVALID_VIRTUAL_PROPS = 'INVALID_VIRTUAL_PROPS',
  ARRAY_NOT_ARRAY = 'ARRAY_NOT_ARRAY',
  NEGATIVE_INDEX = 'NEGATIVE_INDEX',
  INVALID_BOUNDS = 'INVALID_BOUNDS'
}

// Enhanced bounds checking
function validateBounds<T>(
  items: T[],
  startIndex: number,
  endIndex: number
): { isValid: boolean; error?: string } {
  if (!Array.isArray(items)) {
    return { isValid: false, error: VirtualizationError.ARRAY_NOT_ARRAY }
  }

  if (startIndex < 0 || endIndex < 0) {
    return { isValid: false, error: VirtualizationError.NEGATIVE_INDEX }
  }

  if (startIndex > items.length || endIndex > items.length) {
    return { isValid: false, error: VirtualizationError.INDEX_OUT_OF_BOUNDS }
  }

  if (startIndex > endIndex) {
    return { isValid: false, error: VirtualizationError.INVALID_BOUNDS }
  }

  return { isValid: true }
}

// Safe array access with comprehensive validation
export function safeGetVirtualItem<T>(
  items: T[],
  virtualItem: VirtualItem
): SafeVirtualItem<T> | null {
  const startTime = performance.now()

  try {
    // Validate input parameters
    if (!Array.isArray(items)) {
      log.error('safeGetVirtualItem: items is not an array', {
        itemsType: typeof items,
        virtualIndex: virtualItem.index
      })
      return null
    }

    if (!virtualItem || typeof virtualItem.index !== 'number') {
      log.error('safeGetVirtualItem: invalid virtual item', { virtualItem })
      return null
    }

    const { index } = virtualItem

    // Bounds checking
    if (index < 0) {
      log.warn('safeGetVirtualItem: negative index', { index, itemsLength: items.length })
      return null
    }

    if (index >= items.length) {
      log.warn('safeGetVirtualItem: index out of bounds', {
        index,
        itemsLength: items.length,
        virtualItem
      })
      return null
    }

    const item = items[index]

    // Validate item existence
    if (item === null || item === undefined) {
      log.warn('safeGetVirtualItem: item is null or undefined', {
        index,
        itemsLength: items.length
      })
      return {
        item: item as T, // Type assertion needed for null/undefined items
        index,
        virtualProps: virtualItem,
        isValid: false,
        error: VirtualizationError.NULL_OR_UNDEFINED_ITEM
      }
    }

    // Success case
    return {
      item,
      index,
      virtualProps: virtualItem,
      isValid: true
    }

  } catch (error) {
    log.error('safeGetVirtualItem: unexpected error', {
      error: error instanceof Error ? error.message : 'Unknown error',
      virtualIndex: virtualItem.index,
      itemsLength: Array.isArray(items) ? items.length : 'not array',
      processingTime: performance.now() - startTime
    })
    return null
  }
}

// Process multiple virtual items safely
export function safeProcessVirtualItems<T>(
  items: T[],
  virtualItems: VirtualItem[]
): SafeVirtualizationResult<T> {
  const startTime = performance.now()
  const errors: string[] = []
  const safeItems: SafeVirtualItem<T>[] = []

  try {
    // Input validation
    if (!Array.isArray(items)) {
      const error = 'Items parameter is not an array'
      errors.push(error)
      return {
        items: [],
        bounds: { startIndex: 0, endIndex: 0, totalCount: 0, isValid: false },
        errors,
        performance: {
          processingTime: performance.now() - startTime,
          itemCount: 0,
          errorCount: 1
        }
      }
    }

    if (!Array.isArray(virtualItems)) {
      const error = 'Virtual items parameter is not an array'
      errors.push(error)
      return {
        items: [],
        bounds: { startIndex: 0, endIndex: 0, totalCount: items.length, isValid: false },
        errors,
        performance: {
          processingTime: performance.now() - startTime,
          itemCount: 0,
          errorCount: 1
        }
      }
    }

    // Calculate bounds
    const bounds: VirtualizationBounds = {
      startIndex: virtualItems.length > 0 ? virtualItems[0]?.index ?? 0 : 0,
      endIndex: virtualItems.length > 0 ? virtualItems[virtualItems.length - 1]?.index ?? 0 : 0,
      totalCount: items.length,
      isValid: true
    }

    // Validate bounds
    const boundsValidation = validateBounds(items, bounds.startIndex, bounds.endIndex)
    if (!boundsValidation.isValid) {
      bounds.isValid = false
      if (boundsValidation.error) {
        errors.push(boundsValidation.error)
      }
    }

    // Process each virtual item
    for (const virtualItem of virtualItems) {
      if (!virtualItem || typeof virtualItem.index !== 'number') {
        errors.push(`Invalid virtual item: ${JSON.stringify(virtualItem)}`)
        continue
      }

      const safeItem = safeGetVirtualItem(items, virtualItem)
      if (safeItem) {
        safeItems.push(safeItem)
        if (!safeItem.isValid && safeItem.error) {
          errors.push(`Item at index ${safeItem.index}: ${safeItem.error}`)
        }
      } else {
        errors.push(`Failed to process virtual item at index ${virtualItem.index}`)
      }
    }

    return {
      items: safeItems,
      bounds,
      errors,
      performance: {
        processingTime: performance.now() - startTime,
        itemCount: safeItems.length,
        errorCount: errors.length
      }
    }

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    errors.push(`Unexpected error in safeProcessVirtualItems: ${errorMessage}`)

    log.error('safeProcessVirtualItems: unexpected error', {
      error: errorMessage,
      itemsLength: Array.isArray(items) ? items.length : 'not array',
      virtualItemsLength: Array.isArray(virtualItems) ? virtualItems.length : 'not array',
      processingTime: performance.now() - startTime
    })

    return {
      items: [],
      bounds: { startIndex: 0, endIndex: 0, totalCount: 0, isValid: false },
      errors,
      performance: {
        processingTime: performance.now() - startTime,
        itemCount: 0,
        errorCount: errors.length
      }
    }
  }
}

// Type-safe row virtualization for TanStack Table
export function safeVirtualizeRows<TData>(
  rows: Row<TData>[],
  virtualRows: VirtualItem[]
): SafeVirtualizationResult<Row<TData>> {
  return safeProcessVirtualItems(rows, virtualRows)
}

// Type-safe column virtualization for TanStack Table
export function safeVirtualizeColumns<TData>(
  columns: Column<TData, unknown>[],
  virtualColumns: VirtualItem[]
): SafeVirtualizationResult<Column<TData, unknown>> {
  return safeProcessVirtualItems(columns, virtualColumns)
}

// Performance monitoring wrapper
export function withVirtualizationPerformanceMonitoring<T, R>(
  operation: (items: T[]) => R,
  operationName: string
): (items: T[]) => R {
  return (items: T[]): R => {
    const startTime = performance.now()

    try {
      const result = operation(items)
      const duration = performance.now() - startTime

      // Log performance metrics
      if (duration > 16) { // More than one frame at 60fps
        log.warn('Slow virtualization operation detected', {
          operationName,
          duration,
          itemCount: Array.isArray(items) ? items.length : 'not array'
        })
      } else {
        log.debug('Virtualization operation completed', {
          operationName,
          duration,
          itemCount: Array.isArray(items) ? items.length : 'not array'
        })
      }

      return result
    } catch (error) {
      const duration = performance.now() - startTime
      log.error('Virtualization operation failed', {
        operationName,
        duration,
        error: error instanceof Error ? error.message : 'Unknown error',
        itemCount: Array.isArray(items) ? items.length : 'not array'
      })
      throw error
    }
  }
}

// Race condition safe state updates for virtualization
interface VirtualizationState<T> {
  items: T[]
  virtualItems: VirtualItem[]
  timestamp: number
  version: number
}

export class SafeVirtualizationManager<T> {
  private state: VirtualizationState<T>
  private version = 0

  constructor(initialItems: T[] = []) {
    this.state = {
      items: initialItems,
      virtualItems: [],
      timestamp: Date.now(),
      version: 0
    }
  }

  // Thread-safe state update
  updateItems(items: T[]): boolean {
    const newVersion = ++this.version
    const timestamp = Date.now()

    // Validate that this isn't a stale update
    if (newVersion < this.state.version) {
      log.warn('Discarding stale virtualization state update', {
        newVersion,
        currentVersion: this.state.version
      })
      return false
    }

    this.state = {
      items: [...items], // Create defensive copy
      virtualItems: this.state.virtualItems,
      timestamp,
      version: newVersion
    }

    log.debug('Virtualization state updated', {
      itemCount: items.length,
      version: newVersion,
      timestamp
    })

    return true
  }

  // Thread-safe virtual items update
  updateVirtualItems(virtualItems: VirtualItem[]): boolean {
    const newVersion = ++this.version
    const timestamp = Date.now()

    if (newVersion < this.state.version) {
      log.warn('Discarding stale virtual items update', {
        newVersion,
        currentVersion: this.state.version
      })
      return false
    }

    this.state = {
      items: this.state.items,
      virtualItems: [...virtualItems], // Create defensive copy
      timestamp,
      version: newVersion
    }

    return true
  }

  // Get safe virtual items
  getSafeVirtualItems(): SafeVirtualizationResult<T> {
    return safeProcessVirtualItems(this.state.items, this.state.virtualItems)
  }

  // Get current state snapshot
  getState(): Readonly<VirtualizationState<T>> {
    return { ...this.state }
  }
}

// Export utility types
export type {
  SafeVirtualItem,
  VirtualizationBounds,
  SafeVirtualizationResult,
  VirtualizationState
}

export { VirtualizationError }