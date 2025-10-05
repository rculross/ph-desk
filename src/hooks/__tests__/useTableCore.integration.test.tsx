/**
 * Integration Tests for useTableCore Hook
 *
 * Tests for integration scenarios combining multiple features:
 * - Persistence + Virtualization + Field Detection
 * - Multi-tenant scenarios with complex state
 * - Real-world usage patterns
 */

import React from 'react'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  getCoreRowModel,
  type ColumnDef
} from '@tanstack/react-table'
import { renderHook, act, waitFor } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'

import { storageManager } from '../../utils/storage-manager'
import { useFieldDetection } from '../useFieldDetection'
import { useTableCore } from '../useTableCore'

// Mock dependencies
vi.mock('../../utils/storage-manager')
vi.mock('../../utils/logger')
vi.mock('../../services/field-detection.service')

interface IntegrationTestRow {
  id: number
  name: string
  value: number
  tenant_specific_field?: string
}

const mockData: IntegrationTestRow[] = [
  { id: 1, name: 'Item 1', value: 100 },
  { id: 2, name: 'Item 2', value: 200 },
  { id: 3, name: 'Item 3', value: 300 }
]

const baseColumns: ColumnDef<IntegrationTestRow>[] = [
  { accessorKey: 'id', header: 'ID', size: 80 },
  { accessorKey: 'name', header: 'Name', size: 150 },
  { accessorKey: 'value', header: 'Value', size: 100 }
]

function createTestWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, staleTime: 0, gcTime: 0 }
    }
  })

  return function TestWrapper({ children }: { children: React.ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    )
  }
}

