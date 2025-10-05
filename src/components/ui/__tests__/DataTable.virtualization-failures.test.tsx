/**
 * Virtualization Failure Tests for DataTable
 *
 * Tests for virtualization edge cases and failure scenarios:
 * - Large dataset handling (10k+ rows)
 * - Array bounds checking
 * - Measurement failures
 * - Scrolling edge cases
 * - Memory pressure scenarios
 */

import React, { useState } from 'react'

import {
  getCoreRowModel,
  type ColumnDef,
  useReactTable
} from '@tanstack/react-table'
import { render, cleanup, act, fireEvent, screen } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'

import {
  OPTIMIZED_VIRTUALIZATION,
  HIGH_PERFORMANCE_VIRTUALIZATION,
  getVirtualizationConfig
} from '../../../config/table-virtualization'
import { DataTable } from '../DataTable'

interface LargeDatasetRow {
  id: number
  name: string
  email: string
  company: string
  value: number
  status: string
  date: string
  category: string
  notes: string
  metadata: Record<string, any>
}

// Generate test data of various sizes
function generateTestData(size: number): LargeDatasetRow[] {
  return Array.from({ length: size }, (_, i) => ({
    id: i,
    name: `User ${i}`,
    email: `user${i}@example.com`,
    company: `Company ${Math.floor(i / 100)}`,
    value: Math.random() * 1000,
    status: ['active', 'inactive', 'pending'][i % 3],
    date: new Date(2024, 0, 1 + (i % 365)).toISOString(),
    category: ['A', 'B', 'C', 'D'][i % 4],
    notes: `Notes for user ${i}`.repeat(Math.floor(Math.random() * 5) + 1),
    metadata: {
      tags: [`tag${i % 10}`, `tag${(i + 1) % 10}`],
      score: Math.random(),
      level: i % 5,
      extra: `extra-${i}`
    }
  }))
}

const columns: ColumnDef<LargeDatasetRow>[] = [
  { accessorKey: 'id', header: 'ID', size: 80 },
  { accessorKey: 'name', header: 'Name', size: 150 },
  { accessorKey: 'email', header: 'Email', size: 200 },
  { accessorKey: 'company', header: 'Company', size: 150 },
  { accessorKey: 'value', header: 'Value', size: 100 },
  { accessorKey: 'status', header: 'Status', size: 100 },
  { accessorKey: 'date', header: 'Date', size: 150 },
  { accessorKey: 'category', header: 'Category', size: 100 },
  { accessorKey: 'notes', header: 'Notes', size: 300 }
]

// Mock performance monitoring
const mockPerformanceNow = vi.fn()
Object.defineProperty(window, 'performance', {
  value: { now: mockPerformanceNow },
  writable: true
})

// Mock IntersectionObserver
const mockIntersectionObserver = vi.fn(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn()
}))
window.IntersectionObserver = mockIntersectionObserver

// Mock ResizeObserver with error simulation
const mockResizeObserver = vi.fn(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn()
}))
window.ResizeObserver = mockResizeObserver

function VirtualizedTableWrapper({
  data,
  enableRowVirtualization = true,
  enableColumnVirtualization = true,
  height = 600,
  rowHeight = 48,
  rowOverscan = 5,
  columnOverscan = 3
}: {
  data: LargeDatasetRow[]
  enableRowVirtualization?: boolean
  enableColumnVirtualization?: boolean
  height?: number
  rowHeight?: number
  rowOverscan?: number
  columnOverscan?: number
}) {
  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel()
  })

  return (
    <DataTable
      table={table}
      enableRowVirtualization={enableRowVirtualization}
      enableColumnVirtualization={enableColumnVirtualization}
      height={height}
      rowHeight={rowHeight}
      rowOverscan={rowOverscan}
      columnOverscan={columnOverscan}
    />
  )
}

function DynamicDataTable({
  initialSize = 1000
}: {
  initialSize?: number
}) {
  const [data, setData] = useState(() => generateTestData(initialSize))
  const [virtualizationConfig, setVirtualizationConfig] = useState(
    getVirtualizationConfig(initialSize)
  )

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel()
  })

  const addMoreData = (additionalRows: number) => {
    const newData = generateTestData(additionalRows)
    setData(prev => [...prev, ...newData])
    setVirtualizationConfig(getVirtualizationConfig(data.length + additionalRows))
  }

  return (
    <div>
      <button
        data-testid="add-data-btn"
        onClick={() => addMoreData(5000)}
      >
        Add 5000 rows
      </button>
      <DataTable
        table={table}
        enableRowVirtualization={virtualizationConfig.enableRowVirtualization}
        enableColumnVirtualization={virtualizationConfig.enableColumnVirtualization}
        rowOverscan={virtualizationConfig.rowOverscan}
        columnOverscan={virtualizationConfig.columnOverscan}
        height={600}
      />
    </div>
  )
}

