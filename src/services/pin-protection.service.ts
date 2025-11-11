/**
 * PIN Protection Service (Simplified)
 *
 * Secure PIN-based authentication with essential security features:
 * - PBKDF2 PIN hashing (100k iterations, SHA-256)
 * - Max 3 attempts before emergency wipe
 * - 30-minute session timeout
 * - 1-second rate limiting between attempts
 * - Emergency PIN reset to default (today's date)
 */

import type { PinSession } from '../types/llm'
import { PinProtectionError } from '../types/llm-errors'
import { logger } from '../utils/logger'
import { storageManager } from '../utils/storage-manager'
import { getDefaultPin } from './default-pin.service'
import { encryptionService } from './encryption.service'

const log = logger.api

/**
 * PIN Hash Storage Structure
 */
interface PinHashStorage {
  hash: string // Base64-encoded hash
  salt: string // Base64-encoded salt
  iterations: number // PBKDF2 iterations
  createdAt: number // Creation timestamp
}

/**
 * PIN Attempt Tracking
 */
interface PinAttemptRecord {
  attempts: number
  lastAttempt: number
}

/**
 * Simplified PIN Protection Service
 */
class PinProtectionService {
  // Storage keys
  private static readonly PIN_HASH_KEY = 'pin_hash'
  private static readonly SESSION_KEY = 'pin_session'
  private static readonly ATTEMPT_RECORD_KEY = 'pin_attempt_record'

  // Security configuration
  private readonly PBKDF2_ITERATIONS = 100000
  private readonly PBKDF2_HASH = 'SHA-256'
  private readonly SALT_LENGTH = 32 // 256 bits
  private readonly MAX_ATTEMPTS = 3 // Simple: 3 strikes and you're out
  private readonly SESSION_TIMEOUT = 30 * 60 * 1000 // 30 minutes
  private static readonly MIN_ATTEMPT_INTERVAL = 1000 // 1 second rate limit

  private currentSession: PinSession | null = null
  private lastAttemptTime: number = 0

  constructor() {
    log.debug('PIN Protection service initialized')
    void this.initializeService()
  }

  private async initializeService(): Promise<void> {
    try {
      await this.loadSession()
      log.debug('PIN Protection service initialized', {
        sessionValid: this.currentSession?.isValid ?? false
      })
    } catch (error) {
      log.warn('Failed to initialize PIN Protection service', { error })
    }
  }

  /**
   * Setup PIN for first-time use
   */
  async setupPin(pin: string): Promise<void> {
    try {
      if (!pin || typeof pin !== 'string' || pin.length < 4) {
        throw new PinProtectionError('PIN must be at least 4 characters', 'INVALID_PIN')
      }

      log.debug('Setting up new PIN', { pinLength: pin.length })

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
      await this.createValidSession()

      log.info('PIN setup completed successfully')
    } catch (error) {
      log.error('PIN setup failed', { error })
      if (error instanceof PinProtectionError) throw error
      throw new PinProtectionError('Failed to setup PIN', 'INVALID_PIN')
    }
  }

