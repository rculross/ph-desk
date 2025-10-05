/**
 * Electron Storage Manager
 *
 * Provides safe storage operations using Electron's persistent storage.
 * Maintains API compatibility with Chrome extension version.
 */

import { logger } from './logger'

const log = logger.api

export interface StorageQuotaInfo {
  bytesInUse: number
  quotaBytes: number
  percentageUsed: number
  available: number
}

export interface StorageOperationOptions {
  maxSize?: number // Maximum size in bytes for this operation
  priority?: 'high' | 'medium' | 'low'
  skipQuotaCheck?: boolean
}

export interface StorageValidationResult {
  isValid: boolean
  error?: string
  size?: number
  quotaInfo?: StorageQuotaInfo
}

/**
 * Check if Electron storage API is available
 */
function isElectronStorageAvailable(): boolean {
  return typeof window !== 'undefined' &&
         window.electron !== undefined &&
         window.electron.storage !== undefined
}

/**
 * Get the storage API (Electron)
 */
function getStorageAPI() {
  if (!isElectronStorageAvailable()) {
    throw new Error('Electron storage API not available')
  }
  return window.electron.storage
}

/**
 * Electron Storage Manager
 */
export class StorageManager {
  private static instance: StorageManager

  // Storage limits - set conservatively for desktop app
  private readonly MAX_QUOTA_BYTES = 100 * 1024 * 1024 // 100MB for desktop (more generous than Chrome)
  private readonly MAX_ITEM_SIZE = 10 * 1024 * 1024 // 10MB per item (larger than Chrome)
  private readonly MAX_ERROR_SIZE = 1024 // 1KB max for error objects
  private readonly QUOTA_WARNING_THRESHOLD = 0.7 // 70% usage warning
  private readonly QUOTA_ERROR_THRESHOLD = 0.85 // 85% usage error
  private readonly CRITICAL_THRESHOLD = 0.95 // 95% critical - force cleanup

  private constructor() {
    log.info('Electron storage manager initialized', {
      maxQuota: this.formatBytes(this.MAX_QUOTA_BYTES),
      maxItemSize: this.formatBytes(this.MAX_ITEM_SIZE),
      platform: typeof window !== 'undefined' && window.electron ? window.electron.platform : 'unknown'
    })
  }

  public static getInstance(): StorageManager {
    if (!StorageManager.instance) {
      StorageManager.instance = new StorageManager()
    }
    return StorageManager.instance
  }

  /**
   * Get current storage quota information
   */
  public async getQuotaInfo(): Promise<StorageQuotaInfo> {
    try {
      const storage = getStorageAPI()
      const bytesInUse = await storage.getBytesInUse(null)

      const quotaInfo: StorageQuotaInfo = {
        bytesInUse,
        quotaBytes: this.MAX_QUOTA_BYTES,
        percentageUsed: bytesInUse / this.MAX_QUOTA_BYTES,
        available: this.MAX_QUOTA_BYTES - bytesInUse
      }

      // Only log quota info when there are actual changes or issues
      if (quotaInfo.percentageUsed >= this.QUOTA_WARNING_THRESHOLD) {
        log.debug('Storage quota info retrieved', {
          used: this.formatBytes(quotaInfo.bytesInUse),
          percentage: `${(quotaInfo.percentageUsed * 100).toFixed(1)}%`
        })
      }

      return quotaInfo
    } catch (error) {
      log.error('Failed to get quota info', { error: error instanceof Error ? error.message : 'Unknown error' })
      throw error
    }
  }

