/**
 * Tenant Selector Hook
 * 
 * Custom hook that manages tenant selection state, fetching all available tenants,
 * checking their active status, and providing formatted data for the TenantSelector component.
 * Also handles tenant switching logic with proper error handling and loading states.
 */

import { useCallback, useEffect, useMemo, useRef } from 'react'

import { useQueryClient } from '@tanstack/react-query'

import type { TenantInfo } from '../api/services/tenant.service'
import { useAppStore } from '../stores/app.store'
import { useAuthStore } from '../stores/auth.store'
import { useTenantStore } from '../stores/tenant.store'
import { logger } from '../utils/logger'

export interface TenantOption {
  id: string
  slug: string
  name: string
  isActive: boolean
  domain?: string
  logo?: string
  environment: 'production' | 'demo'
  subscription?: {
    plan: string
    status: 'active' | 'trialing' | 'past_due' | 'canceled' | 'unpaid'
  }
}

export interface UseTenantSelectorReturn {
  // Current state
  currentTenant: TenantOption | null
  availableTenants: TenantOption[]

  // Loading and error states
  isLoading: boolean
  isSwitching: boolean
  error: string | null
  switchError: string | null

  // Actions
  switchTenant: (tenantSlug: string) => Promise<void>
  refreshTenants: () => Promise<void>
  refreshProductionTenants: () => Promise<void>
  refreshDemoTenants: () => Promise<void>
  clearErrors: () => void

  // Utilities
  getTenantBySlug: (slug: string) => TenantOption | undefined
  isCurrentTenant: (slug: string) => boolean
}

/**
 * Format TenantInfo to TenantOption for component use
 * Merges tenant info with status data from the status checking
 * Note: Using tenantSlug for display instead of name for consistency with API
 */
const formatTenantOption = (tenant: TenantInfo, tenantStatus?: { tenantSlug: string; isActive: boolean } | null): TenantOption => {
  // Determine environment based on domain or current URL context
  const environment: 'production' | 'demo' = tenant.domain?.includes('planhatdemo.com')
    ? 'demo'
    : 'production'

  // Note: Individual demo tenant detection logging removed to reduce repetition
  // Demo tenants are now logged in bulk in the useTenantSelector hook

  return {
    id: tenant.id,
    slug: tenant.slug,
    name: tenant.tenantSlug ?? tenant.slug, // Use tenantSlug for display, fallback to slug
    isActive: tenantStatus?.isActive ?? tenant.isActive, // Use status check result if available
    domain: tenant.domain,
    logo: tenant.logo,
    environment,
    subscription: tenant.subscription ? {
      plan: tenant.subscription.plan,
      status: tenant.subscription.status
    } : undefined
  }
}

/**
 * Hook for managing tenant selection
 */
