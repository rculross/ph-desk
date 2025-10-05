/**
 * Extended settings hook for managing all application settings
 */

import { useCallback, useEffect, useState } from 'react'

import { ExtendedUserSettings, defaultExtendedSettings } from '../types/settings'
import { logger } from '../utils/logger'

const STORAGE_KEY = 'extension-settings'

/**
 * Hook for managing extended settings with auto-save functionality
 */
export function useExtendedSettings() {
  const log = logger.extension // Using extension context as this is primarily used in UI contexts
  
  const [settings, setSettings] = useState<ExtendedUserSettings>(defaultExtendedSettings)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  log.debug('useExtendedSettings hook initialized')

  // Load settings on mount
  useEffect(() => {
    const loadSettings = async () => {
      log.info('Loading extended settings from storage')
      
      // Check if Chrome APIs are available
      if (!chrome.storage.local) {
        log.warn('Chrome storage API not available, using defaults')
        setLoading(false)
        return
      }
      
      try {
        const result = await chrome.storage.local.get(STORAGE_KEY)
        if (result[STORAGE_KEY]) {
          log.debug('Found saved settings in storage')
          
          const { safeJsonParse } = await import('../utils/secure-json')
          const savedSettings = safeJsonParse(result[STORAGE_KEY], defaultExtendedSettings, {
            maxSize: 50 * 1024, // 50KB limit for settings
            maxDepth: 8,
            maxKeys: 200,
            allowedTypes: ['object', 'array', 'string', 'number', 'boolean', 'null']
          })
          
          // Merge with defaults to ensure all fields exist
          const mergedSettings = {
            ...defaultExtendedSettings,
            ...savedSettings,
            export: {
              ...defaultExtendedSettings.export,
              ...savedSettings.export
            },
            ui: {
              ...defaultExtendedSettings.ui,
              ...savedSettings.ui
            },
            performance: {
              ...defaultExtendedSettings.performance,
              ...savedSettings.performance
            },
            api: {
              ...defaultExtendedSettings.api,
              ...savedSettings.api
            },
            notifications: {
              ...defaultExtendedSettings.notifications,
              ...savedSettings.notifications
            }
          }
          
          setSettings(mergedSettings)
          log.info('Settings loaded successfully', {
            hasCustomizations: JSON.stringify(savedSettings) !== JSON.stringify(defaultExtendedSettings)
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
  const saveSettings = useCallback(async (newSettings: ExtendedUserSettings) => {
    log.info('Saving settings to storage')
    setSaving(true)
    setError(null)

    // Check if Chrome APIs are available
    if (!chrome.storage.local) {
      log.warn('Chrome storage API not available, cannot save settings')
      setSaving(false)
      setError('Storage not available - extension context required')
      return
    }

    try {
      await chrome.storage.local.set({
        [STORAGE_KEY]: JSON.stringify(newSettings)
      })
      
      // Notify other parts of the extension about settings change
      if (chrome.runtime.sendMessage) {
        log.debug('Notifying other extension contexts about settings update')
        await chrome.runtime.sendMessage({
          type: 'SETTINGS_UPDATED',
          settings: newSettings
        }).catch((err) => {
          // Ignore errors if background script is not ready
          log.warn('Could not notify background script about settings update', { error: err?.message })
        })
      }

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
  const updateSetting = useCallback(async <K extends keyof ExtendedUserSettings>(
    key: K,
    value: ExtendedUserSettings[K] | ((prev: ExtendedUserSettings[K]) => ExtendedUserSettings[K])
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
    K extends keyof ExtendedUserSettings,
    NK extends keyof ExtendedUserSettings[K]
  >(
    category: K,
    key: NK,
    value: ExtendedUserSettings[K][NK]
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
      setSettings(defaultExtendedSettings)
      await saveSettings(defaultExtendedSettings)
      log.info('Settings reset to defaults completed')
    }
  }
}