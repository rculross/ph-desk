import React, { useCallback, useMemo, useState } from 'react'

import { FilterFilled } from '@ant-design/icons'
import { flexRender, type Header , Table } from '@tanstack/react-table'
import { clsx } from 'clsx'

import { logger } from '../../utils/logger'

import { FilterDropdown } from './FilterDropdown'


export interface ColumnDragState {
  draggedColumnId: string | null
  dragOverColumnId: string | null
  dropPosition: 'left' | 'right' | null
}

export interface ColumnDragHandlers<TData> extends ColumnDragState {
  handleColumnDragStart: (event: React.DragEvent, columnId: string) => void
  handleColumnDragEnter: (event: React.DragEvent, columnId: string) => void
  handleColumnDragOver: (event: React.DragEvent, columnId: string) => void
  handleColumnDragLeave: (event: React.DragEvent) => void
  handleColumnDrop: (event: React.DragEvent, columnId: string) => void
  handleColumnDragEnd: (event: React.DragEvent) => void
}

export interface UseColumnDragOptions<TData> {
  table: Table<TData>
  enableColumnDragging?: boolean
  onColumnReorder?: (fromIndex: number, toIndex: number) => void
}

export function useColumnDrag<TData>({
  table,
  enableColumnDragging = false,
  onColumnReorder
}: UseColumnDragOptions<TData>): ColumnDragHandlers<TData> {
  const [draggedColumnId, setDraggedColumnId] = useState<string | null>(null)
  const [dragOverColumnId, setDragOverColumnId] = useState<string | null>(null)
  const [dropPosition, setDropPosition] = useState<'left' | 'right' | null>(null)

  const handleColumnDragStart = useCallback(
    (event: React.DragEvent, columnId: string) => {
      if (!enableColumnDragging) {
        return
      }

      console.log('Column drag start:', columnId)
      setDraggedColumnId(columnId)
      event.dataTransfer.effectAllowed = 'move'
      event.dataTransfer.setData('text/plain', columnId)

      if (event.currentTarget instanceof HTMLElement) {
        event.currentTarget.style.opacity = '0.5'
      }
    },
    [enableColumnDragging]
  )

  const handleColumnDragEnter = useCallback(
    (event: React.DragEvent, columnId: string) => {
      if (!enableColumnDragging) {
        return
      }

      event.preventDefault()
      if (draggedColumnId && draggedColumnId !== columnId) {
        const rect = event.currentTarget.getBoundingClientRect()
        const mouseX = event.clientX
        const columnCenter = rect.left + rect.width / 2
        const position = mouseX < columnCenter ? 'left' : 'right'

        setDragOverColumnId(columnId)
        setDropPosition(position)
      }
    },
    [draggedColumnId, enableColumnDragging]
  )

  const handleColumnDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault()
    event.dataTransfer.dropEffect = 'move'
  }, [])

  const handleColumnDragLeave = useCallback((event: React.DragEvent) => {
    const rect = event.currentTarget.getBoundingClientRect()
    const x = event.clientX
    const y = event.clientY

    if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) {
      setDragOverColumnId(null)
      setDropPosition(null)
    }
  }, [])

  const handleColumnDrop = useCallback(
    (event: React.DragEvent, columnId: string) => {
      if (!enableColumnDragging) {
        return
      }

      event.preventDefault()
      console.log('Column drop event:', { draggedColumnId, columnId, dropPosition })

      if (draggedColumnId && draggedColumnId !== columnId && onColumnReorder) {
        const columns = table.getAllLeafColumns()
        const fromIndex = columns.findIndex(col => col.id === draggedColumnId)
        const toIndex = columns.findIndex(col => col.id === columnId)

        if (fromIndex !== -1 && toIndex !== -1) {
          let finalToIndex = toIndex
          if (dropPosition === 'right') {
            finalToIndex = toIndex + 1
          }
          onColumnReorder(fromIndex, finalToIndex)
        }
      }

      setDraggedColumnId(null)
      setDragOverColumnId(null)
      setDropPosition(null)
    },
    [draggedColumnId, dropPosition, enableColumnDragging, onColumnReorder, table]
  )

  const handleColumnDragEnd = useCallback((event: React.DragEvent) => {
    if (event.currentTarget instanceof HTMLElement) {
      event.currentTarget.style.opacity = '1'
    }

    setDraggedColumnId(null)
    setDragOverColumnId(null)
    setDropPosition(null)
  }, [])

  return {
    draggedColumnId,
    dragOverColumnId,
    dropPosition,
    handleColumnDragStart,
    handleColumnDragEnter,
    handleColumnDragOver,
    handleColumnDragLeave,
    handleColumnDrop,
    handleColumnDragEnd
  }
}

interface ColumnHeaderLabelProps<TData> {
  header: Header<TData, unknown>
  className?: string
}

export function ColumnHeaderLabel<TData>({ header, className }: ColumnHeaderLabelProps<TData>) {
  return (
    <div
      className={clsx(
        'flex items-center gap-1',
        header.column.getCanSort() && 'cursor-pointer select-none hover:text-blue-600',
        className
      )}
      onClick={header.column.getCanSort() ? header.column.getToggleSortingHandler() : undefined}
    >
      {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}

      {header.column.getCanFilter() && (
        <div className="ml-1" data-no-column-drag>
          <FilterDropdown column={header.column}>
            <div>
              {header.column.getIsFiltered() ? (
                <FilterFilled className="cursor-pointer text-sm text-blue-600" />
              ) : (
                <FilterFilled className="cursor-pointer text-sm text-gray-300 opacity-50 transition-all hover:text-gray-500 hover:opacity-100" />
              )}
            </div>
          </FilterDropdown>
        </div>
      )}
    </div>
  )
}