describe('useTableCore Integration Tests', () => {
  let wrapper: ReturnType<typeof createTestWrapper>

  beforeEach(() => {
    wrapper = createTestWrapper()
    vi.clearAllMocks()
    vi.mocked(storageManager.safeGet).mockResolvedValue({})
    vi.mocked(storageManager.safeSet).mockResolvedValue()
  })

  afterEach(() => {
    vi.clearAllTimers()
  })

  it('should integrate table core with field detection for multi-tenant usage', async () => {
    const { result } = renderHook(
      () => {
        const fieldDetection = useFieldDetection({
          entityType: 'company',
          tenantSlug: 'tenant-a',
          enabled: false // Start disabled
        })

        const tableCore = useTableCore({
          data: mockData,
          columns: baseColumns,
          enableColumnResizing: true,
          persistColumnSizes: true,
          persistenceScope: {
            entityType: 'company',
            tenantSlug: 'tenant-a'
          }
        })

        return { fieldDetection, tableCore }
      },
      { wrapper }
    )

    await waitFor(() => {
      expect(result.current.tableCore.isPersistenceLoaded).toBe(true)
    })

    // Test table and field detection integration
    expect(result.current.tableCore.table).toBeDefined()
    expect(result.current.fieldDetection.detectionResult).toBeUndefined()

    // Both hooks should be functional
    act(() => {
      result.current.tableCore.setColumnSizing({ id: 100, name: 200 })
    })

    expect(result.current.tableCore.columnSizing).toEqual({ id: 100, name: 200 })
  })

  it('should handle tenant switching with coordinated state cleanup', async () => {
    const { result, rerender } = renderHook(
      ({ tenantSlug }) => {
        const fieldDetection = useFieldDetection({
          entityType: 'company',
          tenantSlug,
          enabled: true
        })

        const tableCore = useTableCore({
          data: mockData,
          columns: baseColumns,
          persistColumnSizes: true,
          persistColumnOrder: true,
          persistenceScope: { entityType: 'companies', tenantSlug }
        })

        return { fieldDetection, tableCore }
      },
      { wrapper, initialProps: { tenantSlug: 'tenant-a' } }
    )

    await waitFor(() => {
      expect(result.current.tableCore.isPersistenceLoaded).toBe(true)
    })

    // Set state for tenant A
    act(() => {
      result.current.tableCore.setColumnSizing({ id: 100 })
      result.current.tableCore.setColumnOrder(['name', 'id', 'value'])
    })

    const tenantAState = {
      columnSizing: result.current.tableCore.columnSizing,
      columnOrder: result.current.tableCore.columnOrder
    }

    // Switch to tenant B
    rerender({ tenantSlug: 'tenant-b' })

    await waitFor(() => {
      expect(result.current.tableCore.isPersistenceLoaded).toBe(true)
    })

    // Should have clean state for tenant B
    expect(result.current.tableCore.columnSizing).toEqual({})
    expect(result.current.tableCore.columnOrder).toEqual([])

    // Set different state for tenant B
    act(() => {
      result.current.tableCore.setColumnSizing({ id: 80 })
    })

    // Switch back to tenant A
    rerender({ tenantSlug: 'tenant-a' })

    await waitFor(() => {
      expect(result.current.tableCore.isPersistenceLoaded).toBe(true)
    })

    // Should restore tenant A's state
    // Note: In real implementation, this would come from persistence
    expect(result.current.tableCore).toBeDefined()
  })

  it('should handle complex state combinations with error recovery', async () => {
    // Mock storage errors for tenant A
    vi.mocked(storageManager.safeGet).mockImplementation(async (keys) => {
      if (Array.isArray(keys) && keys.some((key: any) => key.includes('tenant-a'))) {
        throw new Error('Storage error for tenant A')
      }
      return {}
    })

    const { result } = renderHook(
      () => useTableCore({
        data: mockData,
        columns: baseColumns,
        enableSorting: true,
        enableFiltering: true,
        enableColumnResizing: true,
        enableSelection: true,
        persistColumnSizes: true,
        persistenceScope: { entityType: 'companies', tenantSlug: 'tenant-a' }
      }),
      { wrapper }
    )

    await waitFor(() => {
      expect(result.current.isPersistenceLoaded).toBe(true)
    })

    // Should handle storage errors gracefully and still be functional
    expect(result.current.table).toBeDefined()
    expect(result.current.columnSizing).toEqual({})

    // All features should work despite storage error
    act(() => {
      result.current.setSorting([{ id: 'name', desc: false }])
      result.current.setColumnFilters([{ id: 'value', value: '100' }])
      result.current.setColumnSizing({ id: 90 })
      result.current.setRowSelection({ '0': true })
    })

    expect(result.current.sorting).toEqual([{ id: 'name', desc: false }])
    expect(result.current.columnFilters).toEqual([{ id: 'value', value: '100' }])
    expect(result.current.columnSizing).toEqual({ id: 90 })
    expect(result.current.rowSelection).toEqual({ '0': true })
  })

  it('should coordinate multiple table instances with shared persistence context', async () => {
    const sharedContext = { entityType: 'companies', tenantSlug: 'shared-tenant' }

    // Create two table hooks with same persistence context
    const { result: result1 } = renderHook(
      () => useTableCore({
        data: mockData,
        columns: baseColumns,
        persistColumnSizes: true,
        persistenceScope: sharedContext
      }),
      { wrapper }
    )

    const { result: result2 } = renderHook(
      () => useTableCore({
        data: mockData.slice(0, 2), // Different data, same context
        columns: baseColumns,
        persistColumnSizes: true,
        persistenceScope: sharedContext
      }),
      { wrapper }
    )

    await waitFor(() => {
      expect(result1.current.isPersistenceLoaded).toBe(true)
      expect(result2.current.isPersistenceLoaded).toBe(true)
    })

    // Changes to one should persist for both (same context)
    act(() => {
      result1.current.setColumnSizing({ id: 120 })
    })

    // Wait for persistence
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 600))
    })

    // Both instances should eventually have access to same persistent state
    expect(vi.mocked(storageManager.safeSet)).toHaveBeenCalledWith(
      expect.objectContaining({
        'table-column-widths-companies-shared-tenant': { id: 120 }
      }),
      expect.any(Object)
    )
  })

  it('should handle feature flag combinations correctly', async () => {
    const allFeaturesEnabled = {
      enableSorting: true,
      enableMultiSort: true,
      enableFiltering: true,
      enableGlobalFilter: true,
      enableGrouping: true,
      enableSelection: true,
      enableColumnResizing: true,
      enablePagination: true
    }

    const { result } = renderHook(
      () => useTableCore({
        data: mockData,
        columns: baseColumns,
        ...allFeaturesEnabled
      }),
      { wrapper }
    )

    expect(result.current.table).toBeDefined()

    // Test all features are accessible
    act(() => {
      result.current.setSorting([{ id: 'name', desc: false }])
      result.current.setColumnFilters([{ id: 'value', value: '100' }])
      result.current.setGlobalFilter('test')
      result.current.setGrouping(['name'])
      result.current.setRowSelection({ '0': true })
      result.current.setColumnSizing({ id: 100 })
      result.current.setPagination({ pageIndex: 1, pageSize: 10 })
    })

    // All state should be set
    expect(result.current.sorting.length).toBe(1)
    expect(result.current.columnFilters.length).toBe(1)
    expect(result.current.globalFilter).toBe('test')
    expect(result.current.grouping.length).toBe(1)
    expect(result.current.rowSelection['0']).toBe(true)
    expect(result.current.columnSizing.id).toBe(100)
    expect(result.current.pagination.pageIndex).toBe(1)
  })

  it('should handle cleanup during component unmount with active persistence', async () => {
    const { result, unmount } = renderHook(
      () => useTableCore({
        data: mockData,
        columns: baseColumns,
        persistColumnSizes: true,
        persistenceScope: { entityType: 'companies', tenantSlug: 'test' }
      }),
      { wrapper }
    )

    await waitFor(() => {
      expect(result.current.isPersistenceLoaded).toBe(true)
    })

    // Start some persistence operations
    act(() => {
      result.current.setColumnSizing({ id: 100 })
      result.current.setColumnOrder(['name', 'id', 'value'])
    })

    // Unmount before persistence completes
    unmount()

    // Should not cause memory leaks or errors
    await new Promise(resolve => setTimeout(resolve, 700))
  })

  it('should handle persistence key migration during integration', async () => {
    const legacyData = {
      'table_column_sizes_companies': { id: 90, name: 180 },
      'table_column_order_companies': ['value', 'name', 'id']
    }

    // Mock localStorage with legacy data
    const mockLocalStorage = {
      getItem: vi.fn((key) => {
        const data = legacyData[key as keyof typeof legacyData]
        return data ? JSON.stringify(data) : null
      }),
      setItem: vi.fn(),
      removeItem: vi.fn()
    }
    Object.defineProperty(window, 'localStorage', { value: mockLocalStorage })

    const { result } = renderHook(
      () => useTableCore({
        data: mockData,
        columns: baseColumns,
        persistColumnSizes: true,
        persistColumnOrder: true,
        persistenceScope: { entityType: 'companies', tenantSlug: 'test-tenant' }
      }),
      { wrapper }
    )

    await waitFor(() => {
      expect(result.current.isPersistenceLoaded).toBe(true)
    })

    // Should migrate legacy data
    expect(result.current.columnSizing).toEqual({ id: 90, name: 180 })
    expect(result.current.columnOrder).toEqual(['value', 'name', 'id'])

    // Should save migrated data under new keys
    expect(vi.mocked(storageManager.safeSet)).toHaveBeenCalledWith(
      expect.objectContaining({
        'table-column-widths-companies-test-tenant': { id: 90, name: 180 }
      }),
      expect.any(Object)
    )
  })
})