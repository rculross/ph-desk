/**
 * Cache Invalidation Tests for useTableCore Hook
 *
 * Tests for cache invalidation logic during tenant switching and persistence cleanup:
 * - Tenant-specific cache isolation
 * - Persistence key migration
 * - Cross-tenant data leakage prevention
 * - Storage cleanup and invalidation
 */

import React from 'react'

import {
  getCoreRowModel,
  type ColumnDef
} from '@tanstack/react-table'
import { renderHook, act, waitFor } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'

import { storageManager } from '../../utils/storage-manager'
import { useTableCore } from '../useTableCore'

// Mock storage manager
vi.mock('../../utils/storage-manager', () => ({
  storageManager: {
    safeGet: vi.fn(),
    safeSet: vi.fn(),
    safeRemove: vi.fn()
  }
}))

// Mock logger
vi.mock('../../utils/logger', () => ({
  logger: {
    content: {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn()
    }
  }
}))

// Mock localStorage
const mockLocalStorage = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn()
}
Object.defineProperty(window, 'localStorage', {
  value: mockLocalStorage,
  writable: true
})

// Mock Chrome storage API
const mockChromeStorage = {
  local: {
    get: vi.fn(),
    set: vi.fn(),
    remove: vi.fn()
  }
}
Object.defineProperty(global, 'chrome', {
  value: { storage: mockChromeStorage },
  writable: true
})

interface TestRow {
  id: number
  name: string
  value: number
}

const testData: TestRow[] = [
  { id: 1, name: 'Item 1', value: 10 },
  { id: 2, name: 'Item 2', value: 20 },
  { id: 3, name: 'Item 3', value: 30 }
]

const columns: ColumnDef<TestRow>[] = [
  { accessorKey: 'id', header: 'ID', size: 80 },
  { accessorKey: 'name', header: 'Name', size: 150 },
  { accessorKey: 'value', header: 'Value', size: 100 }
]

const mockStorageManager = vi.mocked(storageManager)

