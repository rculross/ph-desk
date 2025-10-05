import React from 'react'

import {
  getCoreRowModel,
  type ColumnDef,
  useReactTable,
  type Table as TanStackTable
} from '@tanstack/react-table'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

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

function createDataTransfer(): DataTransfer {
  const dataStore = new Map<string, string>()
  return {
    dropEffect: 'move',
    effectAllowed: 'all',
    files: [] as File[],
    items: [] as unknown as DataTransferItemList,
    types: [],
    setDragImage: vi.fn(),
    clearData: vi.fn(),
    getData: (format: string) => dataStore.get(format) ?? '',
    setData: (format: string, data: string) => {
      dataStore.set(format, data)
    }
  } as unknown as DataTransfer
}

function DataTableHarness({
  onTableReady,
  onReorder
}: {
  onTableReady: (table: TanStackTable<SampleRow>) => void
  onReorder: (from: number, to: number) => void
}) {
  const [columnOrder, setColumnOrder] = React.useState<string[]>([])

  const table = useReactTable({
    data,
    columns,
    state: {
      columnOrder
    },
    onColumnOrderChange: setColumnOrder,
    getCoreRowModel: getCoreRowModel(),
    columnResizeMode: 'onChange'
  })

  React.useEffect(() => {
    onTableReady(table)
  }, [table, onTableReady])

  return (
    <DataTable
      table={table}
      enableColumnDragging
      enableColumnResizing
      enableRowVirtualization={false}
      enableColumnVirtualization={false}
      onColumnReorder={(fromIndex, toIndex) => {
        onReorder(fromIndex, toIndex)

        const allColumns = table.getAllLeafColumns().map(col => col.id)
        const nextOrder = [...allColumns]
        const [moved] = nextOrder.splice(fromIndex, 1)
        if (moved) {
          nextOrder.splice(toIndex, 0, moved)
          table.setColumnOrder(nextOrder)
        }
      }}
    />
  )
}

describe('DataTable column dragging', () => {
  it('runs drag lifecycle callbacks and reorders columns', async () => {
    const tableRef: { current: TanStackTable<SampleRow> | null } = { current: null }
    const reorderSpy = vi.fn()
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

    render(
      <DataTableHarness
        onTableReady={(table) => {
          tableRef.current = table
        }}
        onReorder={reorderSpy}
      />
    )

    await waitFor(() => {
      expect(tableRef.current).not.toBeNull()
    })

    const table = tableRef.current!
    const setColumnOrderSpy = vi.spyOn(table, 'setColumnOrder')

    const dataTransfer = createDataTransfer()
    const sourceOverlay = await screen.findByTestId('column-drag-overlay-name')
    const targetOverlay = await screen.findByTestId('column-drag-overlay-value')

    fireEvent.dragStart(sourceOverlay, { dataTransfer })
    fireEvent.dragEnter(targetOverlay, { dataTransfer })
    fireEvent.dragOver(targetOverlay, { dataTransfer })
    fireEvent.drop(targetOverlay, { dataTransfer })
    fireEvent.dragEnd(sourceOverlay, { dataTransfer })

    expect(consoleSpy.mock.calls.some(call => call[0] === 'Column drag start:' && call[1] === 'name')).toBe(true)
    expect(consoleSpy.mock.calls.some(call => call[0] === 'Column drop event:' && typeof call[1] === 'object')).toBe(true)
    expect(reorderSpy).toHaveBeenCalledWith(0, 1)
    expect(setColumnOrderSpy).toHaveBeenCalled()

    const headerCells = screen.getAllByRole('columnheader')
    expect(headerCells[0]).toHaveTextContent('Value')
    expect(headerCells[1]).toHaveTextContent('Name')

    consoleSpy.mockRestore()
  })

  it('keeps the resize handle interactive without triggering drag', async () => {
    const tableRef: { current: TanStackTable<SampleRow> | null } = { current: null }
    const reorderSpy = vi.fn()
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

    render(
      <DataTableHarness
        onTableReady={(table) => {
          tableRef.current = table
        }}
        onReorder={reorderSpy}
      />
    )

    await waitFor(() => {
      expect(tableRef.current).not.toBeNull()
    })

    const resizeHandle = await screen.findByTestId('column-resize-handle-name')

    fireEvent.mouseDown(resizeHandle, { clientX: 100 })

    const dragStartCalls = consoleSpy.mock.calls.filter(call => call[0] === 'Column drag start:')
    expect(dragStartCalls.length).toBe(0)

    const table = tableRef.current!
    expect(table.getState().columnSizingInfo.isResizingColumn).toBe('name')

    consoleSpy.mockRestore()
  })
})
