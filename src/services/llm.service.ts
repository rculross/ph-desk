/**
 * LLM Service
 *
 * Core service for LLM API integration
 * - Extends existing HttpClient infrastructure
 * - Supports Claude, OpenAI, and Gemini APIs
 * - Uses existing rate limiting and logging
 * - Handles streaming responses and token counting
 */

import { HttpClient } from '../api/client/http-client'
import {
  LLMResponseSchema,
  LLMStreamResponseSchema,
  ChatMessageSchema,
  LLMRequestOptionsSchema
} from '../schemas/llm-schemas'
import type {
  LLMProvider,
  LLMProviderConfig,
  LLMModel,
  ChatMessage,
  LLMResponse,
  LLMStreamResponse,
  LLMRequestOptions
} from '../types/llm'
import { LLMError } from '../types/llm-errors'
import { logger } from '../utils/logger'
import { parseSecureJson } from '../utils/secure-json'

const log = logger.api

/**
 * LLM Service Class
 * Handles all LLM provider API interactions
 */
class LLMService {
  private httpClients: Map<LLMProvider, HttpClient> = new Map()
  private providerConfigs: Map<LLMProvider, LLMProviderConfig> = new Map()

  constructor() {
    log.debug('LLM service initialized')
    this.initializeProviders()
  }

  /**
   * Initialize provider configurations
   */
  private initializeProviders(): void {
    // Claude (Anthropic) configuration
    const claudeConfig: LLMProviderConfig = {
      provider: 'claude',
      baseURL: 'https://api.anthropic.com/v1',
      authHeader: 'x-api-key',
      maxTokens: 200000,
      rateLimits: {
        requestsPerMinute: 40,
        requestsPerSecond: 2,
        maxConcurrent: 3
      },
      availableModels: [
        {
          modelId: 'claude-3-5-sonnet-20241022',
          displayName: 'Claude 3.5 Sonnet',
          description: 'Most intelligent model with enhanced reasoning',
          maxTokens: 200000,
          costPer1kTokens: { input: 0.003, output: 0.015 },
          capabilities: { streaming: true, vision: true, functionCalling: true }
        },
        {
          modelId: 'claude-3-5-haiku-20241022',
          displayName: 'Claude 3.5 Haiku',
          description: 'Fastest model for simple tasks',
          maxTokens: 200000,
          costPer1kTokens: { input: 0.0008, output: 0.004 },
          capabilities: { streaming: true, vision: true, functionCalling: true }
        },
        {
          modelId: 'claude-3-opus-20240229',
          displayName: 'Claude 3 Opus',
          description: 'Most powerful model for complex tasks',
          maxTokens: 200000,
          costPer1kTokens: { input: 0.015, output: 0.075 },
          capabilities: { streaming: true, vision: true, functionCalling: true }
        }
      ]
    }

    // OpenAI configuration
    const openaiConfig: LLMProviderConfig = {
      provider: 'openai',
      baseURL: 'https://api.openai.com/v1',
      authHeader: 'authorization',
      maxTokens: 128000,
      rateLimits: {
        requestsPerMinute: 60,
        requestsPerSecond: 3,
        maxConcurrent: 5
      },
      availableModels: [
        {
          modelId: 'gpt-4o',
          displayName: 'GPT-4o',
          description: 'Most advanced GPT-4 model with vision',
          maxTokens: 128000,
          costPer1kTokens: { input: 0.005, output: 0.015 },
          capabilities: { streaming: true, vision: true, functionCalling: true }
        },
        {
          modelId: 'gpt-4o-mini',
          displayName: 'GPT-4o Mini',
          description: 'Fast and cost-effective model',
          maxTokens: 128000,
          costPer1kTokens: { input: 0.00015, output: 0.0006 },
          capabilities: { streaming: true, vision: true, functionCalling: true }
        },
        {
          modelId: 'gpt-4-turbo',
          displayName: 'GPT-4 Turbo',
          description: 'Previous generation flagship model',
          maxTokens: 128000,
          costPer1kTokens: { input: 0.01, output: 0.03 },
          capabilities: { streaming: true, vision: true, functionCalling: true }
        }
      ]
    }

    // Gemini configuration
    const geminiConfig: LLMProviderConfig = {
      provider: 'gemini',
      baseURL: 'https://generativelanguage.googleapis.com/v1beta',
      authHeader: 'x-goog-api-key',
      maxTokens: 1048576,
      rateLimits: {
        requestsPerMinute: 60,
        requestsPerSecond: 2,
        maxConcurrent: 4
      },
      availableModels: [
        {
          modelId: 'gemini-1.5-pro',
          displayName: 'Gemini 1.5 Pro',
          description: 'Advanced model with large context window',
          maxTokens: 1048576,
          costPer1kTokens: { input: 0.00125, output: 0.005 },
          capabilities: { streaming: true, vision: true, functionCalling: true }
        },
        {
          modelId: 'gemini-1.5-flash',
          displayName: 'Gemini 1.5 Flash',
          description: 'Fast model for simple tasks',
          maxTokens: 1048576,
          costPer1kTokens: { input: 0.000075, output: 0.0003 },
          capabilities: { streaming: true, vision: true, functionCalling: true }
        }
      ]
    }

    // Store configurations
    this.providerConfigs.set('claude', claudeConfig)
    this.providerConfigs.set('openai', openaiConfig)
    this.providerConfigs.set('gemini', geminiConfig)

    log.debug('Provider configurations initialized', {
      providers: Array.from(this.providerConfigs.keys()),
      totalModels: Array.from(this.providerConfigs.values())
        .reduce((sum, config) => sum + config.availableModels.length, 0)
    })
  }

