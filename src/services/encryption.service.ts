/**
 * Encryption Service
 *
 * Secure encryption/decryption using Web Crypto API
 * - AES-GCM encryption with 256-bit keys
 * - PBKDF2 key derivation from PIN
 * - Cryptographically secure random salt/IV generation
 */

import type { EncryptionResult, DecryptionInput } from '../types/llm'
import { EncryptionError } from '../types/llm-errors'
import { logger } from '../utils/logger'

const log = logger.api

/**
 * Encryption Service Class
 * Uses Web Crypto API for secure encryption operations
 */
class EncryptionService {
  // Encryption configuration
  private readonly ALGORITHM = 'AES-GCM'
  private readonly KEY_LENGTH = 256 // bits
  private readonly IV_LENGTH = 12 // bytes (96 bits for GCM)
  private readonly SALT_LENGTH = 32 // bytes (256 bits)
  private readonly TAG_LENGTH = 16 // bytes (128 bits for GCM)
  private readonly PBKDF2_ITERATIONS = 100000 // iterations for key derivation
  private readonly PBKDF2_HASH = 'SHA-256'

  constructor() {
    log.debug('Encryption service initialized')
    this.validateWebCryptoSupport()
  }

  /**
   * Encrypt data using PIN-derived key
   */
  async encrypt(data: string, pin: string): Promise<EncryptionResult> {
    try {
      if (!data || typeof data !== 'string') {
        throw new EncryptionError(
          'Invalid data: must be a non-empty string',
          'INVALID_INPUT'
        )
      }

      if (!pin || typeof pin !== 'string' || pin.length < 4) {
        throw new EncryptionError(
          'Invalid PIN: must be at least 4 characters',
          'INVALID_INPUT'
        )
      }

      log.debug('Starting encryption operation', {
        dataLength: data.length,
        pinLength: pin.length
      })

      // Generate cryptographically secure random values
      const salt = this.generateSecureRandom(this.SALT_LENGTH)
      const iv = this.generateSecureRandom(this.IV_LENGTH)

      // Derive key from PIN using PBKDF2
      const key = await this.deriveKey(pin, salt)

      // Convert data to bytes
      const dataBytes = new TextEncoder().encode(data)

      // Encrypt using AES-GCM
      const encryptedData = await crypto.subtle.encrypt(
        {
          name: this.ALGORITHM,
          iv,
          tagLength: this.TAG_LENGTH * 8 // Convert bytes to bits
        },
        key,
        dataBytes
      )

      log.debug('Encryption completed successfully', {
        originalSize: data.length,
        encryptedSize: encryptedData.byteLength,
        saltSize: salt.byteLength,
        ivSize: iv.byteLength
      })

      return {
        encryptedData,
        salt,
        iv
      }

    } catch (error) {
      log.error('Encryption failed', {
        error: error instanceof Error ? error.message : 'Unknown error'
      })

      if (error instanceof EncryptionError) {
        throw error
      }

      throw new EncryptionError(
        'Encryption operation failed',
        'ENCRYPTION_FAILED',
        { originalError: error instanceof Error ? error.message : 'Unknown error' }
      )
    }
  }

  /**
   * Decrypt data using PIN-derived key
   */
  async decrypt(input: DecryptionInput): Promise<string> {
    try {
      const { encryptedData, salt, iv, pin } = input

      // Validate input
      if (!encryptedData || !salt || !iv || !pin) {
        throw new EncryptionError(
          'Invalid decryption input: missing required fields',
          'INVALID_INPUT'
        )
      }

      if (typeof pin !== 'string' || pin.length < 4) {
        throw new EncryptionError(
          'Invalid PIN: must be at least 4 characters',
          'INVALID_INPUT'
        )
      }

      log.debug('Starting decryption operation', {
        encryptedSize: encryptedData.byteLength,
        saltSize: salt.byteLength,
        ivSize: iv.byteLength,
        pinLength: pin.length
      })

      // Derive key from PIN using same parameters
      const key = await this.deriveKey(pin, salt)

      // Decrypt using AES-GCM
      const decryptedBytes = await crypto.subtle.decrypt(
        {
          name: this.ALGORITHM,
          iv,
          tagLength: this.TAG_LENGTH * 8
        },
        key,
        encryptedData
      )

      // Convert bytes back to string
      const decryptedData = new TextDecoder().decode(decryptedBytes)

      log.debug('Decryption completed successfully', {
        decryptedSize: decryptedData.length
      })

      return decryptedData

    } catch (error) {
      log.error('Decryption failed', {
        error: error instanceof Error ? error.message : 'Unknown error'
      })

      if (error instanceof EncryptionError) {
        throw error
      }

      // Common decryption failures usually indicate wrong PIN
      if (error instanceof Error && error.name === 'OperationError') {
        throw new EncryptionError(
          'Decryption failed: incorrect PIN or corrupted data',
          'DECRYPTION_FAILED'
        )
      }

      throw new EncryptionError(
        'Decryption operation failed',
        'DECRYPTION_FAILED',
        { originalError: error instanceof Error ? error.message : 'Unknown error' }
      )
    }
  }

