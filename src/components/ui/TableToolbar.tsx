/**
 * TableToolbar Component
 *
 * Reusable toolbar for table controls and actions.
 * Handles filtering, sorting, grouping, and selection management.
 */

import React, { useState, useEffect, useCallback } from 'react'

import {
  FilterOutlined,
  SortAscendingOutlined,
  GroupOutlined,
  ColumnWidthOutlined,
  ClearOutlined,
  FolderOpenOutlined,
  FolderOutlined
} from '@ant-design/icons'
import type {
  Table,
  GroupingState,
  ColumnFiltersState,
  SortingState,
  VisibilityState,
  ExpandedState,
  RowSelectionState
} from '@tanstack/react-table'
import { Button, Space, Dropdown, Checkbox, Divider, Typography, Badge } from 'antd'
import { clsx } from 'clsx'

const { Text } = Typography

export interface TableToolbarProps<TData> {
  table?: Table<TData>
  title?: string
  className?: string

  // State values
  grouping?: GroupingState
  columnFilters?: ColumnFiltersState
  sorting?: SortingState
  columnVisibility?: VisibilityState
  expanded?: ExpandedState
  rowSelection?: RowSelectionState

  // Feature flags
  enableGrouping?: boolean
  enableFiltering?: boolean
  enableSorting?: boolean
  enableColumnVisibility?: boolean
  enableSelection?: boolean

  // Event handlers
  onResetFilters?: () => void
  onResetSorting?: () => void
  onClearSelection?: () => void
  onGroupingChange?: (grouping: GroupingState) => void
  onExpandedChange?: (expanded: ExpandedState) => void
  onColumnVisibilityChange?: (visibility: VisibilityState) => void
  onColumnOrderClick?: () => void

  // Custom actions
  children?: React.ReactNode
}

/**
 * Table toolbar with standardized controls
 */