  /**
   * Send chat request to LLM provider
   */
  async chat(
    provider: LLMProvider,
    messages: ChatMessage[],
    apiKey: string,
    options: LLMRequestOptions = {}
  ): Promise<LLMResponse> {
    try {
      // Validate inputs
      this.validateChatRequest(provider, messages, apiKey, options)

      const config = this.getProviderConfig(provider)
      const selectedModel = options.model || config.availableModels[0]?.modelId || 'default'

      log.debug('Starting LLM chat request', {
        provider,
        model: selectedModel,
        messageCount: messages.length,
        streaming: options.stream || false
      })

      // Get HTTP client for provider
      const httpClient = this.getHttpClient(provider, apiKey, config)

      // Build request payload
      const requestPayload = this.buildRequestPayload(provider, messages, selectedModel, options)

      // Make API request
      const startTime = Date.now()
      const response = await this.makeApiRequest(httpClient, provider, requestPayload, apiKey)
      const duration = Date.now() - startTime

      // Parse and validate response
      const parsedResponse = this.parseResponse(provider, response, selectedModel, duration)

      log.info('LLM chat completed successfully', {
        provider,
        model: selectedModel,
        duration,
        inputTokens: parsedResponse.usage.inputTokens,
        outputTokens: parsedResponse.usage.outputTokens,
        totalTokens: parsedResponse.usage.totalTokens,
        estimatedCost: this.calculateCost(config, selectedModel, parsedResponse.usage)
      })

      return parsedResponse

    } catch (error) {
      log.error('LLM chat request failed', {
        provider,
        error: error instanceof Error ? error.message : 'Unknown error'
      })

      if (error instanceof LLMError) {
        throw error
      }

      throw this.handleApiError(error, provider, options.model)
    }
  }

  /**
   * Get available models for provider
   */
  getAvailableModels(provider: LLMProvider): LLMModel[] {
    const config = this.providerConfigs.get(provider)
    if (!config) {
      throw new LLMError(
        `Unknown provider: ${provider}`,
        'MODEL_NOT_AVAILABLE',
        provider
      )
    }

    return [...config.availableModels]
  }

  /**
   * Get provider configuration
   */
  getProviderConfig(provider: LLMProvider): LLMProviderConfig {
    const config = this.providerConfigs.get(provider)
    if (!config) {
      throw new LLMError(
        `Unknown provider: ${provider}`,
        'MODEL_NOT_AVAILABLE',
        provider
      )
    }

    return config
  }

