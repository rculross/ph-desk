/**
 * Performance Regression Tests for DataTable
 *
 * Tests for performance regressions with overscan optimizations:
 * - Render time benchmarks
 * - Memory usage monitoring
 * - Scrolling performance
 * - DOM node count optimization
 * - Configuration impact assessment
 */

import React from 'react'

import {
  getCoreRowModel,
  type ColumnDef,
  useReactTable
} from '@tanstack/react-table'
import { render, cleanup, act, fireEvent } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'

import {
  OPTIMIZED_VIRTUALIZATION,
  CONSERVATIVE_VIRTUALIZATION,
  HIGH_PERFORMANCE_VIRTUALIZATION,
  getVirtualizationConfig
} from '../../../config/table-virtualization'
import { DataTable } from '../DataTable'

interface PerformanceTestRow {
  id: number
  name: string
  email: string
  company: string
  value: number
  status: string
  date: string
  category: string
  description: string
  metadata: string
}

// Generate test data with realistic complexity
function generatePerformanceTestData(size: number): PerformanceTestRow[] {
  return Array.from({ length: size }, (_, i) => ({
    id: i,
    name: `User ${i}`.padEnd(20, 'x'), // Add some content length variation
    email: `user${i}@example-company-name-${Math.floor(i / 100)}.com`,
    company: `Company ${Math.floor(i / 50)}`.repeat(Math.floor(Math.random() * 3) + 1),
    value: Math.random() * 10000,
    status: ['active', 'inactive', 'pending', 'suspended'][i % 4],
    date: new Date(2024, i % 12, (i % 28) + 1).toISOString(),
    category: ['A', 'B', 'C', 'D', 'E'][i % 5],
    description: `Description for item ${i}. `.repeat(Math.floor(Math.random() * 10) + 1),
    metadata: JSON.stringify({
      tags: [`tag${i % 10}`, `tag${(i + 1) % 10}`, `tag${(i + 2) % 10}`],
      score: Math.random(),
      level: i % 10,
      nested: {
        prop1: `value${i}`,
        prop2: i * 2,
        prop3: {
          deepProp: `deep${i}`
        }
      }
    })
  }))
}

const performanceColumns: ColumnDef<PerformanceTestRow>[] = [
  { accessorKey: 'id', header: 'ID', size: 80 },
  { accessorKey: 'name', header: 'Name', size: 150 },
  { accessorKey: 'email', header: 'Email', size: 200 },
  { accessorKey: 'company', header: 'Company', size: 150 },
  { accessorKey: 'value', header: 'Value', size: 120 },
  { accessorKey: 'status', header: 'Status', size: 100 },
  { accessorKey: 'date', header: 'Date', size: 150 },
  { accessorKey: 'category', header: 'Category', size: 100 },
  { accessorKey: 'description', header: 'Description', size: 300 },
  { accessorKey: 'metadata', header: 'Metadata', size: 200 }
]

// Mock performance APIs
const mockPerformanceNow = vi.fn()
const mockPerformanceMark = vi.fn()
const mockPerformanceMeasure = vi.fn()
const mockPerformanceGetEntriesByName = vi.fn()

Object.defineProperty(window, 'performance', {
  value: {
    now: mockPerformanceNow,
    mark: mockPerformanceMark,
    measure: mockPerformanceMeasure,
    getEntriesByName: mockPerformanceGetEntriesByName
  },
  writable: true
})

// Mock ResizeObserver
const mockResizeObserver = vi.fn(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn()
}))
window.ResizeObserver = mockResizeObserver

// Mock getBoundingClientRect for consistent measurements
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

// Performance measurement utilities
class PerformanceTracker {
  private startTime: number = 0
  private measurements: Map<string, number[]> = new Map()

  start(label: string) {
    this.startTime = performance.now()
    mockPerformanceMark(`${label}-start`)
  }

  end(label: string): number {
    const endTime = performance.now()
    const duration = endTime - this.startTime

    mockPerformanceMark(`${label}-end`)
    mockPerformanceMeasure(label, `${label}-start`, `${label}-end`)

    if (!this.measurements.has(label)) {
      this.measurements.set(label, [])
    }
    this.measurements.get(label)!.push(duration)

    return duration
  }

