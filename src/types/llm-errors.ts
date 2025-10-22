/**
 * LLM Error Classes
 *
 * Custom error types for LLM API integration with detailed context and error codes
 */

import type { LLMProvider, LLMErrorCode, LLMErrorContext, EncryptionErrorCode, PinProtectionErrorCode } from './llm'

/**
 * Base LLM Error Class
 */
export class LLMError extends Error {
  public readonly code: LLMErrorCode
  public readonly provider?: LLMProvider
  public readonly context?: LLMErrorContext
  public readonly timestamp: number

  constructor(
    message: string,
    code: LLMErrorCode,
    provider?: LLMProvider,
    context?: LLMErrorContext
  ) {
    super(message)
    this.name = 'LLMError'
    this.code = code
    this.provider = provider
    this.context = context
    this.timestamp = Date.now()

    // Maintain proper stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, LLMError)
    }
  }

  /**
   * Get user-friendly error message
   */
  getUserMessage(): string {
    switch (this.code) {
      case 'NO_API_KEY':
        return `Please set up an API key for ${this.provider ?? 'this provider'} first.`
      case 'INVALID_API_KEY':
        return `The API key for ${this.provider ?? 'this provider'} is invalid or expired.`
      case 'REQUEST_FAILED':
        return 'The request failed. Please try again.'
      case 'RATE_LIMITED':
        return 'Too many requests. Please wait a moment before trying again.'
      case 'QUOTA_EXCEEDED':
        return `You've exceeded your quota for ${this.provider ?? 'this provider'}.`
      case 'MODEL_NOT_AVAILABLE':
        return 'The requested model is not available.'
      case 'NETWORK_ERROR':
        return 'Network error. Please check your connection and try again.'
      case 'SESSION_EXPIRED':
        return 'Your session has expired. Please enter your PIN to continue.'
      case 'PIN_REQUIRED':
        return 'PIN required to access encrypted data.'
      case 'MAX_ATTEMPTS_EXCEEDED':
        return 'Too many failed attempts. Data has been wiped for security.'
      case 'LOCKOUT_ACTIVE':
        return 'Account is temporarily locked. Please wait before trying again.'
      default:
        return this.message
    }
  }

  /**
   * Get detailed error information for logging
   */
  getDetailedInfo(): Record<string, any> {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      provider: this.provider,
      context: this.context,
      timestamp: this.timestamp,
      stack: this.stack
    }
  }

  /**
   * Check if error is recoverable
   */
  isRecoverable(): boolean {
    const unrecoverableErrors: LLMErrorCode[] = [
      'MAX_ATTEMPTS_EXCEEDED',
      'INVALID_API_KEY',
      'QUOTA_EXCEEDED',
      'MODEL_NOT_AVAILABLE'
    ]
    return !unrecoverableErrors.includes(this.code)
  }

  /**
   * Check if error requires user action
   */
  requiresUserAction(): boolean {
    const userActionErrors: LLMErrorCode[] = [
      'NO_API_KEY',
      'INVALID_API_KEY',
      'PIN_REQUIRED',
      'SESSION_EXPIRED',
      'MAX_ATTEMPTS_EXCEEDED',
      'QUOTA_EXCEEDED'
    ]
    return userActionErrors.includes(this.code)
  }
}

/**
 * Encryption-specific Error Class
 */
export class EncryptionError extends Error {
  public readonly code: EncryptionErrorCode
  public readonly context?: Record<string, any>
  public readonly timestamp: number

  constructor(
    message: string,
    code: EncryptionErrorCode,
    context?: Record<string, any>
  ) {
    super(message)
    this.name = 'EncryptionError'
    this.code = code
    this.context = context
    this.timestamp = Date.now()

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, EncryptionError)
    }
  }

  getUserMessage(): string {
    switch (this.code) {
      case 'ENCRYPTION_FAILED':
        return 'Failed to encrypt data. Please try again.'
      case 'DECRYPTION_FAILED':
        return 'Failed to decrypt data. Your PIN may be incorrect.'
      case 'KEY_DERIVATION_FAILED':
        return 'Failed to generate encryption key from PIN.'
      case 'INVALID_INPUT':
        return 'Invalid data provided for encryption/decryption.'
      case 'CRYPTO_NOT_SUPPORTED':
        return 'Encryption is not supported in this browser.'
      default:
        return this.message
    }
  }

  getDetailedInfo(): Record<string, any> {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      context: this.context,
      timestamp: this.timestamp,
      stack: this.stack
    }
  }
}

