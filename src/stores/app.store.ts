import { create } from 'zustand'
import { persist, createJSONStorage, subscribeWithSelector } from 'zustand/middleware'

import type { Notification, UserSettings } from '../types'
import { logger } from '../utils/logger'
import { parseSecureJson } from '../utils/secure-json'
import { storageManager } from '../utils/storage-manager'

/**
 * App Store
 *
 * Manages global application state including theme, notifications,
 * user preferences, and UI state using Zustand with persistence.
 */

export interface AppState {
  // Theme and UI state
  theme: 'light' | 'dark' | 'system'
  sidebarCollapsed: boolean
  sidebarWidth: number

  // Notifications
  notifications: Notification[]
  unreadNotifications: number

  // User settings and preferences
  settings: UserSettings

  // Activity tracking
  lastActivity: number
  isActive: boolean

  // Modal and overlay state
  modals: {
    [key: string]: {
      isOpen: boolean
      data?: unknown
    }
  }

  // Command palette
  commandPaletteOpen: boolean

  // Loading states
  globalLoading: boolean
  loadingMessage: string | null

  // Connection status
  isOnline: boolean
  connectionQuality: 'good' | 'poor' | 'offline'

  // Feature flags
  featureFlags: {
    [key: string]: boolean
  }
}

export interface AppActions {
  // Theme management
  setTheme: (theme: 'light' | 'dark' | 'system') => void
  toggleTheme: () => void
  getComputedTheme: () => 'light' | 'dark'

  // Sidebar management
  setSidebarCollapsed: (collapsed: boolean) => void
  toggleSidebar: () => void
  setSidebarWidth: (width: number) => void

  // Notification management
  addNotification: (notification: Omit<Notification, 'id' | 'timestamp' | 'read'>) => void
  removeNotification: (id: string) => void
  markNotificationRead: (id: string) => void
  markAllNotificationsRead: () => void
  clearNotifications: () => void

  // Settings management
  updateSettings: (updates: Partial<UserSettings>) => void
  resetSettings: () => void

  // Activity tracking
  updateActivity: () => void
  setActive: (active: boolean) => void

  // Modal management
  openModal: (modalKey: string, data?: unknown) => void
  closeModal: (modalKey: string) => void
  isModalOpen: (modalKey: string) => boolean
  getModalData: (modalKey: string) => unknown

  // Command palette
  openCommandPalette: () => void
  closeCommandPalette: () => void
  toggleCommandPalette: () => void

  // Loading states
  setGlobalLoading: (loading: boolean, message?: string) => void

  // Connection status
  setOnlineStatus: (online: boolean) => void
  setConnectionQuality: (quality: 'good' | 'poor' | 'offline') => void

  // Feature flags
  setFeatureFlag: (flag: string, enabled: boolean) => void
  hasFeatureFlag: (flag: string) => boolean

  // Utility actions
  reset: () => void
  exportSettings: () => string
  importSettings: (settings: string) => void
}

export type AppStore = AppState & AppActions

const defaultSettings: UserSettings = {
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
  experimental: {}
}

const initialState: AppState = {
  theme: 'system',
  sidebarCollapsed: false,
  sidebarWidth: 280,

  notifications: [],
  unreadNotifications: 0,

  settings: defaultSettings,

  lastActivity: Date.now(),
  isActive: true,

  modals: {},

  commandPaletteOpen: false,

  globalLoading: false,
  loadingMessage: null,

  isOnline: navigator.onLine,
  connectionQuality: 'good',

  featureFlags: {
    // Default feature flags
    dataExport: true,
    bulkOperations: true,
    advancedFilters: true,
    realTimeUpdates: false,
    offlineMode: false,
    analytics: true
  }
}

/**
 * App Store Implementation
 */
