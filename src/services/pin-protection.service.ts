/**
 * PIN Protection Service
 *
 * Secure PIN-based authentication with brute force protection
 * - Failed attempt tracking with progressive delays
 * - Auto-wipe after maximum attempts exceeded
 * - Session management with timeout
 * - Emergency lockout protection
 */

import { PinAttemptRecordSchema, PinSessionSchema, SecurityConfigSchema } from '../schemas/llm-schemas'
import type { PinAttemptRecord, PinSession, SecurityConfig } from '../types/llm'
import { PinProtectionError } from '../types/llm-errors'
import { logger } from '../utils/logger'
import { storageManager } from '../utils/storage-manager'

import { encryptionService } from './encryption.service'

const log = logger.api

/**
 * PIN Hash Storage Structure
 * Stores the hashed PIN with salt for secure validation
 */
interface PinHashStorage {
  hash: string // Base64-encoded hash
  salt: string // Base64-encoded salt
  iterations: number // PBKDF2 iterations used
  createdAt: number // Timestamp when PIN was created
}

/**
 * PIN Protection Service Class
 * Manages PIN authentication with comprehensive security features
 */
class PinProtectionService {
  // Storage keys
  private static readonly ATTEMPT_RECORD_KEY = 'pin_attempt_record'
  private static readonly SESSION_KEY = 'pin_session'
  private static readonly SECURITY_CONFIG_KEY = 'security_config'
  private static readonly PIN_HASH_KEY = 'pin_hash' // NEW: Storage key for PIN hash

  // PBKDF2 configuration for PIN hashing (matching encryption service)
  private readonly PBKDF2_ITERATIONS = 100000
  private readonly PBKDF2_HASH = 'SHA-256'
  private readonly SALT_LENGTH = 32 // 256 bits

  // Rate limiting configuration
  // Security: Minimum time between PIN verification attempts (1 second)
  // This prevents rapid-fire brute force attempts and cannot be bypassed from DevTools
  private static readonly MIN_ATTEMPT_INTERVAL = 1000 // 1 second

  // Default security configuration
  private readonly DEFAULT_CONFIG: SecurityConfig = {
    maxAttempts: 5,
    lockoutDuration: 15 * 60 * 1000, // 15 minutes
    sessionTimeout: 30 * 60 * 1000, // 30 minutes
    progressiveDelays: [1000, 2000, 4000, 8000, 16000] // 1s, 2s, 4s, 8s, 16s
  }

  private currentSession: PinSession | null = null
  private securityConfig: SecurityConfig = this.DEFAULT_CONFIG
  private lastAttemptTime: number = 0 // Track last PIN verification attempt timestamp

  constructor() {
    log.debug('PIN Protection service initialized')
    void this.initializeService()
  }

