/**
 * Electron Storage Manager
 *
 * Provides safe storage operations using Electron's persistent storage.
 * Focuses on security (prototype pollution prevention) and data preprocessing.
 */

import { logger } from './logger'

const log = logger.api

export interface StorageOperationOptions {
  maxSize?: number // Maximum size in bytes for this operation
  priority?: 'high' | 'medium' | 'low'
}

/**
 * Check if Electron storage API is available
 */
function isElectronStorageAvailable(): boolean {
  return window.electron.storage !== undefined
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

  // Storage limits for desktop app (generous compared to Chrome extension constraints)
  private readonly MAX_ITEM_SIZE = 10 * 1024 * 1024 // 10MB per item

  private constructor() {
    log.info('Electron storage manager initialized', {
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
   * Validate storage operation - checks data size only
   */
  private validateStorageOperation(
    data: Record<string, any>,
    options: StorageOperationOptions = {}
  ): { isValid: boolean; error?: string; size: number } {
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

    return { isValid: true, size: dataSize }
  }

  /**
   * Safe storage set operation with validation and security checks
   */
  public async safeSet(
    data: Record<string, any>,
    options: StorageOperationOptions = {}
  ): Promise<void> {
    // Validate keys for security and preprocess data
    const sanitizedData = this.sanitizeKeys(this.preprocessData(data))

    const validation = this.validateStorageOperation(sanitizedData, options)

    if (!validation.isValid) {
      const error = new Error(`Storage operation blocked: ${validation.error}`)
      log.error('Storage set operation blocked', {
        error: validation.error,
        dataSize: this.formatBytes(validation.size)
      })
      throw error
    }

    try {
      const storage = getStorageAPI()
      await storage.set(sanitizedData)

      // Log only large operations
      if (validation.size > 5120) { // Log only operations larger than 5KB
        log.debug('Storage set operation completed', {
          keys: Object.keys(data),
          size: this.formatBytes(validation.size),
          priority: options.priority ?? 'medium'
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
   * Security: Prevents prototype pollution attacks by blocking dangerous key patterns
   * that could modify Object.prototype or other built-in prototypes
   */
  private sanitizeKeys(data: Record<string, any>): Record<string, any> {
    const sanitized: Record<string, any> = {}

    // Comprehensive regex patterns for dangerous key names
    // Matches: __proto__, __defineGetter__, __defineSetter__, __lookupGetter__, __lookupSetter__
    // Also matches: constructor, prototype (in any case), and variations with brackets
    const dangerousKeyPatterns = [
      /^__proto__$/i,
      /^__define(Getter|Setter)__$/i,
      /^__lookup(Getter|Setter)__$/i,
      /^constructor$/i,
      /^prototype$/i,
      /\[(__proto__|constructor|prototype)\]/i,
      /\.__proto__/i,
      /\.constructor/i,
      /\.prototype/i
    ]

    for (const [key, value] of Object.entries(data)) {
      // Validate key type and length
      if (typeof key !== 'string' || key.length === 0 || key.length > 100) {
        log.warn('Invalid storage key skipped - invalid type or length', { key: String(key).substring(0, 50) })
        continue
      }

      // Check against all dangerous patterns
      let isDangerous = false
      for (const pattern of dangerousKeyPatterns) {
        if (pattern.test(key)) {
          log.warn('Potentially dangerous storage key blocked', {
            key: key.substring(0, 50),
            reason: 'prototype pollution prevention'
          })
          isDangerous = true
          break
        }
      }

      if (isDangerous) {
        continue
      }

      // Additional check: keys starting with __ are suspicious
      if (key.startsWith('__')) {
        log.warn('Potentially dangerous storage key blocked - double underscore prefix', { key: key.substring(0, 50) })
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

// Export core storage functions
export const { safeSet, safeGet, safeRemove } = storageManager
