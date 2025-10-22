/**
 * Column Visibility Persistence Tests for useTableCore Hook
 *
 * Tests for column visibility persistence feature:
 * - Persists column visibility state per tenant
 * - Uses storage key pattern: table-column-visibility-{entityType}-{tenantSlug}
 * - Debounces saves (500ms)
 * - Loads on mount
 * - Uses the existing persistenceBackend system
 *
 * NOTE: These tests follow TDD approach - written before implementation.
 * They specify the expected behavior of column visibility persistence.
 *
 * @vitest-environment jsdom
 */

import React from 'react'

import { type ColumnDef } from '@tanstack/react-table'
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

// Mock window.electron.storage
const mockElectronStorage = {
  get: vi.fn(),
  set: vi.fn(),
  remove: vi.fn()
}

// Setup global window object for test environment
if (typeof window === 'undefined') {
  global.window = {} as any
}

Object.defineProperty(window, 'electron', {
  value: { storage: mockElectronStorage },
  writable: true,
  configurable: true
})

interface TestRow {
  id: number
  name: string
  email: string
  status: string
  value: number
}

const testData: TestRow[] = [
  { id: 1, name: 'Alice', email: 'alice@test.com', status: 'active', value: 100 },
  { id: 2, name: 'Bob', email: 'bob@test.com', status: 'inactive', value: 200 },
  { id: 3, name: 'Charlie', email: 'charlie@test.com', status: 'active', value: 300 }
]

const columns: ColumnDef<TestRow>[] = [
  { accessorKey: 'id', header: 'ID', size: 80 },
  { accessorKey: 'name', header: 'Name', size: 150 },
  { accessorKey: 'email', header: 'Email', size: 200 },
  { accessorKey: 'status', header: 'Status', size: 100 },
  { accessorKey: 'value', header: 'Value', size: 100 }
]

const mockStorageManager = vi.mocked(storageManager)

