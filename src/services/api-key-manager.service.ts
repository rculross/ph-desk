/**
 * API Key Manager Service
 *
 * Manages encrypted storage of LLM provider API keys
 * Integrates with existing storage and security patterns
 */

import { ApiKeyStorageSchema } from '../schemas/llm-schemas'
import type { LLMProvider, ApiKeyEntry, ApiKeyStorage } from '../types/llm'
import { LLMError, EncryptionError, PinProtectionError } from '../types/llm-errors'
import { logger } from '../utils/logger'
import { storageManager } from '../utils/storage-manager'

import { encryptionService } from './encryption.service'
import { pinProtectionService } from './pin-protection.service'

const log = logger.api

/**
 * API Key Manager Service
 * Manages encrypted storage of LLM provider API keys
 * Integrates with existing storage and security patterns
 */
class ApiKeyManagerService {
  private static readonly STORAGE_KEY = 'llm_api_keys'
  private cachedKeys: Map<LLMProvider, string> = new Map()

  constructor() {
    log.debug('API Key Manager service initialized')
  }

  /**
   * Validate API key integrity after encryption/decryption roundtrip
   */
  async validateKeyIntegrity(provider: LLMProvider, apiKey: string, pin: string): Promise<boolean> {
    try {
      log.debug('Validating API key integrity', { provider, keyLength: apiKey.length })

      // Encrypt the API key
      const encryptionResult = await encryptionService.encrypt(apiKey, pin)

      // Convert to Base64 for storage (like we do in storeApiKey)
      const encryptedBase64 = encryptionService.arrayBufferToBase64(encryptionResult.encryptedData)
      const saltBase64 = encryptionService.arrayBufferToBase64(encryptionResult.salt)
      const ivBase64 = encryptionService.arrayBufferToBase64(encryptionResult.iv)

      // Convert back from Base64 (like we do in getApiKey)
      const encryptedData = encryptionService.base64ToArrayBuffer(encryptedBase64)
      const salt = encryptionService.base64ToArrayBuffer(saltBase64)
      const iv = encryptionService.base64ToArrayBuffer(ivBase64)

      // Decrypt
      const decryptedKey = await encryptionService.decrypt({
        encryptedData,
        salt,
        iv,
        pin
      })

      // Compare with original
      const isValid = decryptedKey === apiKey

      if (!isValid) {
        log.error('API key integrity check FAILED', {
          provider,
          originalLength: apiKey.length,
          decryptedLength: decryptedKey.length || 0,
          originalPrefix: apiKey.slice(0, 15),
          decryptedPrefix: decryptedKey.slice(0, 15) || 'NULL',
          base64Lengths: {
            encrypted: encryptedBase64.length,
            salt: saltBase64.length,
            iv: ivBase64.length
          }
        })
      } else {
        log.info('API key integrity check PASSED', { provider })
      }

      return isValid
    } catch (error) {
      log.error('API key integrity validation failed', {
        provider,
        error: error instanceof Error ? error.message : 'Unknown error'
      })
      return false
    }
  }

  /**
   * Store encrypted API key for provider
   */
  async storeApiKey(provider: LLMProvider, apiKey: string, pin: string): Promise<void> {
    try {
      log.debug('Storing API key', { provider })

      // Verify PIN first
      await pinProtectionService.verifyPin(pin)

      // Validate key integrity before storing
      const integrityCheck = await this.validateKeyIntegrity(provider, apiKey, pin)
      if (!integrityCheck) {
        throw new LLMError(
          'API key failed integrity check - encryption/decryption corrupted the key',
          'STORAGE_VALIDATION_FAILED',
          provider
        )
      }

      // Encrypt the API key
      const encryptionResult = await encryptionService.encrypt(apiKey, pin)

      // Convert to base64 for storage
      const entry: ApiKeyEntry = {
        provider,
        encryptedKey: encryptionService.arrayBufferToBase64(encryptionResult.encryptedData),
        salt: encryptionService.arrayBufferToBase64(encryptionResult.salt),
        iv: encryptionService.arrayBufferToBase64(encryptionResult.iv),
        createdAt: Date.now()
      }

      // Load existing storage
      const existingStorage = await this.loadApiKeyStorage()

      // Update with new key
      existingStorage.keys[provider] = entry

      // Validate before storing
      const validation = ApiKeyStorageSchema.safeParse(existingStorage)
      if (!validation.success) {
        throw new LLMError(
          'Invalid API key storage format',
          'STORAGE_VALIDATION_FAILED',
          provider,
          { validationErrors: validation.error.errors }
        )
      }

      // Store encrypted data
      await storageManager.safeSet({
        [ApiKeyManagerService.STORAGE_KEY]: existingStorage
      })

      // Cache decrypted key for session
      this.cachedKeys.set(provider, apiKey)

      log.info('API key stored successfully', {
        provider,
        encryptedSize: entry.encryptedKey.length
      })

    } catch (error) {
      log.error('Failed to store API key', {
        provider,
        error: error instanceof Error ? error.message : 'Unknown error'
      })

      if (error instanceof EncryptionError || error instanceof PinProtectionError) {
        throw error
      }

      throw new LLMError(
        'Failed to store API key',
        'STORAGE_FAILED',
        provider,
        { originalError: error instanceof Error ? error.message : 'Unknown error' }
      )
    }
  }