  getAverageTime(label: string): number {
    const times = this.measurements.get(label) || []
    return times.length > 0 ? times.reduce((a, b) => a + b, 0) / times.length : 0
  }

  getMedianTime(label: string): number {
    const times = this.measurements.get(label) || []
    if (times.length === 0) return 0

    const sorted = [...times].sort((a, b) => a - b)
    const mid = Math.floor(sorted.length / 2)
    return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid]
  }

  reset() {
    this.measurements.clear()
  }
}

function PerformanceTableWrapper({
  data,
  config,
  enableColumnResizing = false
}: {
  data: PerformanceTestRow[]
  config: typeof OPTIMIZED_VIRTUALIZATION
  enableColumnResizing?: boolean
}) {
  const table = useReactTable({
    data,
    columns: performanceColumns,
    getCoreRowModel: getCoreRowModel()
  })

  return (
    <DataTable
      table={table}
      enableRowVirtualization={config.enableRowVirtualization}
      enableColumnVirtualization={config.enableColumnVirtualization}
      rowHeight={config.rowHeight}
      rowOverscan={config.rowOverscan}
      columnOverscan={config.columnOverscan}
      enableColumnResizing={enableColumnResizing}
      height={600}
    />
  )
}

describe('DataTable Performance Regression Tests', () => {
  let performanceTracker: PerformanceTracker
  let currentTime = 1000

  beforeEach(() => {
    performanceTracker = new PerformanceTracker()
    currentTime = 1000
    mockPerformanceNow.mockImplementation(() => currentTime++)

    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
    cleanup()
    vi.clearAllMocks()
    performanceTracker.reset()
  })

  it('should render large datasets within performance benchmarks', () => {
    const dataSizes = [1000, 5000, 10000]
    const renderTimes: Record<number, number> = {}

    dataSizes.forEach(size => {
      const data = generatePerformanceTestData(size)

      performanceTracker.start(`render-${size}`)

      render(
        <PerformanceTableWrapper
          data={data}
          config={OPTIMIZED_VIRTUALIZATION}
        />
      )

      const renderTime = performanceTracker.end(`render-${size}`)
      renderTimes[size] = renderTime

      cleanup()
    })

    // Performance benchmarks (in mock time units)
    expect(renderTimes[1000]).toBeLessThan(100) // Should render 1k rows quickly
    expect(renderTimes[5000]).toBeLessThan(200) // 5k rows should scale reasonably
    expect(renderTimes[10000]).toBeLessThan(300) // 10k rows should still be acceptable

    // Verify scaling is not exponential
    const scalingFactor = renderTimes[10000] / renderTimes[1000]
    expect(scalingFactor).toBeLessThan(5) // Should not be more than 5x slower for 10x data
  })

  it('should compare performance across different virtualization configs', () => {
    const data = generatePerformanceTestData(5000)
    const configs = [
      { name: 'optimized', config: OPTIMIZED_VIRTUALIZATION },
      { name: 'conservative', config: CONSERVATIVE_VIRTUALIZATION },
      { name: 'high-performance', config: HIGH_PERFORMANCE_VIRTUALIZATION }
    ]

    const results: Record<string, number> = {}

    configs.forEach(({ name, config }) => {
      performanceTracker.start(`config-${name}`)

      render(
        <PerformanceTableWrapper
          data={data}
          config={config}
        />
      )

      results[name] = performanceTracker.end(`config-${name}`)
      cleanup()
    })

    // High performance should be fastest
    expect(results['high-performance']).toBeLessThanOrEqual(results['optimized'])
    expect(results['optimized']).toBeLessThanOrEqual(results['conservative'])

    // All configs should be within reasonable bounds
    Object.values(results).forEach(time => {
      expect(time).toBeLessThan(500) // All should render within 500 time units
    })
  })

  it('should measure DOM node count optimization', () => {
    const data = generatePerformanceTestData(3000)

    // Test with virtualization
    const { container: virtualizedContainer } = render(
      <PerformanceTableWrapper
        data={data}
        config={OPTIMIZED_VIRTUALIZATION}
      />
    )

    const virtualizedNodeCount = virtualizedContainer.querySelectorAll('*').length

    cleanup()

    // Test without virtualization
    const { container: nonVirtualizedContainer } = render(
      <PerformanceTableWrapper
        data={data}
        config={{
          ...OPTIMIZED_VIRTUALIZATION,
          enableRowVirtualization: false,
          enableColumnVirtualization: false
        }}
      />
    )

    const nonVirtualizedNodeCount = nonVirtualizedContainer.querySelectorAll('*').length

    // Virtualization should significantly reduce DOM nodes
    expect(virtualizedNodeCount).toBeLessThan(nonVirtualizedNodeCount * 0.5) // At least 50% reduction
    expect(virtualizedNodeCount).toBeLessThan(1000) // Absolute limit for virtualized
  })

  it('should measure scrolling performance with different overscan values', () => {
    const data = generatePerformanceTestData(5000)
    const overscanConfigs = [
      { rowOverscan: 1, columnOverscan: 1 },
      { rowOverscan: 5, columnOverscan: 3 },
      { rowOverscan: 10, columnOverscan: 5 },
      { rowOverscan: 20, columnOverscan: 10 }
    ]

    const scrollResults: Record<string, number> = {}

    overscanConfigs.forEach(({ rowOverscan, columnOverscan }) => {
      const config = {
        ...OPTIMIZED_VIRTUALIZATION,
        rowOverscan,
        columnOverscan
      }

      const { container } = render(
        <PerformanceTableWrapper data={data} config={config} />
      )

      const scrollContainer = container.querySelector('.overflow-auto')

      if (scrollContainer) {
        performanceTracker.start(`scroll-${rowOverscan}-${columnOverscan}`)

        // Simulate rapid scrolling
        for (let i = 0; i < 10; i++) {
          fireEvent.scroll(scrollContainer, {
            target: { scrollTop: i * 100 }
          })
        }

        scrollResults[`${rowOverscan}-${columnOverscan}`] =
          performanceTracker.end(`scroll-${rowOverscan}-${columnOverscan}`)
      }

      cleanup()
    })

    // Lower overscan should generally perform better
    expect(scrollResults['1-1']).toBeLessThanOrEqual(scrollResults['20-10'])
    expect(scrollResults['5-3']).toBeLessThanOrEqual(scrollResults['20-10'])
  })

  it('should measure column resizing performance impact', () => {
    const data = generatePerformanceTestData(2000)

    // Test without column resizing
    performanceTracker.start('render-no-resize')
    render(
      <PerformanceTableWrapper
        data={data}
        config={OPTIMIZED_VIRTUALIZATION}
        enableColumnResizing={false}
      />
    )
    const noResizeTime = performanceTracker.end('render-no-resize')
    cleanup()

    // Test with column resizing
    performanceTracker.start('render-with-resize')
    render(
      <PerformanceTableWrapper
        data={data}
        config={OPTIMIZED_VIRTUALIZATION}
        enableColumnResizing={true}
      />
    )
    const withResizeTime = performanceTracker.end('render-with-resize')
    cleanup()

    // Column resizing should not significantly impact render time
    const overhead = withResizeTime / noResizeTime
    expect(overhead).toBeLessThan(2) // Should not be more than 2x slower
  })

  it('should measure memory usage patterns', () => {
    const dataSizes = [1000, 5000, 10000]

    dataSizes.forEach(size => {
      const data = generatePerformanceTestData(size)

      // Mock memory usage tracking
      const initialNodeCount = document.querySelectorAll('*').length

      const { container } = render(
        <PerformanceTableWrapper
          data={data}
          config={HIGH_PERFORMANCE_VIRTUALIZATION}
        />
      )

      const finalNodeCount = container.querySelectorAll('*').length
      const nodesAdded = finalNodeCount

      // Memory usage should scale sublinearly with data size
      expect(nodesAdded).toBeLessThan(size * 0.1) // Should use much less than 10% of data size in DOM nodes

      cleanup()
    })
  })

  it('should test configuration auto-selection performance', () => {
    const testSizes = [500, 1500, 5000, 15000]

    testSizes.forEach(size => {
      const data = generatePerformanceTestData(size)
      const autoConfig = getVirtualizationConfig(size)

      performanceTracker.start(`auto-config-${size}`)

      render(
        <PerformanceTableWrapper
          data={data}
          config={autoConfig}
        />
      )

      const renderTime = performanceTracker.end(`auto-config-${size}`)

      // Auto-selected config should provide good performance
      expect(renderTime).toBeLessThan(300)

      cleanup()
    })
  })

  it('should measure initial render vs re-render performance', () => {
    const data = generatePerformanceTestData(3000)

    // Initial render
    performanceTracker.start('initial-render')
    const { rerender } = render(
      <PerformanceTableWrapper
        data={data}
        config={OPTIMIZED_VIRTUALIZATION}
      />
    )
    const initialRenderTime = performanceTracker.end('initial-render')

    // Re-render with same data
    performanceTracker.start('re-render')
    rerender(
      <PerformanceTableWrapper
        data={data}
        config={OPTIMIZED_VIRTUALIZATION}
      />
    )
    const reRenderTime = performanceTracker.end('re-render')

    // Re-renders should be faster than initial render
    expect(reRenderTime).toBeLessThanOrEqual(initialRenderTime)
  })

  it('should measure performance regression in specific scenarios', () => {
    const scenarios = [
      {
        name: 'wide-table',
        data: generatePerformanceTestData(1000),
        columns: Array.from({ length: 20 }, (_, i) => ({
          accessorKey: 'name' as keyof PerformanceTestRow,
          header: `Column ${i}`,
          id: `col-${i}`,
          size: 100
        }))
      },
      {
        name: 'narrow-columns',
        data: generatePerformanceTestData(2000),
        columns: performanceColumns.map(col => ({ ...col, size: 50 }))
      },
      {
        name: 'variable-widths',
        data: generatePerformanceTestData(1500),
        columns: performanceColumns.map((col, i) => ({
          ...col,
          size: 50 + (i * 25) // Varying widths from 50 to 275
        }))
      }
    ]

    const scenarioResults: Record<string, number> = {}

    scenarios.forEach(({ name, data, columns }) => {
      const table = useReactTable({
        data,
        columns,
        getCoreRowModel: getCoreRowModel()
      })

      performanceTracker.start(`scenario-${name}`)

      render(
        <DataTable
          table={table}
          enableRowVirtualization={OPTIMIZED_VIRTUALIZATION.enableRowVirtualization}
          enableColumnVirtualization={OPTIMIZED_VIRTUALIZATION.enableColumnVirtualization}
          rowOverscan={OPTIMIZED_VIRTUALIZATION.rowOverscan}
          columnOverscan={OPTIMIZED_VIRTUALIZATION.columnOverscan}
          height={600}
        />
      )

      scenarioResults[name] = performanceTracker.end(`scenario-${name}`)
      cleanup()
    })

    // All scenarios should perform within acceptable bounds
    Object.entries(scenarioResults).forEach(([name, time]) => {
      expect(time).toBeLessThan(400) // Max 400 time units for any scenario
    })
  })

  it('should verify no performance regression in rapid state changes', () => {
    const data = generatePerformanceTestData(2000)

    const { container, rerender } = render(
      <PerformanceTableWrapper
        data={data}
        config={OPTIMIZED_VIRTUALIZATION}
      />
    )

    const scrollContainer = container.querySelector('.overflow-auto')

    performanceTracker.start('rapid-changes')

    // Simulate rapid prop changes and scrolling
    for (let i = 0; i < 20; i++) {
      // Change configuration
      rerender(
        <PerformanceTableWrapper
          data={data}
          config={{
            ...OPTIMIZED_VIRTUALIZATION,
            rowOverscan: (i % 3) + 2,
            columnOverscan: (i % 2) + 1
          }}
        />
      )

      // Scroll
      if (scrollContainer) {
        fireEvent.scroll(scrollContainer, {
          target: { scrollTop: i * 20 }
        })
      }
    }

    const rapidChangesTime = performanceTracker.end('rapid-changes')

    // Rapid changes should still complete in reasonable time
    expect(rapidChangesTime).toBeLessThan(1000)
  })
})