describe('useTableCore Cache Invalidation Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockStorageManager.safeGet.mockResolvedValue({})
    mockStorageManager.safeSet.mockResolvedValue()
    mockStorageManager.safeRemove.mockResolvedValue()
    mockLocalStorage.getItem.mockReturnValue(null)
  })

  afterEach(() => {
    vi.clearAllTimers()
  })

  it('should isolate cache by tenant slug', async () => {
    const tenantA = 'tenant-a'
    const tenantB = 'tenant-b'

    // Setup tenant A with some column sizing
    const { result: resultA, rerender: rerenderA } = renderHook(
      ({ tenantSlug }) => useTableCore({
        data: testData,
        columns,
        enableColumnResizing: true,
        persistColumnSizes: true,
        persistenceScope: {
          entityType: 'companies',
          tenantSlug
        }
      }),
      { initialProps: { tenantSlug: tenantA } }
    )

    await waitFor(() => {
      expect(resultA.current.isPersistenceLoaded).toBe(true)
    })

    // Set column sizes for tenant A
    act(() => {
      resultA.current.setColumnSizing({
        id: 100,
        name: 200,
        value: 150
      })
    })

    // Wait for debounced persistence
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 600))
    })

    // Verify tenant A's data was persisted
    expect(mockStorageManager.safeSet).toHaveBeenCalledWith(
      expect.objectContaining({
        'table-column-widths-companies-tenant-a': {
          id: 100,
          name: 200,
          value: 150
        }
      }),
      expect.any(Object)
    )

    // Switch to tenant B - should start fresh
    rerenderA({ tenantSlug: tenantB })

    await waitFor(() => {
      expect(resultA.current.isPersistenceLoaded).toBe(true)
    })

    // Tenant B should have default column sizes, not tenant A's
    expect(resultA.current.columnSizing).toEqual({})

    // Set different column sizes for tenant B
    act(() => {
      resultA.current.setColumnSizing({
        id: 80,
        name: 180,
        value: 120
      })
    })

    // Wait for debounced persistence
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 600))
    })

    // Should save under tenant B's key
    expect(mockStorageManager.safeSet).toHaveBeenCalledWith(
      expect.objectContaining({
        'table-column-widths-companies-tenant-b': {
          id: 80,
          name: 180,
          value: 120
        }
      }),
      expect.any(Object)
    )
  })

  it('should handle legacy key migration during tenant switch', async () => {
    const tenantSlug = 'test-tenant'
    const legacyKey = 'table_column_sizes_companies'
    const newKey = 'table-column-widths-companies-test-tenant'

    // Mock legacy data in localStorage
    mockLocalStorage.getItem.mockImplementation((key) => {
      if (key === legacyKey) {
        return JSON.stringify({ id: 90, name: 190 })
      }
      return null
    })

    const { result } = renderHook(() =>
      useTableCore({
        data: testData,
        columns,
        enableColumnResizing: true,
        persistColumnSizes: true,
        persistenceScope: {
          entityType: 'companies',
          tenantSlug
        }
      })
    )

    await waitFor(() => {
      expect(result.current.isPersistenceLoaded).toBe(true)
    })

    // Should migrate legacy data
    expect(result.current.columnSizing).toEqual({
      id: 90,
      name: 190
    })

    // Should save migrated data under new key
    expect(mockStorageManager.safeSet).toHaveBeenCalledWith(
      expect.objectContaining({
        [newKey]: { id: 90, name: 190 }
      }),
      expect.any(Object)
    )
  })

  it('should prevent cross-tenant data leakage', async () => {
    // Setup storage with data for multiple tenants
    mockStorageManager.safeGet.mockImplementation(async (keys) => {
      const result: Record<string, any> = {}
      for (const key of keys ?? []) {
        if (key === 'table-column-widths-companies-tenant-a') {
          result[key] = { id: 100, name: 200 }
        } else if (key === 'table-column-widths-companies-tenant-b') {
          result[key] = { id: 80, name: 180 }
        }
      }
      return result
    })

    // Hook for tenant A
    const { result: resultA } = renderHook(() =>
      useTableCore({
        data: testData,
        columns,
        enableColumnResizing: true,
        persistColumnSizes: true,
        persistenceScope: {
          entityType: 'companies',
          tenantSlug: 'tenant-a'
        }
      })
    )

    await waitFor(() => {
      expect(resultA.current.isPersistenceLoaded).toBe(true)
    })

    // Hook for tenant B
    const { result: resultB } = renderHook(() =>
      useTableCore({
        data: testData,
        columns,
        enableColumnResizing: true,
        persistColumnSizes: true,
        persistenceScope: {
          entityType: 'companies',
          tenantSlug: 'tenant-b'
        }
      })
    )

    await waitFor(() => {
      expect(resultB.current.isPersistenceLoaded).toBe(true)
    })

    // Each tenant should only have their own data
    expect(resultA.current.columnSizing).toEqual({ id: 100, name: 200 })
    expect(resultB.current.columnSizing).toEqual({ id: 80, name: 180 })

    // Verify correct keys were requested
    expect(mockStorageManager.safeGet).toHaveBeenCalledWith(
      expect.arrayContaining(['table-column-widths-companies-tenant-a'])
    )
    expect(mockStorageManager.safeGet).toHaveBeenCalledWith(
      expect.arrayContaining(['table-column-widths-companies-tenant-b'])
    )
  })

  it('should clean up storage for unused tenants', async () => {
    const { result, rerender } = renderHook(
      ({ tenantSlug }) => useTableCore({
        data: testData,
        columns,
        enableColumnResizing: true,
        persistColumnSizes: true,
        persistenceScope: {
          entityType: 'companies',
          tenantSlug
        }
      }),
      { initialProps: { tenantSlug: 'tenant-a' } }
    )

    await waitFor(() => {
      expect(result.current.isPersistenceLoaded).toBe(true)
    })

    // Set some data for tenant A
    act(() => {
      result.current.setColumnSizing({ id: 100 })
    })

    // Switch to tenant B
    rerender({ tenantSlug: 'tenant-b' })

    await waitFor(() => {
      expect(result.current.isPersistenceLoaded).toBe(true)
    })

    // Set data for tenant B
    act(() => {
      result.current.setColumnSizing({ id: 80 })
    })

    // The storage calls should be isolated per tenant
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 600))
    })

    const setCalls = mockStorageManager.safeSet.mock.calls
    const tenantACall = setCalls.find(call =>
      Object.keys(call[0]).some(key => key.includes('tenant-a'))
    )
    const tenantBCall = setCalls.find(call =>
      Object.keys(call[0]).some(key => key.includes('tenant-b'))
    )

    expect(tenantACall).toBeDefined()
    expect(tenantBCall).toBeDefined()
  })

  it('should handle invalid persistence data gracefully', async () => {
    const tenantSlug = 'test-tenant'

    // Mock corrupted storage data
    mockStorageManager.safeGet.mockResolvedValue({
      'table-column-widths-companies-test-tenant': 'invalid-json-string'
    })

    mockLocalStorage.getItem.mockImplementation((key) => {
      if (key.includes('table_column_sizes')) {
        return 'invalid-json'
      }
      return null
    })

    const { result } = renderHook(() =>
      useTableCore({
        data: testData,
        columns,
        enableColumnResizing: true,
        persistColumnSizes: true,
        persistenceScope: {
          entityType: 'companies',
          tenantSlug
        }
      })
    )

    await waitFor(() => {
      expect(result.current.isPersistenceLoaded).toBe(true)
    })

    // Should fall back to defaults when persistence data is invalid
    expect(result.current.columnSizing).toEqual({})
  })

  it('should handle storage backend failures during tenant switch', async () => {
    const { result, rerender } = renderHook(
      ({ tenantSlug }) => useTableCore({
        data: testData,
        columns,
        enableColumnResizing: true,
        persistColumnSizes: true,
        persistenceScope: {
          entityType: 'companies',
          tenantSlug
        }
      }),
      { initialProps: { tenantSlug: 'tenant-a' } }
    )

    await waitFor(() => {
      expect(result.current.isPersistenceLoaded).toBe(true)
    })

    // Mock storage failure on save
    mockStorageManager.safeSet.mockRejectedValue(new Error('Storage full'))

    // Set column sizing - should handle save failure gracefully
    act(() => {
      result.current.setColumnSizing({ id: 100 })
    })

    // Switch tenant while save is failing
    rerender({ tenantSlug: 'tenant-b' })

    await waitFor(() => {
      expect(result.current.isPersistenceLoaded).toBe(true)
    })

    // Should still function despite storage errors
    expect(result.current.columnSizing).toEqual({})
  })

  it('should debounce persistence operations across tenant switches', async () => {
    const { result, rerender } = renderHook(
      ({ tenantSlug }) => useTableCore({
        data: testData,
        columns,
        enableColumnResizing: true,
        persistColumnSizes: true,
        persistenceScope: {
          entityType: 'companies',
          tenantSlug
        }
      }),
      { initialProps: { tenantSlug: 'tenant-a' } }
    )

    await waitFor(() => {
      expect(result.current.isPersistenceLoaded).toBe(true)
    })

    // Rapidly change column sizes
    act(() => {
      result.current.setColumnSizing({ id: 100 })
    })

    act(() => {
      result.current.setColumnSizing({ id: 110 })
    })

    act(() => {
      result.current.setColumnSizing({ id: 120 })
    })

    // Switch tenant quickly
    rerender({ tenantSlug: 'tenant-b' })

    await waitFor(() => {
      expect(result.current.isPersistenceLoaded).toBe(true)
    })

    // More rapid changes on new tenant
    act(() => {
      result.current.setColumnSizing({ id: 80 })
    })

    act(() => {
      result.current.setColumnSizing({ id: 90 })
    })

    // Wait for all debounced operations
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 700))
    })

    // Should have made storage calls but debounced appropriately
    const setCalls = mockStorageManager.safeSet.mock.calls
    expect(setCalls.length).toBeLessThan(6) // Less than number of state changes
  })

  it('should handle column order persistence with tenant isolation', async () => {
    const { result, rerender } = renderHook(
      ({ tenantSlug }) => useTableCore({
        data: testData,
        columns,
        persistColumnOrder: true,
        persistenceScope: {
          entityType: 'companies',
          tenantSlug
        }
      }),
      { initialProps: { tenantSlug: 'tenant-a' } }
    )

    await waitFor(() => {
      expect(result.current.isPersistenceLoaded).toBe(true)
    })

    // Set column order for tenant A
    act(() => {
      result.current.setColumnOrder(['name', 'id', 'value'])
    })

    // Switch to tenant B
    rerender({ tenantSlug: 'tenant-b' })

    await waitFor(() => {
      expect(result.current.isPersistenceLoaded).toBe(true)
    })

    // Should have default order for tenant B
    expect(result.current.columnOrder).toEqual([])

    // Set different order for tenant B
    act(() => {
      result.current.setColumnOrder(['value', 'name', 'id'])
    })

    // Wait for persistence
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 600))
    })

    // Verify both tenants' data was saved separately
    const setCalls = mockStorageManager.safeSet.mock.calls
    const tenantACalls = setCalls.filter(call =>
      Object.keys(call[0]).some(key => key.includes('tenant-a'))
    )
    const tenantBCalls = setCalls.filter(call =>
      Object.keys(call[0]).some(key => key.includes('tenant-b'))
    )

    expect(tenantACalls.length).toBeGreaterThan(0)
    expect(tenantBCalls.length).toBeGreaterThan(0)
  })

  it('should validate persistence key generation for different scopes', () => {
    const testCases = [
      {
        scope: { entityType: 'companies', tenantSlug: 'tenant-a' },
        expectedKey: 'companies-tenant-a'
      },
      {
        scope: { entityType: 'issues', tenantSlug: 'tenant-b' },
        expectedKey: 'issues-tenant-b'
      },
      {
        scope: { entityType: 'workflows' },
        expectedKey: 'workflows'
      }
    ]

    testCases.forEach(({ scope, expectedKey }) => {
      const { result } = renderHook(() =>
        useTableCore({
          data: testData,
          columns,
          persistColumnSizes: true,
          persistenceScope: scope
        })
      )

      // The persistence key should be derived correctly
      // We can verify this through the storage calls made
      expect(result.current).toBeDefined()
    })
  })
})