/**
 * PIN Protection-specific Error Class
 */
export class PinProtectionError extends Error {
  public readonly code: PinProtectionErrorCode
  public readonly context?: Record<string, any>
  public readonly timestamp: number

  constructor(
    message: string,
    code: PinProtectionErrorCode,
    context?: Record<string, any>
  ) {
    super(message)
    this.name = 'PinProtectionError'
    this.code = code
    this.context = context
    this.timestamp = Date.now()

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, PinProtectionError)
    }
  }

  getUserMessage(): string {
    switch (this.code) {
      case 'PIN_REQUIRED':
        return 'PIN required to access encrypted data.'
      case 'INVALID_PIN':
        return 'Incorrect PIN. Please try again.'
      case 'MAX_ATTEMPTS_EXCEEDED':
        return 'Too many failed attempts. All data has been wiped for security.'
      case 'LOCKOUT_ACTIVE':
        return `Account is locked. Please wait ${this.getRemainingLockoutTime()} before trying again.`
      case 'SESSION_EXPIRED':
        return 'Your session has expired. Please enter your PIN again.'
      case 'SESSION_CREATION_FAILED':
        return 'Failed to create secure session. Please try again.'
      case 'EMERGENCY_WIPE_TRIGGERED':
        return 'Emergency security wipe activated. All data has been cleared.'
      default:
        return this.message
    }
  }

  getDetailedInfo(): Record<string, any> {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      context: this.context,
      timestamp: this.timestamp,
      stack: this.stack
    }
  }

  private getRemainingLockoutTime(): string {
    if (!this.context?.lockedUntil) return 'a few minutes'

    const remainingMs = this.context.lockedUntil - Date.now()
    if (remainingMs <= 0) return '0 seconds'

    const minutes = Math.ceil(remainingMs / (1000 * 60))
    if (minutes === 1) return '1 minute'
    return `${minutes} minutes`
  }

  isLockoutActive(): boolean {
    return this.code === 'LOCKOUT_ACTIVE' &&
           this.context?.lockedUntil &&
           this.context.lockedUntil > Date.now()
  }

  getRemainingLockoutMs(): number {
    if (!this.isLockoutActive()) return 0
    return this.context!.lockedUntil - Date.now()
  }
}

/**
 * Error utilities
 */
export class LLMErrorHandler {
  /**
   * Convert unknown error to LLMError
   */
  static toLLMError(
    error: unknown,
    fallbackCode: LLMErrorCode = 'REQUEST_FAILED',
    provider?: LLMProvider,
    context?: LLMErrorContext
  ): LLMError {
    if (error instanceof LLMError) {
      return error
    }

    if (error instanceof EncryptionError) {
      return new LLMError(
        error.message,
        'ENCRYPTION_FAILED',
        provider,
        { ...context, originalError: error.message }
      )
    }

    if (error instanceof PinProtectionError) {
      return new LLMError(
        error.message,
        'PIN_REQUIRED',
        provider,
        { ...context, originalError: error.message }
      )
    }

    const message = error instanceof Error ? error.message : String(error)
    return new LLMError(message, fallbackCode, provider, context)
  }

  /**
   * Check if error should trigger emergency wipe
   */
  static shouldTriggerEmergencyWipe(error: PinProtectionError): boolean {
    return error.code === 'MAX_ATTEMPTS_EXCEEDED' ||
           error.code === 'EMERGENCY_WIPE_TRIGGERED'
  }

  /**
   * Get retry delay for error
   */
  static getRetryDelay(error: LLMError): number {
    switch (error.code) {
      case 'RATE_LIMITED':
        return 60000 // 1 minute
      case 'NETWORK_ERROR':
        return 5000 // 5 seconds
      case 'REQUEST_FAILED':
        return 2000 // 2 seconds
      default:
        return 0 // No retry
    }
  }

  /**
   * Check if error should be retried automatically
   */
  static shouldRetry(error: LLMError, attemptCount: number): boolean {
    if (attemptCount >= 3) return false

    const retryableCodes: LLMErrorCode[] = [
      'NETWORK_ERROR',
      'REQUEST_FAILED'
    ]

    return retryableCodes.includes(error.code)
  }
}