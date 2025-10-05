/**
 * Type Safety Tests for DataTable
 *
 * Tests for type safety issues with array bounds checking:
 * - Array index bounds validation
 * - Null/undefined data handling
 * - Type guard implementations
 * - Runtime type checking
 * - Edge case data scenarios
 */

import React from 'react'

import {
  getCoreRowModel,
  type ColumnDef,
  useReactTable,
  type Row
} from '@tanstack/react-table'
import { render, cleanup, screen } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'

import { sanitizeCSSPropertyName } from '../../utils/text-utils'
import { DataTable } from '../DataTable'

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

interface TypeSafeTestRow {
  id: number | string | null
  name?: string
  value: number | null | undefined
  nested?: {
    prop?: string
    array?: unknown[]
  }
  dynamic?: Record<string, unknown>
}

// Test data with various type safety challenges
const typeSafetyTestData: (TypeSafeTestRow | null | undefined)[] = [
  { id: 1, name: 'Valid Row', value: 100 },
  { id: '2', name: 'String ID', value: 200 },
  { id: null, name: 'Null ID', value: null },
  { id: 3, value: 300 }, // Missing name
  { id: 4, name: '', value: undefined }, // Empty name, undefined value
  { id: 5, name: 'Nested', value: 500, nested: { prop: 'test', array: [1, 2, 3] } },
  { id: 6, name: 'Invalid Nested', value: 600, nested: undefined },
  { id: 7, name: 'Complex', value: 700, dynamic: { a: 1, b: 'string', c: null } },
  null, // Null row
  undefined, // Undefined row
  { id: 8 }, // Minimal data
  { id: 9, name: 'Unicode: 🚀🎯💯', value: 900 }, // Unicode handling
  // @ts-expect-error - Intentional type violation for testing
  { id: 10, name: 123, value: 'not-a-number' }, // Type violations
  { id: 11, name: 'Array Test', value: 1100, nested: { array: [] } }, // Empty array
  { id: 12, name: 'Large Array', value: 1200, nested: { array: new Array(10000).fill(0) } } // Large array
]

// Type-safe column definitions with error handling
const typeSafeColumns: ColumnDef<TypeSafeTestRow>[] = [
  {
    accessorKey: 'id',
    header: 'ID',
    cell: ({ getValue }) => {
      const value = getValue()
      if (value === null || value === undefined) {
        return <span data-testid="null-id">N/A</span>
      }
      return <span data-testid="valid-id">{String(value)}</span>
    }
  },
  {
    accessorKey: 'name',
    header: 'Name',
    cell: ({ getValue }) => {
      const value = getValue()
      if (typeof value !== 'string' || value.length === 0) {
        return <span data-testid="invalid-name">—</span>
      }
      return <span data-testid="valid-name">{value}</span>
    }
  },
  {
    accessorKey: 'value',
    header: 'Value',
    cell: ({ getValue }) => {
      const value = getValue()
      if (typeof value !== 'number' || isNaN(value)) {
        return <span data-testid="invalid-value">Invalid</span>
      }
      return <span data-testid="valid-value">{value.toLocaleString()}</span>
    }
  },
  {
    id: 'nested-prop',
    header: 'Nested Property',
    accessorFn: (row) => {
      if (!row.nested || typeof row.nested !== 'object') {
        return null
      }
      return row.nested.prop
    },
    cell: ({ getValue }) => {
      const value = getValue()
      return value ? <span data-testid="valid-nested">{String(value)}</span> :
                   <span data-testid="null-nested">—</span>
    }
  },
  {
    id: 'array-length',
    header: 'Array Length',
    accessorFn: (row) => {
      if (!row.nested?.array || !Array.isArray(row.nested.array)) {
        return 0
      }
      return row.nested.array.length
    },
    cell: ({ getValue }) => {
      const value = getValue()
      return <span data-testid="array-length">{String(value)}</span>
    }
  }
]

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

function TypeSafeTableWrapper({
  data = typeSafetyTestData,
  enableVirtualization = true
}: {
  data?: (TypeSafeTestRow | null | undefined)[]
  enableVirtualization?: boolean
}) {
  // Filter out null/undefined rows with type safety
  const safeData = data.filter((row): row is TypeSafeTestRow =>
    row !== null && row !== undefined && typeof row === 'object'
  )

  const table = useReactTable({
    data: safeData,
    columns: typeSafeColumns,
    getCoreRowModel: getCoreRowModel()
  })

  return (
    <DataTable
      table={table}
      enableRowVirtualization={enableVirtualization}
      enableColumnVirtualization={enableVirtualization}
      height={400}
    />
  )
}

