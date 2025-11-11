/**
 * Unified settings types for PH Tools Desktop
 * Combines all application settings in one structure
 */

import { UserSettings } from './index'

/**
 * Unified application settings interface
 * Merges former electron-preferences and in-app settings
 */
export interface AppSettings extends UserSettings {
  // General Settings
  general: {
    theme: 'light' | 'dark' | 'system'
    startupBehavior: 'home' | 'restore' | 'blank'
    autoUpdate: boolean
    notifications: boolean
  }

  // Export Settings
  export: {
    defaultFormat: 'csv' | 'xlsx' | 'json'
    includeHeaders: boolean
    autoDownload: boolean
    openAfterExport: boolean
    dateFormat: 'ISO' | 'US' | 'EU'
    encoding: string
  }

  // API Configuration
  api: {
    timeout: number // in seconds
    retryAttempts: 1 | 3 | 5
    rateLimiting: {
      enabled: boolean
      requestsPerSecond: number
      maxConcurrent: number
      retryDelay: number // in milliseconds
    }
  }

  // Performance Settings
  performance: {
    exportBatchSize: 500 | 1000 | 2000 | 5000
    enableVirtualScrolling: boolean
    caching: {
      enabled: boolean
      duration: number // in minutes
    }
  }

  // Advanced Settings
  advanced: {
    logLevel: 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'silent'
    developerMode: boolean
    experimentalFeatures: boolean
  }
}

// Default values for all settings
export const defaultAppSettings: AppSettings = {
  // Base settings from UserSettings
  language: 'en',
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  dateFormat: 'MM/dd/yyyy',
  pageSize: 25,
  autoSave: true,
  notifications: {
    desktop: true,
    email: true,
    sound: false
  },
  experimental: {},

  // General
  general: {
    theme: 'system',
    startupBehavior: 'restore',
    autoUpdate: true,
    notifications: true
  },

  // Export
  export: {
    defaultFormat: 'csv',
    includeHeaders: true,
    autoDownload: false,
    openAfterExport: false,
    dateFormat: 'ISO',
    encoding: 'utf-8'
  },

  // API
  api: {
    timeout: 30,
    retryAttempts: 3,
    rateLimiting: {
      enabled: true,
      requestsPerSecond: 10,
      maxConcurrent: 5,
      retryDelay: 1000
    }
  },

  // Performance
  performance: {
    exportBatchSize: 1000,
    enableVirtualScrolling: true,
    caching: {
      enabled: true,
      duration: 5
    }
  },

  // Advanced
  advanced: {
    logLevel: 'info',
    developerMode: false,
    experimentalFeatures: false
  }
}

// Legacy type alias for backward compatibility during migration
export type ExtendedUserSettings = AppSettings
export const defaultExtendedSettings = defaultAppSettings