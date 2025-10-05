/**
 * Endpoint Discovery Service
 *
 * Provides automatic endpoint discovery, pattern recognition,
 * and management for Planhat API endpoints.
 */

import { logger } from '../../utils/logger'
import { getHttpClient, type RequestOptions } from '../client/http-client'

import { ensureTenantSlug as ensureSharedTenantSlug } from './tenant.service'

interface ApiRequestOptions extends RequestOptions {
  priority?: 'low' | 'normal' | 'high' | 'critical'
  complexity?: 'simple' | 'moderate' | 'complex' | 'heavy'
}

const log = logger.api

export interface DiscoveredEndpoint {
  url: string
  normalizedUrl: string
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH'
  pattern: string
  resourceType: string
  firstSeen: number
  lastUsed: number
  usageCount: number
  responseSchema?: any
  metadata?: Record<string, any>
}

export interface EndpointPattern {
  pattern: string
  resourceType: string
  endpoints: string[]
  usage: number
  examples: string[]
}

export interface EndpointDiscoveryConfig {
  maxEndpoints: number
  scanHistoryDays: number
  enableRealTimeDiscovery: boolean
  autoNormalize: boolean
  includeQuery: boolean
}

/**
 * Service for endpoint discovery and management
 */
class EndpointDiscoveryService {
  private get httpClient() {
    return getHttpClient()
  }

  /**
   * Ensure tenant slug is set before making API calls
   */
  private async ensureTenantSlug(): Promise<void> {
    await ensureSharedTenantSlug({ context: 'Endpoint Discovery', logger: log })
  }

  /**
   * Normalize URL by removing dynamic IDs and parameters
   */
  normalizeUrl(url: string): { normalizedUrl: string; pattern: string; resourceType: string } {
    try {
      const urlObj = new URL(url)
      let pathname = urlObj.pathname

      // Remove leading/trailing slashes
      pathname = pathname.replace(/^\/+|\/+$/g, '')

      // Split into segments
      const segments = pathname.split('/').filter(segment => segment.length > 0)

      // Patterns to identify dynamic segments
      const mongoIdPattern = /^[a-f\d]{24}$/i // 24-character hex (MongoDB ObjectId)
      const uuidPattern = /^[a-f\d]{8}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{12}$/i
      const idPattern = /^(id|ID|\d+)$/ // Generic ID patterns

      const normalizedSegments: string[] = []
      let resourceType = 'unknown'

      segments.forEach((segment, index) => {
        if (mongoIdPattern.test(segment) || uuidPattern.test(segment) || idPattern.test(segment)) {
          normalizedSegments.push('{id}')
        } else {
          normalizedSegments.push(segment)
          // The last non-ID segment is usually the resource type
          if (index < segments.length - 1 || !idPattern.test(segments[segments.length - 1] ?? '')) {
            resourceType = segment
          }
        }
      })

      const normalizedUrl = `/${normalizedSegments.join('/')}`
      const pattern = normalizedUrl

      return {
        normalizedUrl,
        pattern,
        resourceType
      }
    } catch (error) {
      log.error('Failed to normalize URL', { url, error })
      return {
        normalizedUrl: url,
        pattern: url,
        resourceType: 'unknown'
      }
    }
  }

