import React from 'react'

import {
  getCoreRowModel,
  type ColumnDef,
  useReactTable
} from '@tanstack/react-table'
import { render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { DataTable } from '../../ui/DataTable'

interface SampleRow {
  id: number
  name: string
  value: number
}

const data: SampleRow[] = [
  { id: 1, name: 'Alpha', value: 10 },
  { id: 2, name: 'Beta', value: 20 }
]

const columns: ColumnDef<SampleRow>[] = [
  {
    accessorKey: 'name',
    header: 'Name'
  },
  {
    accessorKey: 'value',
    header: 'Value'
  }
]

function VirtualizedHarness() {
  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    columnResizeMode: 'onChange'
  })

  return (
    <DataTable
      table={table}
      enableColumnResizing
      enableColumnVirtualization
      enableRowVirtualization={false}
      height={300}
    />
  )
}

describe('DataTable column virtualization', () => {
  it('renders basic table structure without measurement errors', () => {
    // Test that our simplified implementation renders without errors
    // This verifies the simplified measurement logic works
    const { container } = render(<VirtualizedHarness />)

    // Should render the table container
    const tableContainer = container.querySelector('.overflow-hidden.rounded-lg.border')
    expect(tableContainer).toBeInTheDocument()

    // Should have the virtualization container when enabled
    const virtualizationContainer = container.querySelector('.relative')
    expect(virtualizationContainer).toBeInTheDocument()

    // Should have proper CSS custom properties for column sizing
    const elementWithSizing = container.querySelector('[style*="--header-"][style*="--col-"]')
    expect(elementWithSizing).toBeInTheDocument()

    // Verify that the simplification didn't break basic rendering
    // (Complex measurement logic has been simplified to use TanStack Virtual standard patterns)
    expect(container.innerHTML).not.toContain('undefined')
    expect(container.innerHTML).not.toContain('null')
  })
})
