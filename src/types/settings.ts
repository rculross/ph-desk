/**
 * Extended settings types for the Planhat Extension
 */

import { UserSettings } from './index'

export interface ExtendedUserSettings extends UserSettings {
  // Export Settings
  export: {
    defaultFormat: 'csv' | 'xlsx' | 'json'
    includeHeaders: boolean
    autoDownload: boolean
  }
  
  // UI Enhancements
  ui: {
    enhancedLogs: boolean
    wideModalDropdowns: boolean
    diffHighlighting: boolean
  }
  
  // Performance Settings
  performance: {
    exportBatchSize: 500 | 1000 | 2000 | 5000
    enableVirtualScrolling: boolean
  }
  
  // API Configuration
  api: {
    timeout: number // in seconds
    retryAttempts: 1 | 3 | 5
  }
}

// Default values for extended settings
export const defaultExtendedSettings: ExtendedUserSettings = {
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
  
  // Extended settings
  export: {
    defaultFormat: 'csv',
    includeHeaders: true,
    autoDownload: false
  },
  ui: {
    enhancedLogs: false,
    wideModalDropdowns: false,
    diffHighlighting: false
  },
  performance: {
    exportBatchSize: 1000,
    enableVirtualScrolling: true
  },
  api: {
    timeout: 30,
    retryAttempts: 3
  }
}