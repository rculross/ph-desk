/**
 * Memory Leak Detection Tests for DataTable
 *
 * Tests for critical memory leak scenarios identified by security audit:
 * - Event listener cleanup
 * - DOM reference management
 * - Virtualization measurement cleanup
 * - useEffect dependency cleanup
 */

import React from 'react'

import {
  getCoreRowModel,
  type ColumnDef,
  useReactTable
} from '@tanstack/react-table'
import { render, cleanup, act, fireEvent, screen } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'

import { DataTable } from '../DataTable'

interface TestRow {
  id: number
  name: string
  value: number
}

const mockData: TestRow[] = Array.from({ length: 1000 }, (_, i) => ({
  id: i,
  name: `Item ${i}`,
  value: Math.random() * 100
}))

const columns: ColumnDef<TestRow>[] = [
  { accessorKey: 'id', header: 'ID' },
  { accessorKey: 'name', header: 'Name' },
  { accessorKey: 'value', header: 'Value' }
]

// Mock performance.now for consistent timing
const mockPerformanceNow = vi.fn()
Object.defineProperty(window, 'performance', {
  value: { now: mockPerformanceNow },
  writable: true
})

// Mock ResizeObserver
const mockResizeObserver = vi.fn(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn()
}))
window.ResizeObserver = mockResizeObserver

function TestTableWrapper({
  enableColumnResizing = false,
  enableColumnVirtualization = false,
  enableRowVirtualization = false,
  data = mockData
}: {
  enableColumnResizing?: boolean
  enableColumnVirtualization?: boolean
  enableRowVirtualization?: boolean
  data?: TestRow[]
}) {
  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    columnResizeMode: 'onChange'
  })

  return (
    <DataTable
      table={table}
      enableColumnResizing={enableColumnResizing}
      enableColumnVirtualization={enableColumnVirtualization}
      enableRowVirtualization={enableRowVirtualization}
      height={400}
    />
  )
}

