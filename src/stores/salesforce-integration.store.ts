/**
 * Salesforce Integration UI State Store
 *
 * Manages UI state for the Salesforce integration viewer, including
 * expanded objects, search terms, and selected objects. Follows the
 * established Zustand patterns for UI-only state (not API data).
 *
 * @fileVersion 3.1.2
 * @author Claude Code AI Assistant
 */

import { create } from 'zustand'
import { persist, createJSONStorage, subscribeWithSelector } from 'zustand/middleware'

import type { SalesforceSearchFilters } from '../types/integrations/salesforce.types'
import { logger } from '../utils/logger'
import { storageManager } from '../utils/storage-manager'

const log = logger.content

/**
 * UI state interface for Salesforce integration viewer
 */
export interface SalesforceIntegrationUIState {
  // Expanded objects state (tracks which object cards are expanded)
  expandedObjects: Set<string>

  // Search functionality
  searchTerm: string
  searchFilters: SalesforceSearchFilters
  isSearchActive: boolean

  // Selected object for detailed view
  selectedObjectId: string | null

  // View preferences
  viewMode: 'cards' | 'table' | 'compact'
  sortBy: 'name' | 'fieldCount' | 'lastSync' | 'direction'
  sortDirection: 'asc' | 'desc'

  // UI layout state
  sidebarCollapsed: boolean
  showFilters: boolean

  // Field table preferences
  fieldTableSettings: {
    pageSize: number
    showMetadata: boolean
    groupByDirection: boolean
    highlightCustomFields: boolean
  }

  // Performance preferences
  enableVirtualization: boolean
  maxVisibleFields: number
}

/**
 * UI actions for Salesforce integration viewer
 */
export interface SalesforceIntegrationUIActions {
  // Expanded objects management
  toggleObjectExpanded: (objectId: string) => void
  expandObject: (objectId: string) => void
  collapseObject: (objectId: string) => void
  expandAllObjects: () => void
  collapseAllObjects: () => void

  // Search management
  setSearchTerm: (term: string) => void
  clearSearch: () => void
  setSearchFilters: (filters: Partial<SalesforceSearchFilters>) => void
  resetSearchFilters: () => void
  toggleSearchActive: () => void

  // Object selection
  selectObject: (objectId: string) => void
  clearSelection: () => void

  // View preferences
  setViewMode: (mode: 'cards' | 'table' | 'compact') => void
  setSortBy: (field: 'name' | 'fieldCount' | 'lastSync' | 'direction') => void
  setSortDirection: (direction: 'asc' | 'desc') => void
  toggleSortDirection: () => void

  // UI layout
  toggleSidebar: () => void
  toggleFilters: () => void
  setSidebarCollapsed: (collapsed: boolean) => void
  setShowFilters: (show: boolean) => void

  // Field table preferences
  updateFieldTableSettings: (settings: Partial<SalesforceIntegrationUIState['fieldTableSettings']>) => void

  // Performance settings
  setEnableVirtualization: (enable: boolean) => void
  setMaxVisibleFields: (max: number) => void

  // Utility actions
  reset: () => void
  getUIStats: () => {
    expandedCount: number
    hasActiveSearch: boolean
    hasActiveFilters: boolean
    selectedObject: string | null
  }
}

export type SalesforceIntegrationUIStore = SalesforceIntegrationUIState & SalesforceIntegrationUIActions

/**
 * Default state values
 */
const defaultSearchFilters: SalesforceSearchFilters = {
  direction: undefined,
  objectTypes: undefined,
  fieldTypes: undefined,
  includeCustomObjects: true,
  includeStandardObjects: true,
  minFieldCount: undefined,
  maxFieldCount: undefined
}

const initialState: SalesforceIntegrationUIState = {
  expandedObjects: new Set<string>(),

  searchTerm: '',
  searchFilters: { ...defaultSearchFilters },
  isSearchActive: false,

  selectedObjectId: null,

  viewMode: 'table',
  sortBy: 'name',
  sortDirection: 'asc',

  sidebarCollapsed: false,
  showFilters: false,

  fieldTableSettings: {
    pageSize: 50,
    showMetadata: true,
    groupByDirection: true,
    highlightCustomFields: true
  },

  enableVirtualization: true,
  maxVisibleFields: 1000
}

/**
 * Salesforce Integration UI Store Implementation
 */