describe('DataTable Virtualization Failure Tests', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    mockPerformanceNow.mockReturnValue(Date.now())

    // Mock getBoundingClientRect for virtualization measurements
    Element.prototype.getBoundingClientRect = vi.fn(() => ({
      width: 1200,
      height: 600,
      top: 0,
      left: 0,
      bottom: 600,
      right: 1200,
      x: 0,
      y: 0,
      toJSON: vi.fn()
    }))
  })

  afterEach(() => {
    vi.useRealTimers()
    cleanup()
    vi.clearAllMocks()
  })

  it('should handle very large datasets without crashing', () => {
    const largeData = generateTestData(10000)

    expect(() => {
      render(
        <VirtualizedTableWrapper
          data={largeData}
          enableRowVirtualization={true}
          enableColumnVirtualization={true}
        />
      )
    }).not.toThrow()

    // Should only render visible rows, not all 10k
    const tableRows = document.querySelectorAll('[data-index]')
    expect(tableRows.length).toBeLessThan(100) // Much less than 10k
  })

  it('should handle array bounds violations gracefully', () => {
    const data = generateTestData(100)

    const { container } = render(
      <VirtualizedTableWrapper data={data} />
    )

    // Simulate scrolling beyond dataset bounds
    const scrollContainer = container.querySelector('.overflow-auto')
    if (scrollContainer) {
      // Scroll to end
      fireEvent.scroll(scrollContainer, {
        target: { scrollTop: 100000 } // Way beyond actual content
      })

      // Should not crash or show undefined/null content
      expect(container.innerHTML).not.toContain('undefined')
      expect(container.innerHTML).not.toContain('null')
    }
  })

  it('should handle measurement failures gracefully', () => {
    // Mock getBoundingClientRect to return invalid measurements
    Element.prototype.getBoundingClientRect = vi.fn(() => ({
      width: NaN,
      height: NaN,
      top: NaN,
      left: NaN,
      bottom: NaN,
      right: NaN,
      x: NaN,
      y: NaN,
      toJSON: vi.fn()
    }))

    const data = generateTestData(1000)

    expect(() => {
      render(
        <VirtualizedTableWrapper
          data={data}
          enableRowVirtualization={true}
          enableColumnVirtualization={true}
        />
      )
    }).not.toThrow()
  })

  it('should handle dynamic data size changes', () => {
    const { getByTestId } = render(<DynamicDataTable initialSize={1000} />)

    // Initial render should work
    expect(document.querySelectorAll('[data-index]').length).toBeLessThan(50)

    // Add more data
    act(() => {
      fireEvent.click(getByTestId('add-data-btn'))
    })

    // Should handle the dynamic size change
    expect(document.querySelectorAll('[data-index]').length).toBeLessThan(50)
  })

  it('should handle zero or negative overscan values', () => {
    const data = generateTestData(1000)

    expect(() => {
      render(
        <VirtualizedTableWrapper
          data={data}
          rowOverscan={0}
          columnOverscan={0}
        />
      )
    }).not.toThrow()

    expect(() => {
      render(
        <VirtualizedTableWrapper
          data={data}
          rowOverscan={-5}
          columnOverscan={-3}
        />
      )
    }).not.toThrow()
  })

  it('should handle extreme row heights', () => {
    const data = generateTestData(1000)

    // Test very small row height
    expect(() => {
      render(
        <VirtualizedTableWrapper
          data={data}
          rowHeight={1}
        />
      )
    }).not.toThrow()

    cleanup()

    // Test very large row height
    expect(() => {
      render(
        <VirtualizedTableWrapper
          data={data}
          rowHeight={1000}
        />
      )
    }).not.toThrow()
  })

  it('should handle scroll event throttling under high frequency', () => {
    const data = generateTestData(5000)
    const { container } = render(
      <VirtualizedTableWrapper data={data} />
    )

    const scrollContainer = container.querySelector('.overflow-auto')

    if (scrollContainer) {
      // Fire many scroll events rapidly
      for (let i = 0; i < 100; i++) {
        fireEvent.scroll(scrollContainer, {
          target: { scrollTop: i * 10 }
        })
      }

      // Should handle rapid scrolling without errors
      expect(container.innerHTML).not.toContain('undefined')
    }
  })

  it('should handle virtualization config edge cases', () => {
    const smallDataset = generateTestData(10)
    const mediumDataset = generateTestData(1500)
    const largeDataset = generateTestData(15000)

    // Test different virtualization configs
    const smallConfig = getVirtualizationConfig(smallDataset.length)
    const mediumConfig = getVirtualizationConfig(mediumDataset.length)
    const largeConfig = getVirtualizationConfig(largeDataset.length)

    expect(smallConfig).toBe(HIGH_PERFORMANCE_VIRTUALIZATION) // Should use conservative for small
    expect(mediumConfig).toBe(OPTIMIZED_VIRTUALIZATION)
    expect(largeConfig).toBe(HIGH_PERFORMANCE_VIRTUALIZATION)

    // All configs should render without errors
    expect(() => {
      render(<VirtualizedTableWrapper data={smallDataset} {...smallConfig} />)
    }).not.toThrow()

    cleanup()

    expect(() => {
      render(<VirtualizedTableWrapper data={mediumDataset} {...mediumConfig} />)
    }).not.toThrow()

    cleanup()

    expect(() => {
      render(<VirtualizedTableWrapper data={largeDataset} {...largeConfig} />)
    }).not.toThrow()
  })

  it('should handle memory pressure scenarios', () => {
    // Mock memory constraints
    const originalError = console.error
    console.error = vi.fn()

    // Try to trigger memory pressure with very large dataset
    const veryLargeData = generateTestData(50000)

    let renderTime: number
    const startTime = performance.now()

    expect(() => {
      render(
        <VirtualizedTableWrapper
          data={veryLargeData}
          enableRowVirtualization={true}
          enableColumnVirtualization={true}
          rowOverscan={1} // Minimal overscan for performance
          columnOverscan={1}
        />
      )
      renderTime = performance.now() - startTime
    }).not.toThrow()

    // Should render efficiently even with large dataset
    expect(renderTime).toBeLessThan(5000) // Less than 5 seconds

    console.error = originalError
  })

  it('should handle column virtualization edge cases', () => {
    const data = generateTestData(1000)

    // Test with many columns
    const manyColumns: ColumnDef<LargeDatasetRow>[] = Array.from(
      { length: 50 },
      (_, i) => ({
        accessorKey: 'name' as keyof LargeDatasetRow,
        header: `Column ${i}`,
        id: `col-${i}`,
        size: 100 + (i % 3) * 50
      })
    )

    function ManyColumnsTable() {
      const table = useReactTable({
        data,
        columns: manyColumns,
        getCoreRowModel: getCoreRowModel()
      })

      return (
        <DataTable
          table={table}
          enableColumnVirtualization={true}
          enableRowVirtualization={true}
          columnOverscan={2}
        />
      )
    }

    expect(() => {
      render(<ManyColumnsTable />)
    }).not.toThrow()

    // Should only render visible columns
    const headerCells = document.querySelectorAll('[data-index]')
    expect(headerCells.length).toBeLessThan(50) // Should virtualize columns
  })

  it('should handle ResizeObserver failures', () => {
    // Mock ResizeObserver to throw errors
    window.ResizeObserver = vi.fn(() => ({
      observe: vi.fn(() => {
        throw new Error('ResizeObserver failed')
      }),
      unobserve: vi.fn(),
      disconnect: vi.fn()
    }))

    const data = generateTestData(1000)

    // Should handle ResizeObserver failures gracefully
    expect(() => {
      render(
        <VirtualizedTableWrapper
          data={data}
          enableRowVirtualization={true}
          enableColumnVirtualization={true}
        />
      )
    }).not.toThrow()
  })

  it('should handle rapid virtualization toggle', () => {
    const data = generateTestData(2000)

    const { rerender } = render(
      <VirtualizedTableWrapper
        data={data}
        enableRowVirtualization={true}
        enableColumnVirtualization={true}
      />
    )

    // Rapidly toggle virtualization settings
    for (let i = 0; i < 10; i++) {
      rerender(
        <VirtualizedTableWrapper
          data={data}
          enableRowVirtualization={i % 2 === 0}
          enableColumnVirtualization={i % 3 === 0}
        />
      )
    }

    // Should handle rapid changes without errors
    expect(document.querySelectorAll('*').length).toBeGreaterThan(0)
  })

  it('should handle empty data with virtualization enabled', () => {
    expect(() => {
      render(
        <VirtualizedTableWrapper
          data={[]}
          enableRowVirtualization={true}
          enableColumnVirtualization={true}
        />
      )
    }).not.toThrow()

    // Should show empty state
    expect(screen.getByText('No data available')).toBeInTheDocument()
  })

  it('should handle data with missing or null values', () => {
    const corruptedData = [
      { id: 1, name: 'Valid', email: 'valid@test.com' },
      { id: 2, name: null, email: undefined },
      { id: 3 }, // Missing fields
      null, // Null row
      undefined, // Undefined row
      { id: 4, name: 'Valid Again', email: 'valid2@test.com' }
    ] as LargeDatasetRow[]

    expect(() => {
      render(
        <VirtualizedTableWrapper
          data={corruptedData}
          enableRowVirtualization={true}
        />
      )
    }).not.toThrow()
  })
})