describe('DataTable Memory Leak Detection', () => {
  let eventListenerSpy: any
  let removeEventListenerSpy: any
  let timeoutSpy: any
  let clearTimeoutSpy: any

  beforeEach(() => {
    // Mock timers for timeout tracking
    vi.useFakeTimers()
    mockPerformanceNow.mockReturnValue(0)

    // Spy on event listener management
    eventListenerSpy = vi.spyOn(Element.prototype, 'addEventListener') as any
    removeEventListenerSpy = vi.spyOn(Element.prototype, 'removeEventListener') as any
    timeoutSpy = vi.spyOn(global, 'setTimeout') as any
    clearTimeoutSpy = vi.spyOn(global, 'clearTimeout') as any
  })

  afterEach(() => {
    vi.useRealTimers()
    cleanup()
    vi.clearAllMocks()
  })

  it('should properly cleanup event listeners on unmount', () => {
    const { unmount } = render(
      <TestTableWrapper enableColumnResizing={true} />
    )

    // Capture initial event listener counts
    const initialAddListenerCalls = eventListenerSpy.mock.calls.length
    const initialRemoveListenerCalls = removeEventListenerSpy.mock.calls.length

    // Simulate some column resizing to trigger event listeners
    const resizeHandle = screen.getByTestId('column-resize-handle-id')
    if (resizeHandle) {
      fireEvent.mouseDown(resizeHandle)
      fireEvent.mouseUp(resizeHandle)
    }

    const afterInteractionAddCalls = eventListenerSpy.mock.calls.length

    // Unmount component
    unmount()

    const finalRemoveListenerCalls = removeEventListenerSpy.mock.calls.length

    // Verify event listeners are properly cleaned up
    // Should have equal number of add/remove calls for each event type
    expect(finalRemoveListenerCalls).toBeGreaterThan(initialRemoveListenerCalls)

    // Check for specific event types that should be cleaned up
    const addedEvents = eventListenerSpy.mock.calls.map((call: any) => call[0])
    const removedEvents = removeEventListenerSpy.mock.calls.map((call: any) => call[0])

    const scrollEvents = addedEvents.filter((event: string) => event === 'scroll')
    const removedScrollEvents = removedEvents.filter((event: string) => event === 'scroll')

    const resizeEvents = addedEvents.filter((event: string) => event === 'resize')
    const removedResizeEvents = removedEvents.filter((event: string) => event === 'resize')

    // Each added scroll/resize listener should have corresponding removal
    expect(removedScrollEvents.length).toBe(scrollEvents.length)
    expect(removedResizeEvents.length).toBe(resizeEvents.length)
  })

  it('should cleanup timeouts and debounced operations on unmount', () => {
    const { unmount } = render(
      <TestTableWrapper enableColumnResizing={true} />
    )

    // Trigger column resizing to create debounced timeouts
    const resizeHandle = screen.getByTestId('column-resize-handle-id')
    if (resizeHandle) {
      fireEvent.mouseDown(resizeHandle)
      fireEvent.mouseMove(resizeHandle, { clientX: 100 })
    }

    const timeoutCalls = timeoutSpy.mock.calls.length

    // Unmount before timeouts execute
    unmount()

    // Verify timeouts are cleared
    expect(clearTimeoutSpy).toHaveBeenCalled()

    // Check that active timeouts are cleared on unmount
    const clearTimeoutCalls = clearTimeoutSpy.mock.calls.length
    expect(clearTimeoutCalls).toBeGreaterThan(0)
  })

  it('should prevent memory leaks with virtualization refs', () => {
    const { unmount, rerender } = render(
      <TestTableWrapper
        enableRowVirtualization={true}
        enableColumnVirtualization={true}
      />
    )

    // Force multiple re-renders to test ref cleanup
    for (let i = 0; i < 10; i++) {
      rerender(
        <TestTableWrapper
          enableRowVirtualization={true}
          enableColumnVirtualization={true}
          data={mockData.slice(0, 100 + i * 10)}
        />
      )
    }

    // Check ResizeObserver is being used properly
    expect(mockResizeObserver).toHaveBeenCalled()

    const resizeObserverInstance = mockResizeObserver.mock.results[0]?.value

    unmount()

    // Verify ResizeObserver cleanup
    if (resizeObserverInstance) {
      expect(resizeObserverInstance.disconnect).toHaveBeenCalled()
    }
  })

  it('should handle rapid prop changes without memory accumulation', () => {
    const { rerender } = render(
      <TestTableWrapper enableColumnResizing={true} />
    )

    // Simulate rapid prop changes that could cause memory leaks
    for (let i = 0; i < 50; i++) {
      rerender(
        <TestTableWrapper
          enableColumnResizing={i % 2 === 0}
          enableColumnVirtualization={i % 3 === 0}
          data={mockData.slice(0, 100 + (i % 10))}
        />
      )
    }

    // Check that event listeners aren't accumulating
    const scrollListeners = eventListenerSpy.mock.calls.filter((call: any) => call[0] === 'scroll')
    const resizeListeners = eventListenerSpy.mock.calls.filter((call: any) => call[0] === 'resize')

    // Should not have excessive listener accumulation
    expect(scrollListeners.length).toBeLessThan(20) // Reasonable upper bound
    expect(resizeListeners.length).toBeLessThan(20) // Reasonable upper bound
  })

  it('should cleanup column drag event listeners', () => {
    const { unmount } = render(
      <TestTableWrapper enableColumnResizing={true} />
    )

    // Simulate column dragging
    const dragOverlay = screen.getByTestId('column-drag-overlay-id')
    if (dragOverlay) {
      fireEvent.dragStart(dragOverlay)
      fireEvent.dragEnd(dragOverlay)
    }

    const beforeUnmountCalls = removeEventListenerSpy.mock.calls.length

    unmount()

    const afterUnmountCalls = removeEventListenerSpy.mock.calls.length

    // Should have cleaned up drag event listeners
    expect(afterUnmountCalls).toBeGreaterThan(beforeUnmountCalls)
  })

  it('should detect excessive DOM node creation in virtualization', () => {
    const nodeCountBefore = document.querySelectorAll('*').length

    const { unmount } = render(
      <TestTableWrapper
        enableRowVirtualization={true}
        enableColumnVirtualization={true}
        data={Array.from({ length: 5000 }, (_, i) => ({
          id: i,
          name: `Item ${i}`,
          value: i
        }))}
      />
    )

    const nodeCountDuring = document.querySelectorAll('*').length

    // With virtualization, DOM nodes should be bounded
    const nodesAdded = nodeCountDuring - nodeCountBefore
    expect(nodesAdded).toBeLessThan(1000) // Should not render all 5000 rows

    unmount()

    const nodeCountAfter = document.querySelectorAll('*').length

    // Should cleanup most nodes
    expect(nodeCountAfter).toBeLessThanOrEqual(nodeCountBefore + 10) // Allow small margin
  })

  it('should handle useLayoutEffect cleanup in column resizing', () => {
    const { unmount } = render(
      <TestTableWrapper enableColumnResizing={true} />
    )

    // Trigger column resize to activate useLayoutEffect
    const resizeHandle = screen.getByTestId('column-resize-handle-id')
    if (resizeHandle) {
      fireEvent.mouseDown(resizeHandle)

      // Simulate resize state change
      fireEvent.mouseMove(resizeHandle, { clientX: 150 })
    }

    // Unmount while resize is active
    unmount()

    // Should not throw errors or leave hanging effects
    expect(() => {
      // Force any pending effects to run
      act(() => {
        vi.runAllTimers()
      })
    }).not.toThrow()
  })
})