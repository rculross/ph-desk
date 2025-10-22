/**
 * Secure JSON parsing utilities with size limits and error handling
 * Prevents DoS attacks through malformed JSON or oversized payloads
 */

import { logger } from './logger'

const log = logger.api

// Default security constraints
const DEFAULT_MAX_SIZE = 5 * 1024 * 1024 // 5MB max JSON size
const DEFAULT_MAX_DEPTH = 50 // Maximum object nesting depth
const DEFAULT_MAX_KEYS = 10000 // Maximum number of keys in an object

interface SecureJsonOptions {
  maxSize?: number
  maxDepth?: number
  maxKeys?: number
  allowedTypes?: ('object' | 'array' | 'string' | 'number' | 'boolean' | 'null')[]
  suppressLogging?: boolean
}

interface ParseResult<T = any> {
  success: boolean
  data?: T
  error?: string
  size?: number
}

/**
 * Validates JSON string size before parsing
 */
function validateSize(jsonString: string, maxSize: number): boolean {
  const size = new Blob([jsonString]).size
  if (size > maxSize) {
    log.warn('JSON payload exceeds size limit', { size, maxSize })
    return false
  }
  return true
}

/**
 * Validates object depth and key count recursively
 */
function validateStructure(
  obj: any,
  maxDepth: number,
  maxKeys: number,
  currentDepth = 0,
  keyCount = { count: 0 }
): boolean {
  if (currentDepth > maxDepth) {
    log.warn('JSON object exceeds maximum depth', { currentDepth, maxDepth })
    return false
  }

  if (keyCount.count > maxKeys) {
    log.warn('JSON object exceeds maximum key count', { keyCount: keyCount.count, maxKeys })
    return false
  }

  if (obj && typeof obj === 'object') {
    if (Array.isArray(obj)) {
      for (let i = 0; i < obj.length; i++) {
        if (!validateStructure(obj[i], maxDepth, maxKeys, currentDepth + 1, keyCount)) {
          return false
        }
      }
    } else {
      const keys = Object.keys(obj)
      keyCount.count += keys.length

      if (keyCount.count > maxKeys) {
        log.warn('JSON object exceeds maximum key count', { keyCount: keyCount.count, maxKeys })
        return false
      }

      for (const key of keys) {
        if (!validateStructure(obj[key], maxDepth, maxKeys, currentDepth + 1, keyCount)) {
          return false
        }
      }
    }
  }

  return true
}

/**
 * Validates allowed data types
 */
function validateTypes(obj: any, allowedTypes: string[]): boolean {
  const type = Array.isArray(obj) ? 'array' : obj === null ? 'null' : typeof obj

  if (!allowedTypes.includes(type)) {
    log.warn('JSON contains disallowed data type', { type, allowedTypes })
    return false
  }

  if (type === 'object' && !Array.isArray(obj) && obj !== null) {
    for (const key in obj) {
      if (!validateTypes(obj[key], allowedTypes)) {
        return false
      }
    }
  } else if (type === 'array') {
    for (const item of obj) {
      if (!validateTypes(item, allowedTypes)) {
        return false
      }
    }
  }

  return true
}

/**
 * Securely parse JSON string with comprehensive validation
 */
export function parseSecureJson<T = any>(
  jsonString: string,
  options: SecureJsonOptions = {}
): ParseResult<T> {
  const {
    maxSize = DEFAULT_MAX_SIZE,
    maxDepth = DEFAULT_MAX_DEPTH,
    maxKeys = DEFAULT_MAX_KEYS,
    allowedTypes = ['object', 'array', 'string', 'number', 'boolean', 'null'],
    suppressLogging = false
  } = options

  const size = new Blob([jsonString]).size
  
  if (!suppressLogging) {
    log.debug('Parsing JSON with security constraints', {
      size,
      maxSize,
      maxDepth,
      maxKeys,
      allowedTypes
    })
  }

  try {
    // Validate size first (cheapest check)
    if (!validateSize(jsonString, maxSize)) {
      return {
        success: false,
        error: `JSON payload size (${size} bytes) exceeds limit (${maxSize} bytes)`,
        size
      }
    }

    // Parse JSON (potential DoS vector)
    const parsed = JSON.parse(jsonString)

    // Validate structure depth and key count
    if (!validateStructure(parsed, maxDepth, maxKeys)) {
      return {
        success: false,
        error: 'JSON structure exceeds complexity limits',
        size
      }
    }

    // Validate allowed types
    if (!validateTypes(parsed, allowedTypes)) {
      return {
        success: false,
        error: 'JSON contains disallowed data types',
        size
      }
    }

    if (!suppressLogging) {
      log.debug('JSON parsed successfully', { size, keys: Object.keys(parsed ?? {}).length })
    }
    
    return {
      success: true,
      data: parsed,
      size
    }

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown parsing error'
    
    if (!suppressLogging) {
      log.error('JSON parsing failed', {
        error: errorMessage,
        size,
        preview: jsonString.slice(0, 100) + (jsonString.length > 100 ? '...' : '')
      })
    }

    return {
      success: false,
      error: `JSON parsing failed: ${errorMessage}`,
      size
    }
  }
}

/**
 * Safe wrapper for JSON.parse with error boundaries
 * For legacy code that needs gradual migration
 */
export function safeJsonParse<T = any>(
  jsonString: string,
  defaultValue?: T,
  options?: SecureJsonOptions
): T {
  const result = parseSecureJson<T>(jsonString, options)
  
  if (result.success && result.data !== undefined) {
    return result.data
  }

  if (defaultValue !== undefined) {
    log.warn('JSON parsing failed, using default value', {
      error: result.error,
      defaultUsed: true
    })
    return defaultValue
  }

  throw new Error(result.error ?? 'JSON parsing failed')
}

/**
 * Secure JSON stringification with size limits
 */
export function stringifySecureJson(
  obj: any,
  options: { maxSize?: number; space?: string | number } = {}
): ParseResult<string> {
  const { maxSize = DEFAULT_MAX_SIZE, space } = options

  try {
    const jsonString = JSON.stringify(obj, null, space)
    const size = new Blob([jsonString]).size

    if (size > maxSize) {
      log.warn('JSON stringify output exceeds size limit', { size, maxSize })
      return {
        success: false,
        error: `Stringified JSON size (${size} bytes) exceeds limit (${maxSize} bytes)`,
        size
      }
    }

    return {
      success: true,
      data: jsonString,
      size
    }

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown stringification error'
    
    log.error('JSON stringification failed', { error: errorMessage })

    return {
      success: false,
      error: `JSON stringification failed: ${errorMessage}`
    }
  }
}