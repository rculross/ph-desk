/**
 * Tenant Selector Hook
 * 
 * Custom hook that manages tenant selection state, fetching all available tenants,
 * checking their active status, and providing formatted data for the TenantSelector component.
 * Also handles tenant switching logic with proper error handling and loading states.
 */

import { useCallback, useEffect, useMemo } from 'react'

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
  const log = logger.extension // Using extension context as this hook is primarily used in extension contexts
  const queryClient = useQueryClient()

  // Get auth state to check if user is authenticated before fetching tenants
  const isAuthenticated = useAuthStore(state => state.isAuthenticated)

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
      log.debug('No current tenant available')
      return null
    }
    
    const tenantStatus = getTenantStatus(rawCurrentTenant.slug)
    const formattedTenant = formatTenantOption(rawCurrentTenant, tenantStatus)
    log.debug(`Current tenant formatted: ${formattedTenant.slug} (active: ${formattedTenant.isActive}, has status: ${!!tenantStatus})`)
    return formattedTenant
  }, [rawCurrentTenant, tenantStatuses, getTenantStatus, log])

  // Format available tenants and sort by environment, active status, and name
  const availableTenants = useMemo(() => {
    // Debug: Log what we're receiving from the store
    log.info(`Hook: Received from store: ${rawAvailableTenants.length} tenants`)

    const demoTenants = rawAvailableTenants.filter(t => t.domain?.includes('planhatdemo.com'))
    const prodTenants = rawAvailableTenants.filter(t => !t.domain?.includes('planhatdemo.com'))

    if (rawAvailableTenants.length > 0) {
      if (prodTenants.length > 0) {
        log.debug(`Hook Raw Prod: ${prodTenants.map(t => t.slug).join(', ')}`)
      }
      if (demoTenants.length > 0) {
        log.debug(`Hook Raw Demo: ${demoTenants.map(t => t.slug).join(', ')}`)
      }
    }

    log.info(`Formatting available tenants: ${rawAvailableTenants.length} total (${prodTenants.length} prod, ${demoTenants.length} demo), ${tenantStatuses.length} statuses`)

    if (prodTenants.length > 0) {
      log.debug(`Prod: ${prodTenants.map(t => t.slug).join(', ')}`)
    }
    if (demoTenants.length > 0) {
      log.debug(`Demo: ${demoTenants.map(t => t.slug).join(', ')}`)
    }

    const formatted = rawAvailableTenants
      .map(tenant => {
        const tenantStatus = getTenantStatus(tenant.slug)
        return formatTenantOption(tenant, tenantStatus)
      })

    // Filter out ALL tenants where we don't have access (both production and demo)
    // Only show tenants where /myprofile check succeeded (isActive = true)
    const filteredTenants: TenantOption[] = []
    const inactiveProdTenants: string[] = []
    const inactiveDemoTenants: string[] = []

    formatted.forEach(tenant => {
      if (tenant.isActive) {
        // Only include tenants where /myprofile returned 200
        filteredTenants.push(tenant)
      } else {
        // Collect inactive tenants for logging
        if (tenant.environment === 'production') {
          inactiveProdTenants.push(tenant.slug)
        } else {
          inactiveDemoTenants.push(tenant.slug)
        }
      }
    })

    // Log filtered tenants
    if (inactiveProdTenants.length > 0) {
      log.debug(`Filtered out inactive production tenants (no access): ${inactiveProdTenants.join(', ')}`)
    }
    if (inactiveDemoTenants.length > 0) {
      log.debug(`Filtered out inactive demo tenants (no access): ${inactiveDemoTenants.join(', ')}`)
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
    const filteredOutCount = inactiveProdTenants.length + inactiveDemoTenants.length

    if (filteredOutCount > 0) {
      log.info(`Filtered out ${filteredOutCount} tenants without access (${inactiveProdTenants.length} prod, ${inactiveDemoTenants.length} demo)`)
    }

    log.debug(`Available tenants (with access only): ${sortedTenants.length} total (${prodCount} prod, ${demoCount} demo, all active)`)

    return sortedTenants
  }, [rawAvailableTenants, tenantStatuses, getTenantStatus, log])

  // Fetch tenants and tenant statuses on mount if not already loaded or if data is incomplete
  useEffect(() => {
    // Desktop app: Only fetch tenants if user is authenticated
    if (!isAuthenticated) {
      log.debug('User not authenticated - skipping tenant fetch')
      return
    }

    const hasTenants = rawAvailableTenants.length > 0
    const demoCount = rawAvailableTenants.filter(t => t.domain?.includes('planhatdemo.com')).length
    const hasDemo = demoCount > 0

    // Check if we should fetch: no data, or prod-only data when demo environment might be available
    const shouldFetch = !hasTenants || (!hasDemo && !isLoading && !error)

    if (shouldFetch) {
      if (!hasTenants) {
        log.info('useTenantSelector hook initialized - fetching available tenants (no data)')
      } else {
        log.info(`useTenantSelector hook initialized - refreshing tenants (have ${rawAvailableTenants.length} prod-only, checking for demo)`)
      }

      // Check current window location for demo detection
      const currentUrl = window.location.href
      const isCurrentlyDemo = currentUrl.includes('planhatdemo.com')
      log.debug(`Fetching available tenants on mount from ${window.location.hostname} (demo: ${isCurrentlyDemo})`)

      // Force refresh when we suspect incomplete data
      fetchAvailableTenants(undefined, !hasTenants).catch(err => {
        log.error(`Failed to fetch tenants on mount: ${err instanceof Error ? err.message : 'Unknown error'}`)
      })
    } else {
      log.debug(`Hook initialized with existing data: ${rawAvailableTenants.length} tenants (${demoCount} demo), loading: ${isLoading}, error: ${!!error}`)
    }
  }, [isAuthenticated, rawAvailableTenants.length, isLoading, error, fetchAvailableTenants, log])

  // Fetch tenant statuses when tenants are available
  useEffect(() => {
    if (rawAvailableTenants.length > 0 && tenantStatuses.length === 0 && !statusLoading) {
      log.debug(`Fetching tenant statuses for ${rawAvailableTenants.length} tenants`)
      fetchAllTenantStatuses()
    }
  }, [rawAvailableTenants.length, tenantStatuses.length, statusLoading, fetchAllTenantStatuses, log])

  // Switch tenant with error handling and store clearing
  const switchTenant = useCallback(async (tenantSlug: string) => {
    log.info(`Switching tenant from ${currentTenant?.slug ?? 'none'} to ${tenantSlug}`)

    try {
      // Clear all other stores when switching tenants
      log.debug('Clearing stores before tenant switch')
      useAppStore.getState().reset()

      // Clear React Query cache for tenant-specific data
      log.debug('Clearing React Query cache for tenant-specific data')
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
        log.debug('Clearing cached export data')
        // Clear any cached export data
        window.electron.storage.remove([
          'export-progress',
          'export-selections',
          'export-field-mappings'
        ]).catch(() => {
          // Ignore cleanup errors
          log.warn('Non-critical: failed to clear some cached export data')
        })
      }

      // Switch the tenant
      log.info('Executing tenant switch')
      await switchTenantAction(tenantSlug)

      // Refresh tenant statuses after switching
      log.debug('Refreshing tenant statuses after switch')
      await fetchAllTenantStatuses()

      log.info(`Tenant switch completed successfully to ${tenantSlug}`)
    } catch (error) {
      log.error(`Failed to switch tenant from ${currentTenant?.slug ?? 'none'} to ${tenantSlug}: ${error instanceof Error ? error.message : 'Unknown error'}`)
      // Error is already handled by the store
    }
  }, [switchTenantAction, fetchAllTenantStatuses, currentTenant?.slug, queryClient])

  // Refresh tenants and their statuses
  const refreshTenants = useCallback(async () => {
    log.info('Refreshing tenant data')
    
    try {
      log.debug('Refreshing tenants and statuses')
      await Promise.all([
        fetchAvailableTenants(undefined, true), // Force refresh
        fetchAllTenantStatuses()
      ])
      log.info('Tenant data refresh completed successfully')
    } catch (error) {
      log.error(`Failed to refresh tenant data: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }, [fetchAvailableTenants, fetchAllTenantStatuses])

  // Clear all errors
  const clearErrors = useCallback(() => {
    log.debug('Clearing all tenant selector errors')
    clearError()
    clearSwitchTenantError()
  }, [clearError, clearSwitchTenantError])

  // Utility to get tenant by slug
  const getTenantBySlug = useCallback((slug: string) => {
    const tenant = availableTenants.find(tenant => tenant.slug === slug)
    log.debug(`Get tenant by slug '${slug}': ${tenant ? 'found' : 'not found'}`)
    return tenant
  }, [availableTenants])

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
    clearErrors,
    
    // Utilities
    getTenantBySlug,
    isCurrentTenant
  }
}

export default useTenantSelector