export const useSalesforceIntegrationStore = create<SalesforceIntegrationUIStore>()(
  subscribeWithSelector(
    persist(
      (set, get) => ({
        ...initialState,

        // Expanded objects management
        toggleObjectExpanded: (objectId: string) => {
          set(state => {
            const newExpanded = new Set(state.expandedObjects)
            if (newExpanded.has(objectId)) {
              newExpanded.delete(objectId)
              log.debug('Object collapsed', { objectId })
            } else {
              newExpanded.add(objectId)
              log.debug('Object expanded', { objectId })
            }
            return { expandedObjects: newExpanded }
          })
        },

        expandObject: (objectId: string) => {
          set(state => {
            const newExpanded = new Set(state.expandedObjects)
            newExpanded.add(objectId)
            return { expandedObjects: newExpanded }
          })
        },

        collapseObject: (objectId: string) => {
          set(state => {
            const newExpanded = new Set(state.expandedObjects)
            newExpanded.delete(objectId)
            return { expandedObjects: newExpanded }
          })
        },

        expandAllObjects: () => {
          log.info('Expanding all objects')
          // This will be handled by the component when it has access to all object IDs
          // For now, we'll set a flag that components can check
          set({ expandedObjects: new Set(['__EXPAND_ALL__']) })
        },

        collapseAllObjects: () => {
          log.info('Collapsing all objects')
          set({ expandedObjects: new Set<string>() })
        },

        // Search management
        setSearchTerm: (term: string) => {
          const trimmedTerm = term.trim()
          log.debug('Search term changed', {
            from: get().searchTerm.substring(0, 50),
            to: trimmedTerm.substring(0, 50),
            length: trimmedTerm.length
          })

          set({
            searchTerm: trimmedTerm,
            isSearchActive: trimmedTerm.length > 0
          })
        },

        clearSearch: () => {
          log.debug('Search cleared')
          set({
            searchTerm: '',
            isSearchActive: false,
            searchFilters: { ...defaultSearchFilters }
          })
        },

        setSearchFilters: (filters: Partial<SalesforceSearchFilters>) => {
          log.debug('Search filters updated', {
            updatedKeys: Object.keys(filters),
            hasDirectionFilter: !!filters.direction,
            hasObjectTypeFilter: !!filters.objectTypes,
            hasFieldTypeFilter: !!filters.fieldTypes
          })

          set(state => ({
            searchFilters: {
              ...state.searchFilters,
              ...filters
            }
          }))
        },

        resetSearchFilters: () => {
          log.debug('Search filters reset')
          set({ searchFilters: { ...defaultSearchFilters } })
        },

        toggleSearchActive: () => {
          set(state => ({ isSearchActive: !state.isSearchActive }))
        },

        // Object selection
        selectObject: (objectId: string) => {
          const previousSelection = get().selectedObjectId
          log.debug('Object selected', {
            objectId: objectId.substring(0, 50),
            previousSelection: previousSelection?.substring(0, 50) ?? 'none'
          })

          set({ selectedObjectId: objectId })
        },

        clearSelection: () => {
          log.debug('Object selection cleared')
          set({ selectedObjectId: null })
        },

        // View preferences
        setViewMode: (mode: 'cards' | 'table' | 'compact') => {
          const previousMode = get().viewMode
          log.info('View mode changed', { from: previousMode, to: mode })
          set({ viewMode: mode })
        },

        setSortBy: (field: 'name' | 'fieldCount' | 'lastSync' | 'direction') => {
          const previousField = get().sortBy
          log.debug('Sort field changed', { from: previousField, to: field })
          set({ sortBy: field })
        },

        setSortDirection: (direction: 'asc' | 'desc') => {
          const previousDirection = get().sortDirection
          log.debug('Sort direction changed', { from: previousDirection, to: direction })
          set({ sortDirection: direction })
        },

        toggleSortDirection: () => {
          set(state => ({
            sortDirection: state.sortDirection === 'asc' ? 'desc' : 'asc'
          }))
        },

        // UI layout
        toggleSidebar: () => {
          set(state => ({ sidebarCollapsed: !state.sidebarCollapsed }))
        },

        toggleFilters: () => {
          set(state => ({ showFilters: !state.showFilters }))
        },

        setSidebarCollapsed: (collapsed: boolean) => {
          set({ sidebarCollapsed: collapsed })
        },

        setShowFilters: (show: boolean) => {
          set({ showFilters: show })
        },

        // Field table preferences
        updateFieldTableSettings: (settings: Partial<SalesforceIntegrationUIState['fieldTableSettings']>) => {
          log.debug('Field table settings updated', {
            updatedKeys: Object.keys(settings)
          })

          set(state => ({
            fieldTableSettings: {
              ...state.fieldTableSettings,
              ...settings
            }
          }))
        },

        // Performance settings
        setEnableVirtualization: (enable: boolean) => {
          const previous = get().enableVirtualization
          if (previous !== enable) {
            log.info('Virtualization setting changed', { from: previous, to: enable })
          }
          set({ enableVirtualization: enable })
        },

        setMaxVisibleFields: (max: number) => {
          const previous = get().maxVisibleFields
          const clampedMax = Math.max(100, Math.min(10000, max))

          if (previous !== clampedMax) {
            log.info('Max visible fields changed', { from: previous, to: clampedMax })
          }
          set({ maxVisibleFields: clampedMax })
        },

        // Utility actions
        reset: () => {
          log.info('Salesforce integration UI store reset')
          set({ ...initialState })
        },

        getUIStats: () => {
          const state = get()
          const hasActiveFilters = Object.values(state.searchFilters).some(
            value => value !== undefined &&
                    (Array.isArray(value) ? value.length > 0 : true)
          )

          return {
            expandedCount: state.expandedObjects.size,
            hasActiveSearch: state.isSearchActive && state.searchTerm.length > 0,
            hasActiveFilters,
            selectedObject: state.selectedObjectId
          }
        }
      }),
      {
        name: 'salesforce-integration-ui-store',
        storage: createJSONStorage(() => ({
          getItem: async (name: string) => {
            try {
              const result = await storageManager.safeGet([name])
              return result[name] ?? null
            } catch (error) {
              log.warn('Salesforce UI store get failed, using fallback', {
                key: name,
                error: error instanceof Error ? error.message : 'Unknown error'
              })
              const fallbackResult = await chrome.storage.local.get([name])
              return fallbackResult[name] ?? null
            }
          },
          setItem: async (name: string, value: string) => {
            try {
              await storageManager.safeSet({ [name]: value }, {
                priority: 'medium',
                maxSize: 50 * 1024 // 50KB limit for UI state
              })
            } catch (error) {
              log.error('Salesforce UI store set failed', {
                key: name,
                valueSize: new Blob([value]).size,
                error: error instanceof Error ? error.message : 'Unknown error'
              })
              throw error
            }
          },
          removeItem: async (name: string) => {
            try {
              await storageManager.safeRemove([name])
            } catch (error) {
              log.warn('Salesforce UI store remove failed, using fallback', {
                key: name,
                error: error instanceof Error ? error.message : 'Unknown error'
              })
              await chrome.storage.local.remove([name])
            }
          }
        })),
        partialize: state => ({
          // Persist UI preferences and search state
          expandedObjects: Array.from(state.expandedObjects), // Convert Set to Array for persistence
          searchTerm: state.searchTerm,
          searchFilters: state.searchFilters,
          selectedObjectId: state.selectedObjectId,
          viewMode: state.viewMode,
          sortBy: state.sortBy,
          sortDirection: state.sortDirection,
          sidebarCollapsed: state.sidebarCollapsed,
          fieldTableSettings: state.fieldTableSettings,
          enableVirtualization: state.enableVirtualization,
          maxVisibleFields: state.maxVisibleFields
        }),
        onRehydrateStorage: () => (state, error) => {
          if (error) {
            log.error('Salesforce UI store rehydration failed', {
              error: error instanceof Error ? error.message : 'Unknown rehydration error'
            })
            return
          }

          if (state) {
            // Convert Array back to Set for expandedObjects
            if (Array.isArray((state as any).expandedObjects)) {
              state.expandedObjects = new Set((state as any).expandedObjects)
            }

            log.debug('Salesforce UI store rehydrated', {
              expandedCount: state.expandedObjects.size,
              hasSearchTerm: !!state.searchTerm,
              selectedObject: !!state.selectedObjectId,
              viewMode: state.viewMode
            })
          }
        }
      }
    )
  )
)