  /**
   * Fetch available models from provider API
   */
  async fetchAvailableModels(provider: LLMProvider, apiKey: string): Promise<LLMModel[]> {
    const config = this.getProviderConfig(provider)

    try {
      log.debug('Fetching available models from provider', { provider })
      const httpClient = this.getHttpClient(provider, apiKey, config)

      let response: unknown

      switch (provider) {
        case 'claude':
          response = await httpClient.get('/models', {
            headers: {
              [config.authHeader]: apiKey.trim(),
              'anthropic-version': '2023-06-01',
              'anthropic-dangerous-direct-browser-access': 'true'
            },
            metadata: { priority: 'normal', complexity: 'simple' }
          })
          break
        case 'openai':
          response = await httpClient.get('/models', {
            headers: {
              [config.authHeader]: `Bearer ${apiKey.trim()}`
            },
            metadata: { priority: 'normal', complexity: 'simple' }
          })
          break
        case 'gemini':
          // Gemini doesn't have a models endpoint, use static list
          return config.availableModels
        default:
          throw new LLMError(`Unsupported provider: ${provider}`, 'MODEL_NOT_AVAILABLE', provider)
      }

      // Parse provider-specific response and map to our model format
      const fetchedModels = this.parseModelsResponse(provider, response, config)

      log.info('Successfully fetched models from provider', {
        provider,
        modelCount: fetchedModels.length,
        models: fetchedModels.map(m => m.modelId)
      })

      return fetchedModels

    } catch (error) {
      log.warn('Failed to fetch models from provider API, using static list', {
        provider,
        error: error instanceof Error ? error.message : 'Unknown error'
      })

      // Fallback to static models if API call fails
      return config.availableModels
    }
  }

  /**
   * Parse models response from provider API
   */
  private parseModelsResponse(provider: LLMProvider, response: unknown, config: LLMProviderConfig): LLMModel[] {
    try {
      const responseData = response as { data?: unknown[] }

      switch (provider) {
        case 'claude':
          // Parse Anthropic's /v1/models response
          const claudeModels = Array.isArray(responseData.data) ? responseData.data : []
          return claudeModels
            .filter((model: unknown): model is { type: string; id: string; display_name?: string } => {
              return typeof model === 'object' && model !== null && 'type' in model && (model as { type: unknown }).type === 'model'
            })
            .map(model => {
              // Try to find matching model in our static config for pricing/capabilities
              const staticModel = config.availableModels.find(m => m.modelId === model.id)

              return {
                modelId: model.id,
                displayName: model.display_name ?? staticModel?.displayName ?? model.id,
                description: staticModel?.description ?? 'Claude model',
                maxTokens: staticModel?.maxTokens ?? 200000,
                costPer1kTokens: staticModel?.costPer1kTokens ?? { input: 0.003, output: 0.015 },
                capabilities: staticModel?.capabilities ?? { streaming: true, vision: true, functionCalling: true }
              }
            })

        case 'openai':
          // Parse OpenAI's /v1/models response
          const openaiModels = Array.isArray(responseData.data) ? responseData.data : []
          return openaiModels
            .filter((model: unknown): model is { id: string } => {
              return typeof model === 'object' && model !== null && 'id' in model && typeof (model as { id: unknown }).id === 'string' && (model as { id: string }).id.includes('gpt')
            })
            .map(model => {
              const staticModel = config.availableModels.find(m => m.modelId === model.id)

              return {
                modelId: model.id,
                displayName: staticModel?.displayName ?? model.id,
                description: staticModel?.description ?? 'OpenAI model',
                maxTokens: staticModel?.maxTokens ?? 4000,
                costPer1kTokens: staticModel?.costPer1kTokens ?? { input: 0.001, output: 0.002 },
                capabilities: staticModel?.capabilities ?? { streaming: true, vision: false, functionCalling: true }
              }
            })

        default:
          return config.availableModels
      }
    } catch (error) {
      log.warn('Failed to parse models response, using static list', { provider, error })
      return config.availableModels
    }
  }

