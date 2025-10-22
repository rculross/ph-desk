/**
 * Centralized Error Types and Utilities for API Layer
 *
 * This module provides a unified error handling system that consolidates
 * error handling at the TanStack Query level, removing the need for
 * error transformation in multiple layers.
 */

import { logger } from '../utils/logger'

const log = logger.api

/**
 * Standard API Error interface used throughout the application
 */
export interface ApiError {
  /** Error code for programmatic handling */
  code: string
  /** Human-readable error message */
  message: string
  /** HTTP status code if applicable */
  status?: number
  /** Timestamp when the error occurred */
  timestamp: number
  /** Whether this error is retryable */
  retryable?: boolean
  /** Original error details for debugging */
  originalError?: unknown
  /** Request context for debugging */
  context?: {
    method?: string
    url?: string
    requestId?: string
    duration?: number
  }
}

/**
 * Error codes used throughout the application
 */
export const ERROR_CODES = {
  // Network/Connection errors
  NETWORK_ERROR: 'NETWORK_ERROR',
  NETWORK_TYPE_ERROR: 'NETWORK_TYPE_ERROR',
  TIMEOUT: 'TIMEOUT',
  REQUEST_ABORTED: 'REQUEST_ABORTED',

  // HTTP errors
  BAD_REQUEST: 'BAD_REQUEST',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',
  RATE_LIMITED: 'RATE_LIMITED',
  INTERNAL_SERVER_ERROR: 'INTERNAL_SERVER_ERROR',
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',

  // Authentication/Authorization
  TOKEN_EXPIRED: 'TOKEN_EXPIRED',
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',

  // Validation errors
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  PAYLOAD_TOO_LARGE: 'PAYLOAD_TOO_LARGE',

  // Business logic errors
  TENANT_NOT_FOUND: 'TENANT_NOT_FOUND',
  RESOURCE_NOT_FOUND: 'RESOURCE_NOT_FOUND',
  OPERATION_FAILED: 'OPERATION_FAILED',

  // Generic fallback
  UNKNOWN_ERROR: 'UNKNOWN_ERROR'
} as const

export type ErrorCode = typeof ERROR_CODES[keyof typeof ERROR_CODES]

/**
 * Check if an error is an ApiError
 */
export function isApiError(error: unknown): error is ApiError {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    'message' in error &&
    'timestamp' in error
  )
}

/**
 * Create a standardized API error from various error sources
 */
export function createApiError(
  error: unknown,
  context?: {
    method?: string
    url?: string
    requestId?: string
    duration?: number
  }
): ApiError {
  // If it's already an ApiError, return it with updated context
  if (isApiError(error)) {
    return {
      ...error,
      context: { ...error.context, ...context }
    }
  }

  // Handle Axios/fetch response errors
  if (error && typeof error === 'object' && 'response' in error) {
    const response = (error as any).response
    return createHttpError(response, context, error)
  }

  // Handle Response objects directly
  if (error instanceof Response) {
    return createHttpError(error, context)
  }

  // Handle network/fetch errors
  if (error instanceof TypeError || (error instanceof Error && error.name === 'TypeError')) {
    return {
      code: ERROR_CODES.NETWORK_TYPE_ERROR,
      message: error.message ?? 'Network request failed',
      timestamp: Date.now(),
      retryable: true,
      originalError: error,
      context
    }
  }

  // Handle AbortError
  if (error instanceof Error && error.name === 'AbortError') {
    return {
      code: ERROR_CODES.REQUEST_ABORTED,
      message: 'Request was aborted',
      timestamp: Date.now(),
      retryable: false,
      originalError: error,
      context
    }
  }

  // Handle timeout errors
  if (error instanceof Error && (
    error.message.includes('timeout') ||
    error.message.includes('TIMEOUT') ||
    error.name === 'TimeoutError'
  )) {
    return {
      code: ERROR_CODES.TIMEOUT,
      message: error.message ?? 'Request timed out',
      timestamp: Date.now(),
      retryable: true,
      originalError: error,
      context
    }
  }

  // Handle validation errors
  if (error && typeof error === 'object' && 'field' in error) {
    return {
      code: ERROR_CODES.VALIDATION_ERROR,
      message: (error as any).message ?? 'Validation failed',
      timestamp: Date.now(),
      retryable: false,
      originalError: error,
      context
    }
  }

  // Handle generic Error objects
  if (error instanceof Error) {
    return {
      code: ERROR_CODES.UNKNOWN_ERROR,
      message: error.message ?? 'An unknown error occurred',
      timestamp: Date.now(),
      retryable: false,
      originalError: error,
      context
    }
  }

  // Handle string errors
  if (typeof error === 'string') {
    return {
      code: ERROR_CODES.UNKNOWN_ERROR,
      message: error,
      timestamp: Date.now(),
      retryable: false,
      originalError: error,
      context
    }
  }

  // Fallback for any other error types
  return {
    code: ERROR_CODES.UNKNOWN_ERROR,
    message: 'An unknown error occurred',
    timestamp: Date.now(),
    retryable: false,
    originalError: error,
    context
  }
}

