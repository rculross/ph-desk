/**
 * Salesforce Search Controls
 *
 * Composes the shared GlobalSearchInput with Salesforce-specific filter
 * controls so the integration reuses the same search experience as other
 * exporter tables while still exposing domain filters.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react'

import { FilterOutlined, ClearOutlined } from '@ant-design/icons'
import type { Table } from '@tanstack/react-table'
import { Button, Dropdown, InputNumber, Select, Space, Tag } from 'antd'
import { clsx } from 'clsx'

import { useSalesforceSearch } from '../../stores/salesforce-integration.store'
import type {
  SalesforceDirection,
  SalesforceFieldMapping,
  SalesforceFieldType
} from '../../types/integrations/salesforce.types'
import { AdvancedFilters } from '../ui/AdvancedFilters'
import { GlobalSearchInput } from '../ui/GlobalSearchInput'

const DIRECTION_OPTIONS = [
  { label: 'From SF', value: 'fromSF' as SalesforceDirection },
  { label: 'To SF', value: 'toSF' as SalesforceDirection },
  { label: 'Both', value: 'both' as SalesforceDirection },
  { label: 'None', value: 'none' as SalesforceDirection }
]

const FIELD_TYPE_OPTIONS = [
  { label: 'String', value: 'string' as SalesforceFieldType },
  { label: 'Number', value: 'double' as SalesforceFieldType },
  { label: 'Date', value: 'date' as SalesforceFieldType },
  { label: 'DateTime', value: 'datetime' as SalesforceFieldType },
  { label: 'Boolean', value: 'boolean' as SalesforceFieldType },
  { label: 'Picklist', value: 'picklist' as SalesforceFieldType },
  { label: 'Multi-picklist', value: 'multipicklist' as SalesforceFieldType },
  { label: 'User', value: 'user' as SalesforceFieldType },
  { label: 'Reference', value: 'reference' as SalesforceFieldType },
  { label: 'Email', value: 'email' as SalesforceFieldType },
  { label: 'URL', value: 'url' as SalesforceFieldType },
  { label: 'Currency', value: 'currency' as SalesforceFieldType },
  { label: 'Percent', value: 'percent' as SalesforceFieldType }
]

export interface SalesforceSearchBarProps {
  table: Table<SalesforceFieldMapping>
  className?: string
}

interface FilterChip {
  key: string
  label: string
}

function buildFilterChips(searchFilters: ReturnType<typeof useSalesforceSearch>['searchFilters']): FilterChip[] {
  const chips: FilterChip[] = []

  if (searchFilters.direction && searchFilters.direction.length > 0) {
    chips.push({
      key: 'direction',
      label: `Directions: ${searchFilters.direction.join(', ')}`
    })
  }

  if (searchFilters.fieldTypes && searchFilters.fieldTypes.length > 0) {
    chips.push({
      key: 'fieldTypes',
      label: `SF Types: ${searchFilters.fieldTypes.join(', ')}`
    })
  }

  if (typeof searchFilters.minFieldCount === 'number') {
    chips.push({
      key: 'minFieldCount',
      label: `Min fields ≥ ${searchFilters.minFieldCount}`
    })
  }

  if (typeof searchFilters.maxFieldCount === 'number') {
    chips.push({
      key: 'maxFieldCount',
      label: `Max fields ≤ ${searchFilters.maxFieldCount}`
    })
  }

  return chips
}

function useColumnFilterSync(
  table: Table<SalesforceFieldMapping>,
  columnId: string,
  value: unknown
) {
  useEffect(() => {
    const column = table.getColumn(columnId)
    if (!column) return

    column.setFilterValue(value ?? undefined)
  }, [table, columnId, value])
}

export function SalesforceSearchBar({ table, className }: SalesforceSearchBarProps) {
  const {
    searchTerm,
    searchFilters,
    setSearchFilters,
    resetSearchFilters,
    clearSearch
  } = useSalesforceSearch()

  const [filtersOpen, setFiltersOpen] = useState(false)

  const handleFilterChange = useCallback((key: keyof typeof searchFilters, value: any) => {
    setSearchFilters({ [key]: value })
  }, [setSearchFilters])

  const handleClearAll = useCallback(() => {
    table.setGlobalFilter('')
    table.resetColumnFilters()
    clearSearch()
  }, [table, clearSearch])

  const hasActiveFilters = useMemo(() => {
    return buildFilterChips(searchFilters).length > 0
  }, [searchFilters])

  const filterChips = useMemo(() => buildFilterChips(searchFilters), [searchFilters])

  const filteredRowCount = table.getFilteredRowModel().rows.length
  const totalRowCount = table.getCoreRowModel().rows.length

  useColumnFilterSync(table, 'direction', searchFilters.direction?.length ? searchFilters.direction : undefined)
  useColumnFilterSync(table, 'sfType', searchFilters.fieldTypes?.length ? searchFilters.fieldTypes : undefined)

  const filtersContent = (
    <div className="min-w-[320px] space-y-4 p-4">
      <div className="space-y-2">
        <div className="text-xs font-medium text-gray-500 uppercase tracking-wide">
          Sync Direction
        </div>
        <Select
          mode="multiple"
          allowClear
          placeholder="All directions"
          value={searchFilters.direction}
          onChange={(value) => handleFilterChange('direction', value.length ? value : undefined)}
          options={DIRECTION_OPTIONS}
          className="w-full"
          size="middle"
          maxTagCount={3}
        />
      </div>

      <div className="space-y-2">
        <div className="text-xs font-medium text-gray-500 uppercase tracking-wide">
          Salesforce Field Types
        </div>
        <Select
          mode="multiple"
          allowClear
          placeholder="All field types"
          value={searchFilters.fieldTypes}
          onChange={(value) => handleFilterChange('fieldTypes', value.length ? value : undefined)}
          options={FIELD_TYPE_OPTIONS}
          className="w-full"
          size="middle"
          maxTagCount={3}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <div className="text-xs font-medium text-gray-500 uppercase tracking-wide">
            Min Fields
          </div>
          <InputNumber
            min={0}
            max={10000}
            value={searchFilters.minFieldCount}
            onChange={(value) => handleFilterChange('minFieldCount', typeof value === 'number' ? value : undefined)}
            className="w-full"
          />
        </div>
        <div className="space-y-2">
          <div className="text-xs font-medium text-gray-500 uppercase tracking-wide">
            Max Fields
          </div>
          <InputNumber
            min={0}
            max={10000}
            value={searchFilters.maxFieldCount}
            onChange={(value) => handleFilterChange('maxFieldCount', typeof value === 'number' ? value : undefined)}
            className="w-full"
          />
        </div>
      </div>

      <div className="flex items-center justify-between pt-2 border-t">
        <Button size="small" type="text" onClick={resetSearchFilters} disabled={!hasActiveFilters}>
          Reset Filters
        </Button>
        <Tag color="blue" hidden={!hasActiveFilters}>
          {filterChips.length} active
        </Tag>
      </div>
    </div>
  )

  return (
    <div className={clsx('space-y-3', className)}>
      <GlobalSearchInput
        table={table}
        placeholder="Search objects and fields..."
        debounceMs={300}
      />

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          {filterChips.map((chip) => (
            <Tag key={chip.key} color="geekblue">
              {chip.label}
            </Tag>
          ))}
        </div>

        <Space size="small">
          <Dropdown
            trigger={['click']}
            dropdownRender={() => filtersContent}
            open={filtersOpen}
            onOpenChange={setFiltersOpen}
            placement="bottomRight"
          >
            <Button icon={<FilterOutlined />} type={hasActiveFilters ? 'primary' : 'default'}>
              Filters
            </Button>
          </Dropdown>

          {(searchTerm || hasActiveFilters) && (
            <Button icon={<ClearOutlined />} onClick={handleClearAll}>
              Clear All
            </Button>
          )}
        </Space>
      </div>

      <div className="flex items-center justify-between text-xs text-gray-500">
        <span>
          Showing {filteredRowCount.toLocaleString()} of {totalRowCount.toLocaleString()} fields
        </span>
        {searchTerm && (
          <Tag color="blue" bordered={false}>
            Search: {searchTerm}
          </Tag>
        )}
      </div>

      <AdvancedFilters
        table={table}
        className="bg-gray-50/80 border border-gray-100 rounded-lg p-3"
        showQuickActions={false}
        showSavePreset={false}
        showClearAll={false}
      />
    </div>
  )
}

export default SalesforceSearchBar
