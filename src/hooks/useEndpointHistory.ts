/**
 * Endpoint History Hook
 *
 * Manages Chrome storage for Flex Exporter endpoint history.
 * Stores the last 20 unique endpoints with metadata.
 */

import { useState, useCallback, useEffect } from 'react'

import { formatDistanceToNow } from 'date-fns'

import { logger } from '../utils/logger'

const log = logger.api

export interface HistoryItem {
  id: string
  endpoint: string
  method: 'GET' | 'POST' | 'PUT'
  timestamp: number
  displayTime: string
}

interface StoredHistoryItem {
  endpoint: string
  method: 'GET' | 'POST' | 'PUT'
  timestamp: number
}

const HISTORY_KEY = 'flex-export-history'
const MAX_HISTORY_ITEMS = 20

export function useEndpointHistory() {
  const [history, setHistory] = useState<HistoryItem[]>([])
  const [isLoading, setIsLoading] = useState(true)

  // Load history from Chrome storage
  const loadHistory = useCallback(async () => {
    try {
      setIsLoading(true)
      const result = await window.electron.storage.get([HISTORY_KEY])
      const storedHistory: StoredHistoryItem[] = result[HISTORY_KEY] ?? []

      // Convert to display format and sort by timestamp (newest first)
      const historyItems: HistoryItem[] = storedHistory
        .sort((a, b) => b.timestamp - a.timestamp)
        .map(item => ({
          id: `${item.method}-${item.endpoint}-${item.timestamp}`,
          endpoint: item.endpoint,
          method: item.method,
          timestamp: item.timestamp,
          displayTime: formatDistanceToNow(new Date(item.timestamp), { addSuffix: true })
        }))

      setHistory(historyItems)

      log.debug('Endpoint history loaded', {
        count: historyItems.length
      })
    } catch (error) {
      log.error('Failed to load endpoint history', {
        error: error instanceof Error ? error.message : 'Unknown error'
      })
      setHistory([])
    } finally {
      setIsLoading(false)
    }
  }, [])

  // Save endpoint to history
  const addToHistory = useCallback(async (endpoint: string, method: 'GET' | 'POST' | 'PUT') => {
    if (!endpoint.trim()) return

    try {
      const result = await window.electron.storage.get([HISTORY_KEY])
      const storedHistory: StoredHistoryItem[] = result[HISTORY_KEY] ?? []

      // Remove existing entry with same endpoint and method (for deduplication)
      const filteredHistory = storedHistory.filter(
        item => !(item.endpoint === endpoint.trim() && item.method === method)
      )

      // Add new entry at the beginning
      const newItem: StoredHistoryItem = {
        endpoint: endpoint.trim(),
        method,
        timestamp: Date.now()
      }

      const updatedHistory = [newItem, ...filteredHistory].slice(0, MAX_HISTORY_ITEMS)

      // Save back to storage
      await window.electron.storage.set({ [HISTORY_KEY]: updatedHistory })

      // Reload the display history
      await loadHistory()

      log.debug('Endpoint added to history', {
        endpoint: endpoint.trim(),
        method,
        totalItems: updatedHistory.length
      })
    } catch (error) {
      log.error('Failed to add endpoint to history', {
        endpoint: endpoint.trim(),
        method,
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  }, [loadHistory])

  // Clear all history
  const clearHistory = useCallback(async () => {
    try {
      await window.electron.storage.remove([HISTORY_KEY])
      setHistory([])

      log.info('Endpoint history cleared')
    } catch (error) {
      log.error('Failed to clear endpoint history', {
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  }, [])

  // Load history on mount
  useEffect(() => {
    void loadHistory()
  }, [loadHistory])

  return {
    history,
    isLoading,
    addToHistory,
    clearHistory,
    reloadHistory: loadHistory
  }
}