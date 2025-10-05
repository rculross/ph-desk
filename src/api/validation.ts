/**
 * API Validation Middleware
 *
 * Provides comprehensive request/response validation using Zod schemas
 * with proper error handling, logging, and security sanitization.
 */

import { z } from 'zod'

import { logger } from '../utils/logger'

const log = logger.api

// ==================================================
// Validation Error Types
// ==================================================

export class ValidationError extends Error {
  public readonly code = 'VALIDATION_ERROR'
  public readonly field?: string
  public readonly details: any
  public readonly timestamp: number

  constructor(message: string, field?: string, details?: any) {
    super(message)
    this.name = 'ValidationError'
    this.field = field
    this.details = details
    this.timestamp = Date.now()
  }
}

export interface ValidationResult<T> {
  success: boolean
  data?: T
  error?: ValidationError
  issues?: z.ZodIssue[]
}

// ==================================================
// Core Validation Functions
// ==================================================

/**
 * Validates request data against a Zod schema
 * Provides detailed error information and sanitizes input
 */
export function validateRequest<T>(
  schema: z.ZodSchema<T>,
  data: unknown,
  context?: string
): ValidationResult<T> {
  try {
    // Parse and validate with Zod
    const result = schema.safeParse(data)

    if (!result.success) {
      const firstIssue = result.error.issues[0]
      const field = firstIssue?.path.join('.') || 'unknown'
      const message = `Validation failed${context ? ` for ${context}` : ''}: ${firstIssue?.message || 'Invalid data'}`

      log.warn('Request validation failed', {
        context,
        field,
        issues: result.error.issues,
        data: sanitizeLogData(data)
      })

      return {
        success: false,
        error: new ValidationError(message, field, result.error.issues),
        issues: result.error.issues
      }
    }

    // Log successful validation in development
    if (process.env.NODE_ENV === 'development') {
      log.debug('Request validation passed', {
        context,
        schema: (schema._def as any).typeName || 'unknown'
      })
    }

    return {
      success: true,
      data: result.data
    }
  } catch (error) {
    const message = `Validation error${context ? ` for ${context}` : ''}: ${error instanceof Error ? error.message : 'Unknown error'}`

    log.error('Validation exception', {
      context,
      error: error instanceof Error ? error.message : error,
      data: sanitizeLogData(data)
    })

    return {
      success: false,
      error: new ValidationError(message, undefined, error)
    }
  }
}

/**
 * Validates response data against a Zod schema
 * Ensures API responses match expected structure
 */
export function validateResponse<T>(
  schema: z.ZodSchema<T>,
  data: unknown,
  endpoint?: string
): ValidationResult<T> {
  try {
    const result = schema.safeParse(data)

    if (!result.success) {
      const firstIssue = result.error.issues[0]
      const field = firstIssue?.path.join('.') || 'unknown'
      const message = `Response validation failed${endpoint ? ` for ${endpoint}` : ''}: ${firstIssue?.message || 'Invalid response data'}`

      log.error('Response validation failed', {
        endpoint,
        field,
        issues: result.error.issues,
        response: sanitizeLogData(data)
      })

      return {
        success: false,
        error: new ValidationError(message, field, result.error.issues),
        issues: result.error.issues
      }
    }

    // Log successful validation in development
    if (process.env.NODE_ENV === 'development') {
      log.debug('Response validation passed', {
        endpoint,
        schema: (schema._def as any).typeName || 'unknown'
      })
    }

    return {
      success: true,
      data: result.data
    }
  } catch (error) {
    const message = `Response validation error${endpoint ? ` for ${endpoint}` : ''}: ${error instanceof Error ? error.message : 'Unknown error'}`

    log.error('Response validation exception', {
      endpoint,
      error: error instanceof Error ? error.message : error,
      response: sanitizeLogData(data)
    })

    return {
      success: false,
      error: new ValidationError(message, undefined, error)
    }
  }
}

/**
 * Validates and strips unknown properties from objects
 * Provides additional security by removing unexpected fields
 */
export function validateAndStrip<T>(
  schema: z.ZodSchema<T>,
  data: unknown,
  options: {
    context?: string
    strict?: boolean // If true, throws on validation failure
    allowUnknown?: boolean // If false (default), strips unknown properties
  } = {}
): T {
  const { context, strict = false, allowUnknown = false } = options

  // If we don't allow unknown properties and data is an object, strip them
  if (!allowUnknown && typeof data === 'object' && data !== null && !Array.isArray(data)) {
    const schemaKeys = getSchemaKeys(schema)
    if (schemaKeys.length > 0) {
      data = Object.fromEntries(
        Object.entries(data as Record<string, any>).filter(([key]) => schemaKeys.includes(key))
      )
    }
  }

  const result = validateRequest(schema, data, context)

  if (!result.success) {
    if (strict) {
      throw result.error
    }

    // Return a safe default or throw based on schema type
    if (schema instanceof z.ZodObject) {
      return {} as T
    } else if (schema instanceof z.ZodArray) {
      return [] as T
    } else {
      throw result.error
    }
  }

  return result.data!
}

/**
 * Validates pagination parameters with safe defaults
 */
export function validatePagination(params: unknown): {
  limit: number
  offset: number
  sort?: string
  sortOrder: 'asc' | 'desc'
} {
  const defaultPagination = {
    limit: 50,
    offset: 0,
    sortOrder: 'asc' as const
  }

  if (!params || typeof params !== 'object') {
    return defaultPagination
  }

  const paginationSchema = z.object({
    limit: z.number().int().min(1).max(1000).default(50),
    offset: z.number().int().min(0).default(0),
    sort: z.string().min(1).max(50).optional(),
    sortOrder: z.enum(['asc', 'desc']).default('asc')
  })

  try {
    const parsed = paginationSchema.parse(params)
    return {
      limit: parsed.limit,
      offset: parsed.offset,
      sort: parsed.sort,
      sortOrder: parsed.sortOrder
    }
  } catch {
    return defaultPagination
  }
}

