/**
 * Unified settings hook for managing all application settings
 * Replaces both electron-preferences and previous in-app settings
 */

import { useCallback, useEffect, useState } from 'react'

import { AppSettings, defaultAppSettings } from '../types/settings'
import { logger } from '../utils/logger'

const STORAGE_KEY = 'app-settings'

/**
 * Hook for managing unified application settings with auto-save functionality
 */
export function useExtendedSettings() {
  const log = logger.extension // Using extension context as this is primarily used in UI contexts

  const [settings, setSettings] = useState<AppSettings>(defaultAppSettings)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  log.debug('useExtendedSettings hook initialized')

  // Load settings on mount
  useEffect(() => {
    const loadSettings = async () => {
      log.info('Loading application settings from storage')

      // Check if Electron APIs are available
      if (!window.electron?.storage) {
        log.warn('Electron storage API not available, using defaults')
        setLoading(false)
        return
      }

      try {
        const result = await window.electron.storage.get([STORAGE_KEY])
        if (result[STORAGE_KEY]) {
          log.debug('Found saved settings in storage')

          const { safeJsonParse } = await import('../utils/secure-json')
          const savedSettings = safeJsonParse(result[STORAGE_KEY], defaultAppSettings, {
            maxSize: 50 * 1024, // 50KB limit for settings
            maxDepth: 8,
            maxKeys: 200,
            allowedTypes: ['object', 'array', 'string', 'number', 'boolean', 'null']
          })

          // Deep merge with defaults to ensure all fields exist
          const mergedSettings: AppSettings = {
            ...defaultAppSettings,
            ...savedSettings,
            general: {
              ...defaultAppSettings.general,
              ...savedSettings.general
            },
            export: {
              ...defaultAppSettings.export,
              ...savedSettings.export
            },
            api: {
              ...defaultAppSettings.api,
              ...savedSettings.api,
              rateLimiting: {
                ...defaultAppSettings.api.rateLimiting,
                ...savedSettings.api?.rateLimiting
              }
            },
            performance: {
              ...defaultAppSettings.performance,
              ...savedSettings.performance,
              caching: {
                ...defaultAppSettings.performance.caching,
                ...savedSettings.performance?.caching
              }
            },
            advanced: {
              ...defaultAppSettings.advanced,
              ...savedSettings.advanced
            },
            notifications: {
              ...defaultAppSettings.notifications,
              ...savedSettings.notifications
            }
          }

          setSettings(mergedSettings)
          log.info('Settings loaded successfully', {
            hasCustomizations: JSON.stringify(savedSettings) !== JSON.stringify(defaultAppSettings)
          })
        } else {
          log.warn('No saved settings found, using defaults')
        }
      } catch (err) {
        log.error('Failed to load settings:', err)
        setError('Failed to load settings')
      } finally {
        setLoading(false)
        log.info('Settings loading completed')
      }
    }

    loadSettings()
  }, [log])

  // Save settings to storage
  const saveSettings = useCallback(async (newSettings: AppSettings) => {
    log.info('Saving settings to storage')
    setSaving(true)
    setError(null)

    // Check if Electron APIs are available
    if (!window.electron.storage) {
      log.warn('Electron storage API not available, cannot save settings')
      setSaving(false)
      setError('Storage not available - Electron context required')
      return
    }

    try {
      await window.electron.storage.set({
        [STORAGE_KEY]: JSON.stringify(newSettings)
      })

      // Settings change propagates through Zustand store subscriptions in desktop app
      // No need for runtime messaging

      log.info('Settings saved successfully')
    } catch (err) {
      log.error('Failed to save settings:', err)
      setError('Failed to save settings')
      throw err
    } finally {
      setSaving(false)
    }
  }, [log])

  // Update a specific setting with auto-save
  const updateSetting = useCallback(async <K extends keyof AppSettings>(
    key: K,
    value: AppSettings[K] | ((prev: AppSettings[K]) => AppSettings[K])
  ) => {
    log.debug('Updating setting', { key, valueType: typeof value })

    setSettings(prev => {
      const newValue = typeof value === 'function' ? value(prev[key]) : value
      const newSettings = {
        ...prev,
        [key]: newValue
      }

      log.info('Setting updated', { key, hasChanges: JSON.stringify(newValue) !== JSON.stringify(prev[key]) })

      // Save automatically
      saveSettings(newSettings).catch(err => {
        log.error('Failed to save setting update', { key, error: err?.message })
        // Note: Not reverting state to avoid infinite loops
      })

      return newSettings
    })
  }, [saveSettings, log])

  // Update a nested setting
  const updateNestedSetting = useCallback(async <
    K extends keyof AppSettings,
    NK extends keyof AppSettings[K]
  >(
    category: K,
    key: NK,
    value: AppSettings[K][NK]
  ) => {
    log.debug('Updating nested setting', { category, key, valueType: typeof value })

    setSettings(prev => {
      const oldValue = (prev[category] as any)?.[key]
      const newSettings = {
        ...prev,
        [category]: {
          ...prev[category] as any,
          [key]: value
        }
      }

      log.info('Nested setting updated', {
        category,
        key,
        hasChanges: JSON.stringify(value) !== JSON.stringify(oldValue)
      })

      // Save automatically
      saveSettings(newSettings).catch(err => {
        log.error('Failed to save nested setting update', { category, key, error: err?.message })
        // Note: Not reverting state to avoid infinite loops
      })

      return newSettings
    })
  }, [saveSettings, log])

  return {
    settings,
    loading,
    saving,
    error,
    updateSetting,
    updateNestedSetting,
    resetToDefaults: async () => {
      log.info('Resetting settings to defaults')
      setSettings(defaultAppSettings)
      await saveSettings(defaultAppSettings)
      log.info('Settings reset to defaults completed')
    }
  }
}