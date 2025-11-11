/**
 * Simple HTTP Client for Planhat API
 *
 * Direct Axios-based implementation for API interactions
 * Maintains all existing functionality: rate limiting, tenant management, validation, retry logic
 */

import axios, { AxiosInstance, AxiosRequestConfig, AxiosError } from 'axios'
import axiosRetry from 'axios-retry'

import { logger } from '../../utils/logger'
import { apiConfig, getBaseURL, getStandardHeaders, getTimeoutConfig } from '../config/index'
import { axiosRateLimiter as limiter } from '../config/rate-limiter'
import { createApiError, shouldRetryError, getRetryDelay } from '../errors'

const log = logger.api

/**
 * HTTP Client Options
 */
export interface HttpClientOptions {
  baseURL?: string
  tenantSlug?: string
  enableRateLimit?: boolean
  timeout?: number
  context?: string
  withCredentials?: boolean
}

/**
 * Request Options for individual requests
 */
export interface RequestOptions {
  priority?: 'low' | 'normal' | 'high' | 'critical'
  complexity?: 'simple' | 'moderate' | 'complex' | 'heavy'
  skipRateLimit?: boolean
}

/**
 * Simple HTTP Client Class
 */
export class HttpClient {
  private axiosInstance: AxiosInstance
  private options: HttpClientOptions

  constructor(options: HttpClientOptions = {}) {
    this.options = options
    this.axiosInstance = this.createAxiosInstance()
    this.setupInterceptors()
  }

  /**
   * Create configured Axios instance
   */
  private createAxiosInstance(): AxiosInstance {
    const instance = axios.create({
      baseURL: this.options.baseURL ?? getBaseURL(),
      timeout: this.options.timeout ?? getTimeoutConfig('default'),
      headers: getStandardHeaders(),
      withCredentials: this.options.withCredentials ?? apiConfig.withCredentials,
      paramsSerializer: {
        serialize: (params) => this.serializeParams(params)
      }
    })

    // Configure automatic retries to match TanStack Query behavior
    axiosRetry(instance, {
      retries: 3, // Max retries (will be limited by retryCondition)
      retryCondition: (error: AxiosError) => {
        // Convert to ApiError to use centralized retry logic
        const apiError = createApiError(error)
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access
        const retryMeta = (error.config as any)?.['axios-retry']
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access
        const currentRetryCount = retryMeta?.retryCount ?? 0

        // Use the same retry logic as TanStack Query
        const shouldRetry = shouldRetryError(apiError, currentRetryCount)

        if (shouldRetry) {
          log.debug('HTTP client will retry request', {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
            url: error.config?.url,
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
            method: error.config?.method,
            errorCode: apiError.code,
            attempt: currentRetryCount + 1,
            maxRetries: 3
          })
        } else {
          log.debug('HTTP client will not retry request', {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
            url: error.config?.url,
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
            method: error.config?.method,
            errorCode: apiError.code,
            attempt: currentRetryCount + 1,
            reason: apiError.retryable === false ? 'non-retryable' : 'max retries exceeded'
          })
        }

        return shouldRetry
      },
      retryDelay: (retryCount: number, error: AxiosError) => {
        // Use the same exponential backoff as TanStack Query
        const apiError = createApiError(error)
        const delay = getRetryDelay(retryCount - 1, apiError)

        log.debug('HTTP client retry delay', {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          url: error.config?.url,
          retryCount,
          delay,
          errorCode: apiError.code
        })

        return delay
      },
      onRetry: (retryCount: number, error: AxiosError, requestConfig: AxiosRequestConfig) => {
        log.info('HTTP client retrying request', {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
          url: requestConfig.url,
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
          method: requestConfig.method,
          attempt: retryCount,
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
          status: error.response?.status,
          message: error.message
        })
      }
    })

    return instance
  }

  /**
   * Serialize query parameters (handles arrays and nested objects)
   */
  private serializeParams(params: Record<string, unknown>): string {
    if (!params) return ''

    const searchParams = new URLSearchParams()

    Object.entries(params).forEach(([key, value]) => {
      if (value === undefined || value === null) return

      if (Array.isArray(value)) {
        value.forEach(item => searchParams.append(`${key}[]`, String(item)))
      } else if (value instanceof Date) {
        searchParams.append(key, value.toISOString())
      } else if (typeof value === 'object') {
        // For nested objects, stringify them
        searchParams.append(key, JSON.stringify(value))
      } else {
        searchParams.append(key, String(value))
      }
    })

    return searchParams.toString()
  }

