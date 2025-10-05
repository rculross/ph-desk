/**
 * Chrome API Compatibility Shim for Electron Desktop App
 *
 * Provides stub implementations of Chrome APIs that aren't available in Electron.
 * These stubs allow existing code to run without errors while providing
 * appropriate fallback behavior for the desktop environment.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

// Declare chrome types for TypeScript
declare global {
  const chrome: {
    runtime: {
      id: string
      lastError?: { message: string }
      getManifest: () => any
      sendMessage: (message: any) => Promise<any>
      onMessage: {
        addListener: (callback: (...args: any[]) => void) => void
      }
    }
    history: {
      search: (query: any) => Promise<any[]>
    }
    tabs: {
      query: (queryInfo: any) => Promise<any[]>
      create: (createProperties: any) => Promise<any>
      sendMessage: (tabId: number, message: any) => Promise<any>
    }
    storage: {
      local: {
        get: (keys: string | string[] | null) => Promise<Record<string, any>>
        set: (items: Record<string, unknown>) => Promise<void>
        remove: (keys: string | string[]) => Promise<void>
        clear: () => Promise<void>
        getBytesInUse: (keys: string | string[] | null) => Promise<number>
        QUOTA_BYTES: number
      }
      sync: {
        get: (keys: string | string[] | null) => Promise<Record<string, any>>
        set: (items: Record<string, unknown>) => Promise<void>
        remove: (keys: string | string[]) => Promise<void>
        clear: () => Promise<void>
      }
    }
  }
}

// Check if we're in an Electron environment
const isElectron = typeof window !== 'undefined' && typeof (window as any).electron !== 'undefined'

// Always create shim in Electron - override any existing chrome API
if (typeof (globalThis as any).chrome === 'undefined' || isElectron) {
  const chromeShim = {
    runtime: {
      id: 'electron-desktop-app',
      lastError: undefined as any,
      getManifest: () => ({
        version: '3.1.274',
        name: 'PH Tools Desktop',
        manifest_version: 3
      }),
      sendMessage: async (message: any) => {
        console.debug('Chrome runtime.sendMessage called in Electron (no-op):', message)
        return Promise.resolve({ success: true })
      },
      onMessage: {
        addListener: (callback: (...args: any[]) => void) => {
          console.debug('Chrome runtime.onMessage.addListener called in Electron (no-op)')
        }
      }
    },
    history: {
      search: async (query: any) => {
        console.debug('Chrome history.search called in Electron (no-op):', query)
        return Promise.resolve([])
      }
    },
    tabs: {
      query: async (queryInfo: any) => {
        console.debug('Chrome tabs.query called in Electron (no-op):', queryInfo)
        return Promise.resolve([])
      },
      create: async (createProperties: any) => {
        console.debug('Chrome tabs.create called in Electron (no-op):', createProperties)
        return Promise.resolve({} as any)
      },
      sendMessage: async (tabId: number, message: any) => {
        console.debug('Chrome tabs.sendMessage called in Electron (no-op):', tabId, message)
        return Promise.resolve(null)
      }
    },
    storage: {
      local: {
        get: async (keys: string | string[] | null) => {
          // Delegate to Electron storage if available
          if (isElectron && window.electron?.storage) {
            return window.electron.storage.get(keys)
          }
          console.warn('Chrome storage.local.get called but no storage available')
          return {}
        },
        set: async (items: Record<string, unknown>) => {
          // Delegate to Electron storage if available
          if (isElectron && window.electron?.storage) {
            return window.electron.storage.set(items)
          }
          console.warn('Chrome storage.local.set called but no storage available')
        },
        remove: async (keys: string | string[]) => {
          // Delegate to Electron storage if available
          if (isElectron && window.electron?.storage) {
            return window.electron.storage.remove(keys)
          }
          console.warn('Chrome storage.local.remove called but no storage available')
        },
        clear: async () => {
          // Delegate to Electron storage if available
          if (isElectron && window.electron?.storage) {
            return window.electron.storage.clear()
          }
          console.warn('Chrome storage.local.clear called but no storage available')
        },
        getBytesInUse: async (keys: string | string[] | null) => {
          // Delegate to Electron storage if available
          if (isElectron && window.electron?.storage) {
            return window.electron.storage.getBytesInUse(keys)
          }
          console.warn('Chrome storage.local.getBytesInUse called but no storage available')
          return 0
        },
        QUOTA_BYTES: 100 * 1024 * 1024 // 100MB for desktop
      },
      sync: {
        get: async (keys: string | string[] | null) => {
          // For desktop, sync and local are the same
          if (isElectron && window.electron?.storage) {
            return window.electron.storage.get(keys)
          }
          console.warn('Chrome storage.sync.get called but no storage available')
          return {}
        },
        set: async (items: Record<string, unknown>) => {
          // For desktop, sync and local are the same
          if (isElectron && window.electron?.storage) {
            return window.electron.storage.set(items)
          }
          console.warn('Chrome storage.sync.set called but no storage available')
        },
        remove: async (keys: string | string[]) => {
          // For desktop, sync and local are the same
          if (isElectron && window.electron?.storage) {
            return window.electron.storage.remove(keys)
          }
          console.warn('Chrome storage.sync.remove called but no storage available')
        },
        clear: async () => {
          // For desktop, sync and local are the same
          if (isElectron && window.electron?.storage) {
            return window.electron.storage.clear()
          }
          console.warn('Chrome storage.sync.clear called but no storage available')
        }
      }
    }
  }

  // Always assign chrome shim to ensure it's available
  ;(globalThis as any).chrome = chromeShim

  // Also expose on window for compatibility
  if (typeof window !== 'undefined') {
    ;(window as any).chrome = chromeShim
  }

  console.log('[Chrome Shim] Initialized chrome API shim for Electron', {
    isElectron,
    hasElectronStorage: isElectron && !!(window as any).electron?.storage
  })
}

// Export for TypeScript
export const chrome = (globalThis as any).chrome
export default chrome
