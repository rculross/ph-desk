/**
 * Column Filter Component
 *
 * Provides type-specific filter UI for table columns.
 * Supports text, select, date, and number filtering.
 */

import React, { useState, useEffect, useMemo } from 'react'

import { SearchOutlined, FilterOutlined, ClearOutlined } from '@ant-design/icons'
import type { Column } from '@tanstack/react-table'
import { Input, Select, DatePicker, InputNumber, Button, Divider } from 'antd'
import { clsx } from 'clsx'
import dayjs from 'dayjs'

const { RangePicker } = DatePicker

export interface ColumnFilterProps<TData> {
  column: Column<TData, unknown>
  onFilterChange?: (value: any) => void
  className?: string
}

/**
 * Type-specific filter component
 */
export function ColumnFilter<TData>({
  column,
  onFilterChange,
  className
}: ColumnFilterProps<TData>) {
  const columnFilterValue = column.getFilterValue()
  const [tempValue, setTempValue] = useState<any>(columnFilterValue)

  // Get unique values from the column for select filters
  const uniqueValues = useMemo(() => {
    const facetedUniqueValues = column.getFacetedUniqueValues()
    const values = Array.from(facetedUniqueValues.keys())
      .filter(value => value !== null && value !== undefined && value !== '')
      .sort()
    return values.slice(0, 100) // Limit to 100 options for performance
  }, [column])

  // Determine filter type based on column meta or column data
  const filterType = useMemo(() => {
    const columnId = column.id
    const firstValue = uniqueValues[0]

    // First check if filter type is explicitly set in column meta
    const metaFilterType = (column.columnDef.meta as any)?.filterType
    if (metaFilterType && ['text', 'select', 'number', 'date'].includes(metaFilterType)) {
      return metaFilterType
    }

    // Check column ID patterns first
    if (columnId.includes('date') || columnId.includes('time') || columnId === 'time') {
      return 'date'
    }
    if (columnId.includes('id') || columnId === 'entityId') {
      return 'text'
    }
    if (columnId === 'model' || columnId === 'operation' || columnId === 'actorDisplay') {
      return 'select'
    }

    // Check data types
    if (typeof firstValue === 'number') {
      return 'number'
    }
    if (typeof firstValue === 'string' && firstValue.match(/^\d{4}-\d{2}-\d{2}/)) {
      return 'date'
    }

    // Default to text for everything else
    return 'text'
  }, [column.id, column.columnDef.meta, uniqueValues])

  // Apply filter with debouncing
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      column.setFilterValue(tempValue)
      onFilterChange?.(tempValue)
    }, 300)

    return () => clearTimeout(timeoutId)
  }, [tempValue, column, onFilterChange])

  // Clear filter
  const handleClear = () => {
    setTempValue(undefined)
    column.setFilterValue(undefined)
    onFilterChange?.(undefined)
  }

  // Render different filter types
  const renderFilter = () => {
    switch (filterType) {
      case 'select':
        return (
          <Select
            value={tempValue}
            onChange={setTempValue}
            placeholder={`Filter ${String(column.id)}...`}
            allowClear
            showSearch
            style={{ width: '100%', minWidth: 200 }}
            maxTagCount="responsive"
            mode="multiple"
            options={uniqueValues.map(value => ({
              label: String(value),
              value
            }))}
            filterOption={(input, option) =>
              (option?.label ?? '').toString().toLowerCase().includes(input.toLowerCase())
            }
          />
        )

      case 'date':
        return (
          <RangePicker
            value={tempValue ? [dayjs(tempValue[0]), dayjs(tempValue[1])] : undefined}
            onChange={(dates) => {
              if (dates && dates[0] && dates[1]) {
                setTempValue([dates[0].toISOString(), dates[1].toISOString()])
              } else {
                setTempValue(undefined)
              }
            }}
            style={{ width: '100%', minWidth: 250 }}
            showTime
            format="YYYY-MM-DD HH:mm:ss"
          />
        )

      case 'number':
        return (
          <div className="flex gap-2" style={{ minWidth: 200 }}>
            <InputNumber
              value={tempValue?.min}
              onChange={(value) => setTempValue((prev: any) => ({ ...prev, min: value }))}
              placeholder="Min"
              style={{ flex: 1 }}
            />
            <InputNumber
              value={tempValue?.max}
              onChange={(value) => setTempValue((prev: any) => ({ ...prev, max: value }))}
              placeholder="Max"
              style={{ flex: 1 }}
            />
          </div>
        )

      case 'text':
      default:
        return (
          <Input
            value={tempValue || ''}
            onChange={(e) => setTempValue(e.target.value)}
            placeholder={`Search ${String(column.id)}...`}
            prefix={<SearchOutlined />}
            allowClear
            style={{ width: '100%', minWidth: 200 }}
          />
        )
    }
  }

  return (
    <div className={clsx('p-2', className)}>
      <div className="flex items-center gap-2 mb-2">
        <FilterOutlined className="text-blue-600" />
        <span className="font-medium text-sm">Filter {String(column.id)}</span>
        {columnFilterValue !== undefined && columnFilterValue !== null && (
          <Button
            type="text"
            size="small"
            icon={<ClearOutlined />}
            onClick={handleClear}
            className="text-gray-400 hover:text-red-500"
          />
        )}
      </div>
      <Divider className="my-2" />
      {renderFilter()}
      {uniqueValues.length > 0 && filterType === 'select' && (
        <div className="mt-2 text-xs text-gray-500">
          {String(uniqueValues.length)} unique values
        </div>
      )}
    </div>
  )
}