  /**
   * Extract endpoints from browser tabs
   */
  async scanActiveTabs(): Promise<DiscoveredEndpoint[]> {
    try {
      // Check if we have tabs permission
      if (!chrome.tabs) {
        log.warn('Chrome tabs API not available')
        return []
      }

      const tabs = await chrome.tabs.query({
        url: ['*://*.planhat.com/*', '*://*.planhatdemo.com/*']
      })

      const discoveredEndpoints: DiscoveredEndpoint[] = []
      const now = Date.now()

      for (const tab of tabs) {
        if (!tab.url?.trim()) continue

        try {
          const urlObj = new URL(tab.url)

          // Look for Planhat URLs (either app.planhat.com or API endpoints)
          const isPlanhatApp = urlObj.hostname.includes('planhat')
          const isApiUrl = urlObj.pathname.startsWith('/api/')

          if (!isPlanhatApp && !isApiUrl) continue

          // For Planhat app URLs, extract the path as a potential endpoint
          let endpointUrl = tab.url
          if (isPlanhatApp && !isApiUrl) {
            // Convert app URLs to potential API endpoints
            // e.g., https://app.planhat.com/companies -> /companies
            endpointUrl = urlObj.pathname || '/'
          }

          const { normalizedUrl, pattern, resourceType } = this.normalizeUrl(endpointUrl)

          const endpoint: DiscoveredEndpoint = {
            url: endpointUrl,
            normalizedUrl,
            method: 'GET', // Default to GET for tab scanning
            pattern,
            resourceType,
            firstSeen: now,
            lastUsed: now,
            usageCount: 1,
            metadata: {
              source: 'tab-scan',
              tabTitle: tab.title,
              originalUrl: tab.url
            }
          }

          discoveredEndpoints.push(endpoint)
        } catch (error) {
          log.error('Failed to process tab URL', { url: tab.url, error })
        }
      }

      log.debug('Scanned active tabs for endpoints', {
        tabCount: tabs.length,
        endpointsFound: discoveredEndpoints.length
      })

      return discoveredEndpoints
    } catch (error) {
      log.error('Failed to scan active tabs', { error })
      return []
    }
  }

  /**
   * Extract endpoints from browser history
   */
  async scanBrowserHistory(days: number = 7): Promise<DiscoveredEndpoint[]> {
    try {
      // Check if we have history permission
      if (!chrome.history) {
        log.warn('Chrome history API not available')
        return []
      }

      const startTime = Date.now() - (days * 24 * 60 * 60 * 1000)
      const historyItems = await chrome.history.search({
        text: 'planhat.com',
        startTime,
        maxResults: 1000
      })

      const discoveredEndpoints: DiscoveredEndpoint[] = []
      const urlCounts = new Map<string, number>()

      for (const item of historyItems) {
        if (!item.url) continue

        try {
          const urlObj = new URL(item.url)

          // Look for Planhat URLs
          const isPlanhatApp = urlObj.hostname.includes('planhat')
          const isApiUrl = urlObj.pathname.startsWith('/api/')

          if (!isPlanhatApp && !isApiUrl) continue

          // For Planhat app URLs, extract the path as a potential endpoint
          let endpointUrl = item.url
          if (isPlanhatApp && !isApiUrl) {
            // Convert app URLs to potential API endpoints
            endpointUrl = urlObj.pathname || '/'
          }

          const { normalizedUrl, pattern, resourceType } = this.normalizeUrl(endpointUrl)

          // Count occurrences
          const key = `${normalizedUrl}:GET`
          urlCounts.set(key, (urlCounts.get(key) ?? 0) + (item.visitCount ?? 1))

          const endpoint: DiscoveredEndpoint = {
            url: endpointUrl,
            normalizedUrl,
            method: 'GET',
            pattern,
            resourceType,
            firstSeen: item.lastVisitTime ?? Date.now(),
            lastUsed: item.lastVisitTime ?? Date.now(),
            usageCount: item.visitCount ?? 1,
            metadata: {
              source: 'history-scan',
              title: item.title,
              originalUrl: item.url
            }
          }

          discoveredEndpoints.push(endpoint)
        } catch (error) {
          log.error('Failed to process history URL', { url: item.url, error })
        }
      }

      log.debug('Scanned browser history for endpoints', {
        historyItems: historyItems.length,
        endpointsFound: discoveredEndpoints.length,
        daysScanned: days
      })

      return discoveredEndpoints
    } catch (error) {
      log.error('Failed to scan browser history', { error })
      return []
    }
  }