export const useAppStore = create<AppStore>()(
  subscribeWithSelector(
    persist(
      (set, get) => ({
        ...initialState,

        // Theme management
        setTheme: (theme: 'light' | 'dark' | 'system') => {
          logger.extension.info('Theme changed', { from: get().theme, to: theme })
          set({ theme })

          // Update CSS classes
          updateThemeClasses(theme)
        },

        toggleTheme: () => {
          const currentTheme = get().theme
          let newTheme: 'light' | 'dark' | 'system'

          switch (currentTheme) {
            case 'light':
              newTheme = 'dark'
              break
            case 'dark':
              newTheme = 'system'
              break
            default:
              newTheme = 'light'
              break
          }

          logger.extension.info('Theme toggled', { from: currentTheme, to: newTheme })
          get().setTheme(newTheme)
        },

        getComputedTheme: (): 'light' | 'dark' => {
          const theme = get().theme

          if (theme === 'system') {
            return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
          }

          return theme
        },

        // Sidebar management
        setSidebarCollapsed: (collapsed: boolean) => {
          logger.extension.debug('Sidebar collapsed state changed', { collapsed })
          set({ sidebarCollapsed: collapsed })
        },

        toggleSidebar: () => {
          set(state => ({ sidebarCollapsed: !state.sidebarCollapsed }))
        },

        setSidebarWidth: (width: number) => {
          set({ sidebarWidth: Math.max(200, Math.min(400, width)) })
        },

        // Notification management
        addNotification: (notification: Omit<Notification, 'id' | 'timestamp' | 'read'>) => {
          const id = generateId()
          const timestamp = Date.now()

          logger.extension.info('Notification added', {
            type: notification.type,
            title: notification.title,
            id
          })

          set(state => {
            const newNotification = {
              ...notification,
              id,
              timestamp,
              read: false
            }
            
            const newNotifications = [newNotification, ...state.notifications]
            
            return {
              notifications: newNotifications.length > 50 ? newNotifications.slice(0, 50) : newNotifications,
              unreadNotifications: state.unreadNotifications + 1
            }
          })

          // Show browser notification if enabled
          const settings = get().settings
          if (settings.notifications.desktop && 'Notification' in window) {
            if (Notification.permission === 'granted') {
              new Notification(notification.title, {
                body: notification.message,
                icon: '/assets/icons/icon48.png'
              })
            } else if (Notification.permission === 'default') {
              void Notification.requestPermission()
            }
          }
        },

        removeNotification: (id: string) => {
          set(state => {
            const notificationIndex = state.notifications.findIndex(n => n.id === id)
            if (notificationIndex >= 0) {
              const notification = state.notifications[notificationIndex]
              const wasUnread = !notification?.read
              
              logger.extension.debug('Notification removed', { id, wasUnread })
              
              return {
                notifications: state.notifications.filter(n => n.id !== id),
                unreadNotifications: wasUnread 
                  ? Math.max(0, state.unreadNotifications - 1)
                  : state.unreadNotifications
              }
            }
            return {}
          })
        },

        markNotificationRead: (id: string) => {
          set(state => {
            const notification = state.notifications.find(n => n.id === id)
            if (notification && !notification.read) {
              return {
                notifications: state.notifications.map(n => 
                  n.id === id ? { ...n, read: true } : n
                ),
                unreadNotifications: Math.max(0, state.unreadNotifications - 1)
              }
            }
            return {}
          })
        },

        markAllNotificationsRead: () => {
          const unreadCount = get().unreadNotifications
          logger.extension.info('All notifications marked as read', { previousUnreadCount: unreadCount })
          
          set(state => ({
            notifications: state.notifications.map(notification => ({ ...notification, read: true })),
            unreadNotifications: 0
          }))
        },

        clearNotifications: () => {
          set({ 
            notifications: [],
            unreadNotifications: 0
          })
        },

        // Settings management
        updateSettings: (updates: Partial<UserSettings>) => {
          logger.extension.info('Settings updated', {
            updatedKeys: Object.keys(updates),
            hasNotificationChanges: !!updates.notifications,
            hasExperimentalChanges: !!updates.experimental
          })
          
          set(state => ({
            settings: {
              ...state.settings,
              ...updates,
              notifications: {
                ...state.settings.notifications,
                ...updates.notifications
              },
              experimental: {
                ...state.settings.experimental,
                ...updates.experimental
              }
            }
          }))
        },

        resetSettings: () => {
          logger.extension.info('Settings reset to defaults')
          set({ settings: { ...defaultSettings } })
        },

        // Activity tracking
        updateActivity: () => {
          const now = Date.now()

          set({ 
            lastActivity: now,
            isActive: true
          })
        },

        setActive: (active: boolean) => {
          set({ isActive: active })
        },

        // Modal management
        openModal: (modalKey: string, data?: unknown) => {
          logger.extension.info('Modal opened', { modalKey, hasData: !!data })

          set(state => ({
            modals: {
              ...state.modals,
              [modalKey]: {
                isOpen: true,
                data
              }
            }
          }))
        },

        closeModal: (modalKey: string) => {
          logger.extension.info('Modal closed', { modalKey })
          
          set(state => {
            const currentModal = state.modals[modalKey]
            if (currentModal) {
              return {
                modals: {
                  ...state.modals,
                  [modalKey]: {
                    isOpen: false,
                    data: undefined
                  }
                }
              }
            }
            return {}
          })
        },

        isModalOpen: (modalKey: string): boolean => {
          return get().modals[modalKey]?.isOpen ?? false
        },

        getModalData: (modalKey: string): unknown => {
          return get().modals[modalKey]?.data
        },

        // Command palette
        openCommandPalette: () => {
          set({ commandPaletteOpen: true })
        },

        closeCommandPalette: () => {
          set({ commandPaletteOpen: false })
        },

        toggleCommandPalette: () => {
          set(state => ({ commandPaletteOpen: !state.commandPaletteOpen }))
        },

        // Loading states
        setGlobalLoading: (loading: boolean, message?: string) => {
          logger.extension.debug('Global loading state changed', { loading, message })

          set({
            globalLoading: loading,
            loadingMessage: loading ? message ?? null : null
          })
        },

        // Connection status
        setOnlineStatus: (online: boolean) => {
          const previousStatus = get().isOnline
          if (previousStatus !== online) {
            logger.extension.info('Connection status changed', { online, previous: previousStatus })
          }
          
          set(state => ({
            isOnline: online,
            connectionQuality: online ? state.connectionQuality : 'offline' as const
          }))
        },

        setConnectionQuality: (quality: 'good' | 'poor' | 'offline') => {
          set({ 
            connectionQuality: quality,
            isOnline: quality !== 'offline'
          })
        },

        // Feature flags
        setFeatureFlag: (flag: string, enabled: boolean) => {
          const previousValue = get().featureFlags[flag]
          if (previousValue !== enabled) {
            logger.extension.info('Feature flag changed', { flag, enabled, previous: previousValue })
          }
          
          set(state => ({
            featureFlags: {
              ...state.featureFlags,
              [flag]: enabled
            }
          }))
        },

        hasFeatureFlag: (flag: string): boolean => {
          return get().featureFlags[flag] ?? false
        },

        // Utility actions
        reset: () => {
          logger.extension.info('App store reset to initial state')
          
          set({
            ...initialState,
            isOnline: navigator.onLine,
            lastActivity: Date.now()
          })
        },

        exportSettings: (): string => {
          const { settings, theme, featureFlags } = get()

          return JSON.stringify(
            {
              settings,
              theme,
              featureFlags,
              exportedAt: new Date().toISOString(),
              version: '1.0'
            },
            null,
            2
          )
        },

        importSettings: (settingsJson: string) => {
          try {
            interface ImportedSettings {
              settings?: Partial<UserSettings>
              theme?: 'light' | 'dark' | 'system'
              featureFlags?: Record<string, boolean>
            }

            const parseResult = parseSecureJson<ImportedSettings>(settingsJson, {
              maxSize: 100 * 1024, // 100KB limit for settings
              maxDepth: 10,
              maxKeys: 500,
              allowedTypes: ['object', 'array', 'string', 'number', 'boolean', 'null']
            })

            if (!parseResult.success) {
              throw new Error(`Settings parsing failed: ${parseResult.error ?? 'Unknown error'}`)
            }

            const imported = parseResult.data

            if (imported?.settings) {
              get().updateSettings(imported.settings)
            }

            if (imported?.theme) {
              get().setTheme(imported.theme)
            }

            if (imported?.featureFlags) {
              set(state => ({
                featureFlags: {
                  ...state.featureFlags,
                  ...imported.featureFlags
                }
              }))
            }
          } catch (error) {
            logger.extension.error('Failed to import settings', { error: error instanceof Error ? error.message : 'Unknown error' })
            throw new Error('Invalid settings format')
          }
        }
      }),
      {
        name: 'app-store',
        storage: createJSONStorage(() => ({
          getItem: async (name: string) => {
            try {
              const result = await storageManager.safeGet([name])
              return (result[name] as string | null) ?? null
            } catch (error) {
              logger.extension.warn('App store get failed, falling back to direct storage', {
                key: name,
                error: error instanceof Error ? error.message : 'Unknown error'
              })
              // Fallback to direct storage if safe storage fails
              const fallbackResult = await chrome.storage.local.get([name])
              return (fallbackResult[name] as string | null) ?? null
            }
          },
          setItem: async (name: string, value: string) => {
            try {
              await storageManager.safeSet({ [name]: value }, {
                priority: 'high', // App store operations are high priority
                maxSize: 100 * 1024 // 100KB limit for app store items
              })
            } catch (error) {
              logger.extension.error('App store set failed', {
                key: name,
                valueSize: new Blob([value]).size,
                error: error instanceof Error ? error.message : 'Unknown error'
              })
              
              // For critical app state, we still want to try direct storage
              // but only for essential data
              if (name.includes('app-store') && value.length < 10000) {
                logger.extension.warn('Attempting fallback storage for critical app state')
                await chrome.storage.local.set({ [name]: value })
              } else {
                throw error
              }
            }
          },
          removeItem: async (name: string) => {
            try {
              await storageManager.safeRemove([name])
            } catch (error) {
              logger.extension.warn('App store remove failed, falling back to direct storage', {
                key: name,
                error: error instanceof Error ? error.message : 'Unknown error'
              })
              // Fallback for remove operations
              await chrome.storage.local.remove([name])
            }
          }
        })),
        partialize: state => ({
          // Persist most state except temporary UI state
          theme: state.theme,
          sidebarCollapsed: state.sidebarCollapsed,
          sidebarWidth: state.sidebarWidth,
          settings: state.settings,
          featureFlags: state.featureFlags,
          notifications: state.notifications.slice(0, 10) // Only persist recent notifications
        })
      }
    )
  )
)

