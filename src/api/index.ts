/**
 * API Layer Index
 *
 * Centralized exports for the complete API integration layer including
 * HTTP client, authentication, services, query hooks, and utilities.
 *
 * Phase 5: Final Optimized Structure
 * ├── config/        - Configuration and endpoints
 * ├── client/        - HTTP clients
 * ├── queries/       - TanStack Query hooks
 * ├── services/      - Business logic services
 * ├── errors.ts      - Error handling
 * └── index.ts       - Clean API exports
 */

import { logger } from '../utils/logger'

const log = logger.api

// ==================================================
// Core API Infrastructure Exports
// ==================================================

// Configuration
export {
  apiConfig,
  entityCacheConfig,
  getEntityCacheConfig,
  getCacheConfig,
  getTimeoutConfig,
  getBaseURL,
  getBaseURLFromDomain,
  getStandardHeaders
} from './config'
export * from './config/endpoints'
export * from './config/rate-limiter'

// HTTP Clients
export {
  HttpClient,
  initializeHttpClient,
  getHttpClient,
  updateHttpClient,
  type HttpClientOptions
} from './client'

// Authentication
export * from './auth'

// Query Management
export * from './query-client'

// TanStack Query Hooks
export * from './queries'

// Business Logic Services
export { companiesService } from './services/companies.service'
export { issuesService } from './services/issues.service'
export { tenantService, TenantService, ensureTenantSlug } from './services/tenant.service'
export { salesforceIntegrationService } from './services/salesforce-integration.service'

// Error Handling
export * from './errors'

// Validation & Request Utils
export * from './validation'
export * from './request'

// Schemas
export * from './schemas'

// Utilities
export * from './utils/pagination'

// Utility functions and helpers
import { authService } from './auth'
import { initializeHttpClient, getHttpClient } from './client/http-client'
import { queryClient, queryUtils } from './query-client'
import { sendValidatedRequest, type ValidatedRequestOptions } from './request'

const defaultClient = {
  get<T = any>(endpoint: string, options?: ValidatedRequestOptions) {
    return sendValidatedRequest<T>('get', endpoint, undefined, options)
  },
  post<T = any>(endpoint: string, data?: any, options?: ValidatedRequestOptions) {
    return sendValidatedRequest<T>('post', endpoint, data, options)
  },
  put<T = any>(endpoint: string, data?: any, options?: ValidatedRequestOptions) {
    return sendValidatedRequest<T>('put', endpoint, data, options)
  },
  patch<T = any>(endpoint: string, data?: any, options?: ValidatedRequestOptions) {
    return sendValidatedRequest<T>('patch', endpoint, data, options)
  },
  delete<T = any>(endpoint: string, options?: ValidatedRequestOptions) {
    return sendValidatedRequest<T>('delete', endpoint, undefined, options)
  }
}

/**
 * Centralized API instance with all services
 * Provides a single point of access to all API functionality
 */
export const api = {
  // Core services
  client: defaultClient,
  auth: authService,

  // HTTP client (direct axios-based client)
  http: {
    initialize: initializeHttpClient,
    getClient: getHttpClient
  },

  // Query utilities
  query: {
    client: queryClient,
    utils: queryUtils
  },


  // Utility methods
  utils: {
    /**
     * Initialize the API layer with authentication check and both clients setup
     */
    initialize: async () => {
      try {
        // Initialize HTTP client first
        initializeHttpClient({
          enableRateLimit: true,
          context: 'extension'
        })
        log.debug('HTTP client initialized successfully')

        // Then check if user is authenticated
        const isAuthenticated = await authService.isAuthenticated()

        if (process.env.NODE_ENV === 'development') {
          log.debug('API layer initialized successfully')
        }
        return { success: true, authenticated: isAuthenticated }
      } catch (error) {
        log.error('Failed to initialize API layer', { error: error instanceof Error ? error.message : String(error) })
        return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
      }
    },

    /**
     * Clean up API resources and clear caches
     */
    cleanup: async () => {
      try {
        // Clear query caches
        queryClient.clear()

        if (process.env.NODE_ENV === 'development') {
          log.debug('API layer cleaned up successfully')
        }
      } catch (error) {
        log.error('Failed to cleanup API layer', { error: error instanceof Error ? error.message : error })
      }
    },

    /**
     * Health check for API service
     */
    healthCheck: async () => {
      const results = {
        auth: false,
        api: false,
        overall: false
      }

      try {
        // Check authentication service
        results.auth = await authService.isAuthenticated()

        // Test basic API connectivity
        if (results.auth) {
          try {
            await sendValidatedRequest('get', '/companies?limit=1')
            results.api = true
          } catch {
            results.api = false
          }
        }

        results.overall = results.auth && results.api
      } catch (error) {
        log.error('API health check failed', { error: error instanceof Error ? error.message : error })
      }

      return results
    },

    /**
     * Get API performance metrics
     */
    getMetrics: () => {
      return {
        cache: queryUtils.getCacheStats(),
        performance: {
          // Add performance metrics here
          timestamp: Date.now()
        }
      }
    },

    /**
     * Debug information for troubleshooting
     */
    getDebugInfo: async () => {
      const user = await authService.getCurrentUser()
      const tenant = await authService.getTenantContext()
      const isAuthenticated = await authService.isAuthenticated()

      return {
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV ?? 'development',
        authentication: {
          isAuthenticated,
          hasUser: !!user,
          userEmail: user?.email
        },
        tenant: {
          hasTenant: !!tenant,
          tenantSlug: tenant?.slug,
          tenantName: tenant?.name,
          features: tenant?.features.length ?? 0
        },
        cache: queryUtils.getCacheStats(),
        httpClient: {
          baseURL: getHttpClient().getAxiosInstance().defaults.baseURL ?? 'https://api.planhat.com'
        }
      }
    },

    /**
     * Batch operations helper
     */
    batch: <T, R>(
      items: T[],
      operation: (item: T) => Promise<R>,
      options?: {
        batchSize?: number
        delay?: number
        onProgress?: (completed: number, total: number) => void
      }
    ) => {
      const { batchSize = 5, delay = 100, onProgress } = options ?? {}

      return new Promise<R[]>(async (resolve, reject) => {
        const results: R[] = []
        const errors: Error[] = []

        try {
          for (let i = 0; i < items.length; i += batchSize) {
            const batch = items.slice(i, i + batchSize)

            const batchResults = await Promise.allSettled(batch.map(item => operation(item)))

            batchResults.forEach((result, index) => {
              if (result.status === 'fulfilled') {
                results.push(result.value)
              } else {
                errors.push(new Error(`Batch item ${i + index} failed: ${result.reason}`))
              }
            })

            onProgress?.(i + batch.length, items.length)

            // Add delay between batches
            if (i + batchSize < items.length && delay > 0) {
              await new Promise(resolve => setTimeout(resolve, delay))
            }
          }

          if (errors.length > 0) {
            log.warn('Batch operation completed with errors', { errorCount: errors.length, errors: errors.map(e => e.message) })
          }

          resolve(results)
        } catch (error) {
          reject(error)
        }
      })
    }
  }
}