  /**
   * Enhanced storage operation validation with cleanup
   */
  public async validateStorageOperation(
    data: Record<string, any>,
    options: StorageOperationOptions = {}
  ): Promise<StorageValidationResult> {
    try {
      // Pre-process data to limit error object sizes
      const processedData = this.preprocessData(data)

      // Calculate data size
      const dataSize = this.calculateDataSize(processedData)
      const maxSize = options.maxSize || this.MAX_ITEM_SIZE

      // Basic size validation
      if (dataSize > maxSize) {
        return {
          isValid: false,
          error: `Data size (${this.formatBytes(dataSize)}) exceeds maximum allowed (${this.formatBytes(maxSize)})`,
          size: dataSize
        }
      }

      // Skip quota check if requested
      if (options.skipQuotaCheck) {
        return { isValid: true, size: dataSize }
      }

      // Check quota availability
      const quotaInfo = await this.getQuotaInfo()

      // Critical threshold - force cleanup
      if (quotaInfo.percentageUsed >= this.CRITICAL_THRESHOLD) {
        log.warn('Storage at critical level - forcing emergency cleanup')
        await this.emergencyCleanup()

        // Re-check quota after cleanup
        const newQuotaInfo = await this.getQuotaInfo()
        if (newQuotaInfo.percentageUsed >= this.QUOTA_ERROR_THRESHOLD) {
          return {
            isValid: false,
            error: `Storage quota critical (${(newQuotaInfo.percentageUsed * 100).toFixed(1)}% used even after cleanup)`,
            size: dataSize,
            quotaInfo: newQuotaInfo
          }
        }
        // Update quota info after cleanup
        Object.assign(quotaInfo, newQuotaInfo)
      }

      // Error threshold check
      if (quotaInfo.percentageUsed >= this.QUOTA_ERROR_THRESHOLD) {
        return {
          isValid: false,
          error: `Storage quota nearly exhausted (${(quotaInfo.percentageUsed * 100).toFixed(1)}% used)`,
          size: dataSize,
          quotaInfo
        }
      }

      // Check if this operation would exceed quota
      if (dataSize > quotaInfo.available) {
        return {
          isValid: false,
          error: `Operation would exceed storage quota. Required: ${this.formatBytes(dataSize)}, Available: ${this.formatBytes(quotaInfo.available)}`,
          size: dataSize,
          quotaInfo
        }
      }

      // Warn if approaching quota limit
      if (quotaInfo.percentageUsed >= this.QUOTA_WARNING_THRESHOLD) {
        log.warn('Storage quota approaching limit', {
          current: `${(quotaInfo.percentageUsed * 100).toFixed(1)}%`,
          available: this.formatBytes(quotaInfo.available)
        })
      }

      return { isValid: true, size: dataSize, quotaInfo }
    } catch (error) {
      return {
        isValid: false,
        error: `Storage validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      }
    }
  }

  /**
   * Safe storage set operation with validation
   */
  public async safeSet(
    data: Record<string, any>,
    options: StorageOperationOptions = {}
  ): Promise<void> {
    // Validate keys for security and preprocess data
    const sanitizedData = this.sanitizeKeys(this.preprocessData(data))

    const validation = await this.validateStorageOperation(sanitizedData, options)

    if (!validation.isValid) {
      const error = new Error(`Storage operation blocked: ${validation.error}`)
      log.error('Storage set operation blocked', {
        error: validation.error,
        dataSize: validation.size ? this.formatBytes(validation.size) : 'unknown'
      })
      throw error
    }

    try {
      const storage = getStorageAPI()
      await storage.set(sanitizedData)

      // Only log storage operations for large data or when explicitly needed for debugging
      if (validation.size && validation.size > 5120) { // Log only operations larger than 5KB
        log.debug('Storage set operation completed', {
          keys: Object.keys(data),
          size: validation.size ? this.formatBytes(validation.size) : 'unknown',
          priority: options.priority || 'medium'
        })
      }

    } catch (error) {
      log.error('Storage set operation failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        keys: Object.keys(data)
      })
      throw error
    }
  }

  /**
   * Safe storage get operation
   */
  public async safeGet<T = any>(keys: string | string[] | null): Promise<Record<string, T>> {
    try {
      const storage = getStorageAPI()
      const result = await storage.get<T>(keys)

      log.debug('Storage get operation completed', {
        requestedKeys: Array.isArray(keys) ? keys : typeof keys === 'string' ? [keys] : 'all',
        retrievedKeys: Object.keys(result)
      })

      return result

    } catch (error) {
      log.error('Storage get operation failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        keys: Array.isArray(keys) ? keys : typeof keys === 'string' ? [keys] : 'all'
      })
      throw error
    }
  }

  /**
   * Safe storage remove operation
   */
  public async safeRemove(keys: string | string[]): Promise<void> {
    try {
      const storage = getStorageAPI()
      await storage.remove(keys)

      log.debug('Storage remove operation completed', {
        keys: Array.isArray(keys) ? keys : [keys]
      })

    } catch (error) {
      log.error('Storage remove operation failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        keys: Array.isArray(keys) ? keys : [keys]
      })
      throw error
    }
  }

  /**
   * Clear storage with confirmation
   */
  public async clearStorage(confirmationKey: string = ''): Promise<void> {
    if (confirmationKey !== 'CONFIRM_CLEAR_ALL_STORAGE') {
      throw new Error('Storage clear operation requires explicit confirmation')
    }

    try {
      const quotaInfo = await this.getQuotaInfo()
      const storage = getStorageAPI()
      await storage.clear()

      log.info('Storage cleared successfully', {
        clearedSize: this.formatBytes(quotaInfo.bytesInUse)
      })

    } catch (error) {
      log.error('Storage clear operation failed', {
        error: error instanceof Error ? error.message : 'Unknown error'
      })
      throw error
    }
  }

  /**
   * Basic cleanup - removes temp and cache items only
   */
  public async cleanupStorage(): Promise<void> {
    try {
      const quotaInfo = await this.getQuotaInfo()

      if (quotaInfo.percentageUsed < this.QUOTA_WARNING_THRESHOLD) {
        log.debug('Storage cleanup skipped - usage below warning threshold')
        return
      }

      log.info('Starting basic storage cleanup', {
        currentUsage: `${(quotaInfo.percentageUsed * 100).toFixed(1)}%`
      })

      // Get all storage items
      const allItems = await this.safeGet(null)
      const cleanupKeys: string[] = []

      // Find simple cleanup candidates (temp/cache items only)
      for (const key of Object.keys(allItems)) {
        if (key.startsWith('temp_') || key.startsWith('cache_') || key.startsWith('tmp_')) {
          cleanupKeys.push(key)
        }
      }

      // Remove cleanup candidates
      if (cleanupKeys.length > 0) {
        await this.safeRemove(cleanupKeys)

        const newQuotaInfo = await this.getQuotaInfo()
        const freedSpace = quotaInfo.bytesInUse - newQuotaInfo.bytesInUse

        log.info('Storage cleanup completed', {
          removedItems: cleanupKeys.length,
          freedSpace: this.formatBytes(freedSpace),
          newUsage: `${(newQuotaInfo.percentageUsed * 100).toFixed(1)}%`
        })
      } else {
        log.info('Storage cleanup completed - no temporary items to remove')
      }

    } catch (error) {
      log.error('Storage cleanup failed', {
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  }

  /**
   * Emergency cleanup - aggressive cleanup when storage is critical
   */
  public async emergencyCleanup(): Promise<void> {
    try {
      log.warn('Starting emergency storage cleanup')

      const allItems = await this.safeGet(null)
      const cleanupKeys: string[] = []
      const largeItems: Array<{ key: string; size: number }> = []

      // Find all cleanup candidates
      for (const [key, value] of Object.entries(allItems)) {
        const itemSize = this.calculateDataSize({ [key]: value })

        // Immediate removal candidates
        if (
          key.startsWith('temp_') ||
          key.startsWith('cache_') ||
          key.startsWith('tmp_') ||
          key.startsWith('error_') ||
          key.includes('notification') ||
          key.includes('log_')
        ) {
          cleanupKeys.push(key)
          continue
        }

        // Track large items for potential removal
        if (itemSize > 2048) { // Items larger than 2KB
          largeItems.push({ key, size: itemSize })
        }
      }

      // Remove immediate candidates
      if (cleanupKeys.length > 0) {
        await this.safeRemove(cleanupKeys)
      }

      // Check if we need more aggressive cleanup
      const quotaInfo = await this.getQuotaInfo()
      if (quotaInfo.percentageUsed >= this.QUOTA_ERROR_THRESHOLD) {
        // Remove largest items until we're under threshold
        largeItems
          .sort((a, b) => b.size - a.size)
          .slice(0, Math.min(10, largeItems.length)) // Remove up to 10 largest items
          .forEach(item => cleanupKeys.push(item.key))

        if (cleanupKeys.length > 0) {
          await this.safeRemove(cleanupKeys)
        }
      }

      const finalQuotaInfo = await this.getQuotaInfo()
      log.info('Emergency cleanup completed', {
        removedItems: cleanupKeys.length,
        finalUsage: `${(finalQuotaInfo.percentageUsed * 100).toFixed(1)}%`
      })

    } catch (error) {
      log.error('Emergency cleanup failed', {
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  }

  /**
   * Preprocess data to limit sizes and sanitize error objects
   */
  private preprocessData(data: Record<string, any>): Record<string, any> {
    const processed: Record<string, any> = {}

    for (const [key, value] of Object.entries(data)) {
      // Special handling for error objects and notifications
      if (key.includes('error') || key.includes('notification') || key.includes('log')) {
        processed[key] = this.sanitizeErrorObject(value)
      } else {
        processed[key] = this.limitValueSize(value)
      }
    }

    return processed
  }

  /**
   * Sanitize error objects to prevent storage bloat
   */
  private sanitizeErrorObject(value: any): any {
    if (!value || typeof value !== 'object') {
      return value
    }

    if (value instanceof Error) {
      return {
        name: value.name,
        message: value.message.substring(0, 200), // Limit error message length
        stack: value.stack ? value.stack.substring(0, 500) : undefined, // Limit stack trace
        timestamp: new Date().toISOString()
      }
    }

    if (Array.isArray(value)) {
      return value.slice(0, 5).map(item => this.sanitizeErrorObject(item)) // Limit array size
    }

    // Limit object size
    const sanitized: Record<string, any> = {}
    let fieldCount = 0
    for (const [k, v] of Object.entries(value)) {
      if (fieldCount >= 10) break // Limit number of fields
      sanitized[k] = this.sanitizeErrorObject(v)
      fieldCount++
    }

    return sanitized
  }

  /**
   * Limit the size of individual values
   */
  private limitValueSize(value: any, maxSize: number = this.MAX_ITEM_SIZE): any {
    const valueSize = this.calculateDataSize(value)

    if (valueSize <= maxSize) {
      return value
    }

    // If it's a string, truncate it
    if (typeof value === 'string') {
      const truncateLength = Math.floor(maxSize * 0.8) // Leave some buffer
      return `${value.substring(0, truncateLength)}...[truncated]`
    }

    // If it's an array, slice it
    if (Array.isArray(value)) {
      const result = []
      let currentSize = 0
      for (const item of value) {
        const itemSize = this.calculateDataSize(item)
        if (currentSize + itemSize > maxSize) break
        result.push(item)
        currentSize += itemSize
      }
      return result
    }

    // If it's an object, remove fields until it fits
    if (typeof value === 'object' && value !== null) {
      const result: Record<string, any> = {}
      let currentSize = 0
      for (const [k, v] of Object.entries(value)) {
        const fieldSize = this.calculateDataSize({ [k]: v })
        if (currentSize + fieldSize > maxSize) break
        result[k] = v
        currentSize += fieldSize
      }
      return result
    }

    return value
  }

  /**
   * Sanitize storage keys for security
   */
  private sanitizeKeys(data: Record<string, any>): Record<string, any> {
    const sanitized: Record<string, any> = {}

    for (const [key, value] of Object.entries(data)) {
      // Validate key
      if (typeof key !== 'string' || key.length === 0 || key.length > 100) {
        log.warn('Invalid storage key skipped', { key })
        continue
      }

      // Check for dangerous key names
      if (key.startsWith('__') || key.includes('proto') || key.includes('constructor')) {
        log.warn('Potentially dangerous storage key skipped', { key })
        continue
      }

      sanitized[key] = value
    }

    return sanitized
  }

  /**
   * Calculate data size in bytes (JSON serialized)
   */
  private calculateDataSize(data: any): number {
    try {
      return new Blob([JSON.stringify(data)]).size
    } catch (error) {
      log.warn('Failed to calculate data size', { error })
      return 0
    }
  }

  /**
   * Format bytes to human readable format
   */
  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes'

    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))

    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`
  }
}

// Export singleton instance
export const storageManager = StorageManager.getInstance()

// Export utility functions
export const {
  getQuotaInfo,
  validateStorageOperation,
  safeSet,
  safeGet,
  safeRemove,
  clearStorage,
  cleanupStorage,
  emergencyCleanup
} = storageManager
