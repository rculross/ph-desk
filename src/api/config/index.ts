/**
 * Unified API Configuration
 *
 * Centralized configuration for all API-related settings including:
 * - Base URLs and endpoint configurations
 * - Timeout and retry settings
 * - Rate limiting parameters
 * - Cache timing configurations
 * - Entity-specific query defaults
 *
 * This serves as the single source of truth for all API configuration,
 * eliminating scattered config files and ensuring consistency.
 */

export interface ApiConfigRetry {
  /** Maximum number of retry attempts */
  maxAttempts: number
  /** Base backoff delay in milliseconds */
  backoffMs: number
  /** Maximum delay between retries */
  maxDelayMs: number
}

export interface ApiConfigRateLimit {
  /** Requests per second limit */
  perSecond: number
  /** Requests per minute limit */
  perMinute: number
  /** Maximum concurrent requests */
  maxConcurrent: number
  /** Reservoir refresh interval for per-second limiting */
  perSecondRefreshInterval: number
  /** Reservoir refresh interval for per-minute limiting */
  perMinuteRefreshInterval: number
}

export interface ApiConfigTimeout {
  /** Default request timeout in milliseconds */
  default: number
  /** Timeout for authentication requests */
  auth: number
  /** Timeout for search operations */
  search: number
  /** Timeout for export operations */
  export: number
}

export interface ApiConfigCache {
  /** Default stale time for queries */
  defaultStaleTime: number
  /** Default garbage collection time */
  defaultGcTime: number
  /** Enable structural sharing */
  structuralSharing: boolean
  /** Refetch on window focus */
  refetchOnWindowFocus: boolean
  /** Refetch on mount */
  refetchOnMount: boolean
}

export interface ApiConfigQueryDefaults {
  /** Fast data that changes frequently (30s stale, 2min cache) */
  realtime: {
    staleTime: number
    cacheTime: number
    refetchOnWindowFocus: boolean
    refetchOnMount: boolean
  }
  /** Medium-speed data (5min stale, 10min cache) */
  standard: {
    staleTime: number
    cacheTime: number
    refetchOnWindowFocus: boolean
    refetchOnMount: boolean
  }
  /** Slow-changing data (30min stale, 1hr cache) */
  static: {
    staleTime: number
    cacheTime: number
    refetchOnWindowFocus: boolean
    refetchOnMount: boolean
  }
  /** Data that rarely changes (24hr stale, 7day cache) */
  stable: {
    staleTime: number
    cacheTime: number
    refetchOnWindowFocus: boolean
    refetchOnMount: boolean
  }
}

export interface ApiConfigHeaders {
  /** Standard Accept header */
  accept: string
  /** Content-Type header */
  contentType: string
  /** Client version header */
  clientVersion: string
}

export interface ApiConfigEndpoints {
  /** Production API base URL */
  production: string
  /** Demo environment API base URL */
  demo: string
  /** Default base URL */
  default: string
}

export interface ApiConfig {
  /** API endpoint URLs */
  endpoints: ApiConfigEndpoints
  /** Request timeout configurations */
  timeout: ApiConfigTimeout
  /** Rate limiting settings */
  rateLimit: ApiConfigRateLimit
  /** Retry logic configuration */
  retry: ApiConfigRetry
  /** Cache settings */
  cache: ApiConfigCache
  /** Query defaults by data freshness requirements */
  queryDefaults: ApiConfigQueryDefaults
  /** Standard HTTP headers */
  headers: ApiConfigHeaders
  /** Enable credentials for requests */
  withCredentials: boolean
  /** Enable request validation */
  validateRequests: boolean
  /** Enable response transformations */
  transformResponses: boolean
}

/**
 * Centralized API configuration
 *
 * All values preserved from existing scattered configurations to maintain
 * identical behavior while providing a single source of truth.
 */
export const apiConfig: ApiConfig = {
  // API Endpoints
  endpoints: {
    production: 'https://api.planhat.com',
    demo: 'https://api.planhatdemo.com',
    default: 'https://api.planhat.com'
  },

  // Request Timeouts
  timeout: {
    default: 30000,       // 30 seconds - from http-client.ts
    auth: 15000,          // 15 seconds - shorter for auth requests
    search: 45000,        // 45 seconds - longer for search operations
    export: 120000        // 2 minutes - much longer for export operations
  },

  // Rate Limiting (from rate-limiter.ts)
  rateLimit: {
    perSecond: 50,                    // 50 requests per second
    perMinute: 200,                   // 200 requests per minute
    maxConcurrent: 5,                 // Max 5 concurrent requests
    perSecondRefreshInterval: 1000,   // 1 second refresh
    perMinuteRefreshInterval: 60000   // 1 minute refresh
  },

  // Retry Configuration (from query-client.ts)
  retry: {
    maxAttempts: 3,       // Maximum retry attempts
    backoffMs: 1000,      // Base backoff delay (1 second)
    maxDelayMs: 10000     // Maximum delay between retries (10 seconds)
  },

  // Cache Configuration
  cache: {
    defaultStaleTime: 5 * 60 * 1000,    // 5 minutes - from queryDefaults.standard
    defaultGcTime: 10 * 60 * 1000,      // 10 minutes - from queryDefaults.standard
    structuralSharing: true,             // Enable request deduplication
    refetchOnWindowFocus: false,         // Default behavior from query-client.ts
    refetchOnMount: false                // Default behavior from query-client.ts
  },

  // Query Defaults by Data Type (from query-client.ts)
  queryDefaults: {
    // Fast data that changes frequently
    realtime: {
      staleTime: 30 * 1000,           // 30 seconds
      cacheTime: 2 * 60 * 1000,       // 2 minutes
      refetchOnWindowFocus: true,
      refetchOnMount: true
    },

    // Medium-speed data
    standard: {
      staleTime: 5 * 60 * 1000,       // 5 minutes
      cacheTime: 10 * 60 * 1000,      // 10 minutes
      refetchOnWindowFocus: false,
      refetchOnMount: false
    },

    // Slow-changing data
    static: {
      staleTime: 30 * 60 * 1000,      // 30 minutes
      cacheTime: 60 * 60 * 1000,      // 1 hour
      refetchOnWindowFocus: false,
      refetchOnMount: false
    },

    // Data that rarely changes
    stable: {
      staleTime: 24 * 60 * 60 * 1000,     // 24 hours
      cacheTime: 7 * 24 * 60 * 60 * 1000, // 7 days
      refetchOnWindowFocus: false,
      refetchOnMount: false
    }
  },

  // Standard Headers (from http-client.ts)
  headers: {
    accept: 'application/json',
    contentType: 'application/json',
    clientVersion: '3.1.161'          // Preserved from existing config
  },

  // Request Configuration
  withCredentials: true,              // Use existing session cookies
  validateRequests: true,             // Enable runtime validation
  transformResponses: true            // Enable response transformations
}