// Utility function to generate unique IDs
function generateId(): string {
  return `${Date.now()}_${Math.random().toString(36).slice(2, 11)}`
}

// Utility function to update theme classes
function updateThemeClasses(theme: 'light' | 'dark' | 'system') {
  const html = document.documentElement

  if (theme === 'system') {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
    html.className = html.className.replace(/\b(light|dark)-theme\b/g, '')
    html.classList.add(prefersDark ? 'dark-theme' : 'light-theme')
  } else {
    html.className = html.className.replace(/\b(light|dark)-theme\b/g, '')
    html.classList.add(`${theme}-theme`)
  }
}

// Selectors for common use cases
export const useTheme = () =>
  useAppStore(state => ({
    theme: state.theme,
    computedTheme: state.getComputedTheme(),
    setTheme: state.setTheme,
    toggleTheme: state.toggleTheme
  }))

export const useSidebar = () =>
  useAppStore(state => ({
    collapsed: state.sidebarCollapsed,
    width: state.sidebarWidth,
    setCollapsed: state.setSidebarCollapsed,
    toggle: state.toggleSidebar,
    setWidth: state.setSidebarWidth
  }))

export const useNotifications = () =>
  useAppStore(state => ({
    notifications: state.notifications,
    unread: state.unreadNotifications,
    add: state.addNotification,
    remove: state.removeNotification,
    markRead: state.markNotificationRead,
    markAllRead: state.markAllNotificationsRead,
    clear: state.clearNotifications
  }))