  /**
   * Verify PIN with rate limiting and attempt tracking
   */
  async verifyPin(pin: string): Promise<void> {
    try {
      if (!pin || typeof pin !== 'string') {
        throw new PinProtectionError('PIN is required', 'PIN_REQUIRED')
      }

      log.debug('Starting PIN verification', { pinLength: pin.length })

      // Rate limiting: 1 second minimum between attempts
      const now = Date.now()
      const timeSinceLastAttempt = now - this.lastAttemptTime

      if (this.lastAttemptTime > 0 && timeSinceLastAttempt < PinProtectionService.MIN_ATTEMPT_INTERVAL) {
        const remainingMs = PinProtectionService.MIN_ATTEMPT_INTERVAL - timeSinceLastAttempt
        log.warn('Rate limit triggered', { remainingMs })
        await new Promise(resolve => setTimeout(resolve, remainingMs))
      }

      this.lastAttemptTime = Date.now()

      // Get current attempt record
      const attemptRecord = await this.getAttemptRecord()

      // Validate PIN
      const isValidPin = await this.validatePinCredentials(pin)

      if (!isValidPin) {
        // Record failed attempt
        attemptRecord.attempts++
        attemptRecord.lastAttempt = Date.now()
        await this.saveAttemptRecord(attemptRecord)

        log.warn('Failed PIN attempt', {
          attempts: attemptRecord.attempts,
          remaining: this.MAX_ATTEMPTS - attemptRecord.attempts
        })

        // Max attempts exceeded? Emergency wipe!
        if (attemptRecord.attempts >= this.MAX_ATTEMPTS) {
          await this.triggerEmergencyWipe()
          throw new PinProtectionError(
            'Maximum PIN attempts exceeded. All data has been wiped for security.',
            'MAX_ATTEMPTS_EXCEEDED'
          )
        }

        throw new PinProtectionError(
          `Incorrect PIN. ${this.MAX_ATTEMPTS - attemptRecord.attempts} attempts remaining.`,
          'INVALID_PIN',
          { attemptsRemaining: this.MAX_ATTEMPTS - attemptRecord.attempts }
        )
      }

      // Success! Clear attempts and create session
      await this.clearAttemptRecord()
      await this.createValidSession()

      log.info('PIN verification successful', {
        sessionId: this.currentSession?.sessionId
      })
    } catch (error) {
      log.error('PIN verification failed', { error })
      if (error instanceof PinProtectionError) throw error
      throw new PinProtectionError('PIN verification failed', 'INVALID_PIN')
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
      log.debug('Session expired')
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
      throw new PinProtectionError('No valid session to extend', 'SESSION_EXPIRED')
    }

    try {
      this.currentSession = {
        ...this.currentSession,
        expiresAt: Date.now() + this.SESSION_TIMEOUT
      }
      await this.saveSession()
      log.debug('Session extended', { sessionId: this.currentSession.sessionId })
    } catch (error) {
      log.error('Failed to extend session', { error })
      throw new PinProtectionError('Failed to extend session', 'SESSION_CREATION_FAILED')
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
   * Get attempt status
   */
  async getAttemptStatus(): Promise<{ attempts: number; attemptsRemaining: number }> {
    try {
      const attemptRecord = await this.getAttemptRecord()
      return {
        attempts: attemptRecord.attempts,
        attemptsRemaining: Math.max(0, this.MAX_ATTEMPTS - attemptRecord.attempts)
      }
    } catch (error) {
      log.error('Failed to get attempt status', { error })
      return {
        attempts: 0,
        attemptsRemaining: this.MAX_ATTEMPTS
      }
    }
  }

  /**
   * Change PIN (requires current PIN verification)
   */
  async changePin(currentPin: string, newPin: string): Promise<void> {
    try {
      if (!newPin || typeof newPin !== 'string' || newPin.length < 4) {
        throw new PinProtectionError('New PIN must be at least 4 characters', 'INVALID_PIN')
      }

      // Verify current PIN first
      await this.verifyPin(currentPin)

      // Hash and store new PIN
      const newPinHash = await this.hashPin(newPin)
      await this.savePinHash(newPinHash)

      // Lock session to force re-auth with new PIN
      await this.lockSession()

      log.info('PIN changed successfully')
    } catch (error) {
      log.error('PIN change failed', { error })
      if (error instanceof PinProtectionError) throw error
      throw new PinProtectionError('Failed to change PIN', 'INVALID_PIN')
    }
  }

  /**
   * Emergency wipe - clear all data and reset PIN to default
   */
  async emergencyWipe(): Promise<string> {
    try {
      log.warn('Executing emergency wipe')

      // Clear all PIN-related storage
      await storageManager.safeRemove([
        PinProtectionService.PIN_HASH_KEY,
        PinProtectionService.SESSION_KEY,
        PinProtectionService.ATTEMPT_RECORD_KEY
      ])

      // Invalidate current session
      this.invalidateSession()

      // FIX: Regenerate default PIN (today's date)
      const defaultPin = getDefaultPin()
      const pinHash = await this.hashPin(defaultPin)
      await this.savePinHash(pinHash)

      log.warn('Emergency wipe completed - PIN reset to default (today\'s date)')

      return defaultPin
    } catch (error) {
      log.error('Emergency wipe failed', { error })
      throw new PinProtectionError('Emergency wipe failed', 'EMERGENCY_WIPE_TRIGGERED')
    }
  }

  /**
   * Check if PIN has been set up
   */
  async isPinSetup(): Promise<boolean> {
    const pinHash = await this.getPinHash()
    return pinHash !== null
  }

  /**
   * Invalidate session (called by auto-unlock service)
   */
  invalidateSession(): void {
    if (this.currentSession) {
      this.currentSession.isValid = false
      log.debug('Session invalidated', { sessionId: this.currentSession.sessionId })
    }
  }

  // Private helper methods

  /**
   * Validate PIN against stored hash
   */
  private async validatePinCredentials(pin: string): Promise<boolean> {
    try {
      const storedHash = await this.getPinHash()
      if (!storedHash) {
        log.debug('No PIN hash found - first-time setup required')
        return false
      }

      // Hash provided PIN with stored salt
      const providedHashBuffer = await this.deriveHash(pin, encryptionService.base64ToArrayBuffer(storedHash.salt))
      const providedHash = encryptionService.arrayBufferToBase64(providedHashBuffer)

      // Constant-time comparison
      const isValid = this.constantTimeCompare(providedHash, storedHash.hash)

      log.debug('PIN validation completed', { isValid })
      return isValid
    } catch (error) {
      log.debug('PIN validation failed', { error })
      return false
    }
  }

  /**
   * Hash PIN using PBKDF2
   */
  private async hashPin(pin: string): Promise<PinHashStorage> {
    try {
      // Generate cryptographically secure random salt
      const saltBuffer = new Uint8Array(this.SALT_LENGTH)
      crypto.getRandomValues(saltBuffer)

      // Derive hash from PIN
      const hashBuffer = await this.deriveHash(pin, saltBuffer.buffer)

      // Convert to Base64
      const hash = encryptionService.arrayBufferToBase64(hashBuffer)
      const salt = encryptionService.arrayBufferToBase64(saltBuffer.buffer)

      log.debug('PIN hashed successfully')

      return {
        hash,
        salt,
        iterations: this.PBKDF2_ITERATIONS,
        createdAt: Date.now()
      }
    } catch (error) {
      log.error('PIN hashing failed', { error })
      throw new PinProtectionError('Failed to hash PIN', 'INVALID_PIN')
    }
  }

  /**
   * Derive hash using PBKDF2 (Web Crypto API)
   */
  private async deriveHash(pin: string, salt: ArrayBuffer): Promise<ArrayBuffer> {
    try {
      const pinBytes = new TextEncoder().encode(pin)

      const baseKey = await crypto.subtle.importKey('raw', pinBytes, 'PBKDF2', false, ['deriveBits'])

      const hashBuffer = await crypto.subtle.deriveBits(
        {
          name: 'PBKDF2',
          salt,
          iterations: this.PBKDF2_ITERATIONS,
          hash: this.PBKDF2_HASH
        },
        baseKey,
        256 // 256 bits
      )

      return hashBuffer
    } catch (error) {
      log.error('Hash derivation failed', { error })
      throw new PinProtectionError('Failed to derive PIN hash', 'INVALID_PIN')
    }
  }

  /**
   * Constant-time comparison (prevents timing attacks)
   */
  private constantTimeCompare(a: string, b: string): boolean {
    if (a.length !== b.length) return false

    let result = 0
    for (let i = 0; i < a.length; i++) {
      result |= a.charCodeAt(i) ^ b.charCodeAt(i)
    }
    return result === 0
  }

  /**
   * Create valid session
   */
  private async createValidSession(): Promise<void> {
    try {
      const sessionId = this.generateSessionId()
      const now = Date.now()

      this.currentSession = {
        isValid: true,
        createdAt: now,
        expiresAt: now + this.SESSION_TIMEOUT,
        sessionId
      }

      await this.saveSession()
      log.debug('Valid session created', { sessionId })
    } catch (error) {
      log.error('Failed to create session', { error })
      throw new PinProtectionError('Failed to create session', 'SESSION_CREATION_FAILED')
    }
  }

  /**
   * Generate cryptographically secure session ID
   */
  private generateSessionId(): string {
    const timestamp = Date.now()
    const randomBytes = new Uint8Array(16)
    crypto.getRandomValues(randomBytes)

    const randomString = Array.from(randomBytes)
      .map(byte => byte.toString(36).padStart(2, '0'))
      .join('')
      .substring(0, 16)

    return `session_${timestamp}_${randomString}`
  }

  /**
   * Trigger emergency wipe
   */
  private async triggerEmergencyWipe(): Promise<void> {
    log.error('Emergency wipe triggered - max attempts exceeded')
    const newPin = await this.emergencyWipe()
    throw new PinProtectionError(
      `Maximum attempts exceeded. Security wipe activated. Your new PIN is today's date (${newPin}).`,
      'EMERGENCY_WIPE_TRIGGERED',
      { newPin }
    )
  }

  // Storage management

  private async getAttemptRecord(): Promise<PinAttemptRecord> {
    try {
      const data = await storageManager.safeGet([PinProtectionService.ATTEMPT_RECORD_KEY])
      const stored = data[PinProtectionService.ATTEMPT_RECORD_KEY]

      if (!stored) {
        return { attempts: 0, lastAttempt: 0 }
      }

      return stored as PinAttemptRecord
    } catch (error) {
      log.warn('Failed to load attempt record', { error })
      return { attempts: 0, lastAttempt: 0 }
    }
  }

  private async saveAttemptRecord(record: PinAttemptRecord): Promise<void> {
    await storageManager.safeSet({
      [PinProtectionService.ATTEMPT_RECORD_KEY]: record
    })
  }

  private async clearAttemptRecord(): Promise<void> {
    await storageManager.safeRemove([PinProtectionService.ATTEMPT_RECORD_KEY])
    log.debug('Attempt record cleared')
  }

  private async getPinHash(): Promise<PinHashStorage | null> {
    try {
      const data = await storageManager.safeGet([PinProtectionService.PIN_HASH_KEY])
      const stored = data[PinProtectionService.PIN_HASH_KEY]

      if (!stored) return null

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

      log.warn('Invalid PIN hash structure')
      return null
    } catch (error) {
      log.warn('Failed to load PIN hash', { error })
      return null
    }
  }

  private async savePinHash(pinHash: PinHashStorage): Promise<void> {
    await storageManager.safeSet({
      [PinProtectionService.PIN_HASH_KEY]: pinHash
    })
    log.debug('PIN hash saved')
  }

  private async loadSession(): Promise<void> {
    try {
      const data = await storageManager.safeGet([PinProtectionService.SESSION_KEY])
      const stored = data[PinProtectionService.SESSION_KEY]

      if (!stored) {
        this.currentSession = null
        return
      }

      this.currentSession = stored as PinSession

      // Check if expired
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
    if (!this.currentSession) return
    await storageManager.safeSet({
      [PinProtectionService.SESSION_KEY]: this.currentSession
    })
  }

  private async clearSessionStorage(): Promise<void> {
    await storageManager.safeRemove([PinProtectionService.SESSION_KEY])
  }
}

// Export singleton instance
export const pinProtectionService = new PinProtectionService()
export { PinProtectionService }