// Custom row renderer with bounds checking
function BoundsCheckedRow<TData>({
  row,
  rowIndex,
  totalRows
}: {
  row: Row<TData>
  rowIndex: number
  totalRows: number
}) {
  // Validate row index bounds
  if (rowIndex < 0 || rowIndex >= totalRows) {
    return (
      <div data-testid="out-of-bounds-row">
        Row index {rowIndex} is out of bounds (0-{totalRows - 1})
      </div>
    )
  }

  // Validate row data
  if (!row || !row.original) {
    return (
      <div data-testid="invalid-row-data">
        Invalid row data at index {rowIndex}
      </div>
    )
  }

  return (
    <div data-testid={`valid-row-${rowIndex}`} className="border-b">
      {row.getVisibleCells().map((cell, cellIndex) => {
        // Validate cell index bounds
        const totalCells = row.getVisibleCells().length
        if (cellIndex < 0 || cellIndex >= totalCells) {
          return (
            <div key={`invalid-cell-${cellIndex}`} data-testid="out-of-bounds-cell">
              Cell index out of bounds
            </div>
          )
        }

        return (
          <div
            key={cell.id}
            data-testid={`valid-cell-${rowIndex}-${cellIndex}`}
            className="p-2 border-r"
          >
            {cell.getValue() ?? 'N/A'}
          </div>
        )
      })}
    </div>
  )
}

