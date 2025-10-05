/**
 * Chrome Extension API type definitions and interfaces
 * Provides comprehensive typing for Chrome extension runtime and message APIs
 */

// Chrome Runtime Message Types
export interface ChromeRuntimeMessage {
  action: string
  payload?: Record<string, unknown>
  timestamp: number
  requestId: string
}

export interface ChromeMessageResponse {
  success: boolean
  data?: unknown
  error?: string
  code?: string
  requestId?: string
}

// Content Script Message Types
export interface ContentScriptMessage extends ChromeRuntimeMessage {
  action: 'UPDATE_SETTING' | 'REFRESH_ENHANCEMENTS' | 'UPDATE_SETTINGS' | string
  payload?: {
    setting?: string
    enabled?: boolean
    settings?: Record<string, unknown>
  }
}

export interface UpdateSettingMessage extends ChromeRuntimeMessage {
  action: 'UPDATE_SETTING'
  payload: {
    setting: string
    enabled: boolean
  }
}

export interface RefreshEnhancementsMessage extends ChromeRuntimeMessage {
  action: 'REFRESH_ENHANCEMENTS'
  payload?: undefined
}

export interface UpdateSettingsMessage extends ChromeRuntimeMessage {
  action: 'UPDATE_SETTINGS'
  payload: {
    settings: Record<string, unknown>
  }
}

// Experimental Settings Types
export interface ExperimentalSettings {
  modalDropdownEnhancement: boolean
  enhancedLogs: boolean
  diffHighlighting: boolean
  [key: string]: boolean | unknown
}

// Type for specific experimental setting keys (excludes index signature)
export type ExperimentalSettingKey = 'modalDropdownEnhancement' | 'enhancedLogs' | 'diffHighlighting'

// Chrome Storage Data Types
export interface ChromeStorageData {
  experimentalSettings?: ExperimentalSettings
  version?: string
  [key: string]: unknown
}

// Chrome Extension Context Types
export interface ChromeExtensionContext {
  runtime: {
    id: string
    getManifest(): any
    onMessage: {
      addListener(callback: ChromeMessageListener): void
      removeListener(callback: ChromeMessageListener): void
    }
    sendMessage(message: ChromeRuntimeMessage): Promise<ChromeMessageResponse>
    lastError?: { message: string }
  }
  storage: {
    local: {
      get(keys?: string | string[] | Record<string, unknown>): Promise<ChromeStorageData>
      set(items: ChromeStorageData): Promise<void>
    }
  }
  tabs: {
    create(createProperties: any): Promise<any>
    sendMessage(tabId: number, message: ChromeRuntimeMessage): Promise<ChromeMessageResponse>
  }
}

// Message Listener Type
export type ChromeMessageListener = (
  message: ChromeRuntimeMessage,
  sender: any,
  sendResponse: (response?: ChromeMessageResponse) => void
) => boolean | void

// Validation Functions
export function isValidChromeMessage(message: unknown): message is ChromeRuntimeMessage {
  return (
    typeof message === 'object' &&
    message !== null &&
    'action' in message &&
    typeof (message as any).action === 'string' &&
    'timestamp' in message &&
    typeof (message as any).timestamp === 'number' &&
    'requestId' in message &&
    typeof (message as any).requestId === 'string'
  )
}

export function isValidContentScriptMessage(message: unknown): message is ContentScriptMessage {
  if (!isValidChromeMessage(message)) {
    return false
  }

  const typedMessage = message
  const validActions = ['UPDATE_SETTING', 'REFRESH_ENHANCEMENTS', 'UPDATE_SETTINGS']

  return validActions.includes(typedMessage.action) || typeof typedMessage.action === 'string'
}

export function isValidExperimentalSettings(settings: unknown): settings is ExperimentalSettings {
  return (
    typeof settings === 'object' &&
    settings !== null &&
    'modalDropdownEnhancement' in settings &&
    typeof (settings as any).modalDropdownEnhancement === 'boolean' &&
    'enhancedLogs' in settings &&
    typeof (settings as any).enhancedLogs === 'boolean' &&
    'diffHighlighting' in settings &&
    typeof (settings as any).diffHighlighting === 'boolean'
  )
}

// Type guards for Chrome API availability
export function isChromeExtensionContext(): boolean {
  try {
    return (
      typeof chrome.runtime !== 'undefined' &&
      typeof chrome.runtime.id === 'string' &&
      chrome.runtime.id.length > 0
    )
  } catch {
    return false
  }
}

export function isChromeStorageAvailable(): boolean {
  try {
    return (
      isChromeExtensionContext() &&
      typeof chrome.storage.local !== 'undefined'
    )
  } catch {
    return false
  }
}

export function isChromeTabsAvailable(): boolean {
  try {
    return (
      isChromeExtensionContext() &&
      typeof chrome.tabs !== 'undefined'
    )
  } catch {
    return false
  }
}

// Helper function to validate Chrome runtime context
export function validateChromeRuntime(): boolean {
  try {
    if (!isChromeExtensionContext()) {
      return false
    }

    // Try to access manifest to verify context is valid
    chrome.runtime.getManifest()
    return true
  } catch {
    return false
  }
}

// Alias for backwards compatibility
export const validateExtensionRuntime = validateChromeRuntime

// Default experimental settings
export const DEFAULT_EXPERIMENTAL_SETTINGS: ExperimentalSettings = {
  modalDropdownEnhancement: false,
  enhancedLogs: false,
  diffHighlighting: false
}