  /**
   * Retrieve and decrypt API key for provider
   */
  async getApiKey(provider: LLMProvider, pin?: string): Promise<string | null> {
    try {
      // Check session cache first if no PIN provided
      if (!pin && pinProtectionService.isSessionValid()) {
        const cached = this.cachedKeys.get(provider)
        if (cached) {
          log.debug('API key retrieved from session cache', { provider })
          return cached
        }
      }

      // PIN required for decryption
      if (!pin) {
        throw new PinProtectionError(
          'PIN required to access API keys',
          'SESSION_EXPIRED'
        )
      }

      // Verify PIN
      await pinProtectionService.verifyPin(pin)

      // Load storage
      const storage = await this.loadApiKeyStorage()
      const entry = storage.keys[provider]

      if (!entry) {
        log.debug('No API key found for provider', { provider })
        return null
      }

      // Convert from base64
      const decryptionInput = {
        encryptedData: encryptionService.base64ToArrayBuffer(entry.encryptedKey),
        salt: encryptionService.base64ToArrayBuffer(entry.salt),
        iv: encryptionService.base64ToArrayBuffer(entry.iv),
        pin
      }

      // Decrypt
      const apiKey = await encryptionService.decrypt(decryptionInput)

      // Update last used timestamp
      entry.lastUsed = Date.now()
      await storageManager.safeSet({
        [ApiKeyManagerService.STORAGE_KEY]: storage
      })

      // Cache for session
      this.cachedKeys.set(provider, apiKey)

      log.debug('API key retrieved and decrypted', {
        provider,
        lastUsed: entry.lastUsed
      })

      return apiKey

    } catch (error) {
      log.error('Failed to retrieve API key', {
        provider,
        error: error instanceof Error ? error.message : 'Unknown error'
      })

      if (error instanceof EncryptionError || error instanceof PinProtectionError) {
        throw error
      }

      throw new LLMError(
        'Failed to retrieve API key',
        'DECRYPTION_FAILED',
        provider,
        { originalError: error instanceof Error ? error.message : 'Unknown error' }
      )
    }
  }

  /**
   * Remove API key for provider
   */
  async removeApiKey(provider: LLMProvider, pin: string): Promise<void> {
    try {
      log.debug('Removing API key', { provider })

      // Verify PIN
      await pinProtectionService.verifyPin(pin)

      // Load storage
      const storage = await this.loadApiKeyStorage()

      // Remove key
      delete storage.keys[provider]

      // Store updated data
      await storageManager.safeSet({
        [ApiKeyManagerService.STORAGE_KEY]: storage
      })

      // Remove from cache
      this.cachedKeys.delete(provider)

      log.info('API key removed successfully', { provider })

    } catch (error) {
      log.error('Failed to remove API key', {
        provider,
        error: error instanceof Error ? error.message : 'Unknown error'
      })

      if (error instanceof PinProtectionError) {
        throw error
      }

      throw new LLMError(
        'Failed to remove API key',
        'REMOVAL_FAILED',
        provider,
        { originalError: error instanceof Error ? error.message : 'Unknown error' }
      )
    }
  }

  /**
   * List stored API key providers (without keys)
   */
  async listStoredProviders(): Promise<{
    provider: LLMProvider;
    createdAt: number;
    lastUsed?: number;
  }[]> {
    try {
      const storage = await this.loadApiKeyStorage()

      return Object.values(storage.keys).map(entry => ({
        provider: entry.provider,
        createdAt: entry.createdAt,
        lastUsed: entry.lastUsed
      }))

    } catch (error) {
      log.error('Failed to list stored providers', { error })
      return []
    }
  }

  /**
   * Check if API key exists for provider
   */
  async hasApiKey(provider: LLMProvider): Promise<boolean> {
    try {
      const storage = await this.loadApiKeyStorage()
      return provider in storage.keys
    } catch (error) {
      log.error('Failed to check API key existence', { provider, error })
      return false
    }
  }

  /**
   * Clear all API keys (emergency)
   */
  async clearAllKeys(pin: string): Promise<void> {
    try {
      log.warn('Clearing all API keys')

      // Verify PIN
      await pinProtectionService.verifyPin(pin)

      // Clear storage
      await storageManager.safeRemove([ApiKeyManagerService.STORAGE_KEY])

      // Clear cache
      this.cachedKeys.clear()

      log.warn('All API keys cleared successfully')

    } catch (error) {
      log.error('Failed to clear API keys', { error })

      if (error instanceof PinProtectionError) {
        throw error
      }

      throw new LLMError(
        'Failed to clear API keys',
        'CLEAR_FAILED',
        undefined,
        { originalError: error instanceof Error ? error.message : 'Unknown error' }
      )
    }
  }

  /**
   * Clear session cache
   */
  clearSessionCache(): void {
    this.cachedKeys.clear()
    log.debug('Session cache cleared')
  }

  /**
   * Load API key storage with default values
   */
  private async loadApiKeyStorage(): Promise<ApiKeyStorage> {
    try {
      const data = await storageManager.safeGet([ApiKeyManagerService.STORAGE_KEY])
      const stored = data[ApiKeyManagerService.STORAGE_KEY]

      if (!stored) {
        return this.createDefaultStorage()
      }

      // Validate stored data
      const validation = ApiKeyStorageSchema.safeParse(stored)
      if (!validation.success) {
        log.warn('Invalid stored API key data, using defaults', {
          errors: validation.error.errors
        })
        return this.createDefaultStorage()
      }

      return stored

    } catch (error) {
      log.warn('Failed to load API key storage, using defaults', { error })
      return this.createDefaultStorage()
    }
  }

  /**
   * Create default storage structure
   */
  private createDefaultStorage(): ApiKeyStorage {
    return {
      keys: {} as Record<LLMProvider, ApiKeyEntry>,
      securityConfig: {
        maxAttempts: 5,
        lockoutDuration: 15 * 60 * 1000,
        sessionTimeout: 30 * 60 * 1000,
        progressiveDelays: [1000, 2000, 4000, 8000, 16000]
      }
    }
  }
}

// Export singleton instance
export const apiKeyManagerService = new ApiKeyManagerService()
export { ApiKeyManagerService }