describe('DataTable Type Safety Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    cleanup()
  })

  it('should handle null and undefined data gracefully', () => {
    const mixedData = [
      { id: 1, name: 'Valid', value: 100 },
      null,
      undefined,
      { id: 2, name: 'Also Valid', value: 200 }
    ]

    expect(() => {
      render(<TypeSafeTableWrapper data={mixedData} />)
    }).not.toThrow()

    // Should only render valid rows
    expect(screen.getAllByTestId(/valid-id/).length).toBe(2)
  })

  it('should validate array index bounds in virtualization', () => {
    const data = Array.from({ length: 1000 }, (_, i) => ({
      id: i,
      name: `Item ${i}`,
      value: i * 10
    }))

    const { container } = render(<TypeSafeTableWrapper data={data} />)

    // Should not have out-of-bounds errors in DOM
    expect(container.innerHTML).not.toContain('undefined')
    expect(container.innerHTML).not.toContain('[object Object]')

    // Should have proper data-index attributes
    const indexedElements = container.querySelectorAll('[data-index]')
    indexedElements.forEach(element => {
      const index = element.getAttribute('data-index')
      expect(index).toMatch(/^\d+$/) // Should be a valid number
      expect(parseInt(index!, 10)).toBeGreaterThanOrEqual(0)
      expect(parseInt(index!, 10)).toBeLessThan(data.length)
    })
  })

  it('should handle type violations in cell rendering', () => {
    render(<TypeSafeTableWrapper />)

    // Should handle null IDs
    expect(screen.getByTestId('null-id')).toBeInTheDocument()

    // Should handle invalid names
    expect(screen.getByTestId('invalid-name')).toBeInTheDocument()

    // Should handle invalid values
    expect(screen.getByTestId('invalid-value')).toBeInTheDocument()
  })

  it('should validate CSS property name sanitization', () => {
    const testCases = [
      { input: 'normal-id', expected: 'normal-id' },
      { input: 'id with spaces', expected: 'id-with-spaces' },
      { input: 'id.with.dots', expected: 'id-with-dots' },
      { input: 'id@with#special$chars', expected: 'id-with-special-chars' },
      { input: '123numeric-start', expected: '_123numeric-start' },
      { input: '', expected: '_empty' },
      { input: null as any, expected: '_null' },
      { input: undefined as any, expected: '_undefined' }
    ]

    testCases.forEach(({ input, expected }) => {
      const result = sanitizeCSSPropertyName(input)
      expect(result).toBe(expected)
      expect(result).toMatch(/^[a-zA-Z_][\w-]*$/) // Valid CSS identifier
    })
  })

  it('should handle accessing properties on null/undefined row data', () => {
    const columns: ColumnDef<any>[] = [
      {
        accessorKey: 'id',
        header: 'ID',
        cell: ({ row }) => {
          // Safe property access
          const data = row.original
          return data?.id ?? 'N/A'
        }
      },
      {
        id: 'nested-access',
        header: 'Nested',
        accessorFn: (row) => {
          // Multiple levels of safe access
          return row?.nested?.deep?.property ?? 'Not found'
        }
      }
    ]

    const dangerousData = [
      { id: 1 },
      null,
      { id: 2, nested: null },
      { id: 3, nested: { deep: null } },
      { id: 4, nested: { deep: { property: 'found' } } }
    ]

    function SafeAccessTable() {
      const safeData = dangerousData.filter(Boolean)
      const table = useReactTable({
        data: safeData,
        columns,
        getCoreRowModel: getCoreRowModel()
      })

      return <DataTable table={table} />
    }

    expect(() => {
      render(<SafeAccessTable />)
    }).not.toThrow()
  })

  it('should validate column index bounds in virtualization', () => {
    const data = [{ id: 1, name: 'Test', value: 100 }]

    // Create many columns to test column virtualization bounds
    const manyColumns: ColumnDef<any>[] = Array.from({ length: 50 }, (_, i) => ({
      id: `column-${i}`,
      header: `Column ${i}`,
      accessorFn: () => `Value ${i}`,
      cell: ({ column }) => {
        // Validate column is properly defined
        if (!column.id) {
          return <span data-testid="invalid-column">Invalid Column</span>
        }
        return <span data-testid={`valid-column-${i}`}>Column {i}</span>
      }
    }))

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
          columnOverscan={2}
        />
      )
    }

    expect(() => {
      render(<ManyColumnsTable />)
    }).not.toThrow()

    // Should not have invalid column indicators
    expect(screen.queryByTestId('invalid-column')).not.toBeInTheDocument()
  })

  it('should handle dynamic property access safely', () => {
    const dynamicData = [
      { id: 1, dynamic: { a: 1, b: 'string', c: true } },
      { id: 2, dynamic: null },
      { id: 3 }, // No dynamic property
      { id: 4, dynamic: { nested: { deep: 'value' } } }
    ]

    const dynamicColumns: ColumnDef<any>[] = [
      {
        id: 'dynamic-a',
        header: 'Dynamic A',
        accessorFn: (row) => {
          // Safe dynamic property access
          if (!row?.dynamic || typeof row.dynamic !== 'object') {
            return null
          }
          return (row.dynamic as Record<string, unknown>).a
        },
        cell: ({ getValue }) => {
          const value = getValue()
          return value != null ? String(value) : 'N/A'
        }
      },
      {
        id: 'dynamic-nested',
        header: 'Dynamic Nested',
        accessorFn: (row) => {
          // Multiple level dynamic access
          try {
            const dynamic = row?.dynamic
            return dynamic?.nested?.deep ?? null
          } catch {
            return null
          }
        }
      }
    ]

    function DynamicTable() {
      const table = useReactTable({
        data: dynamicData,
        columns: dynamicColumns,
        getCoreRowModel: getCoreRowModel()
      })

      return <DataTable table={table} />
    }

    expect(() => {
      render(<DynamicTable />)
    }).not.toThrow()
  })

  it('should validate array bounds in custom virtualizer measurements', () => {
    const largeData = Array.from({ length: 10000 }, (_, i) => ({
      id: i,
      name: `Item ${i}`,
      value: i
    }))

    function BoundsTestTable() {
      const table = useReactTable({
        data: largeData,
        columns: typeSafeColumns.slice(0, 3), // Only first 3 columns
        getCoreRowModel: getCoreRowModel()
      })

      return (
        <DataTable
          table={table}
          enableRowVirtualization={true}
          enableColumnVirtualization={true}
          rowOverscan={5}
          columnOverscan={2}
        />
      )
    }

    const { container } = render(<BoundsTestTable />)

    // Check that virtualized elements have valid indices
    const virtualizedRows = container.querySelectorAll('[data-index]')
    virtualizedRows.forEach(row => {
      const index = parseInt(row.getAttribute('data-index') || '0', 10)
      expect(index).toBeGreaterThanOrEqual(0)
      expect(index).toBeLessThan(largeData.length)
    })
  })

  it('should handle edge cases in row data types', () => {
    const edgeCaseData = [
      { id: Number.MAX_SAFE_INTEGER, name: 'Max Safe Integer', value: 1 },
      { id: Number.MIN_SAFE_INTEGER, name: 'Min Safe Integer', value: 2 },
      { id: 0, name: 'Zero', value: 0 },
      { id: -1, name: 'Negative', value: -100 },
      { id: 3.14159, name: 'Float', value: 3.14 },
      { id: Infinity, name: 'Infinity', value: Infinity },
      { id: -Infinity, name: 'Negative Infinity', value: -Infinity },
      { id: NaN, name: 'NaN', value: NaN }
    ]

    expect(() => {
      render(<TypeSafeTableWrapper data={edgeCaseData} />)
    }).not.toThrow()

    // Should handle special number values
    expect(screen.getByText('Max Safe Integer')).toBeInTheDocument()
    expect(screen.getByText('Min Safe Integer')).toBeInTheDocument()
  })

  it('should validate virtualization calculations with empty data', () => {
    expect(() => {
      render(<TypeSafeTableWrapper data={[]} />)
    }).not.toThrow()

    expect(screen.getByText('No data available')).toBeInTheDocument()
  })

  it('should handle malformed row objects gracefully', () => {
    const malformedData = [
      { id: 1, name: 'Good' },
      { toString: () => 'Bad Object' }, // Object without expected properties
      Object.create(null), // Object without prototype
      new Date(), // Wrong type entirely
      'string-instead-of-object', // Primitive instead of object
      { id: 2, name: 'Another Good' }
    ] as any[]

    // Filter to only valid rows
    const validRows = malformedData.filter(row =>
      row &&
      typeof row === 'object' &&
      !Array.isArray(row) &&
      !(row instanceof Date) &&
      typeof row.id !== 'undefined'
    )

    expect(() => {
      render(<TypeSafeTableWrapper data={validRows} />)
    }).not.toThrow()

    // Should only render valid rows
    expect(screen.getAllByTestId(/valid-id/).length).toBe(2)
  })
})