  /**
   * Test connection to provider
   */
  async testConnection(provider: LLMProvider, apiKey: string): Promise<{ success: boolean; message: string; model?: string }> {
    try {
      log.debug('Testing connection to LLM provider', { provider })

      // Validate inputs
      if (!provider || !this.providerConfigs.has(provider)) {
        return {
          success: false,
          message: `Invalid provider: ${provider}`
        }
      }

      if (!apiKey || typeof apiKey !== 'string') {
        return {
          success: false,
          message: 'API key is required'
        }
      }

      const config = this.getProviderConfig(provider)
      const testModel = config.availableModels[0] // Use first available model for testing

      if (!testModel) {
        return {
          success: false,
          message: `No models available for ${provider}`
        }
      }

      // Create a simple test message
      const testMessages: ChatMessage[] = [
        {
          id: `test_${Date.now()}`,
          role: 'user',
          content: 'Hello',
          timestamp: Date.now()
        }
      ]

      // Set up HTTP client with API key
      const httpClient = this.getHttpClient(provider, apiKey, config)

      // Test with minimal options
      const testOptions: LLMRequestOptions = {
        model: testModel.modelId,
        maxTokens: 10, // Minimal response to keep test fast and cheap
        temperature: 0.1,
        stream: false
      }

      // Make a test request
      const response = await this.chat(provider, testMessages, apiKey, testOptions)

      if (response && response.content) {
        log.info('LLM connection test successful', {
          provider,
          model: testModel.modelId,
          responseLength: response.content.length,
          usage: response.usage
        })

        return {
          success: true,
          message: `Successfully connected to ${config.availableModels.find(m => m.modelId === testModel.modelId)?.displayName || testModel.modelId}`,
          model: testModel.displayName
        }
      } else {
        return {
          success: false,
          message: 'Received empty response from provider'
        }
      }

    } catch (error) {
      log.error('LLM connection test failed', {
        provider,
        error: error instanceof Error ? error.message : 'Unknown error'
      })

      if (error instanceof LLMError) {
        // Map specific error types to user-friendly messages
        switch (error.code) {
          case 'INVALID_API_KEY':
            return {
              success: false,
              message: 'Invalid API key. Please check your API key and try again.'
            }
          case 'RATE_LIMITED':
            return {
              success: false,
              message: 'Rate limit exceeded. Please wait a moment and try again.'
            }
          case 'QUOTA_EXCEEDED':
            return {
              success: false,
              message: 'Quota exceeded or insufficient credits. Please check your account.'
            }
          case 'MODEL_NOT_AVAILABLE':
            return {
              success: false,
              message: 'Model not available. Please check your subscription plan.'
            }
          case 'NETWORK_ERROR':
            return {
              success: false,
              message: 'Network error. Please check your internet connection.'
            }
          default:
            return {
              success: false,
              message: error.message || 'Connection failed'
            }
        }
      }

      return {
        success: false,
        message: error instanceof Error ? error.message : 'Connection test failed'
      }
    }
  }

  /**
   * Calculate estimated cost for request
   */
  calculateEstimatedCost(
    provider: LLMProvider,
    inputText: string,
    estimatedOutputTokens: number,
    model?: string
  ): number {
    try {
      const config = this.getProviderConfig(provider)
      const selectedModel = model || config.availableModels[0]?.modelId || 'default'
      const modelConfig = config.availableModels.find(m => m.modelId === selectedModel)

      if (!modelConfig) {
        return 0
      }

      // Rough token estimation (1 token ≈ 4 characters)
      const estimatedInputTokens = Math.ceil(inputText.length / 4)

      const inputCost = (estimatedInputTokens / 1000) * modelConfig.costPer1kTokens.input
      const outputCost = (estimatedOutputTokens / 1000) * modelConfig.costPer1kTokens.output

      return inputCost + outputCost

    } catch (error) {
      log.warn('Failed to calculate estimated cost', {
        provider,
        model,
        error: error instanceof Error ? error.message : 'Unknown error'
      })
      return 0
    }
  }

  /**
   * Get or create HTTP client for provider
   */
  private getHttpClient(provider: LLMProvider, apiKey: string, config: LLMProviderConfig): HttpClient {
    const cacheKey = `${provider}_${apiKey.slice(-8)}` // Use last 8 chars for caching

    let client = this.httpClients.get(provider)
    if (!client) {
      client = new HttpClient({
        baseURL: config.baseURL,
        enableRateLimit: true,
        timeout: 60000, // 60 second timeout for LLM requests
        context: `llm_${provider}`,
        withCredentials: false // CRITICAL: Disable credentials for LLM APIs
      })

      this.httpClients.set(provider, client)
    }

    return client
  }