/**
 * Convenient selector hooks
 */

// Search state
export const useSalesforceSearch = () =>
  useSalesforceIntegrationStore(state => ({
    searchTerm: state.searchTerm,
    searchFilters: state.searchFilters,
    isSearchActive: state.isSearchActive,
    setSearchTerm: state.setSearchTerm,
    clearSearch: state.clearSearch,
    setSearchFilters: state.setSearchFilters,
    resetSearchFilters: state.resetSearchFilters
  }))

// Object expansion state
export const useSalesforceObjectExpansion = () =>
  useSalesforceIntegrationStore(state => ({
    expandedObjects: state.expandedObjects,
    toggleExpanded: state.toggleObjectExpanded,
    expandObject: state.expandObject,
    collapseObject: state.collapseObject,
    expandAll: state.expandAllObjects,
    collapseAll: state.collapseAllObjects
  }))

// Object selection state
export const useSalesforceObjectSelection = () =>
  useSalesforceIntegrationStore(state => ({
    selectedObjectId: state.selectedObjectId,
    selectObject: state.selectObject,
    clearSelection: state.clearSelection
  }))

// View preferences
export const useSalesforceViewPreferences = () =>
  useSalesforceIntegrationStore(state => ({
    viewMode: state.viewMode,
    sortBy: state.sortBy,
    sortDirection: state.sortDirection,
    setViewMode: state.setViewMode,
    setSortBy: state.setSortBy,
    setSortDirection: state.setSortDirection,
    toggleSortDirection: state.toggleSortDirection
  }))

// Field table settings
export const useSalesforceFieldTableSettings = () =>
  useSalesforceIntegrationStore(state => ({
    settings: state.fieldTableSettings,
    updateSettings: state.updateFieldTableSettings,
    enableVirtualization: state.enableVirtualization,
    maxVisibleFields: state.maxVisibleFields,
    setEnableVirtualization: state.setEnableVirtualization,
    setMaxVisibleFields: state.setMaxVisibleFields
  }))

// UI layout state
export const useSalesforceLayoutState = () =>
  useSalesforceIntegrationStore(state => ({
    sidebarCollapsed: state.sidebarCollapsed,
    showFilters: state.showFilters,
    toggleSidebar: state.toggleSidebar,
    toggleFilters: state.toggleFilters,
    setSidebarCollapsed: state.setSidebarCollapsed,
    setShowFilters: state.setShowFilters
  }))

// Combined UI stats selector
export const useSalesforceUIStats = () =>
  useSalesforceIntegrationStore(state => state.getUIStats())