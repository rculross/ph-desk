/**
 * Tenant Cache Layer
 *
 * Provides aggressive caching for tenant data to prevent redundant API calls during startup
 * and subsequent operations. Each cache entry has a TTL (time-to-live) to ensure data freshness.
 */

import { logger } from '@/utils/logger'
import type { TenantInfo, TenantListResponse } from '@/api/services/tenant.service'

const log = logger.api

// Cache TTL: 5 minutes (300,000 ms)
const DEFAULT_TTL = 300000

interface CacheEntry<T> {
  data: T
  timestamp: number
  ttl: number
  environments?: string // e.g., 'prod', 'demo', or 'prod+demo'
}

interface TenantStatusEntry {
  authenticated: boolean
  timestamp: number
}

// In-memory cache storage
const cache = {
  tenantList: null as CacheEntry<TenantListResponse[]> | null,
  tenantStatuses: new Map<string, TenantStatusEntry>(),
  initializationComplete: false,
}

/**
 * Check if a cache entry is still valid based on its TTL
 */
function isCacheValid<T>(entry: CacheEntry<T> | null): boolean {
  if (!entry) return false
  const age = Date.now() - entry.timestamp
  const isValid = age < entry.ttl

  if (!isValid) {
    log.debug('Cache entry expired', { age, ttl: entry.ttl })
  }

  return isValid
}

/**
 * Tenant List Cache
 */
export const tenantListCache = {
  get(environments?: string): TenantListResponse[] | null {
    if (isCacheValid(cache.tenantList)) {
      // Check if cached environments match requested environments
      if (environments && cache.tenantList!.environments !== environments) {
        log.debug('Tenant list cache miss - environment mismatch', {
          cached: cache.tenantList!.environments,
          requested: environments
        })
        return null
      }

      log.debug('Tenant list cache hit', {
        count: cache.tenantList!.data.length,
        age: Date.now() - cache.tenantList!.timestamp,
        environments: cache.tenantList!.environments
      })
      return cache.tenantList!.data
    }
    log.debug('Tenant list cache miss')
    return null
  },

  set(tenants: TenantListResponse[], ttl = DEFAULT_TTL, environments?: string): void {
    cache.tenantList = {
      data: tenants,
      timestamp: Date.now(),
      ttl,
      environments,
    }
    log.debug('Tenant list cached', { count: tenants.length, ttl, environments })
  },

  clear(): void {
    cache.tenantList = null
    log.debug('Tenant list cache cleared')
  },

  isValid(): boolean {
    return isCacheValid(cache.tenantList)
  },
}

/**
 * Tenant Status Cache
 */
export const tenantStatusCache = {
  get(tenantSlug: string): boolean | null {
    const entry = cache.tenantStatuses.get(tenantSlug)
    if (!entry) {
      return null
    }

    const age = Date.now() - entry.timestamp
    if (age < DEFAULT_TTL) {
      log.debug(`Status cache hit for ${tenantSlug}`, {
        authenticated: entry.authenticated,
        age
      })
      return entry.authenticated
    }

    // Expired - remove it
    cache.tenantStatuses.delete(tenantSlug)
    log.debug(`Status cache expired for ${tenantSlug}`, { age })
    return null
  },

  set(tenantSlug: string, authenticated: boolean): void {
    cache.tenantStatuses.set(tenantSlug, {
      authenticated,
      timestamp: Date.now(),
    })
    log.debug(`Status cached for ${tenantSlug}`, { authenticated })
  },

  clear(tenantSlug?: string): void {
    if (tenantSlug) {
      cache.tenantStatuses.delete(tenantSlug)
      log.debug(`Status cache cleared for ${tenantSlug}`)
    } else {
      cache.tenantStatuses.clear()
      log.debug('All status caches cleared')
    }
  },

  getAll(): Map<string, boolean> {
    const result = new Map<string, boolean>()
    const now = Date.now()

    for (const [slug, entry] of cache.tenantStatuses.entries()) {
      if (now - entry.timestamp < DEFAULT_TTL) {
        result.set(slug, entry.authenticated)
      }
    }

    return result
  },

  hasValid(tenantSlug: string): boolean {
    const entry = cache.tenantStatuses.get(tenantSlug)
    if (!entry) return false
    return Date.now() - entry.timestamp < DEFAULT_TTL
  },
}

/**
 * Initialization State Cache
 * Tracks whether tenant store initialization has completed
 */
export const initializationCache = {
  isComplete(): boolean {
    return cache.initializationComplete
  },

  setComplete(): void {
    cache.initializationComplete = true
    log.debug('Initialization marked as complete')
  },

  reset(): void {
    cache.initializationComplete = false
    log.debug('Initialization state reset')
  },
}

/**
 * Clear all caches
 */
export function clearAllCaches(): void {
  tenantListCache.clear()
  tenantStatusCache.clear()
  initializationCache.reset()
  log.info('All tenant caches cleared')
}

/**
 * Get cache statistics for debugging
 */
export function getCacheStats() {
  return {
    tenantList: cache.tenantList ? {
      count: cache.tenantList.data.length,
      age: Date.now() - cache.tenantList.timestamp,
      valid: isCacheValid(cache.tenantList),
    } : null,
    tenantStatuses: {
      count: cache.tenantStatuses.size,
      entries: Array.from(cache.tenantStatuses.entries()).map(([slug, entry]) => ({
        slug,
        authenticated: entry.authenticated,
        age: Date.now() - entry.timestamp,
        valid: Date.now() - entry.timestamp < DEFAULT_TTL,
      })),
    },
    initializationComplete: cache.initializationComplete,
  }
}