  /**
   * Setup request/response interceptors
   */
  private setupInterceptors(): void {
    // Rate limiting interceptor
    if (this.options.enableRateLimit) {
      this.axiosInstance.interceptors.request.use(
        async (config) => {
          const requestOptions = (config as AxiosRequestConfig & { metadata?: RequestOptions }).metadata

          if (!requestOptions?.skipRateLimit) {
            try {
              await limiter.schedule(() => Promise.resolve(config))
            } catch (error) {
              log.warn(`Rate limit exceeded: ${config.method} ${config.url}`)
              throw error
            }
          }

          return config
        },
        (error) => Promise.reject(error)
      )
    }

    // Tenant slug injection interceptor
    this.axiosInstance.interceptors.request.use(
      (config) => {
        const tenantSlug = this.options.tenantSlug

        if (tenantSlug && config.url) {
          try {
            const url = new URL(config.url, config.baseURL)

            // Skip tenant slug only for these specific endpoints
            const isTenantEndpoint = url.pathname === '/tenants'

            // Check if tenant slug is already in URL params or config params
            const alreadyHasTenantSlug = url.searchParams.has('tenantSlug') ||
                                        (config.params && 'tenantSlug' in config.params)

            if (!isTenantEndpoint && !alreadyHasTenantSlug) {
              // Add debug logging to track tenant slug injection
              log.debug(`Injecting tenant slug: ${tenantSlug} for ${config.method?.toUpperCase()} ${url.pathname}`)
              url.searchParams.set('tenantSlug', tenantSlug)
              config.url = url.pathname + url.search
            }
          } catch (e) {
            // If URL parsing fails, fall back to simple query param addition
            const isTenantEndpointFallback = config.url === '/tenants'
            const separator = config.url.includes('?') ? '&' : '?'
            const alreadyHasParam = config.url.includes('tenantSlug=') ||
                                   (config.params && 'tenantSlug' in config.params)

            if (!isTenantEndpointFallback && !alreadyHasParam) {
              log.debug(`Fallback tenant slug injection: ${tenantSlug} for ${config.url}`)
              config.url += `${separator}tenantSlug=${tenantSlug}`
            }
          }
        }

        return config
      },
      (error) => Promise.reject(error)
    )

    // Response logging and auth error handling interceptor
    this.axiosInstance.interceptors.response.use(
      (response) => {
        const isStatusCheck = response.config.url?.includes('/myprofile')
        if (!isStatusCheck) {
          log.debug(`API request completed: ${response.config.method?.toUpperCase()} ${response.config.url} - ${response.status}`)
        }
        return response
      },
      async (error) => {
        const isConnectivityCheck = error.config?.url?.includes('/myprofile') &&
                                   (error.response?.status === 400 || error.response?.status === 401)

        if (!isConnectivityCheck) {
          log.debug(`API request failed: ${error.config?.method?.toUpperCase()} ${error.config?.url} - ${error.response?.status ?? 'Network Error'}`)
        }

        // Handle 401 Unauthorized - session expired
        if (error.response?.status === 401 && !isConnectivityCheck) {
          log.warn('[HTTP] Received 401 Unauthorized - session may have expired')

          // Notify auth service if available (Electron environment)
          interface WindowWithAuthService extends Window {
            authService?: {
              handleUnauthorized: () => Promise<void>
            }
          }

          if (typeof window !== 'undefined' && (window as WindowWithAuthService).authService) {
            try {
              await (window as WindowWithAuthService).authService.handleUnauthorized()
            } catch (authError) {
              log.error('[HTTP] Error handling unauthorized response', { error: authError })
            }
          }
        }

        return Promise.reject(error)
      }
    )
  }

  /**
   * Update tenant slug
   */
  public setTenantSlug(tenantSlug: string | undefined): void {
    log.debug(`Setting tenant slug from '${this.options.tenantSlug}' to '${tenantSlug}'`)
    this.options.tenantSlug = tenantSlug
  }

  /**
   * Get current tenant slug
   */
  public getTenantSlug(): string | undefined {
    return this.options.tenantSlug
  }

  /**
   * Get current base URL
   */
  public getBaseURL(): string | undefined {
    return this.options.baseURL ?? this.axiosInstance.defaults.baseURL
  }

  /**
   * Update base URL
   */
  public setBaseURL(baseURL: string): void {
    this.options.baseURL = baseURL
    this.axiosInstance.defaults.baseURL = baseURL
  }