export const useSettings = () =>
  useAppStore(state => ({
    settings: state.settings,
    update: state.updateSettings,
    reset: state.resetSettings
  }))

export const useModal = (modalKey: string) =>
  useAppStore(state => ({
    isOpen: state.isModalOpen(modalKey),
    data: state.getModalData(modalKey),
    open: (data?: unknown) => state.openModal(modalKey, data),
    close: () => state.closeModal(modalKey)
  }))

export const useCommandPalette = () =>
  useAppStore(state => ({
    isOpen: state.commandPaletteOpen,
    open: state.openCommandPalette,
    close: state.closeCommandPalette,
    toggle: state.toggleCommandPalette
  }))

export const useFeatureFlag = (flag: string) => useAppStore(state => state.hasFeatureFlag(flag))

export const useConnectionStatus = () =>
  useAppStore(state => ({
    isOnline: state.isOnline,
    quality: state.connectionQuality
  }))

// Initialize app store
const initializeAppStore = () => {
  // Set up system theme listener
  const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')

  const handleThemeChange = () => {
    const theme = useAppStore.getState().theme
    if (theme === 'system') {
      updateThemeClasses('system')
    }
  }

  mediaQuery.addEventListener('change', handleThemeChange)

  // Set up online/offline listeners
  window.addEventListener('online', () => {
    useAppStore.getState().setOnlineStatus(true)
  })

  window.addEventListener('offline', () => {
    useAppStore.getState().setOnlineStatus(false)
  })

  // Set up activity tracking
  const activityEvents = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart']

  activityEvents.forEach(event => {
    document.addEventListener(
      event,
      () => {
        useAppStore.getState().updateActivity()
      },
      { passive: true }
    )
  })

  // Set up inactivity detection
  let inactivityTimer: NodeJS.Timeout
  const resetInactivityTimer = () => {
    clearTimeout(inactivityTimer)
    useAppStore.getState().setActive(true)

    inactivityTimer = setTimeout(
      () => {
        useAppStore.getState().setActive(false)
      },
      5 * 60 * 1000
    ) // 5 minutes
  }

  activityEvents.forEach(event => {
    document.addEventListener(event, resetInactivityTimer, { passive: true })
  })

  // Initial theme setup
  updateThemeClasses(useAppStore.getState().theme)
}

// Auto-initialize when the module loads
if (typeof window !== 'undefined') {
  initializeAppStore()
}

// Export store type for testing
export type AppStoreType = typeof useAppStore
