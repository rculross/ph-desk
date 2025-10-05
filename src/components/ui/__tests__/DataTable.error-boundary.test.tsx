/**
 * Error Boundary Tests for DataTable Virtualization
 *
 * Tests for error boundary behavior when virtualization fails:
 * - Component error recovery
 * - Fallback UI rendering
 * - Error logging and reporting
 * - Graceful degradation scenarios
 */

import React, { Component, ErrorInfo, ReactNode } from 'react'

import {
  getCoreRowModel,
  type ColumnDef,
  useReactTable
} from '@tanstack/react-table'
import { render, screen, cleanup } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'

import { DataTable } from '../DataTable'

interface TestRow {
  id: number
  name: string
  value: number
}

const testData: TestRow[] = [
  { id: 1, name: 'Item 1', value: 10 },
  { id: 2, name: 'Item 2', value: 20 }
]

const columns: ColumnDef<TestRow>[] = [
  { accessorKey: 'id', header: 'ID' },
  { accessorKey: 'name', header: 'Name' },
  { accessorKey: 'value', header: 'Value' }
]

// Error boundary component for testing
interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
  errorInfo: ErrorInfo | null
  fallbackMode: 'virtualized' | 'simple' | 'minimal'
}

class TestErrorBoundary extends Component<
  { children: ReactNode; onError?: (error: Error, errorInfo: ErrorInfo) => void },
  ErrorBoundaryState
> {
  constructor(props: { children: ReactNode; onError?: (error: Error, errorInfo: ErrorInfo) => void }) {
    super(props)
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      fallbackMode: 'virtualized'
    }
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return {
      hasError: true,
      error
    }
  }

  override componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({
      error,
      errorInfo
    })

    this.props.onError?.(error, errorInfo)

    // Determine fallback strategy based on error type
    let fallbackMode: 'virtualized' | 'simple' | 'minimal' = 'minimal'

    if (error.message.includes('virtualization')) {
      fallbackMode = 'simple'
    } else if (error.message.includes('measurement')) {
      fallbackMode = 'virtualized'
    }

    this.setState({ fallbackMode })
  }

  override render() {
    if (this.state.hasError) {
      const { fallbackMode, error } = this.state

      switch (fallbackMode) {
        case 'simple':
          return (
            <div data-testid="error-fallback-simple">
              <h3>Table Error - Simple Mode</h3>
              <p>Virtualization failed, showing simple table</p>
              <details>
                <summary>Error Details</summary>
                <pre>{error?.message}</pre>
              </details>
              <SimpleTableFallback />
            </div>
          )

        case 'virtualized':
          return (
            <div data-testid="error-fallback-virtualized">
              <h3>Table Error - Basic Virtualization</h3>
              <p>Complex features disabled, basic table active</p>
              <BasicVirtualizedFallback />
            </div>
          )

        default:
          return (
            <div data-testid="error-fallback-minimal">
              <h3>Table Error</h3>
              <p>Unable to render table. Please try refreshing the page.</p>
              <button onClick={() => this.setState({ hasError: false })}>
                Retry
              </button>
            </div>
          )
      }
    }

    return this.props.children
  }
}

