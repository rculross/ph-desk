/**
 * Endpoint Discovery Hook
 *
 * Manages endpoint discovery, storage, and analysis functionality.
 * Extends the basic endpoint history with advanced discovery features.
 */

import { useState, useCallback, useEffect, useMemo } from 'react'

import { formatDistanceToNow } from 'date-fns'

import {
  endpointDiscoveryService,
  type DiscoveredEndpoint,
  type EndpointPattern,
  type EndpointDiscoveryConfig
} from '../api/services/endpoint-discovery.service'
import { logger } from '../utils/logger'

const log = logger.api

interface EndpointDiscoveryFilters {
  searchTerm: string
  method: string
  resourceType: string
  pattern: string
}

const DISCOVERY_STORAGE_KEY = 'endpoint-discovery-data'
const CONFIG_STORAGE_KEY = 'endpoint-discovery-config'
const MAX_ENDPOINTS = 1000

const DEFAULT_CONFIG: EndpointDiscoveryConfig = {
  maxEndpoints: MAX_ENDPOINTS,
  scanHistoryDays: 7,
  enableRealTimeDiscovery: true,
  autoNormalize: true,
  includeQuery: false
}

export function useEndpointDiscovery() {
  const [endpoints, setEndpoints] = useState<DiscoveredEndpoint[]>([])
  const [patterns, setPatterns] = useState<EndpointPattern[]>([])
  const [config, setConfig] = useState<EndpointDiscoveryConfig>(DEFAULT_CONFIG)
  const [filters, setFilters] = useState<EndpointDiscoveryFilters>({
    searchTerm: '',
    method: '',
    resourceType: '',
    pattern: ''
  })
  const [isLoading, setIsLoading] = useState(true)
  const [isScanning, setIsScanning] = useState(false)
  const [isAnalyzing, setIsAnalyzing] = useState(false)

  // Load endpoints and config from Chrome storage
  const loadData = useCallback(async () => {
    try {
      setIsLoading(true)
      const result = await chrome.storage.local.get([DISCOVERY_STORAGE_KEY, CONFIG_STORAGE_KEY])

      const storedEndpoints: DiscoveredEndpoint[] = result[DISCOVERY_STORAGE_KEY] ?? []
      const storedConfig: EndpointDiscoveryConfig = { ...DEFAULT_CONFIG, ...result[CONFIG_STORAGE_KEY] }

      // Sort endpoints by last used (newest first)
      const sortedEndpoints = storedEndpoints.sort((a, b) => b.lastUsed - a.lastUsed)

      setEndpoints(sortedEndpoints)
      setConfig(storedConfig)

      // Analyze patterns
      const analyzedPatterns = endpointDiscoveryService.analyzePatterns(sortedEndpoints)
      setPatterns(analyzedPatterns)

      log.debug('Endpoint discovery data loaded', {
        endpointCount: sortedEndpoints.length,
        patternCount: analyzedPatterns.length
      })
    } catch (error) {
      log.error('Failed to load endpoint discovery data', {
        error: error instanceof Error ? error.message : 'Unknown error'
      })
      setEndpoints([])
      setPatterns([])
    } finally {
      setIsLoading(false)
    }
  }, [])

  // Save endpoints to Chrome storage
  const saveEndpoints = useCallback(async (newEndpoints: DiscoveredEndpoint[]) => {
    try {
      // Limit to max endpoints (keep most recent)
      const limitedEndpoints = newEndpoints
        .sort((a, b) => b.lastUsed - a.lastUsed)
        .slice(0, config.maxEndpoints)

      await chrome.storage.local.set({ [DISCOVERY_STORAGE_KEY]: limitedEndpoints })

      log.debug('Endpoints saved to storage', {
        count: limitedEndpoints.length
      })
    } catch (error) {
      log.error('Failed to save endpoints', {
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  }, [config.maxEndpoints])

  // Save config to Chrome storage
  const saveConfig = useCallback(async (newConfig: EndpointDiscoveryConfig) => {
    try {
      await chrome.storage.local.set({ [CONFIG_STORAGE_KEY]: newConfig })
      setConfig(newConfig)

      log.debug('Configuration saved', newConfig)
    } catch (error) {
      log.error('Failed to save configuration', {
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  }, [])

  // Add or update an endpoint
  const addEndpoint = useCallback(async (
    url: string,
    method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' = 'GET',
    metadata?: Record<string, any>
  ) => {
    if (!url.trim()) return

    try {
      const { normalizedUrl, pattern, resourceType } = endpointDiscoveryService.normalizeUrl(url)
      const now = Date.now()

      // Check if endpoint already exists
      const existingIndex = endpoints.findIndex(
        ep => ep.normalizedUrl === normalizedUrl && ep.method === method
      )

      let updatedEndpoints: DiscoveredEndpoint[]

      if (existingIndex >= 0) {
        // Update existing endpoint
        updatedEndpoints = [...endpoints]
        const existing = updatedEndpoints[existingIndex]
        if (existing) {
          updatedEndpoints[existingIndex] = {
            ...existing,
            lastUsed: now,
            usageCount: existing.usageCount + 1,
            metadata: { ...existing.metadata, ...metadata }
          }
        }
      } else {
        // Add new endpoint
        const newEndpoint: DiscoveredEndpoint = {
          url: url.trim(),
          normalizedUrl,
          method,
          pattern,
          resourceType,
          firstSeen: now,
          lastUsed: now,
          usageCount: 1,
          metadata: metadata ?? {}
        }

        updatedEndpoints = [newEndpoint, ...endpoints]
      }

      setEndpoints(updatedEndpoints)
      await saveEndpoints(updatedEndpoints)

      // Update patterns
      const newPatterns = endpointDiscoveryService.analyzePatterns(updatedEndpoints)
      setPatterns(newPatterns)

      log.debug('Endpoint added/updated', {
        url: url.trim(),
        method,
        isNew: existingIndex < 0
      })
    } catch (error) {
      log.error('Failed to add endpoint', {
        url: url.trim(),
        method,
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  }, [endpoints, saveEndpoints])

  // Remove an endpoint
  const removeEndpoint = useCallback(async (url: string, method: string) => {
    try {
      const updatedEndpoints = endpoints.filter(
        ep => !(ep.url === url && ep.method === method)
      )

      setEndpoints(updatedEndpoints)
      await saveEndpoints(updatedEndpoints)

      // Update patterns
      const newPatterns = endpointDiscoveryService.analyzePatterns(updatedEndpoints)
      setPatterns(newPatterns)

      log.debug('Endpoint removed', { url, method })
    } catch (error) {
      log.error('Failed to remove endpoint', {
        url,
        method,
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  }, [endpoints, saveEndpoints])

  // Scan active browser tabs for endpoints
  const scanTabs = useCallback(async () => {
    try {
      setIsScanning(true)
      const discoveredEndpoints = await endpointDiscoveryService.scanActiveTabs()

      // Merge with existing endpoints
      for (const endpoint of discoveredEndpoints) {
        await addEndpoint(endpoint.url, endpoint.method, endpoint.metadata)
      }

      log.info('Tab scan completed', {
        discovered: discoveredEndpoints.length
      })
    } catch (error) {
      log.error('Failed to scan tabs', {
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    } finally {
      setIsScanning(false)
    }
  }, [addEndpoint])

  // Scan browser history for endpoints
  const scanHistory = useCallback(async (days: number = config.scanHistoryDays) => {
    try {
      setIsScanning(true)
      const discoveredEndpoints = await endpointDiscoveryService.scanBrowserHistory(days)

      // Merge with existing endpoints
      for (const endpoint of discoveredEndpoints) {
        await addEndpoint(endpoint.url, endpoint.method, endpoint.metadata)
      }

      log.info('History scan completed', {
        days,
        discovered: discoveredEndpoints.length
      })
    } catch (error) {
      log.error('Failed to scan history', {
        days,
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    } finally {
      setIsScanning(false)
    }
  }, [config.scanHistoryDays, addEndpoint])

  // Analyze endpoint response schema
  const analyzeEndpoint = useCallback(async (url: string, method: 'GET' = 'GET') => {
    try {
      setIsAnalyzing(true)
      const result = await endpointDiscoveryService.analyzeEndpoint(url, method)

      if (result.schema) {
        // Update endpoint with schema information
        const updatedEndpoints = endpoints.map(ep => {
          if (ep.url === url && ep.method === method) {
            return {
              ...ep,
              responseSchema: result.schema,
              metadata: {
                ...ep.metadata,
                lastAnalyzed: Date.now()
              }
            }
          }
          return ep
        })

        setEndpoints(updatedEndpoints)
        await saveEndpoints(updatedEndpoints)
      }

      return result
    } catch (error) {
      log.error('Failed to analyze endpoint', {
        url,
        method,
        error: error instanceof Error ? error.message : 'Unknown error'
      })
      return { error: error instanceof Error ? error.message : 'Unknown error' }
    } finally {
      setIsAnalyzing(false)
    }
  }, [endpoints, saveEndpoints])

  // Clear all endpoints
  const clearEndpoints = useCallback(async () => {
    try {
      await chrome.storage.local.remove([DISCOVERY_STORAGE_KEY])
      setEndpoints([])
      setPatterns([])

      log.info('All endpoints cleared')
    } catch (error) {
      log.error('Failed to clear endpoints', {
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  }, [])

  // Filter endpoints based on current filters
  const filteredEndpoints = useMemo(() => {
    return endpoints.filter(endpoint => {
      if (filters.searchTerm) {
        const searchLower = filters.searchTerm.toLowerCase()
        if (
          !endpoint.url.toLowerCase().includes(searchLower) &&
          !endpoint.pattern.toLowerCase().includes(searchLower) &&
          !endpoint.resourceType.toLowerCase().includes(searchLower)
        ) {
          return false
        }
      }

      if (filters.method && endpoint.method !== filters.method) {
        return false
      }

      if (filters.resourceType && endpoint.resourceType !== filters.resourceType) {
        return false
      }

      if (filters.pattern && endpoint.pattern !== filters.pattern) {
        return false
      }

      return true
    })
  }, [endpoints, filters])

  // Export endpoints in various formats
  const exportEndpoints = useCallback((format: 'json' | 'csv' | 'yaml' = 'json') => {
    return endpointDiscoveryService.exportEndpoints(filteredEndpoints, format)
  }, [filteredEndpoints])

  // Import endpoints from JSON
  const importEndpoints = useCallback(async (data: string) => {
    try {
      const importedEndpoints: DiscoveredEndpoint[] = JSON.parse(data)

      if (!Array.isArray(importedEndpoints)) {
        throw new Error('Invalid format: expected array of endpoints')
      }

      // Merge with existing endpoints
      for (const endpoint of importedEndpoints) {
        await addEndpoint(endpoint.url, endpoint.method, endpoint.metadata)
      }

      log.info('Endpoints imported', {
        count: importedEndpoints.length
      })
    } catch (error) {
      log.error('Failed to import endpoints', {
        error: error instanceof Error ? error.message : 'Unknown error'
      })
      throw error
    }
  }, [addEndpoint])

  // Get unique values for filter options
  const filterOptions = useMemo(() => {
    const methods = Array.from(new Set(endpoints.map(ep => ep.method))).sort()
    const resourceTypes = Array.from(new Set(endpoints.map(ep => ep.resourceType))).sort()
    const patternList = Array.from(new Set(endpoints.map(ep => ep.pattern))).sort()

    return {
      methods,
      resourceTypes,
      patterns: patternList
    }
  }, [endpoints])

  // Load data on mount
  useEffect(() => {
    void loadData()
  }, [loadData])

  return {
    // Data
    endpoints: filteredEndpoints,
    allEndpoints: endpoints,
    patterns,
    config,
    filterOptions,

    // State
    isLoading,
    isScanning,
    isAnalyzing,
    filters,

    // Actions
    addEndpoint,
    removeEndpoint,
    scanTabs,
    scanHistory,
    analyzeEndpoint,
    clearEndpoints,
    exportEndpoints,
    importEndpoints,
    saveConfig,
    reloadData: loadData,

    // Filter actions
    setFilters,
    updateFilter: (key: keyof EndpointDiscoveryFilters, value: string) => {
      setFilters(prev => ({ ...prev, [key]: value }))
    },
    clearFilters: () => {
      setFilters({
        searchTerm: '',
        method: '',
        resourceType: '',
        pattern: ''
      })
    }
  }
}