  /**
   * Build request payload for provider
   */
  private buildRequestPayload(
    provider: LLMProvider,
    messages: ChatMessage[],
    model: string,
    options: LLMRequestOptions
  ): Record<string, unknown> {
    const config = this.getProviderConfig(provider)

    switch (provider) {
      case 'claude':
        return this.buildClaudePayload(messages, model, options, config)
      case 'openai':
        return this.buildOpenAIPayload(messages, model, options, config)
      case 'gemini':
        return this.buildGeminiPayload(messages, model, options, config)
      default:
        throw new LLMError(
          `Unsupported provider: ${provider}`,
          'MODEL_NOT_AVAILABLE',
          provider
        )
    }
  }

  private buildClaudePayload(
    messages: ChatMessage[],
    model: string,
    options: LLMRequestOptions,
    config: LLMProviderConfig
  ): Record<string, unknown> {
    // Convert messages to Claude format
    const claudeMessages = messages
      .filter(m => m.role !== 'system')
      .map(m => ({
        role: m.role,
        content: m.content
      }))

    // Extract system prompt
    const systemMessage = messages.find(m => m.role === 'system')

    return {
      model,
      max_tokens: Math.min(options.maxTokens || 4000, config.maxTokens),
      messages: claudeMessages,
      ...(systemMessage && { system: systemMessage.content }),
      ...(options.temperature !== undefined && { temperature: options.temperature }),
      ...(options.stream && { stream: true })
    }
  }

  private buildOpenAIPayload(
    messages: ChatMessage[],
    model: string,
    options: LLMRequestOptions,
    config: LLMProviderConfig
  ): Record<string, unknown> {
    const openAIMessages = messages.map(m => ({
      role: m.role,
      content: m.content
    }))

    return {
      model,
      messages: openAIMessages,
      max_tokens: Math.min(options.maxTokens || 4000, config.maxTokens),
      ...(options.temperature !== undefined && { temperature: options.temperature }),
      ...(options.stream && { stream: true })
    }
  }