  /**
   * Derive encryption key from PIN using PBKDF2
   */
  private async deriveKey(pin: string, salt: ArrayBuffer): Promise<CryptoKey> {
    try {
      // Convert PIN to bytes
      const pinBytes = new TextEncoder().encode(pin)

      // Import PIN as base key material
      const baseKey = await crypto.subtle.importKey(
        'raw',
        pinBytes,
        'PBKDF2',
        false,
        ['deriveBits', 'deriveKey']
      )

      // Derive AES key using PBKDF2
      const derivedKey = await crypto.subtle.deriveKey(
        {
          name: 'PBKDF2',
          salt,
          iterations: this.PBKDF2_ITERATIONS,
          hash: this.PBKDF2_HASH
        },
        baseKey,
        {
          name: this.ALGORITHM,
          length: this.KEY_LENGTH
        },
        false, // Not extractable
        ['encrypt', 'decrypt']
      )

      log.debug('Key derivation completed', {
        iterations: this.PBKDF2_ITERATIONS,
        keyLength: this.KEY_LENGTH,
        saltLength: salt.byteLength
      })

      return derivedKey

    } catch (error) {
      log.error('Key derivation failed', {
        error: error instanceof Error ? error.message : 'Unknown error'
      })

      throw new EncryptionError(
        'Failed to derive encryption key from PIN',
        'KEY_DERIVATION_FAILED',
        { originalError: error instanceof Error ? error.message : 'Unknown error' }
      )
    }
  }

  /**
   * Generate cryptographically secure random bytes
   */
  private generateSecureRandom(length: number): ArrayBuffer {
    try {
      const array = new Uint8Array(length)
      crypto.getRandomValues(array)
      return array.buffer
    } catch (error) {
      log.error('Secure random generation failed', {
        length,
        error: error instanceof Error ? error.message : 'Unknown error'
      })

      throw new EncryptionError(
        'Failed to generate secure random values',
        'ENCRYPTION_FAILED',
        { originalError: error instanceof Error ? error.message : 'Unknown error' }
      )
    }
  }

  /**
   * Convert ArrayBuffer to Base64 string for storage
   */
  arrayBufferToBase64(buffer: ArrayBuffer): string {
    try {
      const bytes = new Uint8Array(buffer)
      // Use proper binary string conversion that handles all byte values correctly
      return btoa(String.fromCharCode(...bytes))
    } catch (error) {
      log.error('ArrayBuffer to Base64 conversion failed', {
        bufferSize: buffer.byteLength,
        error: error instanceof Error ? error.message : 'Unknown error'
      })

      throw new EncryptionError(
        'Failed to convert data to Base64',
        'ENCRYPTION_FAILED',
        { originalError: error instanceof Error ? error.message : 'Unknown error' }
      )
    }
  }

  /**
   * Convert Base64 string to ArrayBuffer
   */
  base64ToArrayBuffer(base64: string): ArrayBuffer {
    try {
      if (!base64 || typeof base64 !== 'string') {
        throw new Error('Invalid Base64 string')
      }

      const binary = atob(base64)
      const bytes = new Uint8Array(binary.length)
      for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i)
      }
      return bytes.buffer
    } catch (error) {
      log.error('Base64 to ArrayBuffer conversion failed', {
        base64Length: base64.length ?? 0,
        error: error instanceof Error ? error.message : 'Unknown error'
      })

      throw new EncryptionError(
        'Failed to convert Base64 to data',
        'DECRYPTION_FAILED',
        { originalError: error instanceof Error ? error.message : 'Unknown error' }
      )
    }
  }

  /**
   * Validate that Web Crypto API is available
   */
  private validateWebCryptoSupport(): void {
    if (!crypto.subtle) {
      throw new EncryptionError(
        'Web Crypto API is not supported in this environment',
        'CRYPTO_NOT_SUPPORTED'
      )
    }

    // Check for required methods
    const requiredMethods = [
      'encrypt',
      'decrypt',
      'importKey',
      'deriveKey',
      'generateKey'
    ]

    for (const method of requiredMethods) {
      if (typeof (crypto.subtle as any)[method] !== 'function') {
        throw new EncryptionError(
          `Web Crypto API method '${method}' is not supported`,
          'CRYPTO_NOT_SUPPORTED'
        )
      }
    }

    // Check for getRandomValues
    if (typeof crypto.getRandomValues !== 'function') {
      throw new EncryptionError(
        'Secure random number generation is not supported',
        'CRYPTO_NOT_SUPPORTED'
      )
    }

    log.debug('Web Crypto API support validated successfully')
  }

  /**
   * Generate a secure random PIN
   */
  generateSecurePin(length: number = 6): string {
    try {
      const digits = '0123456789'
      const randomBytes = new Uint8Array(length)
      crypto.getRandomValues(randomBytes)

      let pin = ''
      for (let i = 0; i < length; i++) {
        pin += digits[(randomBytes[i] ?? 0) % digits.length]
      }

      log.debug('Secure PIN generated', { length })
      return pin

    } catch (error) {
      log.error('Secure PIN generation failed', {
        error: error instanceof Error ? error.message : 'Unknown error'
      })

      throw new EncryptionError(
        'Failed to generate secure PIN',
        'ENCRYPTION_FAILED',
        { originalError: error instanceof Error ? error.message : 'Unknown error' }
      )
    }
  }

  /**
   * Securely compare two strings in constant time
   */
  secureCompare(a: string, b: string): boolean {
    if (a.length !== b.length) {
      return false
    }

    let result = 0
    for (let i = 0; i < a.length; i++) {
      result |= a.charCodeAt(i) ^ b.charCodeAt(i)
    }

    return result === 0
  }

  /**
   * Get encryption configuration for debugging/testing
   */
  getEncryptionConfig() {
    return {
      algorithm: this.ALGORITHM,
      keyLength: this.KEY_LENGTH,
      ivLength: this.IV_LENGTH,
      saltLength: this.SALT_LENGTH,
      tagLength: this.TAG_LENGTH,
      pbkdf2Iterations: this.PBKDF2_ITERATIONS,
      pbkdf2Hash: this.PBKDF2_HASH
    }
  }
}

// Export singleton instance
export const encryptionService = new EncryptionService()
export { EncryptionService }