  /**
   * Analyze endpoint patterns and group related endpoints
   */
  analyzePatterns(endpoints: DiscoveredEndpoint[]): EndpointPattern[] {
    const patternMap = new Map<string, EndpointPattern>()

    for (const endpoint of endpoints) {
      const key = endpoint.pattern

      if (patternMap.has(key)) {
        const existing = patternMap.get(key)!
        existing.endpoints.push(endpoint.url)
        existing.usage += endpoint.usageCount

        // Add to examples if not already present
        if (existing.examples.length < 3 && !existing.examples.includes(endpoint.url)) {
          existing.examples.push(endpoint.url)
        }
      } else {
        patternMap.set(key, {
          pattern: endpoint.pattern,
          resourceType: endpoint.resourceType,
          endpoints: [endpoint.url],
          usage: endpoint.usageCount,
          examples: [endpoint.url]
        })
      }
    }

    // Sort by usage (descending)
    return Array.from(patternMap.values()).sort((a, b) => b.usage - a.usage)
  }

  /**
   * Test endpoint to gather response schema
   */
  async analyzeEndpoint(
    url: string,
    method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' = 'GET',
    options?: ApiRequestOptions
  ): Promise<{ schema?: any; error?: string }> {
    try {
      await this.ensureTenantSlug()

      // Only allow safe methods for analysis
      if (method !== 'GET') {
        return { error: 'Only GET requests are allowed for endpoint analysis' }
      }

      const response = await this.httpClient.get(url, undefined, {
        metadata: {
          priority: options?.priority ?? 'low',
          complexity: options?.complexity ?? 'simple'
        }
      })

      // Basic schema detection
      const schema = this.detectSchema(response)

      return { schema }
    } catch (error) {
      log.error('Failed to analyze endpoint', { url, method, error })
      return {
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  /**
   * Basic schema detection from response data
   */
  private detectSchema(data: any): any {
    if (data === null || data === undefined) {
      return { type: 'null' }
    }

    if (Array.isArray(data)) {
      return {
        type: 'array',
        items: data.length > 0 ? this.detectSchema(data[0]) : { type: 'unknown' },
        length: data.length
      }
    }

    if (typeof data === 'object') {
      const properties: Record<string, any> = {}
      const keys = Object.keys(data).slice(0, 20) // Limit to first 20 keys

      for (const key of keys) {
        properties[key] = this.detectSchema(data[key])
      }

      return {
        type: 'object',
        properties,
        keyCount: Object.keys(data).length
      }
    }

    return {
      type: typeof data,
      example: typeof data === 'string' && data.length > 50
        ? `${data.substring(0, 50)}...`
        : data
    }
  }

  /**
   * Export endpoints to various formats
   */
  exportEndpoints(
    endpoints: DiscoveredEndpoint[],
    format: 'json' | 'csv' | 'yaml' = 'json'
  ): string {
    switch (format) {
      case 'json':
        return JSON.stringify(endpoints, null, 2)

      case 'csv':
        const headers = ['URL', 'Method', 'Pattern', 'Resource Type', 'First Seen', 'Last Used', 'Usage Count']
        const rows = endpoints.map(ep => [
          ep.url,
          ep.method,
          ep.pattern,
          ep.resourceType,
          new Date(ep.firstSeen).toISOString(),
          new Date(ep.lastUsed).toISOString(),
          ep.usageCount.toString()
        ])

        return [headers, ...rows].map(row => row.join(',')).join('\n')

      case 'yaml':
        // Simple YAML-like format
        return endpoints.map(ep =>
          `- url: ${ep.url}\n` +
          `  method: ${ep.method}\n` +
          `  pattern: ${ep.pattern}\n` +
          `  resourceType: ${ep.resourceType}\n` +
          `  usageCount: ${ep.usageCount}\n`
        ).join('\n')

      default:
        return JSON.stringify(endpoints, null, 2)
    }
  }
}

// Export singleton instance
export const endpointDiscoveryService = new EndpointDiscoveryService()

// Export types and class for advanced usage
export { EndpointDiscoveryService }