/**
 * Create an HTTP error from a Response object
 */
export function createHttpError(
  response: Response | any,
  context?: { method?: string; url?: string; requestId?: string; duration?: number },
  originalError?: unknown
): ApiError {
  const status = response.status
  let code: ErrorCode
  let message: string
  let retryable = false

  // Map HTTP status codes to error codes
  switch (status) {
    case 400:
      code = ERROR_CODES.BAD_REQUEST
      message = 'Bad Request'
      break
    case 401:
      code = ERROR_CODES.UNAUTHORIZED
      message = 'Authentication required'
      break
    case 403:
      code = ERROR_CODES.FORBIDDEN
      message = 'Access forbidden'
      break
    case 404:
      code = ERROR_CODES.NOT_FOUND
      message = 'Resource not found'
      break
    case 409:
      code = ERROR_CODES.CONFLICT
      message = 'Resource conflict'
      break
    case 429:
      code = ERROR_CODES.RATE_LIMITED
      message = 'Rate limit exceeded'
      retryable = true
      break
    case 500:
      code = ERROR_CODES.INTERNAL_SERVER_ERROR
      message = 'Internal server error'
      retryable = true
      break
    case 502:
    case 503:
    case 504:
      code = ERROR_CODES.SERVICE_UNAVAILABLE
      message = 'Service temporarily unavailable'
      retryable = true
      break
    default:
      if (status >= 500) {
        code = ERROR_CODES.INTERNAL_SERVER_ERROR
        message = 'Server error'
        retryable = true
      } else if (status >= 400) {
        code = ERROR_CODES.BAD_REQUEST
        message = 'Client error'
      } else {
        code = ERROR_CODES.UNKNOWN_ERROR
        message = 'Unknown HTTP error'
      }
  }

  // Override with more specific message if available
  if (response.statusText) {
    message = `${message}: ${response.statusText}`
  }

  return {
    code,
    message,
    status,
    timestamp: Date.now(),
    retryable,
    originalError: originalError || response,
    context
  }
}

/**
 * Determine if an error should be retried
 */
export function shouldRetryError(error: unknown, attemptCount: number = 0): boolean {
  if (!isApiError(error)) {
    // Convert to ApiError to check retryability
    const apiError = createApiError(error)
    return shouldRetryApiError(apiError, attemptCount)
  }

  return shouldRetryApiError(error, attemptCount)
}

/**
 * Determine if an ApiError should be retried
 */