export function TableToolbar<TData>({
  table,
  title,
  className,

  grouping = [],
  columnFilters = [],
  sorting = [],
  columnVisibility = {},
  expanded = {},
  rowSelection = {},

  enableGrouping = false,
  enableFiltering = true,
  enableSorting = true,
  enableColumnVisibility = true,
  enableSelection = false,

  onResetFilters,
  onResetSorting,
  onClearSelection,
  onGroupingChange,
  onExpandedChange,
  onColumnVisibilityChange,
  onColumnOrderClick,

  children
}: TableToolbarProps<TData>) {
  const selectedCount = Object.keys(rowSelection).length

  // State for deferred column visibility updates
  const [pendingVisibility, setPendingVisibility] = useState<VisibilityState | null>(null)
  const [dropdownOpen, setDropdownOpen] = useState(false)

  // Initialize pending visibility when dropdown opens
  useEffect(() => {
    if (dropdownOpen && table) {
      const currentVisibility: VisibilityState = {}
      table.getAllLeafColumns().forEach(column => {
        if (column.id !== 'select') {
          currentVisibility[column.id] = column.getIsVisible()
        }
      })
      setPendingVisibility(currentVisibility)
    }
  }, [dropdownOpen, table])

  // Apply pending changes when dropdown closes
  const handleDropdownOpenChange = useCallback((open: boolean) => {
    setDropdownOpen(open)

    if (!open && pendingVisibility && onColumnVisibilityChange) {
      // Apply the pending visibility changes
      onColumnVisibilityChange(pendingVisibility)
      setPendingVisibility(null)
    }
  }, [pendingVisibility, onColumnVisibilityChange])

  // Handle individual column toggle
  const handleColumnToggle = useCallback((columnId: string) => {
    if (!pendingVisibility) return

    setPendingVisibility(prev => ({
      ...prev,
      [columnId]: !prev![columnId]
    }))
  }, [pendingVisibility])

  // Handle select all columns
  const handleSelectAll = useCallback(() => {
    if (!table) return

    const newVisibility: VisibilityState = {}
    table.getAllLeafColumns().forEach(column => {
      if (column.id !== 'select') {
        newVisibility[column.id] = true
      }
    })
    setPendingVisibility(newVisibility)
  }, [table])

  // Handle deselect all columns
  const handleDeselectAll = useCallback(() => {
    if (!table) return

    const newVisibility: VisibilityState = {}
    table.getAllLeafColumns().forEach(column => {
      if (column.id !== 'select') {
        newVisibility[column.id] = false
      }
    })
    setPendingVisibility(newVisibility)
  }, [table])

  return (
    <div className={clsx('flex items-center justify-between p-3 border-b bg-gray-50', className)}>
      <div className="flex items-center gap-2">
        {title && <Text strong className="text-lg">{title}</Text>}

        {enableSelection && selectedCount > 0 && (
          <Badge
            count={selectedCount}
            showZero
            overflowCount={Number.MAX_SAFE_INTEGER}
            style={{ backgroundColor: '#1890ff' }}
          >
            <Button
              size="small"
              icon={<ClearOutlined />}
              onClick={onClearSelection}
            >
              Clear Selection
            </Button>
          </Badge>
        )}
      </div>

      <Space>
        {children}

        {/* Grouping Control */}
        {enableGrouping && (
          <Dropdown
            trigger={['click']}
            popupRender={() => (
              <div className="p-3 min-w-[200px] bg-white rounded-lg shadow-lg border border-gray-200">
                <div className="flex justify-between items-center mb-2">
                  <Text strong>Group By</Text>
                  <Button
                    type="text"
                    size="small"
                    onClick={() => onGroupingChange?.([])}
                    disabled={grouping.length === 0}
                  >
                    Clear
                  </Button>
                </div>

                {table && (
                  <Checkbox.Group
                    value={grouping}
                    onChange={(checkedValues) => {
                      onGroupingChange?.(checkedValues)
                    }}
                    className="flex flex-col gap-1"
                  >
                    {table.getAllLeafColumns()
                      .filter(column =>
                        column.id !== 'select' &&
                        column.getCanGroup()
                      )
                      .map(column => (
                        <Checkbox key={column.id} value={column.id}>
                          {typeof column.columnDef.header === 'string'
                            ? column.columnDef.header
                            : `Column ${column.id}`
                          }
                        </Checkbox>
                      ))}
                  </Checkbox.Group>
                )}

                <Divider className="my-2" />
                <div className="flex items-center justify-between">
                  <Text className="text-sm text-gray-500">
                    {grouping.length > 0 ? `Grouped by ${grouping.length} column(s)` : 'No grouping'}
                  </Text>
                  {grouping.length > 0 && (
                    <Button
                      type="text"
                      size="small"
                      icon={Object.keys(expanded).length > 0 ? <FolderOpenOutlined /> : <FolderOutlined />}
                      onClick={() => {
                        const hasExpanded = typeof expanded === 'object' && Object.keys(expanded).length > 0
                        const newState = hasExpanded ? {} : true
                        onExpandedChange?.(newState)
                      }}
                    >
                      {Object.keys(expanded).length > 0 ? 'Collapse All' : 'Expand All'}
                    </Button>
                  )}
                </div>
              </div>
            )}
          >
            <Button
              size="small"
              icon={<GroupOutlined />}
              style={{ minWidth: '100px' }}
              type={grouping.length > 0 ? 'primary' : 'default'}
            >
              Group {grouping.length > 0 && `(${grouping.length})`}
            </Button>
          </Dropdown>
        )}

        {/* Reset Filters */}
        {enableFiltering && (
          <Button
            size="small"
            onClick={onResetFilters}
            disabled={columnFilters.length === 0}
            style={{ minWidth: '100px' }}
          >
            Reset <FilterOutlined />
          </Button>
        )}

        {/* Reset Sorting */}
        {enableSorting && (
          <Button
            size="small"
            onClick={onResetSorting}
            disabled={sorting.length === 0}
            style={{ minWidth: '100px' }}
          >
            Reset <SortAscendingOutlined />
          </Button>
        )}

        {/* Column Visibility */}
        {enableColumnVisibility && table && (
          <Dropdown
            trigger={['click']}
            open={dropdownOpen}
            onOpenChange={handleDropdownOpenChange}
            popupRender={() => (
              <div className="p-3 min-w-[200px] bg-white rounded-lg shadow-lg border border-gray-200">
                <div className="flex justify-between items-center mb-2">
                  <Text strong>Show Columns</Text>
                  <div className="flex gap-2">
                    <Button
                      type="text"
                      size="small"
                      onClick={handleSelectAll}
                    >
                      All
                    </Button>
                    <Button
                      type="text"
                      size="small"
                      onClick={handleDeselectAll}
                    >
                      None
                    </Button>
                  </div>
                </div>

                <div className="flex flex-col gap-1">
                  {(() => {
                    const allColumns = table.getAllLeafColumns().filter(column => column.id !== 'select')

                    // Use pending visibility if available, otherwise use current visibility
                    const getVisibility = (columnId: string) => {
                      if (pendingVisibility) {
                        return pendingVisibility[columnId] !== false
                      }
                      return table.getColumn(columnId)?.getIsVisible() ?? true
                    }

                    // Sort columns: visible first (in order), then hidden (alphabetically)
                    const orderedColumns = [...allColumns].sort((a, b) => {
                      const aVisible = getVisibility(a.id)
                      const bVisible = getVisibility(b.id)

                      // If visibility differs, visible columns come first
                      if (aVisible !== bVisible) {
                        return aVisible ? -1 : 1
                      }

                      // For hidden columns, sort alphabetically
                      if (!aVisible) {
                        const aHeader = typeof a.columnDef.header === 'string' ? a.columnDef.header : a.id
                        const bHeader = typeof b.columnDef.header === 'string' ? b.columnDef.header : b.id
                        return aHeader.localeCompare(bHeader)
                      }

                      // Keep visible columns in their original order
                      return 0
                    })

                    return orderedColumns.map(column => (
                      <Checkbox
                        key={column.id}
                        checked={getVisibility(column.id)}
                        onChange={() => handleColumnToggle(column.id)}
                      >
                        {typeof column.columnDef.header === 'string'
                          ? column.columnDef.header
                          : `Column ${column.id}`
                        }
                      </Checkbox>
                    ))
                  })()}
                </div>
              </div>
            )}
          >
            <Button size="small" icon={<ColumnWidthOutlined />} style={{ minWidth: '100px' }}>
              Columns
            </Button>
          </Dropdown>
        )}
      </Space>
    </div>
  )
}