/**
 * LogSettings React component for Planhat Chrome Extension
 * 
 * Provides a user interface for configuring logging levels with:
 * - Select dropdown with all log levels
 * - Helpful descriptions for each level  
 * - Auto-save functionality with instant feedback
 * - Integration with Chrome storage-based settings
 */

import React, { useState, useEffect } from 'react'

import { clsx } from 'clsx'

import { logger, setLogLevel } from '../../utils/logger'
import { Select } from '../ui/Select'

type LogLevelSetting = 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'silent'

interface LogLevelOption {
  value: LogLevelSetting
  label: string
  description: string
}

const LOG_LEVEL_OPTIONS: LogLevelOption[] = [
  {
    value: 'silent',
    label: 'Silent',
    description: 'No logging output - disables all console messages'
  },
  {
    value: 'error', 
    label: 'Error',
    description: 'Only critical errors - shows failures that need immediate attention'
  },
  {
    value: 'warn',
    label: 'Warning', 
    description: 'Warnings and errors - includes potential issues and failures'
  },
  {
    value: 'info',
    label: 'Info',
    description: 'General information - shows user actions, state changes, warnings, and errors'
  },
  {
    value: 'debug',
    label: 'Debug',
    description: 'Detailed debugging - includes API calls, feature flow, and troubleshooting info'
  },
  {
    value: 'trace',
    label: 'Trace',
    description: 'Maximum verbosity - shows everything including internal operations (very verbose)'
  }
]

export function LogSettings() {
  const [level, setLevel] = useState<LogLevelSetting>('info')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saveSuccess, setSaveSuccess] = useState(false)

  useEffect(() => {
    // Load current setting on mount
    const loadSettings = async () => {
      try {
        // Check Chrome storage for saved log level
        if (typeof window !== 'undefined' && window.electron.storage) {
          const result = await window.electron.storage.get(['logLevel'])
          const current = result.logLevel ?? 'info'
          setLevel(current as LogLevelSetting)
        } else {
          // Fallback to default
          setLevel('info')
        }
      } catch (err) {
        logger.extension.error('Failed to load log level settings:', err)
        setError('Failed to load current settings')
      }
    }
    
    loadSettings()
  }, [])

  // Auto-save when level changes
  const handleLevelChange = async (newLevel: string | number | undefined) => {
    if (!newLevel || typeof newLevel !== 'string') return
    
    const logLevel = newLevel as LogLevelSetting
    
    setSaving(true)
    setError(null)
    setSaveSuccess(false)
    
    try {
      // Set the logger level immediately
      setLogLevel(logLevel)
      
      // Save to Chrome storage for persistence
      if (typeof window !== 'undefined' && window.electron.storage) {
        await window.electron.storage.set({ logLevel })
      }
      
      setLevel(logLevel)
      setSaveSuccess(true)
      
      // Show success feedback briefly
      setTimeout(() => setSaveSuccess(false), 2000)
      
    } catch (err) {
      logger.extension.error('Failed to save log level:', err)
      setError('Failed to save settings. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  const selectedOption = LOG_LEVEL_OPTIONS.find(option => option.value === level)

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Log Level</label>
        <Select
          value={level}
          onChange={handleLevelChange}
          options={LOG_LEVEL_OPTIONS.map(option => ({
            value: option.value,
            label: option.label,
            description: option.description
          }))}
          disabled={saving}
          loading={saving}
          placeholder="Select log level..."
          className="w-full"
          status={error ? 'error' : undefined}
        />
        {error && (
          <div className="text-red-500 text-sm mt-1">{error}</div>
        )}
      </div>

      {/* Save status feedback */}
      {saving && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
          <span>Saving settings...</span>
        </div>
      )}

      {saveSuccess && !saving && (
        <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
          <div className="h-4 w-4">
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <span>Settings saved successfully!</span>
        </div>
      )}
    </div>
  )
}