export const useTenantSelector = (): UseTenantSelectorReturn => {
  const queryClient = useQueryClient()

  // Get auth state to check if user is authenticated before fetching tenants
  const isAuthenticated = useAuthStore(state => state.isAuthenticated)

  // Ref to prevent duplicate fetches
  const isFetchingRef = useRef(false)

  // Stable logger instance wrapped in useCallback
  const log = useCallback((level: 'info' | 'debug' | 'warn' | 'error', message: string, ...args: any[]) => {
    logger.extension[level](message, ...args)
  }, [])

  const {
    // State
    currentTenant: rawCurrentTenant,
    availableTenants: rawAvailableTenants,
    isLoading,
    isSwitchingTenant,
    error,
    switchTenantError,

    // Tenant status state
    tenantStatuses,
    statusLoading,
    statusError,
    lastStatusFetch,

    // Actions
    fetchAvailableTenants,
    fetchAllTenantStatuses,
    switchTenant: switchTenantAction,
    clearError,
    clearSwitchTenantError,
    refreshTenantData,
    getTenantStatus
  } = useTenantStore()

  // Format current tenant with status data
  const currentTenant = useMemo(() => {
    if (!rawCurrentTenant) {
      log('debug', 'No current tenant available')
      return null
    }

    const tenantStatus = getTenantStatus(rawCurrentTenant.slug)
    const formattedTenant = formatTenantOption(rawCurrentTenant, tenantStatus)
    log('debug', `Current tenant formatted: ${formattedTenant.slug} (active: ${formattedTenant.isActive}, has status: ${!!tenantStatus})`)
    return formattedTenant
  }, [rawCurrentTenant, tenantStatuses, getTenantStatus, log])

  // Format available tenants and sort by environment, active status, and name
  const availableTenants = useMemo(() => {
    // Debug: Log what we're receiving from the store
    log('info', `Hook: Received from store: ${rawAvailableTenants.length} tenants`)

    const demoTenants = rawAvailableTenants.filter(t => t.domain?.includes('planhatdemo.com'))
    const prodTenants = rawAvailableTenants.filter(t => !t.domain?.includes('planhatdemo.com'))

    if (rawAvailableTenants.length > 0) {
      if (prodTenants.length > 0) {
        log('debug', `Hook Raw Prod: ${prodTenants.map(t => t.slug).join(', ')}`)
      }
      if (demoTenants.length > 0) {
        log('debug', `Hook Raw Demo: ${demoTenants.map(t => t.slug).join(', ')}`)
      }
    }

    log('info', `Formatting available tenants: ${rawAvailableTenants.length} total (${prodTenants.length} prod, ${demoTenants.length} demo), ${tenantStatuses.length} statuses`)

    if (prodTenants.length > 0) {
      log('debug', `Prod: ${prodTenants.map(t => t.slug).join(', ')}`)
    }
    if (demoTenants.length > 0) {
      log('debug', `Demo: ${demoTenants.map(t => t.slug).join(', ')}`)
    }

    const formatted = rawAvailableTenants
      .map(tenant => {
        const tenantStatus = getTenantStatus(tenant.slug)
        return formatTenantOption(tenant, tenantStatus)
      })

    // Filter tenants: Show ALL production tenants (active + inactive), hide inactive demo tenants
    // Production tenants show with green (active) or grey (inactive) dots
    // Demo tenants only show if active
    const filteredTenants: TenantOption[] = []
    const inactiveDemoTenants: string[] = []

    formatted.forEach(tenant => {
      if (tenant.isActive) {
        // Include all active tenants (production and demo)
        filteredTenants.push(tenant)
      } else if (tenant.environment === 'production') {
        // Include inactive production tenants (will show with grey dot)
        filteredTenants.push(tenant)
      } else {
        // Inactive demo tenants - don't include, just log
        inactiveDemoTenants.push(tenant.slug)
      }
    })

    // Log filtered demo tenants
    if (inactiveDemoTenants.length > 0) {
      log('debug', `Filtered out inactive demo tenants (no access): ${inactiveDemoTenants.join(', ')}`)
    }

    const sortedTenants = filteredTenants
      .sort((a, b) => {
        // Sort by environment first (production first)
        if (a.environment === 'production' && b.environment === 'demo') return -1
        if (a.environment === 'demo' && b.environment === 'production') return 1

        // Then sort by active status (active tenants first)
        if (a.isActive && !b.isActive) return -1
        if (!a.isActive && b.isActive) return 1

        // Then sort alphabetically by name
        return a.name.localeCompare(b.name)
      })

    const activeCount = sortedTenants.filter(t => t.isActive).length
    const prodCount = sortedTenants.filter(t => t.environment === 'production').length
    const demoCount = sortedTenants.filter(t => t.environment === 'demo').length
    const filteredOutCount = inactiveDemoTenants.length

    if (filteredOutCount > 0) {
      log('info', `Filtered out ${filteredOutCount} inactive demo tenants`)
    }

    log('debug', `Available tenants: ${sortedTenants.length} total (${prodCount} prod [${activeCount} active], ${demoCount} demo [all active])`)

    return sortedTenants
  }, [rawAvailableTenants, tenantStatuses, getTenantStatus, log])

  // Stable fetch function wrapped in useCallback
  const fetchTenantsIfNeeded = useCallback(async () => {
    // Guard: Check if already fetching
    if (isFetchingRef.current) {
      log('debug', 'Fetch already in progress - skipping')
      return
    }

    // Guard: Only fetch if authenticated
    if (!isAuthenticated) {
      log('debug', 'User not authenticated - skipping tenant fetch')
      return
    }

    const hasTenants = rawAvailableTenants.length > 0
    const hasStatuses = tenantStatuses.length > 0

    // Guard: Skip if we have both tenant data and status data (cache exists)
    if (hasTenants && hasStatuses) {
      log('debug', `Using cached data: ${rawAvailableTenants.length} tenants, ${tenantStatuses.length} statuses - skipping fetch`)
      return
    }

    // Guard: Skip if currently loading
    if (isLoading || statusLoading) {
      log('debug', 'Already loading - skipping fetch')
      return
    }

    // Only fetch if we truly have no data
    if (!hasTenants) {
      isFetchingRef.current = true
      log('info', 'useTenantSelector hook initialized - fetching available tenants (no data)')

      try {
        await fetchAvailableTenants(undefined, false) // Don't force refresh, respect cache
      } catch (err) {
        log('error', `Failed to fetch tenants on mount: ${err instanceof Error ? err.message : 'Unknown error'}`)
      } finally {
        isFetchingRef.current = false
      }
    }
  }, [isAuthenticated, rawAvailableTenants.length, tenantStatuses.length, isLoading, statusLoading, fetchAvailableTenants, log])

  // Fetch tenants on mount if not already loaded
  useEffect(() => {
    fetchTenantsIfNeeded()
  }, [fetchTenantsIfNeeded])

  // Stable status refresh function wrapped in useCallback
  const refreshStatusesIfNeeded = useCallback(() => {
    const now = Date.now()
    const cacheAge = lastStatusFetch ? now - lastStatusFetch : Infinity
    const CACHE_DURATION = 5 * 60 * 1000 // 5 minutes

    // Guard: Skip if we already have statuses from this session
    // This prevents refreshes when cache exists (initialization handles initial fetch)
    if (tenantStatuses.length > 0 && lastStatusFetch) {
      log('debug', `Status cache exists (age: ${Math.round(cacheAge / 1000)}s) - skipping refresh`)
      return
    }

    // Guard: Skip if no tenants yet (nothing to check status for)
    if (rawAvailableTenants.length === 0) {
      return
    }

    // Guard: Skip if currently loading
    if (statusLoading) {
      return
    }

    // Guard: Skip if cache is fresh (< 5 minutes old)
    if (cacheAge < CACHE_DURATION) {
      return
    }

    // Only refresh if:
    // 1. We have tenants but no statuses
    // 2. Cache is stale (> 5 minutes)
    // 3. Not currently loading
    const shouldRefreshStatuses = rawAvailableTenants.length > 0
      && tenantStatuses.length === 0
      && !statusLoading
      && cacheAge > CACHE_DURATION

    if (shouldRefreshStatuses) {
      log('debug', `Refreshing tenant statuses (cache age: ${Math.round(cacheAge / 1000)}s)`)
      fetchAllTenantStatuses()
    }
  }, [rawAvailableTenants.length, tenantStatuses.length, statusLoading, lastStatusFetch, fetchAllTenantStatuses, log])

  // Refresh tenant statuses if cache is stale or missing
  // Note: Status is now fetched during initialization, so this mainly handles refreshes
  useEffect(() => {
    refreshStatusesIfNeeded()
  }, [refreshStatusesIfNeeded])

  // Switch tenant with error handling and store clearing
  const switchTenant = useCallback(async (tenantSlug: string) => {
    log('info', `Switching tenant from ${currentTenant?.slug ?? 'none'} to ${tenantSlug}`)

    try {
      // Clear all other stores when switching tenants
      log('debug', 'Clearing stores before tenant switch')
      useAppStore.getState().reset()

      // Clear React Query cache for tenant-specific data
      log('debug', 'Clearing React Query cache for tenant-specific data')
      // Clear all cached queries for issues, companies, workflows, and other tenant-specific data
      await queryClient.invalidateQueries({ queryKey: ['issues'] })
      await queryClient.invalidateQueries({ queryKey: ['companies'] })
      await queryClient.invalidateQueries({ queryKey: ['workflows'] })
      await queryClient.invalidateQueries({ queryKey: ['workflowtemplates'] })
      await queryClient.invalidateQueries({ queryKey: ['search'] })

      // Remove the queries from cache entirely to force fresh data fetch
      queryClient.removeQueries({ queryKey: ['issues'] })
      queryClient.removeQueries({ queryKey: ['companies'] })
      queryClient.removeQueries({ queryKey: ['workflows'] })
      queryClient.removeQueries({ queryKey: ['workflowtemplates'] })
      queryClient.removeQueries({ queryKey: ['search'] })

      // Clear any ongoing export jobs or selections
      // (Export functionality uses services, not stores, so we clear browser cache)
      if (typeof window !== 'undefined') {
        log('debug', 'Clearing cached export data')
        // Clear any cached export data
        window.electron.storage.remove([
          'export-progress',
          'export-selections',
          'export-field-mappings'
        ]).catch(() => {
          // Ignore cleanup errors
          log('warn', 'Non-critical: failed to clear some cached export data')
        })
      }

      // Switch the tenant
      log('info', 'Executing tenant switch')
      await switchTenantAction(tenantSlug)

      // Refresh tenant statuses after switching
      log('debug', 'Refreshing tenant statuses after switch')
      await fetchAllTenantStatuses()

      log('info', `Tenant switch completed successfully to ${tenantSlug}`)
    } catch (error) {
      log('error', `Failed to switch tenant from ${currentTenant?.slug ?? 'none'} to ${tenantSlug}: ${error instanceof Error ? error.message : 'Unknown error'}`)
      // Error is already handled by the store
    }
  }, [switchTenantAction, fetchAllTenantStatuses, currentTenant?.slug, queryClient, log])

  // Refresh tenants and their statuses
  const refreshTenants = useCallback(async () => {
    log('info', 'Refreshing tenant data')

    try {
      log('debug', 'Refreshing tenants and statuses')
      await Promise.all([
        fetchAvailableTenants(undefined, true), // Force refresh
        fetchAllTenantStatuses()
      ])
      log('info', 'Tenant data refresh completed successfully')
    } catch (error) {
      log('error', `Failed to refresh tenant data: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }, [fetchAvailableTenants, fetchAllTenantStatuses, log])

  // Refresh production tenants
  const refreshProductionTenants = useCallback(async () => {
    log('info', 'Refreshing production tenants')

    try {
      const { tenantService } = await import('../api/services/tenant.service')
      const statuses = await tenantService.refreshEnvironmentTenants('production')

      // Check if any tenants are authenticated
      const hasActiveTenants = statuses.some(t => t.isActive)

      if (!hasActiveTenants) {
        log('warn', 'No authenticated production tenants found - opening login window')
        // Open login for production environment
        const { authService } = await import('../services/auth.service')
        const authResult = await authService.login('production')

        // After login, refresh tenants again
        await fetchAvailableTenants(undefined, true)
        await fetchAllTenantStatuses()

        // Auto-switch to the newly authenticated tenant
        if (authResult.tenantSlug) {
          log('info', `Auto-switching to newly authenticated production tenant: ${authResult.tenantSlug}`)
          await switchTenant(authResult.tenantSlug)
        }
      } else {
        // Update store with new statuses
        await fetchAllTenantStatuses()
      }

      log('info', 'Production tenant refresh completed')
    } catch (error) {
      log('error', `Failed to refresh production tenants: ${error instanceof Error ? error.message : 'Unknown error'}`)
      throw error
    }
  }, [fetchAvailableTenants, fetchAllTenantStatuses, switchTenant, log])

  // Refresh demo tenants
  const refreshDemoTenants = useCallback(async () => {
    log('info', 'Refreshing demo tenants')

    try {
      const { tenantService } = await import('../api/services/tenant.service')
      const statuses = await tenantService.refreshEnvironmentTenants('demo')

      // Check if any tenants are authenticated (empty array = no demo tenant stored yet)
      const hasActiveTenants = statuses.length > 0 && statuses.some(t => t.isActive)

      if (!hasActiveTenants) {
        log('info', 'No demo tenant found - opening login window')
        // Open login for demo environment
        const { authService } = await import('../services/auth.service')
        const authResult = await authService.login('demo')

        // After login, refresh tenants again
        await fetchAvailableTenants(undefined, true)
        await fetchAllTenantStatuses()

        // Auto-switch to the newly authenticated demo tenant
        if (authResult.tenantSlug) {
          log('info', `Auto-switching to newly authenticated demo tenant: ${authResult.tenantSlug}`)
          await switchTenant(authResult.tenantSlug)
        }
      } else {
        // Update store with new statuses
        await fetchAllTenantStatuses()
      }

      log('info', 'Demo tenant refresh completed')
    } catch (error) {
      log('error', `Failed to refresh demo tenants: ${error instanceof Error ? error.message : 'Unknown error'}`)
      throw error
    }
  }, [fetchAvailableTenants, fetchAllTenantStatuses, switchTenant, log])

  // Clear all errors
  const clearErrors = useCallback(() => {
    log('debug', 'Clearing all tenant selector errors')
    clearError()
    clearSwitchTenantError()
  }, [clearError, clearSwitchTenantError, log])

  // Utility to get tenant by slug
  const getTenantBySlug = useCallback((slug: string) => {
    const tenant = availableTenants.find(tenant => tenant.slug === slug)
    log('debug', `Get tenant by slug '${slug}': ${tenant ? 'found' : 'not found'}`)
    return tenant
  }, [availableTenants, log])

  // Utility to check if a tenant is current
  const isCurrentTenant = useCallback((slug: string) => {
    const isCurrent = currentTenant?.slug === slug
    // Only log when the current tenant changes, not on every check
    return isCurrent
  }, [currentTenant])

  return {
    // Current state
    currentTenant,
    availableTenants,

    // Loading and error states
    isLoading: isLoading || statusLoading,
    isSwitching: isSwitchingTenant,
    error: error || statusError,
    switchError: switchTenantError,

    // Actions
    switchTenant,
    refreshTenants,
    refreshProductionTenants,
    refreshDemoTenants,
    clearErrors,

    // Utilities
    getTenantBySlug,
    isCurrentTenant
  }
}

export default useTenantSelector