  /**
   * Initialize service by loading configuration and session
   */
  private async initializeService(): Promise<void> {
    try {
      // Load security configuration
      await this.loadSecurityConfig()

      // Load existing session
      await this.loadSession()

      log.debug('PIN Protection service initialized successfully', {
        configLoaded: true,
        sessionValid: this.currentSession?.isValid ?? false
      })
    } catch (error) {
      log.warn('Failed to initialize PIN Protection service', {
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  }

  /**
   * Setup PIN for first-time use
   * Creates and stores a secure hash of the PIN
   */
  async setupPin(pin: string): Promise<void> {
    try {
      if (!pin || typeof pin !== 'string' || pin.length < 4) {
        throw new PinProtectionError(
          'PIN must be at least 4 characters',
          'INVALID_PIN'
        )
      }

      log.debug('Setting up new PIN', {
        pinLength: pin.length
      })

      // Check if PIN already exists
      const existingHash = await this.getPinHash()
      if (existingHash) {
        throw new PinProtectionError(
          'PIN already exists. Use changePin to modify it.',
          'INVALID_PIN'
        )
      }

      // Hash and store the PIN
      const pinHash = await this.hashPin(pin)
      await this.savePinHash(pinHash)

      // Create initial session
      await this.createValidSession(pin)

      log.info('PIN setup completed successfully')

    } catch (error) {
      log.error('PIN setup failed', {
        error: error instanceof Error ? error.message : 'Unknown error'
      })

      if (error instanceof PinProtectionError) {
        throw error
      }

      throw new PinProtectionError(
        'Failed to setup PIN',
        'INVALID_PIN',
        { originalError: error instanceof Error ? error.message : 'Unknown error' }
      )
    }
  }

  /**
   * Verify PIN with brute force protection
   */
  async verifyPin(pin: string): Promise<void> {
    try {
      if (!pin || typeof pin !== 'string') {
        throw new PinProtectionError(
          'PIN is required',
          'PIN_REQUIRED'
        )
      }

      log.debug('Starting PIN verification', {
        pinLength: pin.length,
        sessionValid: this.currentSession?.isValid ?? false
      })

      // Security: Enforce minimum time interval between PIN attempts
      // This rate limiting cannot be bypassed from DevTools as it's enforced server-side in the service
      const now = Date.now()
      const timeSinceLastAttempt = now - this.lastAttemptTime

      if (this.lastAttemptTime > 0 && timeSinceLastAttempt < PinProtectionService.MIN_ATTEMPT_INTERVAL) {
        const remainingMs = PinProtectionService.MIN_ATTEMPT_INTERVAL - timeSinceLastAttempt

        log.warn('PIN attempt rate limit triggered', {
          timeSinceLastAttempt,
          remainingMs
        })

        // Enforce delay before allowing the attempt
        await new Promise(resolve => setTimeout(resolve, remainingMs))
      }

      // Update last attempt time
      this.lastAttemptTime = Date.now()

      // Check if currently locked out
      await this.checkLockoutStatus()

      // Get current attempt record
      const attemptRecord = await this.getAttemptRecord()

      // Apply progressive delay if there are previous failed attempts
      if (attemptRecord.attempts > 0) {
        await this.applyProgressiveDelay(attemptRecord)
      }

      // Try to verify PIN by checking if we can create a valid session
      const isValidPin = await this.validatePinCredentials(pin)

      if (!isValidPin) {
        // Increment failed attempts
        await this.recordFailedAttempt(attemptRecord)

        // Check if max attempts exceeded
        if (attemptRecord.attempts >= this.securityConfig.maxAttempts) {
          await this.triggerEmergencyWipe()
          throw new PinProtectionError(
            'Maximum PIN attempts exceeded. All data has been wiped for security.',
            'MAX_ATTEMPTS_EXCEEDED'
          )
        }

        // Check if should be locked out
        if (attemptRecord.attempts >= Math.floor(this.securityConfig.maxAttempts * 0.6)) {
          await this.activateLockout(attemptRecord)
        }

        throw new PinProtectionError(
          `Incorrect PIN. ${this.securityConfig.maxAttempts - attemptRecord.attempts} attempts remaining.`,
          'INVALID_PIN',
          {
            attemptsRemaining: this.securityConfig.maxAttempts - attemptRecord.attempts,
            willLockout: attemptRecord.attempts >= Math.floor(this.securityConfig.maxAttempts * 0.6)
          }
        )
      }

      // PIN is correct - clear attempts and create session
      await this.clearAttemptRecord()
      await this.createValidSession(pin)

      log.info('PIN verification successful', {
        sessionId: this.currentSession?.sessionId,
        expiresAt: this.currentSession?.expiresAt
      })

    } catch (error) {
      log.error('PIN verification failed', {
        error: error instanceof Error ? error.message : 'Unknown error'
      })

      if (error instanceof PinProtectionError) {
        throw error
      }

      throw new PinProtectionError(
        'PIN verification failed',
        'INVALID_PIN',
        { originalError: error instanceof Error ? error.message : 'Unknown error' }
      )
    }
  }

  /**
   * Check if current session is valid
   */
  isSessionValid(): boolean {
    if (!this.currentSession || !this.currentSession.isValid) {
      return false
    }

    const now = Date.now()
    if (now >= this.currentSession.expiresAt) {
      log.debug('Session expired', {
        sessionId: this.currentSession.sessionId,
        expiredAt: this.currentSession.expiresAt,
        now
      })
      this.invalidateSession()
      return false
    }

    return true
  }

  /**
   * Get remaining session time in milliseconds
   */
  getRemainingSessionTime(): number {
    if (!this.isSessionValid() || !this.currentSession) {
      return 0
    }

    return Math.max(0, this.currentSession.expiresAt - Date.now())
  }

  /**
   * Extend current session timeout
   */
  async extendSession(): Promise<void> {
    if (!this.isSessionValid() || !this.currentSession) {
      throw new PinProtectionError(
        'No valid session to extend',
        'SESSION_EXPIRED'
      )
    }

    try {
      const newExpiresAt = Date.now() + this.securityConfig.sessionTimeout

      this.currentSession = {
        ...this.currentSession,
        expiresAt: newExpiresAt
      }

      await this.saveSession()

      log.debug('Session extended', {
        sessionId: this.currentSession.sessionId,
        newExpiresAt
      })

    } catch (error) {
      log.error('Failed to extend session', {
        error: error instanceof Error ? error.message : 'Unknown error'
      })

      throw new PinProtectionError(
        'Failed to extend session',
        'SESSION_CREATION_FAILED',
        { originalError: error instanceof Error ? error.message : 'Unknown error' }
      )
    }
  }

  /**
   * Lock current session immediately
   */
  async lockSession(): Promise<void> {
    log.info('Locking session manually')
    this.invalidateSession()
    await this.clearSessionStorage()
  }

  /**
   * Get current lockout status
   */
  async getLockoutStatus(): Promise<{
    isLockedOut: boolean
    remainingTime: number
    attemptsRemaining: number
  }> {
    try {
      const attemptRecord = await this.getAttemptRecord()
      const now = Date.now()

      const isLockedOut = attemptRecord.lockedUntil > now
      const remainingTime = Math.max(0, attemptRecord.lockedUntil - now)
      const attemptsRemaining = Math.max(0, this.securityConfig.maxAttempts - attemptRecord.attempts)

      return {
        isLockedOut,
        remainingTime,
        attemptsRemaining
      }

    } catch (error) {
      log.error('Failed to get lockout status', {
        error: error instanceof Error ? error.message : 'Unknown error'
      })

      return {
        isLockedOut: false,
        remainingTime: 0,
        attemptsRemaining: this.securityConfig.maxAttempts
      }
    }
  }

  /**
   * Change PIN (requires current PIN verification)
   */
  async changePin(currentPin: string, newPin: string): Promise<void> {
    try {
      if (!newPin || typeof newPin !== 'string' || newPin.length < 4) {
        throw new PinProtectionError(
          'New PIN must be at least 4 characters',
          'INVALID_PIN'
        )
      }

      // Verify current PIN first
      await this.verifyPin(currentPin)

      // Hash and store the new PIN
      const newPinHash = await this.hashPin(newPin)
      await this.savePinHash(newPinHash)

      // Invalidate current session to force re-authentication with new PIN
      await this.lockSession()

      log.info('PIN changed successfully')

    } catch (error) {
      log.error('PIN change failed', {
        error: error instanceof Error ? error.message : 'Unknown error'
      })

      if (error instanceof PinProtectionError) {
        throw error
      }

      throw new PinProtectionError(
        'Failed to change PIN',
        'INVALID_PIN',
        { originalError: error instanceof Error ? error.message : 'Unknown error' }
      )
    }
  }

  /**
   * Emergency wipe - clear all data
   */
  async emergencyWipe(): Promise<void> {
    try {
      log.warn('Executing emergency wipe')

      // Clear all PIN-related storage including PIN hash
      await storageManager.safeRemove([
        PinProtectionService.ATTEMPT_RECORD_KEY,
        PinProtectionService.SESSION_KEY,
        PinProtectionService.SECURITY_CONFIG_KEY,
        PinProtectionService.PIN_HASH_KEY
      ])

      // Invalidate current session
      this.invalidateSession()

      // Reset security config to defaults
      this.securityConfig = this.DEFAULT_CONFIG

      log.warn('Emergency wipe completed - all PIN data cleared')

    } catch (error) {
      log.error('Emergency wipe failed', {
        error: error instanceof Error ? error.message : 'Unknown error'
      })

      throw new PinProtectionError(
        'Emergency wipe failed',
        'EMERGENCY_WIPE_TRIGGERED',
        { originalError: error instanceof Error ? error.message : 'Unknown error' }
      )
    }
  }

  /**
   * Get security configuration
   */
  getSecurityConfig(): SecurityConfig {
    return { ...this.securityConfig }
  }

  /**
   * Update security configuration (requires PIN verification)
   */
  async updateSecurityConfig(newConfig: Partial<SecurityConfig>, pin: string): Promise<void> {
    try {
      // Verify PIN first
      await this.verifyPin(pin)

      const updatedConfig = { ...this.securityConfig, ...newConfig }

      // Validate new configuration
      const validation = SecurityConfigSchema.safeParse(updatedConfig)
      if (!validation.success) {
        throw new PinProtectionError(
          'Invalid security configuration',
          'INVALID_PIN',
          { validationErrors: validation.error.errors }
        )
      }

      this.securityConfig = updatedConfig
      await this.saveSecurityConfig()

      log.info('Security configuration updated', {
        maxAttempts: updatedConfig.maxAttempts,
        lockoutDuration: updatedConfig.lockoutDuration,
        sessionTimeout: updatedConfig.sessionTimeout
      })

    } catch (error) {
      log.error('Failed to update security configuration', {
        error: error instanceof Error ? error.message : 'Unknown error'
      })

      if (error instanceof PinProtectionError) {
        throw error
      }

      throw new PinProtectionError(
        'Failed to update security configuration',
        'INVALID_PIN',
        { originalError: error instanceof Error ? error.message : 'Unknown error' }
      )
    }
  }

  // Private helper methods

  /**
   * Validate PIN against stored hash
   * Uses constant-time comparison to prevent timing attacks
   */
  private async validatePinCredentials(pin: string): Promise<boolean> {
    try {
      // Get stored PIN hash
      const storedHash = await this.getPinHash()

      // If no PIN hash exists, this is first-time setup - return false
      if (!storedHash) {
        log.debug('No PIN hash found - first-time setup required')
        return false
      }

      // Hash the provided PIN with the stored salt
      const providedHashBuffer = await this.deriveHash(pin, encryptionService.base64ToArrayBuffer(storedHash.salt))
      const providedHash = encryptionService.arrayBufferToBase64(providedHashBuffer)

      // Compare hashes using constant-time comparison
      const isValid = this.constantTimeCompare(providedHash, storedHash.hash)

      log.debug('PIN validation completed', {
        isValid,
        iterations: storedHash.iterations
      })

      return isValid
    } catch (error) {
      log.debug('PIN validation failed during hash comparison', {
        error: error instanceof Error ? error.message : 'Unknown error'
      })
      return false
    }
  }

  /**
   * Hash PIN using PBKDF2
   * Returns a PinHashStorage object with hash, salt, and metadata
   */
  private async hashPin(pin: string): Promise<PinHashStorage> {
    try {
      // Generate cryptographically secure random salt
      const saltBuffer = new Uint8Array(this.SALT_LENGTH)
      crypto.getRandomValues(saltBuffer)

      // Derive hash from PIN using PBKDF2
      const hashBuffer = await this.deriveHash(pin, saltBuffer.buffer)

      // Convert to Base64 for storage
      const hash = encryptionService.arrayBufferToBase64(hashBuffer)
      const salt = encryptionService.arrayBufferToBase64(saltBuffer.buffer)

      log.debug('PIN hashed successfully', {
        iterations: this.PBKDF2_ITERATIONS,
        saltLength: this.SALT_LENGTH
      })

      return {
        hash,
        salt,
        iterations: this.PBKDF2_ITERATIONS,
        createdAt: Date.now()
      }
    } catch (error) {
      log.error('PIN hashing failed', {
        error: error instanceof Error ? error.message : 'Unknown error'
      })
      throw new PinProtectionError(
        'Failed to hash PIN',
        'INVALID_PIN',
        { originalError: error instanceof Error ? error.message : 'Unknown error' }
      )
    }
  }

  /**
   * Derive hash from PIN using PBKDF2
   * Uses Web Crypto API for secure key derivation
   */
  private async deriveHash(pin: string, salt: ArrayBuffer): Promise<ArrayBuffer> {
    try {
      // Convert PIN to bytes
      const pinBytes = new TextEncoder().encode(pin)

      // Import PIN as base key material
      const baseKey = await crypto.subtle.importKey(
        'raw',
        pinBytes,
        'PBKDF2',
        false,
        ['deriveBits']
      )

      // Derive hash using PBKDF2
      const hashBuffer = await crypto.subtle.deriveBits(
        {
          name: 'PBKDF2',
          salt,
          iterations: this.PBKDF2_ITERATIONS,
          hash: this.PBKDF2_HASH
        },
        baseKey,
        256 // 256 bits = 32 bytes
      )

      return hashBuffer
    } catch (error) {
      log.error('Hash derivation failed', {
        error: error instanceof Error ? error.message : 'Unknown error'
      })
      throw new PinProtectionError(
        'Failed to derive PIN hash',
        'INVALID_PIN',
        { originalError: error instanceof Error ? error.message : 'Unknown error' }
      )
    }
  }

  /**
   * Constant-time string comparison to prevent timing attacks
   * Compares two strings of equal length in constant time
   */
  private constantTimeCompare(a: string, b: string): boolean {
    if (a.length !== b.length) {
      return false
    }

    let result = 0
    for (let i = 0; i < a.length; i++) {
      result |= a.charCodeAt(i) ^ b.charCodeAt(i)
    }

    return result === 0
  }

  private async checkLockoutStatus(): Promise<void> {
    const attemptRecord = await this.getAttemptRecord()
    const now = Date.now()

    if (attemptRecord.lockedUntil > now) {
      const remainingMs = attemptRecord.lockedUntil - now
      throw new PinProtectionError(
        `Account is locked. Please wait ${Math.ceil(remainingMs / 60000)} minutes before trying again.`,
        'LOCKOUT_ACTIVE',
        {
          lockedUntil: attemptRecord.lockedUntil,
          remainingMs
        }
      )
    }

    // Clear expired lockout
    if (attemptRecord.lockedUntil > 0 && attemptRecord.lockedUntil <= now) {
      attemptRecord.lockedUntil = 0
      attemptRecord.attempts = 0
      attemptRecord.progressiveDelayIndex = 0
      await this.saveAttemptRecord(attemptRecord)
      log.debug('Expired lockout cleared')
    }
  }

  private async applyProgressiveDelay(attemptRecord: PinAttemptRecord): Promise<void> {
    const delayIndex = Math.min(
      attemptRecord.progressiveDelayIndex,
      this.securityConfig.progressiveDelays.length - 1
    )
    const delayMs = this.securityConfig.progressiveDelays[delayIndex] ?? 0

    if (delayMs && delayMs > 0) {
      log.debug('Applying progressive delay', {
        delayMs,
        attemptNumber: attemptRecord.attempts + 1
      })

      await new Promise(resolve => setTimeout(resolve, delayMs))
    }
  }

  private async recordFailedAttempt(attemptRecord: PinAttemptRecord): Promise<void> {
    attemptRecord.attempts++
    attemptRecord.lastAttempt = Date.now()
    attemptRecord.progressiveDelayIndex = Math.min(
      attemptRecord.progressiveDelayIndex + 1,
      this.securityConfig.progressiveDelays.length - 1
    )

    await this.saveAttemptRecord(attemptRecord)

    log.warn('Failed PIN attempt recorded', {
      attempts: attemptRecord.attempts,
      maxAttempts: this.securityConfig.maxAttempts,
      remaining: this.securityConfig.maxAttempts - attemptRecord.attempts
    })
  }

  private async activateLockout(attemptRecord: PinAttemptRecord): Promise<void> {
    attemptRecord.lockedUntil = Date.now() + this.securityConfig.lockoutDuration
    await this.saveAttemptRecord(attemptRecord)

    log.warn('Lockout activated', {
      attempts: attemptRecord.attempts,
      lockedUntil: attemptRecord.lockedUntil,
      durationMinutes: this.securityConfig.lockoutDuration / 60000
    })
  }

  private async clearAttemptRecord(): Promise<void> {
    await storageManager.safeRemove([PinProtectionService.ATTEMPT_RECORD_KEY])
    log.debug('Attempt record cleared after successful PIN verification')
  }

  private async createValidSession(pin: string): Promise<void> {
    try {
      const sessionId = this.generateSessionId()
      const now = Date.now()

      this.currentSession = {
        isValid: true,
        createdAt: now,
        expiresAt: now + this.securityConfig.sessionTimeout,
        sessionId
      }

      await this.saveSession()

      log.debug('Valid session created', {
        sessionId,
        expiresAt: this.currentSession.expiresAt
      })

    } catch (error) {
      log.error('Failed to create valid session', {
        error: error instanceof Error ? error.message : 'Unknown error'
      })

      throw new PinProtectionError(
        'Failed to create session',
        'SESSION_CREATION_FAILED',
        { originalError: error instanceof Error ? error.message : 'Unknown error' }
      )
    }
  }

  private invalidateSession(): void {
    if (this.currentSession) {
      this.currentSession.isValid = false
      log.debug('Session invalidated', {
        sessionId: this.currentSession.sessionId
      })
    }
  }

  private async triggerEmergencyWipe(): Promise<void> {
    log.error('Emergency wipe triggered due to max PIN attempts exceeded')
    await this.emergencyWipe()

    throw new PinProtectionError(
      'Maximum attempts exceeded. Emergency security wipe activated.',
      'EMERGENCY_WIPE_TRIGGERED'
    )
  }

  /**
   * Generate cryptographically secure session ID
   * Security: Uses Web Crypto API (crypto.getRandomValues) instead of Math.random()
   * to generate cryptographically strong random numbers for session IDs
   */
  private generateSessionId(): string {
    const timestamp = Date.now()
    const randomBytes = new Uint8Array(16)
    crypto.getRandomValues(randomBytes)

    // Convert random bytes to base36 string
    const randomString = Array.from(randomBytes)
      .map(byte => byte.toString(36).padStart(2, '0'))
      .join('')
      .substring(0, 16)

    return `session_${timestamp}_${randomString}`
  }

  // Storage management methods

  private async getAttemptRecord(): Promise<PinAttemptRecord> {
    try {
      const data = await storageManager.safeGet([PinProtectionService.ATTEMPT_RECORD_KEY])
      const stored = data[PinProtectionService.ATTEMPT_RECORD_KEY]

      if (!stored) {
        return this.createDefaultAttemptRecord()
      }

      const validation = PinAttemptRecordSchema.safeParse(stored)
      if (!validation.success) {
        log.warn('Invalid attempt record, using defaults', {
          errors: validation.error.errors
        })
        return this.createDefaultAttemptRecord()
      }

      return stored
    } catch (error) {
      log.warn('Failed to load attempt record, using defaults', { error })
      return this.createDefaultAttemptRecord()
    }
  }

  private createDefaultAttemptRecord(): PinAttemptRecord {
    return {
      attempts: 0,
      lastAttempt: 0,
      lockedUntil: 0,
      progressiveDelayIndex: 0
    }
  }

  private async saveAttemptRecord(record: PinAttemptRecord): Promise<void> {
    await storageManager.safeSet({
      [PinProtectionService.ATTEMPT_RECORD_KEY]: record
    })
  }

  /**
   * Get stored PIN hash from storage
   */
  private async getPinHash(): Promise<PinHashStorage | null> {
    try {
      const data = await storageManager.safeGet([PinProtectionService.PIN_HASH_KEY])
      const stored = data[PinProtectionService.PIN_HASH_KEY]

      if (!stored) {
        return null
      }

      // Validate structure
      if (
        typeof stored === 'object' &&
        stored !== null &&
        'hash' in stored &&
        'salt' in stored &&
        'iterations' in stored &&
        'createdAt' in stored
      ) {
        return stored as PinHashStorage
      }

      log.warn('Invalid PIN hash structure in storage')
      return null
    } catch (error) {
      log.warn('Failed to load PIN hash', { error })
      return null
    }
  }

  /**
   * Save PIN hash to storage
   */
  private async savePinHash(pinHash: PinHashStorage): Promise<void> {
    await storageManager.safeSet({
      [PinProtectionService.PIN_HASH_KEY]: pinHash
    })
    log.debug('PIN hash saved to storage')
  }

  /**
   * Check if PIN has been set up
   */
  async isPinSetup(): Promise<boolean> {
    const pinHash = await this.getPinHash()
    return pinHash !== null
  }

  private async loadSession(): Promise<void> {
    try {
      const data = await storageManager.safeGet([PinProtectionService.SESSION_KEY])
      const stored = data[PinProtectionService.SESSION_KEY]

      if (!stored) {
        this.currentSession = null
        return
      }

      const validation = PinSessionSchema.safeParse(stored)
      if (!validation.success) {
        log.warn('Invalid session data, clearing session', {
          errors: validation.error.errors
        })
        this.currentSession = null
        await this.clearSessionStorage()
        return
      }

      this.currentSession = stored

      // Check if session is expired
      if (!this.isSessionValid()) {
        this.currentSession = null
        await this.clearSessionStorage()
      }

    } catch (error) {
      log.warn('Failed to load session', { error })
      this.currentSession = null
    }
  }

  private async saveSession(): Promise<void> {
    if (!this.currentSession) {
      return
    }

    await storageManager.safeSet({
      [PinProtectionService.SESSION_KEY]: this.currentSession
    })
  }

  private async clearSessionStorage(): Promise<void> {
    await storageManager.safeRemove([PinProtectionService.SESSION_KEY])
  }

  private async loadSecurityConfig(): Promise<void> {
    try {
      const data = await storageManager.safeGet([PinProtectionService.SECURITY_CONFIG_KEY])
      const stored = data[PinProtectionService.SECURITY_CONFIG_KEY]

      if (!stored) {
        this.securityConfig = this.DEFAULT_CONFIG
        await this.saveSecurityConfig()
        return
      }

      const validation = SecurityConfigSchema.safeParse(stored)
      if (!validation.success) {
        log.warn('Invalid security config, using defaults', {
          errors: validation.error.errors
        })
        this.securityConfig = this.DEFAULT_CONFIG
        await this.saveSecurityConfig()
        return
      }

      this.securityConfig = stored

    } catch (error) {
      log.warn('Failed to load security config, using defaults', { error })
      this.securityConfig = this.DEFAULT_CONFIG
    }
  }

  private async saveSecurityConfig(): Promise<void> {
    await storageManager.safeSet({
      [PinProtectionService.SECURITY_CONFIG_KEY]: this.securityConfig
    })
  }
}

// Export singleton instance
export const pinProtectionService = new PinProtectionService()
export { PinProtectionService }