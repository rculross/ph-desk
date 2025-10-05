/**
 * Logz Explorer Store
 *
 * Zustand store for managing Logz Explorer state including filters,
 * pagination, cached logs, and entity resolution cache.
 */

import { format, subDays } from 'date-fns'
import { create } from 'zustand'

import type {
  LogzStore,
  LogsFilterState,
  PaginationState,
  ParsedLogEntry,
  EntityCache,
  UserEntity,
  CompanyEntity,
  LOGZ_CONSTRAINTS,
  QuickDateFilter
} from '../types/logz.types'
import { logger } from '../utils/logger'

const log = logger.api

// Helper function to get date string in YYYY-MM-DD format
const getDateString = (date: Date): string => format(date, 'yyyy-MM-dd')

// Helper function to get default date range (last 7 days)
const getDefaultDateRange = () => {
  const endDate = new Date()
  const startDate = subDays(endDate, 7)

  return {
    startDate: getDateString(startDate),
    endDate: getDateString(endDate)
  }
}

// Initial filter state
const initialFilters: LogsFilterState = {
  dateRange: getDefaultDateRange(),
  models: [],
  operations: [],
  actorTypes: [],
  entityId: '',
  searchTerm: ''
}

// Initial pagination state
const initialPagination: PaginationState = {
  currentOffset: 0,
  recordsPerPull: 2000, // Default to maximum size for better performance
  totalLoaded: 0,
  hasMore: false
}

// Initial entity cache
const initialEntityCache: EntityCache = {
  users: new Map(),
  companies: new Map()
}

/**
 * Logz Explorer Store
 */
export const useLogzStore = create<LogzStore>((set, get) => ({
  // State
  filters: initialFilters,
  pagination: initialPagination,
  logs: [],
  totalCount: 0,
  isLoading: false,
  error: null,
  entityCache: initialEntityCache,

  // Filter actions
  updateFilters: (newFilters) => {
    const currentFilters = get().filters
    const updatedFilters = { ...currentFilters, ...newFilters }

    log.info('Logz filters updated', {
      from: currentFilters,
      to: updatedFilters
    })

    set(state => ({
      filters: updatedFilters,
      // Reset pagination when filters change
      pagination: {
        ...state.pagination,
        currentOffset: 0,
        totalLoaded: 0,
        hasMore: false
      },
      // Clear current logs when filters change
      logs: [],
      totalCount: 0,
      error: null
    }))
  },

  updatePagination: (newPagination) => {
    const currentPagination = get().pagination
    const updatedPagination = { ...currentPagination, ...newPagination }

    log.debug('Logz pagination updated', {
      from: currentPagination,
      to: updatedPagination
    })

    set(state => ({
      pagination: updatedPagination
    }))
  },

  // Data actions
  setLogs: (logs) => {
    log.debug('Logz logs set', { count: logs.length })
    set({
      logs,
      totalCount: logs.length
    })
  },

  appendLogs: (newLogs) => {
    const currentLogs = get().logs
    const allLogs = [...currentLogs, ...newLogs]

    log.debug('Logz logs appended', {
      existing: currentLogs.length,
      new: newLogs.length,
      total: allLogs.length
    })

    set(state => ({
      logs: allLogs,
      totalCount: allLogs.length,
      pagination: {
        ...state.pagination,
        totalLoaded: allLogs.length,
        hasMore: newLogs.length === state.pagination.recordsPerPull
      }
    }))
  },

  clearLogs: () => {
    log.debug('Logz logs cleared')
    set({
      logs: [],
      totalCount: 0,
      error: null
    })
  },

  setLoading: (loading) => {
    set({ isLoading: loading })
  },

  setError: (error) => {
    if (error) {
      log.error('Logz error set', { error })
    }
    set({ error })
  },

  // Filter utility actions
  clearFilters: () => {
    log.info('Logz filters cleared')
    set({
      filters: initialFilters,
      pagination: initialPagination,
      logs: [],
      totalCount: 0,
      error: null
    })
  },

  applyQuickDateFilter: (daysAgo: QuickDateFilter) => {
    const endDate = new Date()
    const startDate = subDays(endDate, daysAgo)

    const dateRange = {
      startDate: getDateString(startDate),
      endDate: getDateString(endDate)
    }

    log.info('Logz quick date filter applied', {
      daysAgo,
      dateRange
    })

    get().updateFilters({ dateRange })
  },

  // Entity cache actions
  cacheUser: (tenantId: string, userId: string, user: UserEntity | null) => {
    const key = `${tenantId}:${userId}`
    const cache = get().entityCache

    cache.users.set(key, user)

    log.debug('User cached', { tenantId, userId, hasUser: !!user })

    set(state => ({
      entityCache: {
        ...state.entityCache,
        users: cache.users
      }
    }))
  },

  cacheCompany: (tenantId: string, companyId: string, company: CompanyEntity | null) => {
    const key = `${tenantId}:${companyId}`
    const cache = get().entityCache

    cache.companies.set(key, company)

    log.debug('Company cached', { tenantId, companyId, hasCompany: !!company })

    set(state => ({
      entityCache: {
        ...state.entityCache,
        companies: cache.companies
      }
    }))
  },

  getCachedUser: (tenantId: string, userId: string) => {
    const key = `${tenantId}:${userId}`
    return get().entityCache.users.get(key)
  },

  getCachedCompany: (tenantId: string, companyId: string) => {
    const key = `${tenantId}:${companyId}`
    return get().entityCache.companies.get(key)
  }
}))

// Selector hooks for common derived state
export const useLogzFilters = () => useLogzStore(state => state.filters)
export const useLogzPagination = () => useLogzStore(state => state.pagination)
export const useLogzLogs = () => useLogzStore(state => state.logs)
export const useLogzLoading = () => useLogzStore(state => state.isLoading)
export const useLogzError = () => useLogzStore(state => state.error)
export const useLogzEntityCache = () => useLogzStore(state => state.entityCache)

// Action selector hooks
export const useLogzActions = () => useLogzStore(state => ({
  updateFilters: state.updateFilters,
  updatePagination: state.updatePagination,
  setLogs: state.setLogs,
  appendLogs: state.appendLogs,
  clearLogs: state.clearLogs,
  setLoading: state.setLoading,
  setError: state.setError,
  clearFilters: state.clearFilters,
  applyQuickDateFilter: state.applyQuickDateFilter,
  cacheUser: state.cacheUser,
  cacheCompany: state.cacheCompany,
  getCachedUser: state.getCachedUser,
  getCachedCompany: state.getCachedCompany
}))