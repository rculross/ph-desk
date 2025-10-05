/**
 * TenantSelector Integration Test
 *
 * Tests the integration between TenantSelector component, useTenantSelector hook,
 * and the tenant status checking functionality.
 */

import { renderHook, waitFor } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach } from 'vitest'

import type { TenantInfo, TenantStatus } from '../../api/services/tenant.service'
import { useTenantSelector } from '../../hooks/useTenantSelector'
import { useTenantStore } from '../../stores/tenant.store'

// Mock the stores
vi.mock('../../stores/tenant.store')
vi.mock('../../stores/app.store')
vi.mock('../../stores/auth.store')
vi.mock('../../stores/rate-limiting.store')

// Mock Chrome APIs
;(global as any).chrome = {
  storage: {
    local: {
      remove: vi.fn().mockResolvedValue(undefined)
    }
  }
}

describe('TenantSelector Integration', () => {
  const mockTenantInfo: TenantInfo = {
    id: 'tenant-1',
    slug: 'test-tenant',
    name: 'Test Tenant',
    isActive: false, // This will be overridden by status check
    domain: 'test.planhat.com',
    logo: undefined,
    settings: {
      timezone: 'UTC',
      locale: 'en',
      dateFormat: 'YYYY-MM-DD',
      currency: 'USD',
      workingDays: [1, 2, 3, 4, 5],
      workingHours: { start: '09:00', end: '17:00' },
      customFields: {}
    },
    features: [],
    limits: {
      maxUsers: 100,
      maxProjects: 50,
      maxStorageGB: 100,
      maxApiCallsPerMonth: 100000,
      maxExportRecords: 10000
    },
    billing: {
      plan: 'Pro',
      status: 'active',
      billingCycle: 'monthly',
      usage: {
        users: 10,
        projects: 5,
        storageGB: 2.5,
        apiCallsThisMonth: 1000,
        lastUpdated: '2024-01-15T10:00:00Z'
      }
    },
    subscription: {
      plan: 'Pro',
      status: 'active',
      currentPeriodStart: '2024-01-01',
      currentPeriodEnd: '2024-12-31',
      cancelAtPeriodEnd: false
    },
    members: 10,
    lastActivity: '2024-01-15T10:00:00Z',
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-15T10:00:00Z'
  }

  const mockTenantStatus: TenantStatus = {
    tenantSlug: 'test-tenant',
    name: 'Test Tenant',
    isActive: true // This should override the TenantInfo.isActive value
  }

  const mockTenantStore = {
    currentTenant: null,
    availableTenants: [mockTenantInfo],
    isLoading: false,
    isSwitchingTenant: false,
    error: null,
    switchTenantError: null,
    tenantStatuses: [mockTenantStatus],
    statusLoading: false,
    statusError: null,
    fetchAvailableTenants: vi.fn(),
    fetchAllTenantStatuses: vi.fn(),
    switchTenant: vi.fn(),
    clearError: vi.fn(),
    clearSwitchTenantError: vi.fn(),
    refreshTenantData: vi.fn(),
    getTenantStatus: vi.fn()
  }

  beforeEach(() => {
    vi.clearAllMocks()
    
    // Mock the getTenantStatus function
    mockTenantStore.getTenantStatus.mockImplementation((slug: string) => {
      return mockTenantStatus.tenantSlug === slug ? mockTenantStatus : null
    })

    // Mock the store
    vi.mocked(useTenantStore).mockReturnValue(mockTenantStore as any)
  })

  it('should merge tenant info with status data correctly', () => {
    const { result } = renderHook(() => useTenantSelector())

    expect(result.current.availableTenants).toHaveLength(1)
    
    const tenant = result.current.availableTenants[0]!
    expect(tenant).toBeDefined()
    expect(tenant.slug).toBe('test-tenant')
    expect(tenant.name).toBe('Test Tenant')
    
    // The key test: status should override the TenantInfo.isActive value
    expect(tenant.isActive).toBe(true) // Should be true from status check, not false from TenantInfo
  })

  it('should handle loading states for both tenants and statuses', () => {
    const loadingStore = {
      ...mockTenantStore,
      isLoading: true,
      statusLoading: true
    }
    
    vi.mocked(useTenantStore).mockReturnValue(loadingStore as any)

    const { result } = renderHook(() => useTenantSelector())

    expect(result.current.isLoading).toBe(true)
  })

  it('should handle error states for both tenants and statuses', () => {
    const errorStore = {
      ...mockTenantStore,
      error: 'Failed to load tenants',
      statusError: 'Failed to check status'
    }
    
    vi.mocked(useTenantStore).mockReturnValue(errorStore as any)

    const { result } = renderHook(() => useTenantSelector())

    expect(result.current.error).toBe('Failed to load tenants')
  })

  it('should fetch tenant statuses when tenants are available', async () => {
    renderHook(() => useTenantSelector())

    await waitFor(() => {
      expect(mockTenantStore.fetchAllTenantStatuses).toHaveBeenCalled()
    })
  })

  it('should clear stores and refresh statuses when switching tenants', async () => {
    const { result } = renderHook(() => useTenantSelector())

    await result.current.switchTenant('another-tenant')

    expect(mockTenantStore.switchTenant).toHaveBeenCalledWith('another-tenant')
    expect(mockTenantStore.fetchAllTenantStatuses).toHaveBeenCalled()
    expect((global as any).chrome.storage.local.remove).toHaveBeenCalledWith([
      'export-progress',
      'export-selections',
      'export-field-mappings'
    ])
  })

  it('should refresh both tenant data and statuses', async () => {
    const { result } = renderHook(() => useTenantSelector())

    await result.current.refreshTenants()

    expect(mockTenantStore.refreshTenantData).toHaveBeenCalled()
    expect(mockTenantStore.fetchAllTenantStatuses).toHaveBeenCalled()
  })

  it('should fallback to TenantInfo.isActive when status is not available', () => {
    const storeWithoutStatus = {
      ...mockTenantStore,
      tenantStatuses: [],
      getTenantStatus: vi.fn().mockReturnValue(null)
    }
    
    vi.mocked(useTenantStore).mockReturnValue(storeWithoutStatus as any)

    const { result } = renderHook(() => useTenantSelector())

    const tenant = result.current.availableTenants[0]!
    expect(tenant).toBeDefined()
    expect(tenant.isActive).toBe(false) // Should use TenantInfo.isActive as fallback
  })
})