  /**
   * GET request
   */
  async get<T = unknown>(
    url: string,
    params?: Record<string, unknown>,
    config?: AxiosRequestConfig & { metadata?: RequestOptions }
  ): Promise<T> {
    const response = await this.axiosInstance.get<T>(url, {
      ...config,
      params
    })
    return response.data
  }

  /**
   * POST request
   */
  async post<T = unknown>(
    url: string,
    data?: unknown,
    config?: AxiosRequestConfig & { metadata?: RequestOptions }
  ): Promise<T> {
    // Ensure headers are properly merged
    const mergedConfig = config ? {
      ...config,
      headers: {
        ...this.axiosInstance.defaults.headers.common,
        ...this.axiosInstance.defaults.headers.post,
        ...config.headers
      }
    } : config

    const response = await this.axiosInstance.post<T>(url, data, mergedConfig)
    return response.data
  }

  /**
   * PATCH request
   */
  async patch<T = unknown>(
    url: string,
    data?: unknown,
    config?: AxiosRequestConfig & { metadata?: RequestOptions }
  ): Promise<T> {
    const response = await this.axiosInstance.patch<T>(url, data, config)
    return response.data
  }

  /**
   * DELETE request
   */
  async delete<T = unknown>(
    url: string,
    config?: AxiosRequestConfig & { metadata?: RequestOptions }
  ): Promise<T> {
    const response = await this.axiosInstance.delete<T>(url, config)
    return response.data
  }

  /**
   * PUT request
   */
  async put<T = unknown>(
    url: string,
    data?: unknown,
    config?: AxiosRequestConfig & { metadata?: RequestOptions }
  ): Promise<T> {
    const response = await this.axiosInstance.put<T>(url, data, config)
    return response.data
  }

  /**
   * Get the underlying Axios instance for advanced use cases
   */
  public getAxiosInstance(): AxiosInstance {
    return this.axiosInstance
  }
}

// Singleton instance
let defaultHttpClient: HttpClient | null = null

/**
 * Initialize the default HTTP client
 */
export function initializeHttpClient(options: HttpClientOptions = {}): void {
  defaultHttpClient = new HttpClient(options)
}

/**
 * Get the default HTTP client instance
 */
export function getHttpClient(): HttpClient {
  if (!defaultHttpClient) {
    throw new Error('HTTP client not initialized. Call initializeHttpClient() first.')
  }
  return defaultHttpClient
}

/**
 * Update the default HTTP client configuration
 */
export function updateHttpClient(options: Partial<HttpClientOptions>): void {
  const client = getHttpClient()

  if (options.tenantSlug !== undefined) {
    client.setTenantSlug(options.tenantSlug)
  }

  if (options.baseURL) {
    client.setBaseURL(options.baseURL)
  }
}

/**
 * Convenience function to set tenant slug
 */
export function setTenantSlug(tenantSlug: string | undefined): void {
  const client = getHttpClient()
  client.setTenantSlug(tenantSlug)
}

/**
 * Convenience function to get tenant slug
 */
export function getTenantSlug(): string | undefined {
  const client = getHttpClient()
  return client.getTenantSlug()
}

/**
 * Determine the correct API base URL based on current environment
 */
export async function detectApiBaseURL(): Promise<string> {
  // For Electron desktop app, default to production
  // User can change this in settings if needed
  return getBaseURL('production')
}

/**
 * Update client base URL based on current environment
 */
export async function updateClientForCurrentEnvironment(tenantDomain?: string): Promise<void> {
  // Get current baseURL for comparison
  const client = getHttpClient()
  const currentBaseURL = client.getBaseURL()

  let baseURL: string

  if (tenantDomain) {
    if (tenantDomain.includes('planhatdemo.com')) {
      baseURL = getBaseURL('demo')
    } else if (tenantDomain.includes('planhat.com')) {
      baseURL = getBaseURL('production')
    } else {
      baseURL = await detectApiBaseURL()
    }
  } else {
    baseURL = await detectApiBaseURL()
  }

  // Log if base URL is changing (helps detect domain confusion issues)
  if (currentBaseURL && currentBaseURL !== baseURL) {
    log.info(`HTTP client base URL changing: ${currentBaseURL} → ${baseURL}`, {
      tenantDomain,
      reason: tenantDomain ? 'tenant domain update' : 'auto-detection'
    })
  } else if (!currentBaseURL) {
    log.debug(`HTTP client base URL initialized: ${baseURL}`, { tenantDomain })
  }

  updateHttpClient({ baseURL })
}