// Default export for convenience
export default api

/**
 * API Events for cross-component communication
 */
export const apiEvents = {
  // Authentication events
  AUTH_SUCCESS: 'auth:success',
  AUTH_FAILURE: 'auth:failure',
  AUTH_LOGOUT: 'auth:logout',
  SESSION_EXPIRED: 'auth:session-expired',

  // Tenant events
  TENANT_CHANGED: 'tenant:changed',
  TENANT_CLEARED: 'tenant:cleared',

  // Data events
  DATA_UPDATED: 'data:updated',
  DATA_SYNC_START: 'data:sync-start',
  DATA_SYNC_COMPLETE: 'data:sync-complete',
  DATA_SYNC_ERROR: 'data:sync-error',

  // Connection events
  CONNECTION_ONLINE: 'connection:online',
  CONNECTION_OFFLINE: 'connection:offline',
  CONNECTION_SLOW: 'connection:slow',

  // Rate limiting events
  RATE_LIMIT_WARNING: 'ratelimit:warning',
  RATE_LIMIT_EXCEEDED: 'ratelimit:exceeded',

  // Error events
  API_ERROR: 'api:error',
  NETWORK_ERROR: 'network:error',
  VALIDATION_ERROR: 'validation:error'
}

/**
 * API Error Codes for consistent error handling
 */
export const apiErrorCodes = {
  // Authentication errors
  UNAUTHORIZED: 'UNAUTHORIZED',
  TOKEN_EXPIRED: 'TOKEN_EXPIRED',
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  INSUFFICIENT_PERMISSIONS: 'INSUFFICIENT_PERMISSIONS',

  // Request errors
  BAD_REQUEST: 'BAD_REQUEST',
  NOT_FOUND: 'NOT_FOUND',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  CONFLICT: 'CONFLICT',

  // Server errors
  SERVER_ERROR: 'SERVER_ERROR',
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',

  // Network errors
  NETWORK_ERROR: 'NETWORK_ERROR',
  TIMEOUT: 'TIMEOUT',
  RATE_LIMITED: 'RATE_LIMITED',

  // Application errors
  STORAGE_ERROR: 'STORAGE_ERROR',
  UNKNOWN_ERROR: 'UNKNOWN_ERROR'
} as const

/**
 * Type definitions for API consumers
 */
export type ApiErrorCode = (typeof apiErrorCodes)[keyof typeof apiErrorCodes]
export type ApiEventType = (typeof apiEvents)[keyof typeof apiEvents]

export interface ApiConfig {
  baseURL?: string
  timeout?: number
  retries?: number
  rateLimitDelay?: number
}

export interface ApiHealthStatus {
  auth: boolean
  api: boolean
  overall: boolean
}

export interface ApiMetrics {
  cache: ReturnType<typeof queryUtils.getCacheStats>
  performance: {
    timestamp: number
  }
}

// Initialize API on module load if in browser environment
// Note: Disabled for service worker compatibility 
// if (typeof window !== 'undefined') {
//   // Auto-initialize API layer
//   api.utils.initialize().catch(error => {
//     log.warn('Auto-initialization failed', { error: error instanceof Error ? error.message : error })
//   })
// }