export function shouldRetryApiError(error: ApiError, attemptCount: number = 0): boolean {
  // Don't retry if explicitly marked as non-retryable
  if (error.retryable === false) {
    return false
  }

  // Don't retry 4xx errors (except 429)
  if (error.status && error.status >= 400 && error.status < 500 && error.status !== 429) {
    return false
  }

  // Limit retry attempts based on error type
  switch (error.code) {
    case ERROR_CODES.NETWORK_ERROR:
    case ERROR_CODES.NETWORK_TYPE_ERROR:
    case ERROR_CODES.TIMEOUT:
      return attemptCount < 3

    case ERROR_CODES.RATE_LIMITED:
      return attemptCount < 2

    case ERROR_CODES.INTERNAL_SERVER_ERROR:
    case ERROR_CODES.SERVICE_UNAVAILABLE:
      return attemptCount < 2

    default:
      return error.retryable === true && attemptCount < 1
  }
}

/**
 * Get retry delay for an error (exponential backoff)
 */
export function getRetryDelay(attemptIndex: number, error?: ApiError): number {
  // Rate limits might have specific retry-after headers, but we'll use exponential backoff
  const baseDelay = error?.code === ERROR_CODES.RATE_LIMITED ? 2000 : 1000
  const maxDelay = error?.code === ERROR_CODES.RATE_LIMITED ? 10000 : 30000

  return Math.min(baseDelay * Math.pow(2, attemptIndex), maxDelay)
}

/**
 * Log an error with appropriate level and context
 */
export function logError(error: ApiError, level: 'error' | 'warn' | 'debug' = 'error'): void {
  const logData = {
    code: error.code,
    message: error.message,
    status: error.status,
    retryable: error.retryable,
    context: error.context,
    timestamp: new Date(error.timestamp).toISOString()
  }

  // Don't log certain errors as errors (they're expected)
  if (error.code === ERROR_CODES.UNAUTHORIZED && error.context?.url?.includes('/myprofile')) {
    // Connectivity checks are expected to fail sometimes
    log.debug('Connectivity check failed (expected)', logData)
    return
  }

  switch (level) {
    case 'error':
      log.error('API Error', logData)
      break
    case 'warn':
      log.warn('API Warning', logData)
      break
    case 'debug':
      log.debug('API Debug', logData)
      break
  }
}

/**
 * Get user-friendly error message for display
 */
export function getUserFriendlyMessage(error: ApiError): string {
  switch (error.code) {
    case ERROR_CODES.NETWORK_ERROR:
    case ERROR_CODES.NETWORK_TYPE_ERROR:
      return 'Unable to connect to the server. Please check your internet connection.'

    case ERROR_CODES.TIMEOUT:
      return 'The request timed out. Please try again.'

    case ERROR_CODES.UNAUTHORIZED:
      return 'You need to be logged in to perform this action.'

    case ERROR_CODES.FORBIDDEN:
      return 'You do not have permission to perform this action.'

    case ERROR_CODES.NOT_FOUND:
      return 'The requested resource was not found.'

    case ERROR_CODES.RATE_LIMITED:
      return 'Too many requests. Please wait a moment before trying again.'

    case ERROR_CODES.INTERNAL_SERVER_ERROR:
    case ERROR_CODES.SERVICE_UNAVAILABLE:
      return 'The server is temporarily unavailable. Please try again later.'

    case ERROR_CODES.VALIDATION_ERROR:
      return error.message // Validation errors usually have specific messages

    case ERROR_CODES.TENANT_NOT_FOUND:
      return 'The selected workspace was not found.'

    default:
      return error.message ?? 'An unexpected error occurred. Please try again.'
  }
}

/**
 * Create error for rate limiting
 */
export function createRateLimitError(message?: string, context?: any): ApiError {
  return {
    code: ERROR_CODES.RATE_LIMITED,
    message: message ?? 'Rate limit exceeded',
    status: 429,
    timestamp: Date.now(),
    retryable: true,
    context
  }
}

/**
 * Create error for validation failures
 */
export function createValidationError(message: string, field?: string, context?: any): ApiError {
  return {
    code: ERROR_CODES.VALIDATION_ERROR,
    message,
    timestamp: Date.now(),
    retryable: false,
    originalError: { field },
    context
  }
}

/**
 * Create error for network failures
 */
export function createNetworkError(originalError: unknown, context?: any): ApiError {
  return createApiError(originalError, context)
}