describe('useTableCore Column Visibility Persistence', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockStorageManager.safeGet.mockResolvedValue({})
    mockStorageManager.safeSet.mockResolvedValue()
    mockStorageManager.safeRemove.mockResolvedValue()
  })

  afterEach(() => {
    vi.clearAllTimers()
  })

  // Helper to wait for persistence to load with proper async handling
  const waitForPersistence = async (result: any, timeout = 1000) => {
    return waitFor(
      () => {
        expect(result.current.isPersistenceLoaded).toBe(true)
      },
      { timeout }
    )
  }

  describe('Basic Persistence', () => {
    it('should save column visibility state to storage', async () => {
      const { result } = renderHook(() =>
        useTableCore({
          data: testData,
          columns,
          persistColumnVisibility: true,
          persistenceScope: {
            entityType: 'companies',
            tenantSlug: 'test-tenant'
          }
        })
      )

      // Wait for initial persistence load
      await waitFor(() => {
        expect(result.current.isPersistenceLoaded).toBe(true)
      })

      // Hide some columns
      await act(async () => {
        result.current.setColumnVisibility({
          email: false,
          status: false
        })
        // Wait for debounced persistence (500ms + buffer)
        await new Promise(resolve => setTimeout(resolve, 600))
      })

      // Should persist to storage with correct key
      expect(mockStorageManager.safeSet).toHaveBeenCalledWith(
        expect.objectContaining({
          'table-column-visibility-companies-test-tenant': {
            email: false,
            status: false
          }
        }),
        expect.objectContaining({ priority: 'low' })
      )
    })

    it('should load saved visibility state on mount', async () => {
      // Mock persisted visibility state
      mockStorageManager.safeGet.mockResolvedValue({
        'table-column-visibility-companies-test-tenant': {
          email: false,
          value: false
        }
      })

      const { result } = renderHook(() =>
        useTableCore({
          data: testData,
          columns,
          persistColumnVisibility: true,
          persistenceScope: {
            entityType: 'companies',
            tenantSlug: 'test-tenant'
          }
        })
      )

      // Should load persisted state
      await waitFor(() => {
        expect(result.current.isPersistenceLoaded).toBe(true)
      })

      // Verify visibility state was loaded
      expect(result.current.columnVisibility).toEqual({
        email: false,
        value: false
      })
    })

    it('should debounce saves correctly (500ms)', async () => {
      const { result } = renderHook(() =>
        useTableCore({
          data: testData,
          columns,
          persistColumnVisibility: true,
          persistenceScope: {
            entityType: 'companies',
            tenantSlug: 'test-tenant'
          }
        })
      )

      await waitFor(() => {
        expect(result.current.isPersistenceLoaded).toBe(true)
      })

      // Rapidly change visibility multiple times
      act(() => {
        result.current.setColumnVisibility({ email: false })
      })

      act(() => {
        result.current.setColumnVisibility({ email: false, status: false })
      })

      act(() => {
        result.current.setColumnVisibility({ email: false, status: false, value: false })
      })

      // Should not save yet
      expect(mockStorageManager.safeSet).not.toHaveBeenCalled()

      // Wait a bit but not long enough for debounce
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 400))
      })

      // Still should not have saved
      expect(mockStorageManager.safeSet).not.toHaveBeenCalled()

      // Wait for debounce to complete (600ms total for safety)
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 200))
      })

      // Now should save only the final state
      expect(mockStorageManager.safeSet).toHaveBeenCalledTimes(1)
      expect(mockStorageManager.safeSet).toHaveBeenCalledWith(
        expect.objectContaining({
          'table-column-visibility-companies-test-tenant': {
            email: false,
            status: false,
            value: false
          }
        }),
        expect.any(Object)
      )
    })
  })

  describe('Tenant-Specific Behavior', () => {
    it('should save different visibility settings for different tenants', async () => {
      // First tenant
      const { result: result1, unmount: unmount1 } = renderHook(() =>
        useTableCore({
          data: testData,
          columns,
          persistColumnVisibility: true,
          persistenceScope: {
            entityType: 'companies',
            tenantSlug: 'tenant-a'
          }
        })
      )

      await waitFor(() => {
        expect(result1.current.isPersistenceLoaded).toBe(true)
      })

      // Set visibility for tenant A
      act(() => {
        result1.current.setColumnVisibility({ email: false })
      })

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 500))
        await Promise.resolve()
      })

      // Should save under tenant A's key
      expect(mockStorageManager.safeSet).toHaveBeenCalledWith(
        expect.objectContaining({
          'table-column-visibility-companies-tenant-a': { email: false }
        }),
        expect.any(Object)
      )

      unmount1()
      vi.clearAllMocks()

      // Second tenant
      const { result: result2 } = renderHook(() =>
        useTableCore({
          data: testData,
          columns,
          persistColumnVisibility: true,
          persistenceScope: {
            entityType: 'companies',
            tenantSlug: 'tenant-b'
          }
        })
      )

      await waitFor(() => {
        expect(result2.current.isPersistenceLoaded).toBe(true)
      })

      // Set different visibility for tenant B
      act(() => {
        result2.current.setColumnVisibility({ status: false, value: false })
      })

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 500))
        await Promise.resolve()
      })

      // Should save under tenant B's key
      expect(mockStorageManager.safeSet).toHaveBeenCalledWith(
        expect.objectContaining({
          'table-column-visibility-companies-tenant-b': { status: false, value: false }
        }),
        expect.any(Object)
      )
    })

    it('should load correct visibility state when switching tenants', async () => {
      // Mock different states for different tenants
      mockStorageManager.safeGet.mockImplementation(async (keys) => {
        const result: Record<string, any> = {}
        for (const key of keys ?? []) {
          if (key === 'table-column-visibility-companies-tenant-a') {
            result[key] = { email: false }
          } else if (key === 'table-column-visibility-companies-tenant-b') {
            result[key] = { status: false, value: false }
          }
        }
        return result
      })

      // Start with tenant A
      const { result, rerender } = renderHook(
        ({ tenantSlug }) =>
          useTableCore({
            data: testData,
            columns,
            persistColumnVisibility: true,
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

      // Should load tenant A's visibility
      expect(result.current.columnVisibility).toEqual({ email: false })

      // Switch to tenant B
      rerender({ tenantSlug: 'tenant-b' })

      await waitFor(() => {
        expect(result.current.isPersistenceLoaded).toBe(true)
      })

      // Should load tenant B's visibility
      expect(result.current.columnVisibility).toEqual({ status: false, value: false })
    })

    it('should include tenant slug in storage key', async () => {
      const { result } = renderHook(() =>
        useTableCore({
          data: testData,
          columns,
          persistColumnVisibility: true,
          persistenceScope: {
            entityType: 'companies',
            tenantSlug: 'my-tenant-123'
          }
        })
      )

      await waitFor(() => {
        expect(result.current.isPersistenceLoaded).toBe(true)
      })

      act(() => {
        result.current.setColumnVisibility({ email: false })
      })

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 500))
        await Promise.resolve()
      })

      // Should use key with tenant slug
      expect(mockStorageManager.safeSet).toHaveBeenCalledWith(
        expect.objectContaining({
          'table-column-visibility-companies-my-tenant-123': expect.any(Object)
        }),
        expect.any(Object)
      )

      // Should request from storage with correct key
      expect(mockStorageManager.safeGet).toHaveBeenCalledWith(
        expect.arrayContaining(['table-column-visibility-companies-my-tenant-123'])
      )
    })
  })

  describe('State Validation', () => {
    it('should reject invalid visibility states', async () => {
      // Mock invalid persisted data
      mockStorageManager.safeGet.mockResolvedValue({
        'table-column-visibility-companies-test-tenant': 'invalid-string'
      })

      const { result } = renderHook(() =>
        useTableCore({
          data: testData,
          columns,
          persistColumnVisibility: true,
          persistenceScope: {
            entityType: 'companies',
            tenantSlug: 'test-tenant'
          }
        })
      )

      await waitFor(() => {
        expect(result.current.isPersistenceLoaded).toBe(true)
      })

      // Should fall back to default visibility (all visible)
      expect(result.current.columnVisibility).toEqual({})
    })

    it('should handle corrupted storage data gracefully', async () => {
      // Mock storage returning unexpected data types
      mockStorageManager.safeGet.mockResolvedValue({
        'table-column-visibility-companies-test-tenant': [1, 2, 3] // Array instead of object
      })

      const { result } = renderHook(() =>
        useTableCore({
          data: testData,
          columns,
          persistColumnVisibility: true,
          persistenceScope: {
            entityType: 'companies',
            tenantSlug: 'test-tenant'
          }
        })
      )

      await waitFor(() => {
        expect(result.current.isPersistenceLoaded).toBe(true)
      })

      // Should not crash and fall back to defaults
      expect(result.current.columnVisibility).toEqual({})
      expect(result.current.table).toBeDefined()
    })

    it('should handle empty or missing storage gracefully', async () => {
      mockStorageManager.safeGet.mockResolvedValue({})

      const { result } = renderHook(() =>
        useTableCore({
          data: testData,
          columns,
          persistColumnVisibility: true,
          persistenceScope: {
            entityType: 'companies',
            tenantSlug: 'test-tenant'
          }
        })
      )

      await waitFor(() => {
        expect(result.current.isPersistenceLoaded).toBe(true)
      })

      // Should use default state (all columns visible)
      expect(result.current.columnVisibility).toEqual({})
    })

    it('should validate visibility state has boolean values', async () => {
      // Mock visibility state with non-boolean values
      mockStorageManager.safeGet.mockResolvedValue({
        'table-column-visibility-companies-test-tenant': {
          email: 'false', // String instead of boolean
          status: 1, // Number instead of boolean
          value: null // Null instead of boolean
        }
      })

      const { result } = renderHook(() =>
        useTableCore({
          data: testData,
          columns,
          persistColumnVisibility: true,
          persistenceScope: {
            entityType: 'companies',
            tenantSlug: 'test-tenant'
          }
        })
      )

      await waitFor(() => {
        expect(result.current.isPersistenceLoaded).toBe(true)
      })

      // Should reject invalid state and use defaults
      expect(result.current.columnVisibility).toEqual({})
    })
  })

  describe('Integration with Table', () => {
    it('should persist when hiding columns via table API', async () => {
      const { result } = renderHook(() =>
        useTableCore({
          data: testData,
          columns,
          persistColumnVisibility: true,
          persistenceScope: {
            entityType: 'companies',
            tenantSlug: 'test-tenant'
          }
        })
      )

      await waitFor(() => {
        expect(result.current.isPersistenceLoaded).toBe(true)
      })

      // Use table API to hide a column
      act(() => {
        result.current.table.getColumn('email')?.toggleVisibility(false)
      })

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 500))
        await Promise.resolve()
      })

      // Should persist the change
      expect(mockStorageManager.safeSet).toHaveBeenCalledWith(
        expect.objectContaining({
          'table-column-visibility-companies-test-tenant': expect.objectContaining({
            email: false
          })
        }),
        expect.any(Object)
      )
    })

    it('should persist when showing hidden columns', async () => {
      // Start with some columns hidden
      mockStorageManager.safeGet.mockResolvedValue({
        'table-column-visibility-companies-test-tenant': {
          email: false,
          status: false
        }
      })

      const { result } = renderHook(() =>
        useTableCore({
          data: testData,
          columns,
          persistColumnVisibility: true,
          persistenceScope: {
            entityType: 'companies',
            tenantSlug: 'test-tenant'
          }
        })
      )

      await waitFor(() => {
        expect(result.current.isPersistenceLoaded).toBe(true)
      })

      // Verify columns are hidden
      expect(result.current.columnVisibility).toEqual({
        email: false,
        status: false
      })

      vi.clearAllMocks()

      // Show the email column
      act(() => {
        result.current.table.getColumn('email')?.toggleVisibility(true)
      })

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 500))
        await Promise.resolve()
      })

      // Should persist the change
      expect(mockStorageManager.safeSet).toHaveBeenCalledWith(
        expect.objectContaining({
          'table-column-visibility-companies-test-tenant': expect.objectContaining({
            email: true,
            status: false
          })
        }),
        expect.any(Object)
      )
    })

    it('should work with column reordering', async () => {
      const { result } = renderHook(() =>
        useTableCore({
          data: testData,
          columns,
          persistColumnVisibility: true,
          persistColumnOrder: true,
          persistenceScope: {
            entityType: 'companies',
            tenantSlug: 'test-tenant'
          }
        })
      )

      await waitFor(() => {
        expect(result.current.isPersistenceLoaded).toBe(true)
      })

      // Hide a column
      act(() => {
        result.current.setColumnVisibility({ email: false })
      })

      // Reorder columns
      act(() => {
        result.current.setColumnOrder(['value', 'name', 'id', 'status', 'email'])
      })

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 500))
        await Promise.resolve()
      })

      // Both should be persisted
      expect(mockStorageManager.safeSet).toHaveBeenCalledWith(
        expect.objectContaining({
          'table-column-visibility-companies-test-tenant': { email: false },
          'table-column-order-companies-test-tenant': ['value', 'name', 'id', 'status', 'email']
        }),
        expect.any(Object)
      )
    })
  })

  describe('Edge Cases', () => {
    it('should not persist when persistence is disabled', async () => {
      const { result } = renderHook(() =>
        useTableCore({
          data: testData,
          columns,
          persistColumnVisibility: false, // Disabled
          persistenceScope: {
            entityType: 'companies',
            tenantSlug: 'test-tenant'
          }
        })
      )

      // Should load immediately since persistence is disabled
      expect(result.current.isPersistenceLoaded).toBe(true)

      act(() => {
        result.current.setColumnVisibility({ email: false })
      })

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 500))
        await Promise.resolve()
      })

      // Should NOT persist to storage
      expect(mockStorageManager.safeSet).not.toHaveBeenCalled()
    })

    it('should handle missing tenant slug gracefully', async () => {
      const { result } = renderHook(() =>
        useTableCore({
          data: testData,
          columns,
          persistColumnVisibility: true,
          persistenceScope: {
            entityType: 'companies'
            // No tenantSlug
          }
        })
      )

      await waitFor(() => {
        expect(result.current.isPersistenceLoaded).toBe(true)
      })

      act(() => {
        result.current.setColumnVisibility({ email: false })
      })

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 500))
        await Promise.resolve()
      })

      // Should still persist but without tenant slug in key
      expect(mockStorageManager.safeSet).toHaveBeenCalledWith(
        expect.objectContaining({
          'table-column-visibility-companies': { email: false }
        }),
        expect.any(Object)
      )
    })

    it('should handle multiple rapid visibility changes with debouncing', async () => {
      const { result } = renderHook(() =>
        useTableCore({
          data: testData,
          columns,
          persistColumnVisibility: true,
          persistenceScope: {
            entityType: 'companies',
            tenantSlug: 'test-tenant'
          }
        })
      )

      await waitFor(() => {
        expect(result.current.isPersistenceLoaded).toBe(true)
      })

      // Rapidly toggle visibility
      for (let i = 0; i < 10; i++) {
        act(() => {
          result.current.setColumnVisibility({
            email: i % 2 === 0,
            status: i % 3 === 0
          })
        })
      }

      // Fast-forward through debounce
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 500))
        await Promise.resolve()
      })

      // Should only save once with final state
      expect(mockStorageManager.safeSet).toHaveBeenCalledTimes(1)
    })

    it('should cleanup debounce timer on unmount', async () => {
      const { result, unmount } = renderHook(() =>
        useTableCore({
          data: testData,
          columns,
          persistColumnVisibility: true,
          persistenceScope: {
            entityType: 'companies',
            tenantSlug: 'test-tenant'
          }
        })
      )

      await waitFor(() => {
        expect(result.current.isPersistenceLoaded).toBe(true)
      })

      // Change visibility
      act(() => {
        result.current.setColumnVisibility({ email: false })
      })

      // Unmount before debounce completes
      unmount()

      // Fast-forward past debounce
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 500))
        await Promise.resolve()
      })

      // Should not cause errors or attempt to persist after unmount
      // The debounce timer should have been cleaned up
    })

    it('should handle storage errors gracefully', async () => {
      mockStorageManager.safeSet.mockRejectedValue(new Error('Storage quota exceeded'))

      const { result } = renderHook(() =>
        useTableCore({
          data: testData,
          columns,
          persistColumnVisibility: true,
          persistenceScope: {
            entityType: 'companies',
            tenantSlug: 'test-tenant'
          }
        })
      )

      await waitFor(() => {
        expect(result.current.isPersistenceLoaded).toBe(true)
      })

      // Should not crash when storage fails
      act(() => {
        result.current.setColumnVisibility({ email: false })
      })

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 500))
        await Promise.resolve()
      })

      // State should still be updated locally
      expect(result.current.columnVisibility).toEqual({ email: false })
    })

    it('should handle storage load errors gracefully', async () => {
      mockStorageManager.safeGet.mockRejectedValue(new Error('Storage read error'))

      const { result } = renderHook(() =>
        useTableCore({
          data: testData,
          columns,
          persistColumnVisibility: true,
          persistenceScope: {
            entityType: 'companies',
            tenantSlug: 'test-tenant'
          }
        })
      )

      await waitFor(() => {
        expect(result.current.isPersistenceLoaded).toBe(true)
      })

      // Should fall back to defaults despite load error
      expect(result.current.columnVisibility).toEqual({})
      expect(result.current.table).toBeDefined()
    })

    it('should work with enablePersistence flag', async () => {
      const { result } = renderHook(() =>
        useTableCore({
          data: testData,
          columns,
          enablePersistence: true, // Global persistence flag
          persistColumnVisibility: true,
          persistenceScope: {
            entityType: 'companies',
            tenantSlug: 'test-tenant'
          }
        })
      )

      await waitFor(() => {
        expect(result.current.isPersistenceLoaded).toBe(true)
      })

      act(() => {
        result.current.setColumnVisibility({ email: false })
      })

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 500))
        await Promise.resolve()
      })

      // Should persist when both flags are enabled
      expect(mockStorageManager.safeSet).toHaveBeenCalled()
    })

    it('should respect enablePersistence=false even if persistColumnVisibility=true', async () => {
      const { result } = renderHook(() =>
        useTableCore({
          data: testData,
          columns,
          enablePersistence: false, // Global persistence disabled
          persistColumnVisibility: true, // Specific feature enabled
          persistenceScope: {
            entityType: 'companies',
            tenantSlug: 'test-tenant'
          }
        })
      )

      expect(result.current.isPersistenceLoaded).toBe(true)

      act(() => {
        result.current.setColumnVisibility({ email: false })
      })

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 500))
        await Promise.resolve()
      })

      // Should NOT persist when global flag is disabled
      expect(mockStorageManager.safeSet).not.toHaveBeenCalled()
    })
  })

  describe('Performance', () => {
    it('should not trigger persistence on initial state load', async () => {
      mockStorageManager.safeGet.mockResolvedValue({
        'table-column-visibility-companies-test-tenant': {
          email: false
        }
      })

      renderHook(() =>
        useTableCore({
          data: testData,
          columns,
          persistColumnVisibility: true,
          persistenceScope: {
            entityType: 'companies',
            tenantSlug: 'test-tenant'
          }
        })
      )

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 1000))
        await Promise.resolve()
      })

      // Should only load, not save during mount
      expect(mockStorageManager.safeGet).toHaveBeenCalled()
      expect(mockStorageManager.safeSet).not.toHaveBeenCalled()
    })

    it('should batch persistence operations when multiple columns change', async () => {
      const { result } = renderHook(() =>
        useTableCore({
          data: testData,
          columns,
          persistColumnVisibility: true,
          persistenceScope: {
            entityType: 'companies',
            tenantSlug: 'test-tenant'
          }
        })
      )

      await waitFor(() => {
        expect(result.current.isPersistenceLoaded).toBe(true)
      })

      // Change visibility of multiple columns at once
      act(() => {
        result.current.setColumnVisibility({
          email: false,
          status: false,
          value: false
        })
      })

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 500))
        await Promise.resolve()
      })

      // Should save only once with all changes
      expect(mockStorageManager.safeSet).toHaveBeenCalledTimes(1)
      expect(mockStorageManager.safeSet).toHaveBeenCalledWith(
        expect.objectContaining({
          'table-column-visibility-companies-test-tenant': {
            email: false,
            status: false,
            value: false
          }
        }),
        expect.any(Object)
      )
    })
  })
})