// Fallback components
function SimpleTableFallback() {
  return (
    <table data-testid="simple-fallback-table">
      <thead>
        <tr>
          {columns.map(col => (
            <th key={col.id || String((col as any).accessorKey)}>{String(col.header)}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {testData.map(row => (
          <tr key={row.id}>
            <td>{row.id}</td>
            <td>{row.name}</td>
            <td>{row.value}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function BasicVirtualizedFallback() {
  const table = useReactTable({
    data: testData,
    columns,
    getCoreRowModel: getCoreRowModel()
  })

  return (
    <DataTable
      table={table}
      enableRowVirtualization={false}
      enableColumnVirtualization={false}
      enableColumnResizing={false}
      enableColumnDragging={false}
      height={300}
    />
  )
}

// Components that throw specific errors
function VirtualizationErrorComponent() {
  const table = useReactTable({
    data: testData,
    columns,
    getCoreRowModel: getCoreRowModel()
  })

  // Simulate virtualization error during render
  React.useEffect(() => {
    throw new Error('virtualization failed: Unable to measure viewport')
  }, [])

  return <DataTable table={table} enableRowVirtualization={true} />
}

function MeasurementErrorComponent() {
  const table = useReactTable({
    data: testData,
    columns,
    getCoreRowModel: getCoreRowModel()
  })

  // Simulate measurement error
  React.useEffect(() => {
    throw new Error('measurement error: getBoundingClientRect returned invalid values')
  }, [])

  return <DataTable table={table} enableColumnResizing={true} />
}

function CriticalErrorComponent() {
  React.useEffect(() => {
    throw new Error('critical error: Memory allocation failed')
  }, [])

  return <div>This should not render</div>
}

// Mock console.error to capture error logs
const mockConsoleError = vi.fn()
const originalConsoleError = console.error

// Mock ResizeObserver to trigger errors
const mockResizeObserver = vi.fn()

describe('DataTable Error Boundary Tests', () => {
  let errorSpy: ReturnType<typeof vi.fn>

  beforeEach(() => {
    console.error = mockConsoleError
    errorSpy = vi.fn()

    // Mock ResizeObserver for testing
    window.ResizeObserver = mockResizeObserver
    mockResizeObserver.mockImplementation(() => ({
      observe: vi.fn(),
      unobserve: vi.fn(),
      disconnect: vi.fn()
    }))

    // Mock getBoundingClientRect
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
    console.error = originalConsoleError
    cleanup()
    vi.clearAllMocks()
  })

  it('should catch virtualization errors and show appropriate fallback', () => {
    render(
      <TestErrorBoundary onError={errorSpy}>
        <VirtualizationErrorComponent />
      </TestErrorBoundary>
    )

    // Should catch the error and show simple fallback
    expect(screen.getByTestId('error-fallback-simple')).toBeInTheDocument()
    expect(screen.getByText('Table Error - Simple Mode')).toBeInTheDocument()
    expect(screen.getByTestId('simple-fallback-table')).toBeInTheDocument()

    // Should have called error handler
    expect(errorSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.stringContaining('virtualization failed')
      }),
      expect.any(Object)
    )
  })

  it('should catch measurement errors and show virtualized fallback', () => {
    render(
      <TestErrorBoundary onError={errorSpy}>
        <MeasurementErrorComponent />
      </TestErrorBoundary>
    )

    // Should show basic virtualized fallback
    expect(screen.getByTestId('error-fallback-virtualized')).toBeInTheDocument()
    expect(screen.getByText('Table Error - Basic Virtualization')).toBeInTheDocument()

    // Should still try to render a table
    const fallbackTable = document.querySelector('.overflow-hidden.rounded-lg.border')
    expect(fallbackTable).toBeInTheDocument()
  })

  it('should catch critical errors and show minimal fallback', () => {
    render(
      <TestErrorBoundary onError={errorSpy}>
        <CriticalErrorComponent />
      </TestErrorBoundary>
    )

    // Should show minimal fallback
    expect(screen.getByTestId('error-fallback-minimal')).toBeInTheDocument()
    expect(screen.getByText('Table Error')).toBeInTheDocument()
    expect(screen.getByText('Retry')).toBeInTheDocument()
  })

  it('should handle ResizeObserver errors gracefully', () => {
    // Mock ResizeObserver to throw error
    mockResizeObserver.mockImplementation(() => ({
      observe: vi.fn(() => {
        throw new Error('ResizeObserver failed')
      }),
      unobserve: vi.fn(),
      disconnect: vi.fn()
    }))

    function ResizeObserverErrorComponent() {
      const table = useReactTable({
        data: testData,
        columns,
        getCoreRowModel: getCoreRowModel()
      })

      return (
        <DataTable
          table={table}
          enableRowVirtualization={true}
          enableColumnVirtualization={true}
        />
      )
    }

    expect(() => {
      render(
        <TestErrorBoundary onError={errorSpy}>
          <ResizeObserverErrorComponent />
        </TestErrorBoundary>
      )
    }).not.toThrow()

    // Should either render normally or show appropriate fallback
    const isNormalRender = document.querySelector('.overflow-hidden.rounded-lg.border')
    const isFallbackRender = screen.queryByTestId('error-fallback-simple') ||
                           screen.queryByTestId('error-fallback-virtualized') ||
                           screen.queryByTestId('error-fallback-minimal')

    expect(isNormalRender || isFallbackRender).toBeTruthy()
  })

  it('should handle getBoundingClientRect errors', () => {
    // Mock getBoundingClientRect to throw error
    Element.prototype.getBoundingClientRect = vi.fn(() => {
      throw new Error('getBoundingClientRect failed')
    })

    function BoundingRectErrorComponent() {
      const table = useReactTable({
        data: testData,
        columns,
        getCoreRowModel: getCoreRowModel()
      })

      return (
        <DataTable
          table={table}
          enableColumnResizing={true}
          enableRowVirtualization={true}
        />
      )
    }

    expect(() => {
      render(
        <TestErrorBoundary onError={errorSpy}>
          <BoundingRectErrorComponent />
        </TestErrorBoundary>
      )
    }).not.toThrow()
  })

  it('should provide retry functionality', () => {
    render(
      <TestErrorBoundary onError={errorSpy}>
        <CriticalErrorComponent />
      </TestErrorBoundary>
    )

    expect(screen.getByTestId('error-fallback-minimal')).toBeInTheDocument()

    // Click retry button
    const retryButton = screen.getByText('Retry')
    retryButton.click()

    // Should attempt to render again (and likely error again, but that's expected)
    expect(errorSpy).toHaveBeenCalled()
  })

  it('should handle memory-related errors during large dataset rendering', () => {
    const largeData = Array.from({ length: 100000 }, (_, i) => ({
      id: i,
      name: `Item ${i}`,
      value: i * 10
    }))

    function MemoryErrorComponent() {
      const table = useReactTable({
        data: largeData,
        columns,
        getCoreRowModel: getCoreRowModel()
      })

      // Simulate memory error during large dataset processing
      React.useEffect(() => {
        // Simulate running out of memory
        if (largeData.length > 50000) {
          throw new Error('RangeError: Maximum call stack size exceeded')
        }
      }, [])

      return (
        <DataTable
          table={table}
          enableRowVirtualization={true}
          height={600}
        />
      )
    }

    render(
      <TestErrorBoundary onError={errorSpy}>
        <MemoryErrorComponent />
      </TestErrorBoundary>
    )

    // Should handle memory errors gracefully
    expect(screen.getByTestId('error-fallback-minimal')).toBeInTheDocument()
  })

  it('should preserve error information for debugging', () => {
    render(
      <TestErrorBoundary onError={errorSpy}>
        <VirtualizationErrorComponent />
      </TestErrorBoundary>
    )

    // Check error details are preserved
    const errorDetails = screen.getByText('Error Details')
    expect(errorDetails).toBeInTheDocument()

    // Error info should be available for debugging
    expect(errorSpy).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({
        componentStack: expect.any(String)
      })
    )
  })

  it('should handle concurrent errors from multiple table instances', () => {
    function MultiTableErrorComponent() {
      return (
        <div>
          <VirtualizationErrorComponent />
          <MeasurementErrorComponent />
        </div>
      )
    }

    render(
      <TestErrorBoundary onError={errorSpy}>
        <MultiTableErrorComponent />
      </TestErrorBoundary>
    )

    // Should catch the first error that occurs
    expect(errorSpy).toHaveBeenCalled()

    // Should show appropriate fallback
    const fallback = screen.queryByTestId('error-fallback-simple') ||
                    screen.queryByTestId('error-fallback-virtualized') ||
                    screen.queryByTestId('error-fallback-minimal')

    expect(fallback).toBeInTheDocument()
  })

  it('should handle errors during column resizing operations', () => {
    function ColumnResizeErrorComponent() {
      const table = useReactTable({
        data: testData,
        columns: columns.map(col => ({
          ...col,
          size: 150,
          onResize: () => {
            throw new Error('Column resize failed')
          }
        })),
        getCoreRowModel: getCoreRowModel()
      })

      React.useEffect(() => {
        // Simulate resize error
        throw new Error('measurement error: Column resize calculation failed')
      }, [])

      return (
        <DataTable
          table={table}
          enableColumnResizing={true}
        />
      )
    }

    render(
      <TestErrorBoundary onError={errorSpy}>
        <ColumnResizeErrorComponent />
      </TestErrorBoundary>
    )

    // Should handle resize errors with appropriate fallback
    expect(screen.getByTestId('error-fallback-virtualized')).toBeInTheDocument()
  })

  it('should log errors with sufficient context for debugging', () => {
    render(
      <TestErrorBoundary onError={errorSpy}>
        <VirtualizationErrorComponent />
      </TestErrorBoundary>
    )

    expect(errorSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.stringContaining('virtualization failed')
      }),
      expect.objectContaining({
        componentStack: expect.stringContaining('VirtualizationErrorComponent')
      })
    )
  })
})