  private buildGeminiPayload(
    messages: ChatMessage[],
    model: string,
    options: LLMRequestOptions,
    config: LLMProviderConfig
  ): Record<string, unknown> {
    // Gemini uses a different format - convert messages to parts
    const contents = messages
      .filter(m => m.role !== 'system')
      .map(m => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }]
      }))

    const systemMessage = messages.find(m => m.role === 'system')

    return {
      contents,
      ...(systemMessage && { systemInstruction: { parts: [{ text: systemMessage.content }] } }),
      generationConfig: {
        maxOutputTokens: Math.min(options.maxTokens || 4000, config.maxTokens),
        ...(options.temperature !== undefined && { temperature: options.temperature })
      }
    }
  }

  /**
   * Make API request to provider
   */
  private async makeApiRequest(
    httpClient: HttpClient,
    provider: LLMProvider,
    payload: Record<string, unknown>,
    apiKey: string
  ): Promise<unknown> {
    const config = this.getProviderConfig(provider)

    // Clean the API key to remove any whitespace
    const cleanApiKey = apiKey.trim()

    // Set appropriate headers
    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    }

    switch (provider) {
      case 'claude':
        headers[config.authHeader] = cleanApiKey
        headers['anthropic-version'] = '2023-06-01'
        headers['anthropic-dangerous-direct-browser-access'] = 'true'
        break
      case 'openai':
        headers[config.authHeader] = `Bearer ${cleanApiKey}`
        break
      case 'gemini':
        // Gemini uses query parameter for API key
        break
    }

    // Determine endpoint
    let endpoint = ''
    switch (provider) {
      case 'claude':
        endpoint = '/messages'
        break
      case 'openai':
        endpoint = '/chat/completions'
        break
      case 'gemini':
        endpoint = `/models/${payload.model}:generateContent`
        break
    }

    try {
      log.debug('🔍 DETAILED API REQUEST DEBUG', {
        provider,
        endpoint,
        baseURL: config.baseURL,
        fullURL: `${config.baseURL}${endpoint}`,
        authHeaderName: config.authHeader,

        // API Key Analysis
        apiKeyAnalysis: {
          originalKey: `"${apiKey}"`, // Show exact key with quotes to see whitespace
          cleanedKey: `"${cleanApiKey}"`, // Show cleaned key
          keyLength: cleanApiKey.length,
          originalLength: apiKey.length,
          keyPrefix: cleanApiKey.slice(0, 20),
          wasKeyTrimmed: cleanApiKey !== apiKey,
          hasWhitespace: /\s/.test(apiKey),
          startsWithCorrectPrefix: cleanApiKey.startsWith('sk-ant-api03-'),
          // TEMPORARY DEBUG: Show full key for debugging
          FULL_API_KEY_DEBUG: cleanApiKey
        },

        // Headers Analysis
        headerAnalysis: {
          allHeaders: headers,
          authHeaderSet: !!headers[config.authHeader],
          authHeaderValue: headers[config.authHeader] || 'NOT SET',
          contentType: headers['Content-Type'],
          anthropicVersion: headers['anthropic-version']
        },

        // Request payload
        requestPayload: {
          model: payload.model,
          max_tokens: payload.max_tokens,
          messageCount: payload.messages?.length || 0,
          hasSystemMessage: !!payload.system,
          fullPayload: payload
        }
      })

      // Log exact request being sent
      log.debug('🚀 MAKING ACTUAL REQUEST', {
        endpoint,
        method: 'POST',
        baseURL: config.baseURL,
        fullUrl: `${config.baseURL}${endpoint}`,
        requestHeaders: headers,
        requestPayload: payload,
        requestMetadata: {
          priority: 'normal',
          complexity: 'moderate'
        }
      })

      const response = await httpClient.post(endpoint, payload, {
        headers,
        metadata: {
          priority: 'normal',
          complexity: 'moderate'
        }
      })

      log.debug('Claude API response received', {
        provider,
        status: 'success',
        hasContent: !!response?.content,
        contentLength: response?.content?.[0]?.text?.length || 0,
        usage: response?.usage
      })

      return response

    } catch (error) {
      log.error('🚨 DETAILED API ERROR DEBUG', {
        provider,
        endpoint,
        error: error instanceof Error ? error.message : 'Unknown error',

        // HTTP Response Details
        httpErrorDetails: {
          status: (error as any)?.response?.status,
          statusText: (error as any)?.response?.statusText,
          responseData: (error as any)?.response?.data,
          responseHeaders: (error as any)?.response?.headers,
          requestConfig: {
            url: (error as any)?.config?.url,
            method: (error as any)?.config?.method,
            headers: (error as any)?.config?.headers,
            data: (error as any)?.config?.data
          }
        },

        // Request Details that were sent
        sentRequest: {
          fullURL: `${config.baseURL}${endpoint}`,
          method: 'POST',
          headers,
          payload,
          authHeaderName: config.authHeader,
          authHeaderValue: headers[config.authHeader]
        },

        // Error Object Analysis
        errorAnalysis: {
          errorType: (error as any)?.constructor?.name || 'Unknown',
          errorCode: (error as any)?.code,
          errorMessage: (error as any)?.message,
          isNetworkError: (error as any)?.code === 'ENOTFOUND' || (error as any)?.code === 'ECONNREFUSED',
          hasResponse: !!(error as any)?.response,
          fullErrorObject: error
        }
      })
      throw this.handleHttpError(error, provider)
    }
  }

  /**
   * Parse API response
   */
  private parseResponse(
    provider: LLMProvider,
    response: unknown,
    model: string,
    duration: number
  ): LLMResponse {
    try {
      let content = ''
      let usage = { inputTokens: 0, outputTokens: 0, totalTokens: 0 }

      const responseObj = response as Record<string, unknown>

      switch (provider) {
        case 'claude':
          const claudeContent = responseObj.content as Array<{ text?: string }> | undefined
          content = claudeContent?.[0]?.text ?? ''
          const claudeUsage = responseObj.usage as { input_tokens?: number; output_tokens?: number } | undefined
          usage = {
            inputTokens: claudeUsage?.input_tokens ?? 0,
            outputTokens: claudeUsage?.output_tokens ?? 0,
            totalTokens: (claudeUsage?.input_tokens ?? 0) + (claudeUsage?.output_tokens ?? 0)
          }
          break

        case 'openai':
          const openaiChoices = responseObj.choices as Array<{ message?: { content?: string } }> | undefined
          content = openaiChoices?.[0]?.message?.content ?? ''
          const openaiUsage = responseObj.usage as { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number } | undefined
          usage = {
            inputTokens: openaiUsage?.prompt_tokens ?? 0,
            outputTokens: openaiUsage?.completion_tokens ?? 0,
            totalTokens: openaiUsage?.total_tokens ?? 0
          }
          break

        case 'gemini':
          const geminiCandidates = responseObj.candidates as Array<{ content?: { parts?: Array<{ text?: string }> } }> | undefined
          content = geminiCandidates?.[0]?.content?.parts?.[0]?.text ?? ''
          const geminiUsage = responseObj.usageMetadata as { promptTokenCount?: number; candidatesTokenCount?: number; totalTokenCount?: number } | undefined
          usage = {
            inputTokens: geminiUsage?.promptTokenCount ?? 0,
            outputTokens: geminiUsage?.candidatesTokenCount ?? 0,
            totalTokens: geminiUsage?.totalTokenCount ?? 0
          }
          break
      }

      const llmResponse: LLMResponse = {
        id: this.generateResponseId(),
        provider,
        model,
        content,
        role: 'assistant',
        timestamp: Date.now(),
        usage,
        metadata: {
          duration,
          rawResponse: response
        }
      }

      // Validate response
      const validation = LLMResponseSchema.safeParse(llmResponse)
      if (!validation.success) {
        log.warn('Response validation failed, using partial data', {
          provider,
          errors: validation.error.errors
        })
      }

      return llmResponse

    } catch (error) {
      log.error('Failed to parse LLM response', {
        provider,
        error: error instanceof Error ? error.message : 'Unknown error'
      })

      throw new LLMError(
        'Failed to parse API response',
        'VALIDATION_ERROR',
        provider,
        { originalError: error instanceof Error ? error.message : 'Unknown error' }
      )
    }
  }

  /**
   * Validate chat request inputs
   */
  private validateChatRequest(
    provider: LLMProvider,
    messages: ChatMessage[],
    apiKey: string,
    options: LLMRequestOptions
  ): void {
    if (!provider || !this.providerConfigs.has(provider)) {
      throw new LLMError(
        `Invalid provider: ${provider}`,
        'VALIDATION_ERROR',
        provider
      )
    }

    if (!apiKey || typeof apiKey !== 'string') {
      throw new LLMError(
        'API key is required',
        'NO_API_KEY',
        provider
      )
    }

    // Validate API key format for each provider
    this.validateApiKeyFormat(provider, apiKey)

    if (!Array.isArray(messages) || messages.length === 0) {
      throw new LLMError(
        'At least one message is required',
        'VALIDATION_ERROR',
        provider
      )
    }

    // Validate each message
    for (const message of messages) {
      const validation = ChatMessageSchema.safeParse(message)
      if (!validation.success) {
        throw new LLMError(
          'Invalid message format',
          'VALIDATION_ERROR',
          provider,
          { validationErrors: validation.error.errors }
        )
      }
    }

    // Validate options
    if (options && Object.keys(options).length > 0) {
      const validation = LLMRequestOptionsSchema.safeParse(options)
      if (!validation.success) {
        throw new LLMError(
          'Invalid request options',
          'VALIDATION_ERROR',
          provider,
          { validationErrors: validation.error.errors }
        )
      }
    }
  }

  /**
   * Validate API key format for specific provider
   */
  private validateApiKeyFormat(provider: LLMProvider, apiKey: string): void {
    // Clean the API key of any whitespace
    const cleanKey = apiKey.trim()

    // Log key details for debugging
    log.debug('Validating API key format', {
      provider,
      keyLength: cleanKey.length,
      keyPrefix: cleanKey.slice(0, 15),
      hasWhitespace: apiKey !== cleanKey,
      originalLength: apiKey.length
    })

    switch (provider) {
      case 'claude':
        if (!cleanKey.startsWith('sk-ant-api03-')) {
          log.error('Invalid Claude API key format', {
            expected: 'sk-ant-api03-...',
            received: `${cleanKey.slice(0, 15)}...`,
            keyLength: cleanKey.length
          })
          throw new LLMError(
            'Invalid Claude API key format. API key must start with "sk-ant-api03-"',
            'INVALID_API_KEY',
            provider
          )
        }
        if (cleanKey.length < 100) {
          log.warn('Claude API key seems too short', {
            keyLength: cleanKey.length,
            expected: 'around 108-120 characters'
          })
        }
        break

      case 'openai':
        if (!cleanKey.startsWith('sk-') && !cleanKey.startsWith('sk-proj-')) {
          throw new LLMError(
            'Invalid OpenAI API key format. API key must start with "sk-" or "sk-proj-"',
            'INVALID_API_KEY',
            provider
          )
        }
        break

      case 'gemini':
        if (cleanKey.length < 30) {
          throw new LLMError(
            'Invalid Gemini API key format. API key seems too short',
            'INVALID_API_KEY',
            provider
          )
        }
        break
    }

    // Update the apiKey reference if it was trimmed
    if (cleanKey !== apiKey) {
      log.warn('API key contained whitespace - this has been cleaned', {
        provider,
        originalLength: apiKey.length,
        cleanedLength: cleanKey.length
      })
    }
  }

  /**
   * Handle HTTP errors
   */
  private handleHttpError(error: unknown, provider: LLMProvider): LLMError {
    const errorObj = error as { response?: { status?: number; statusText?: string; data?: unknown }; code?: string; message?: string }
    const status = errorObj.response?.status
    const statusText = errorObj.response?.statusText ?? ''
    const responseData = errorObj.response?.data

    switch (status) {
      case 401:
        return new LLMError(
          'Invalid API key',
          'INVALID_API_KEY',
          provider,
          { status, statusText, responseData }
        )
      case 429:
        return new LLMError(
          'Rate limit exceeded',
          'RATE_LIMITED',
          provider,
          { status, statusText, responseData }
        )
      case 402:
      case 403:
        return new LLMError(
          'Quota exceeded or insufficient credits',
          'QUOTA_EXCEEDED',
          provider,
          { status, statusText, responseData }
        )
      case 404:
        return new LLMError(
          'Model not found',
          'MODEL_NOT_AVAILABLE',
          provider,
          { status, statusText, responseData }
        )
      case 500:
      case 502:
      case 503:
      case 504:
        return new LLMError(
          'Provider service error',
          'REQUEST_FAILED',
          provider,
          { status, statusText, responseData }
        )
      default:
        if (errorObj.code === 'ENOTFOUND' || errorObj.code === 'ECONNREFUSED') {
          return new LLMError(
            'Network error - unable to reach provider',
            'NETWORK_ERROR',
            provider,
            { originalError: errorObj.message }
          )
        }

        return new LLMError(
          errorObj.message ?? 'Unknown API error',
          'REQUEST_FAILED',
          provider,
          { status, statusText, responseData }
        )
    }
  }

  /**
   * Handle API errors
   */
  private handleApiError(error: unknown, provider: LLMProvider, model?: string): LLMError {
    const errorObj = error as { response?: unknown; message?: string }
    if (errorObj.response) {
      return this.handleHttpError(error, provider)
    }

    return new LLMError(
      errorObj.message ?? 'Unknown error occurred',
      'REQUEST_FAILED',
      provider,
      { model, originalError: errorObj.message }
    )
  }

  /**
   * Calculate cost for completed request
   */
  private calculateCost(
    config: LLMProviderConfig,
    model: string,
    usage: { inputTokens: number; outputTokens: number; totalTokens: number }
  ): number {
    const modelConfig = config.availableModels.find(m => m.modelId === model)
    if (!modelConfig) {
      return 0
    }

    const inputCost = (usage.inputTokens / 1000) * modelConfig.costPer1kTokens.input
    const outputCost = (usage.outputTokens / 1000) * modelConfig.costPer1kTokens.output

    return inputCost + outputCost
  }

  /**
   * Generate unique response ID
   */
  private generateResponseId(): string {
    return `llm_${Date.now()}_${Math.random().toString(36).substring(2)}`
  }

  /**
   * Set API key for provider client
   */
  private setProviderApiKey(provider: LLMProvider, apiKey: string): void {
    const config = this.getProviderConfig(provider)
    const client = this.httpClients.get(provider)

    if (client) {
      const headers = client.getAxiosInstance().defaults.headers.common

      switch (provider) {
        case 'claude':
          headers[config.authHeader] = apiKey
          break
        case 'openai':
          headers[config.authHeader] = apiKey // Will be prefixed with "Bearer " in request
          break
        case 'gemini':
          headers[config.authHeader] = apiKey
          break
      }

      log.debug('API key set for provider client', {
        provider,
        keyLength: apiKey.length,
        keyPreview: `${apiKey.slice(0, 8)}...`
      })
    }
  }
}

// Export singleton instance
export const llmService = new LLMService()
export { LLMService }