/**
 * Validates filters object with proper sanitization
 */
export function validateFilters<T>(schema: z.ZodSchema<T>, filters: unknown, context?: string): T {
  if (!filters) {
    return {} as T
  }

  // Remove null and undefined values from filters
  if (typeof filters === 'object' && filters !== null) {
    filters = Object.fromEntries(
      Object.entries(filters as Record<string, any>)
        .filter(([, value]) => value !== null && value !== undefined)
        .map(([key, value]) => [key, cleanFilterValue(value)])
    )
  }

  const result = validateRequest(schema, filters, context || 'filters')
  return result.success ? result.data! : ({} as T)
}

// ==================================================
// Utility Functions
// ==================================================

/**
 * Sanitizes data for logging by removing sensitive information
 */
function sanitizeLogData(data: any): any {
  if (!data || typeof data !== 'object') {
    return data
  }

  const sensitive = ['password', 'token', 'secret', 'key', 'authorization', 'cookie']

  if (Array.isArray(data)) {
    return data.map(item => sanitizeLogData(item))
  }

  const sanitized = { ...data }

  Object.keys(sanitized).forEach(key => {
    const lowerKey = key.toLowerCase()
    if (sensitive.some(s => lowerKey.includes(s))) {
      sanitized[key] = '[REDACTED]'
    } else if (typeof sanitized[key] === 'object') {
      sanitized[key] = sanitizeLogData(sanitized[key])
    }
  })

  return sanitized
}

/**
 * Attempts to extract known keys from a Zod schema
 */
function getSchemaKeys(schema: z.ZodSchema): string[] {
  try {
    // Handle ZodObject
    if (schema instanceof z.ZodObject) {
      return Object.keys(schema.shape)
    }

    // Handle ZodEffects (refined schemas)
    if (schema instanceof z.ZodEffects) {
      return getSchemaKeys(schema._def.schema)
    }

    // Handle ZodOptional/ZodNullable
    if (schema instanceof z.ZodOptional || schema instanceof z.ZodNullable) {
      return getSchemaKeys(schema._def.innerType)
    }

    // Handle ZodUnion/ZodDiscriminatedUnion
    if (schema instanceof z.ZodUnion) {
      const allKeys = (schema._def as any).options.flatMap((option: z.ZodSchema) =>
        getSchemaKeys(option)
      )
      return Array.from(new Set(allKeys))
    }

    return []
  } catch {
    return []
  }
}

/**
 * Cleans filter values by removing empty arrays, null values, etc.
 */
function cleanFilterValue(value: any): any {
  if (Array.isArray(value)) {
    const cleaned = value.filter(v => v !== null && v !== undefined && v !== '')
    return cleaned.length > 0 ? cleaned : undefined
  }

  if (typeof value === 'object' && value !== null) {
    const cleaned = Object.fromEntries(
      Object.entries(value).filter(([, v]) => v !== null && v !== undefined && v !== '')
    )
    return Object.keys(cleaned).length > 0 ? cleaned : undefined
  }

  return value === '' ? undefined : value
}

// ==================================================
// Type Helpers
// ==================================================

export type ValidatedRequestHandler<TRequest, TResponse> = (
  validatedRequest: TRequest
) => Promise<TResponse>

export type ValidationOptions = {
  context?: string
  strict?: boolean
  sanitize?: boolean
  logLevel?: 'debug' | 'info' | 'warn' | 'error'
}

// ==================================================
// Higher-Order Validation Functions
// ==================================================

/**
 * Creates a validated API method that handles both request and response validation
 */
export function createValidatedMethod<TRequest, TResponse>(
  requestSchema: z.ZodSchema<TRequest>,
  responseSchema: z.ZodSchema<TResponse>,
  handler: ValidatedRequestHandler<TRequest, TResponse>,
  options: ValidationOptions = {}
) {
  return async (requestData: unknown): Promise<TResponse> => {
    const { context, strict = true } = options

    // Validate request
    const requestValidation = validateRequest(requestSchema, requestData, context)
    if (!requestValidation.success) {
      if (strict) {
        throw requestValidation.error
      }
      // Could return default response or re-throw based on requirements
      throw requestValidation.error
    }

    try {
      // Execute handler with validated data
      const response = await handler(requestValidation.data!)

      // Validate response
      const responseValidation = validateResponse(responseSchema, response, context)
      if (!responseValidation.success) {
        log.error('Response validation failed for handler', {
          context,
          error: responseValidation.error
        })
        // In production, you might want to return a generic error response
        // rather than exposing internal validation failures
        throw new Error('Internal server error: Invalid response format')
      }

      return responseValidation.data!
    } catch (error) {
      // Ensure handler errors are properly logged
      log.error('Handler error', { context, error: error instanceof Error ? error.message : error })
      throw error
    }
  }
}

/**
 * Type guard to check if an error is a ValidationError
 */
export function isValidationError(error: unknown): error is ValidationError {
  return error instanceof ValidationError
}

/**
 * Formats validation errors for user-friendly display
 */
export function formatValidationError(error: ValidationError): string {
  if (error.field) {
    return `${error.field}: ${error.message}`
  }
  return error.message
}

/**
 * Extracts all validation error messages from Zod issues
 */
export function extractValidationMessages(issues: z.ZodIssue[]): string[] {
  return issues.map(issue => {
    const path = issue.path.length > 0 ? `${issue.path.join('.')}: ` : ''
    return `${path}${issue.message}`
  })
}