/**
 * Entity-specific cache configurations
 *
 * These override the default query settings for specific entity types
 * based on their data freshness requirements. Values preserved from
 * existing query files to maintain identical behavior.
 */
export const entityCacheConfig = {
  // Authentication & Session (auth.queries.ts)
  session: {
    staleTime: 2 * 60 * 1000,         // 2 minutes - session data changes frequently
    refetchInterval: 5 * 60 * 1000    // Check every 5 minutes
  },

  sessionValidity: {
    staleTime: 30 * 1000,             // 30 seconds - check validity frequently
    refetchInterval: 5 * 60 * 1000    // Check every 5 minutes
  },

  currentUser: {
    staleTime: 10 * 60 * 1000         // 10 minutes - user data doesn't change often
  },

  // Issues (issues.queries.ts)
  issues: {
    staleTime: 2 * 60 * 1000          // 2 minutes - issues change frequently
  },

  issue: {
    staleTime: 5 * 60 * 1000          // 5 minutes
  },

  issueComments: {
    staleTime: 30 * 1000              // 30 seconds - comments are real-time
  },

  issueActivity: {
    staleTime: 2 * 60 * 1000          // 2 minutes
  },

  issueStats: {
    staleTime: 5 * 60 * 1000          // 5 minutes
  },

  myIssues: {
    staleTime: 60 * 1000              // 1 minute - user's issues are important
  },

  overdueIssues: {
    staleTime: 2 * 60 * 1000          // 2 minutes
  },

  // Companies (companies.queries.ts)
  companies: {
    staleTime: 5 * 60 * 1000          // 5 minutes - company data is relatively stable
  },

  company: {
    staleTime: 5 * 60 * 1000          // 5 minutes
  },

  companyBySlug: {
    staleTime: 10 * 60 * 1000         // 10 minutes
  },

  companyStats: {
    staleTime: 10 * 60 * 1000         // 10 minutes - stats change less frequently
  },

  companyHealth: {
    staleTime: 2 * 60 * 1000          // 2 minutes - health scores are important
  },

  companyActivity: {
    staleTime: 60 * 1000              // 1 minute - activity is real-time
  },

  companyIssues: {
    staleTime: 2 * 60 * 1000          // 2 minutes
  },

  companyIntegrations: {
    staleTime: 5 * 60 * 1000          // 5 minutes
  },

  atRiskCompanies: {
    staleTime: 5 * 60 * 1000          // 5 minutes - at-risk companies need frequent monitoring
  },

  highValueCompanies: {
    staleTime: 10 * 60 * 1000         // 10 minutes
  },

  // Search Operations
  search: {
    staleTime: 5 * 60 * 1000          // 5 minutes - search results
  }
}

/**
 * Get entity-specific cache configuration
 */
export function getEntityCacheConfig(entityType: keyof typeof entityCacheConfig) {
  return entityCacheConfig[entityType] || {
    staleTime: apiConfig.cache.defaultStaleTime
  }
}

/**
 * Get cache configuration for a specific query type
 */
export function getCacheConfig(queryType: keyof ApiConfigQueryDefaults) {
  return apiConfig.queryDefaults[queryType]
}

/**
 * Get timeout for specific operation type
 */
export function getTimeoutConfig(operationType: keyof ApiConfigTimeout) {
  return apiConfig.timeout[operationType]
}

/**
 * Get appropriate base URL for environment
 */
export function getBaseURL(environment?: 'production' | 'demo'): string {
  if (environment === 'demo') {
    return apiConfig.endpoints.demo
  }
  if (environment === 'production') {
    return apiConfig.endpoints.production
  }
  return apiConfig.endpoints.default
}

/**
 * Detect environment from domain and return appropriate base URL
 */
export function getBaseURLFromDomain(domain: string): string {
  if (domain.includes('planhatdemo.com')) {
    return apiConfig.endpoints.demo
  }
  return apiConfig.endpoints.production
}

/**
 * Get standard headers for API requests
 */
export function getStandardHeaders(): Record<string, string> {
  return {
    'Accept': apiConfig.headers.accept,
    'Content-Type': apiConfig.headers.contentType,
    'X-Client-Version': apiConfig.headers.clientVersion
  }
}

// Export individual config sections for convenience
export const {
  endpoints,
  timeout,
  rateLimit,
  retry,
  cache,
  queryDefaults,
  headers
} = apiConfig

// Re-export for backward compatibility during transition
export { apiConfig as default }