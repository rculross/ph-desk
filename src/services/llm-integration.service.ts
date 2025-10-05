/**
 * LLM Integration Service
 *
 * High-level service that orchestrates all LLM-related services
 * Provides simplified API for the extension components
 */

import type { LLMProvider, ChatMessage, LLMResponse, LLMRequestOptions } from '../types/llm'
import { LLMError, PinProtectionError } from '../types/llm-errors'
import { logger } from '../utils/logger'

import { apiKeyManagerService } from './api-key-manager.service'
import { llmService } from './llm.service'
import { pinProtectionService } from './pin-protection.service'

const log = logger.api

interface LLMIntegrationOptions {
  defaultProvider?: LLMProvider
  fallbackProviders?: LLMProvider[]
  autoRetry?: boolean
  maxRetries?: number
}

/**
 * High-level LLM Integration Service
 * Orchestrates all LLM-related services with proper error handling
 * Provides simplified API for the extension components
 */
class LLMIntegrationService {
  constructor(private options: LLMIntegrationOptions = {}) {
    log.debug('LLM Integration service initialized', options)
  }

  /**
   * Send chat message with automatic key management
   */
  async chat(
    provider: LLMProvider,
    messages: ChatMessage[],
    requestOptions: LLMRequestOptions = {},
    pin?: string
  ): Promise<LLMResponse> {
    try {
      log.debug('Starting integrated LLM chat', { provider, messageCount: messages.length })

      // Get API key
      const apiKey = await apiKeyManagerService.getApiKey(provider, pin)
      if (!apiKey) {
        throw new LLMError(
          `No API key stored for provider: ${provider}`,
          'NO_API_KEY',
          provider
        )
      }

      // Make chat request
      const response = await llmService.chat(provider, messages, apiKey, requestOptions)

      log.info('Integrated LLM chat completed', {
        provider,
        model: response.model,
        tokens: response.usage.totalTokens,
        cost: this.calculateCost(response)
      })

      return response

    } catch (error) {
      log.error('Integrated LLM chat failed', {
        provider,
        error: error instanceof Error ? error.message : 'Unknown error'
      })

      // Handle specific error cases
      if (error instanceof PinProtectionError) {
        if (error.code === 'SESSION_EXPIRED') {
          throw new LLMError(
            'Session expired. Please enter your PIN to continue.',
            'SESSION_EXPIRED',
            provider
          )
        }
        throw error
      }

      if (error instanceof LLMError) {
        throw error
      }

      throw new LLMError(
        'Chat request failed',
        'REQUEST_FAILED',
        provider,
        { originalError: error instanceof Error ? error.message : 'Unknown error' }
      )
    }
  }

  /**
   * Setup new provider with API key
   */
  async setupProvider(provider: LLMProvider, apiKey: string, pin: string): Promise<void> {
    try {
      log.debug('Setting up LLM provider', { provider })

      // Validate API key by making a test request
      await this.validateApiKey(provider, apiKey)

      // Store encrypted API key
      await apiKeyManagerService.storeApiKey(provider, apiKey, pin)

      log.info('LLM provider setup completed', { provider })

    } catch (error) {
      log.error('Failed to setup LLM provider', {
        provider,
        error: error instanceof Error ? error.message : 'Unknown error'
      })

      if (error instanceof LLMError || error instanceof PinProtectionError) {
        throw error
      }

      throw new LLMError(
        'Provider setup failed',
        'SETUP_FAILED',
        provider,
        { originalError: error instanceof Error ? error.message : 'Unknown error' }
      )
    }
  }

  /**
   * Validate API key by making a test request
   */
  private async validateApiKey(provider: LLMProvider, apiKey: string): Promise<void> {
    const testMessages: ChatMessage[] = [{
      role: 'user',
      content: 'Hello, this is a test message. Please respond with "Test successful".',
      timestamp: Date.now(),
      id: `test_${Date.now()}`
    }]

    try {
      const response = await llmService.chat(provider, testMessages, apiKey, {
        maxTokens: 50,
        temperature: 0
      })

      if (!response.content || response.content.length === 0) {
        throw new Error('Empty response from provider')
      }

      log.debug('API key validation successful', {
        provider,
        responseLength: response.content.length
      })

    } catch (error) {
      log.warn('API key validation failed', {
        provider,
        error: error instanceof Error ? error.message : 'Unknown error'
      })

      throw new LLMError(
        'Invalid API key or provider configuration',
        'INVALID_API_KEY',
        provider,
        { originalError: error instanceof Error ? error.message : 'Unknown error' }
      )
    }
  }

  /**
   * Remove provider configuration
   */
  async removeProvider(provider: LLMProvider, pin: string): Promise<void> {
    try {
      await apiKeyManagerService.removeApiKey(provider, pin)
      log.info('LLM provider removed', { provider })
    } catch (error) {
      log.error('Failed to remove LLM provider', { provider, error })
      throw error
    }
  }

  /**
   * Get list of configured providers
   */
  async getConfiguredProviders(): Promise<{
    provider: LLMProvider;
    createdAt: number;
    lastUsed?: number;
    isSessionValid: boolean;
  }[]> {
    try {
      const providers = await apiKeyManagerService.listStoredProviders()
      const isSessionValid = pinProtectionService.isSessionValid()

      return providers.map(p => ({
        ...p,
        isSessionValid
      }))

    } catch (error) {
      log.error('Failed to get configured providers', { error })
      return []
    }
  }

  /**
   * Get available models for provider
   */
  getAvailableModels(provider: LLMProvider) {
    return llmService.getAvailableModels(provider)
  }

  /**
   * Estimate cost for request
   */
  estimateCost(
    provider: LLMProvider,
    inputText: string,
    estimatedOutputTokens: number,
    model?: string
  ): number {
    return llmService.calculateEstimatedCost(
      provider,
      inputText,
      estimatedOutputTokens,
      model
    )
  }

  /**
   * Calculate actual cost from response
   */
  private calculateCost(response: LLMResponse): number {
    const config = llmService.getProviderConfig(response.provider)
    const modelConfig = config.availableModels.find(m => m.modelId === response.model)

    if (!modelConfig) {
      return 0
    }

    const inputCost = (response.usage.inputTokens / 1000) * modelConfig.costPer1kTokens.input
    const outputCost = (response.usage.outputTokens / 1000) * modelConfig.costPer1kTokens.output

    return inputCost + outputCost
  }

  /**
   * Check session status
   */
  isSessionValid(): boolean {
    return pinProtectionService.isSessionValid()
  }

  /**
   * Lock session
   */
  async lockSession(): Promise<void> {
    await pinProtectionService.lockSession()
    apiKeyManagerService.clearSessionCache()
  }

  /**
   * Emergency wipe all data
   */
  async emergencyWipe(pin: string): Promise<void> {
    try {
      await apiKeyManagerService.clearAllKeys(pin)
      await pinProtectionService.emergencyWipe()

      log.warn('Emergency wipe completed - all LLM data removed')

    } catch (error) {
      log.error('Emergency wipe failed', { error })
      throw new LLMError(
        'Emergency wipe failed',
        'WIPE_FAILED',
        undefined,
        { originalError: error instanceof Error ? error.message : 'Unknown error' }
      )
    }
  }
}

// Export singleton instance
export const llmIntegrationService = new LLMIntegrationService()
export { LLMIntegrationService }