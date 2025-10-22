/**
 * Global Search Input Component
 *
 * Enhanced search input for TanStack Table with debouncing and advanced features.
 */

import React, { useState, useEffect, useMemo } from 'react'

import { SearchOutlined, FilterOutlined, ClearOutlined, MoreOutlined } from '@ant-design/icons'
import type { Table } from '@tanstack/react-table'
import { Input, Tag, Dropdown, Button, Space } from 'antd'
import { clsx } from 'clsx'

export interface GlobalSearchInputProps<TData> {
  table: Table<TData>
  placeholder?: string
  className?: string
  showFilters?: boolean
  debounceMs?: number
}

/**
 * Global search input with advanced filtering capabilities
 */
export function GlobalSearchInput<TData>({
  table,
  placeholder = 'Search all columns...',
  className,
  showFilters = true,
  debounceMs = 300
}: GlobalSearchInputProps<TData>) {
  const [searchValue, setSearchValue] = useState('')
  const globalFilterValue = table.getState().globalFilter ?? ''

  // Sync internal state with table state
  useEffect(() => {
    setSearchValue(globalFilterValue)
  }, [globalFilterValue])

  // Debounced search update
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      table.setGlobalFilter(searchValue)
    }, debounceMs)

    return () => clearTimeout(timeoutId)
  }, [searchValue, table, debounceMs])

  // Count active column filters
  const activeColumnFilters = useMemo(() => {
    return table.getState().columnFilters.length
  }, [table.getState().columnFilters])

  // Get filtered row count
  const filteredRowCount = table.getFilteredRowModel().rows.length
  const totalRowCount = table.getCoreRowModel().rows.length

  // Search suggestions based on column data
  const searchSuggestions = useMemo(() => {
    if (!searchValue.trim() || searchValue.length < 2) return []

    const suggestions = new Set<string>()
    const columns = table.getAllColumns()
    const rows = table.getCoreRowModel().rows.slice(0, 100) // Limit for performance

    columns.forEach(column => {
      if (column.getCanFilter()) {
        rows.forEach(row => {
          const value = row.getValue(column.id)
          if (value && typeof value === 'string') {
            const lowerValue = value.toLowerCase()
            const lowerSearch = searchValue.toLowerCase()
            if (lowerValue.includes(lowerSearch) && lowerValue !== lowerSearch) {
              suggestions.add(value)
            }
          }
        })
      }
    })

    return Array.from(suggestions).slice(0, 5) // Limit suggestions
  }, [searchValue, table])

  const handleClear = () => {
    setSearchValue('')
    table.setGlobalFilter('')
  }

  const handleClearAllFilters = () => {
    setSearchValue('')
    table.setGlobalFilter('')
    table.resetColumnFilters()
  }

  const handleSuggestionClick = (suggestion: string) => {
    setSearchValue(suggestion)
  }

  // Advanced search dropdown menu
  const advancedSearchMenu = {
    items: [
      {
        key: 'clear-global',
        label: 'Clear Global Search',
        icon: <ClearOutlined />,
        disabled: !globalFilterValue,
        onClick: handleClear
      },
      {
        key: 'clear-all',
        label: 'Clear All Filters',
        icon: <FilterOutlined />,
        disabled: !globalFilterValue && activeColumnFilters === 0,
        onClick: handleClearAllFilters
      },
      {
        type: 'divider' as const
      },
      {
        key: 'help',
        label: (
          <div className="text-xs text-gray-500">
            <div>Search across all visible columns</div>
            <div>Use quotes for exact matches</div>
          </div>
        ),
        disabled: true
      }
    ]
  }

  return (
    <div className={clsx('space-y-2', className)}>
      <div className="flex items-center gap-2">
        <div className="flex-1 relative">
          <Dropdown
            menu={searchSuggestions.length > 0 ? {
              items: searchSuggestions.map((suggestion, index) => ({
                key: index,
                label: suggestion,
                onClick: () => handleSuggestionClick(suggestion)
              }))
            } : undefined}
            open={searchSuggestions.length > 0 && searchValue.length > 1}
            placement="bottomLeft"
          >
            <Input
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
              placeholder={placeholder}
              prefix={<SearchOutlined className="text-gray-400" />}
              suffix={
                <Space size="small">
                  {searchValue && (
                    <Button
                      type="text"
                      size="small"
                      icon={<ClearOutlined />}
                      onClick={handleClear}
                      className="text-gray-400 hover:text-gray-600"
                    />
                  )}
                  {showFilters && (
                    <Dropdown menu={advancedSearchMenu} trigger={['click']}>
                      <Button
                        type="text"
                        size="small"
                        icon={<MoreOutlined />}
                        className="text-gray-400 hover:text-gray-600"
                      />
                    </Dropdown>
                  )}
                </Space>
              }
              className="pr-16"
            />
          </Dropdown>
        </div>
      </div>

      {/* Search Stats */}
      <div className="flex items-center justify-between text-xs text-gray-500">
        <div className="flex items-center gap-4">
          {filteredRowCount !== totalRowCount && (
            <span>
              Showing {filteredRowCount.toLocaleString()} of {totalRowCount.toLocaleString()} rows
            </span>
          )}
          {globalFilterValue && (
            <Tag color="blue" closable onClose={handleClear}>
              Search: {globalFilterValue}
            </Tag>
          )}
        </div>

        {activeColumnFilters > 0 && (
          <div className="flex items-center gap-1">
            <FilterOutlined className="text-blue-500" />
            <span className="text-blue-600">
              {activeColumnFilters} column filter{activeColumnFilters > 1 ? 's' : ''} active
            </span>
          </div>
        )}
      </div>
    </div>
  )
}