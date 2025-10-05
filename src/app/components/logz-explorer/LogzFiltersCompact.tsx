/**
 * Logz Filters Compact Component
 *
 * Compact filter controls for the ToolHeader toolbar.
 * Provides all filtering functionality in a space-efficient horizontal layout.
 */

import { useCallback } from 'react'

import { DatePicker, Select, Input, Button, Space } from 'antd'
import { Search, X } from 'lucide-react'

import {
  ALL_MODELS,
  ALL_OPERATIONS,
  ALL_ACTOR_TYPES,
  getDateRangeValue,
  hasActiveFilters as filtersAreActive,
  handleDateRangeChange as onDateRangeChange,
  handleModelsChange as onModelsChange,
  handleOperationsChange as onOperationsChange,
  handleActorTypesChange as onActorTypesChange,
  handleEntityIdChange as onEntityIdChange,
  handleSearchChange as onSearchChange,
  handleClearAllFilters as onClearAllFilters,
  isDateDisabled
} from '../../../components/logz-explorer/logzFilterConfig'
import { useLogzFilters, useLogzActions } from '../../../stores/logz.store'
import { LOGZ_CONSTRAINTS } from '../../../types/logz.types'

const { RangePicker } = DatePicker
const { Option } = Select

export function LogzFiltersCompact() {
  const filters = useLogzFilters()
  const { updateFilters, clearFilters } = useLogzActions()

  // Convert date strings to dayjs objects for DatePicker
  const dateRange = getDateRangeValue(filters)

  // Handle date range change
  const handleDateRangeChange = useCallback(
    (dates: Parameters<typeof onDateRangeChange>[1]) => {
      onDateRangeChange(updateFilters, dates)
    },
    [updateFilters]
  )

  // Handle model change
  const handleModelChange = useCallback(
    (models: Parameters<typeof onModelsChange>[1]) => {
      onModelsChange(updateFilters, models)
    },
    [updateFilters]
  )

  // Handle operations change
  const handleOperationsChange = useCallback(
    (operations: Parameters<typeof onOperationsChange>[1]) => {
      onOperationsChange(updateFilters, operations)
    },
    [updateFilters]
  )

  // Handle actor types change
  const handleActorTypesChange = useCallback(
    (actorTypes: Parameters<typeof onActorTypesChange>[1]) => {
      onActorTypesChange(updateFilters, actorTypes)
    },
    [updateFilters]
  )

  // Handle entity ID change
  const handleEntityIdChange = useCallback(
    (event: Parameters<typeof onEntityIdChange>[1]) => {
      onEntityIdChange(updateFilters, event)
    },
    [updateFilters]
  )

  // Handle search change
  const handleSearchChange = useCallback(
    (event: Parameters<typeof onSearchChange>[1]) => {
      onSearchChange(updateFilters, event)
    },
    [updateFilters]
  )

  // Handle clear filters
  const handleClearFilters = useCallback(() => {
    onClearAllFilters(clearFilters)
  }, [clearFilters])

  // Check if filters are active
  const hasActiveFilters = filtersAreActive(filters)

  return (
    <Space size="middle" wrap>
      {/* Date Range */}
      <RangePicker
        value={dateRange}
        onChange={handleDateRangeChange}
        format="MM-DD-YYYY"
        allowClear={false}
        size="small"
        placeholder={['Start', 'End']}
        style={{ width: 240 }}
        disabledDate={(current) =>
          isDateDisabled(current, dateRange, LOGZ_CONSTRAINTS.MAX_DATE_RANGE_DAYS)
        }
      />

      {/* Objects */}
      <Select
        mode="multiple"
        placeholder="Objects"
        value={filters.models}
        onChange={handleModelChange}
        size="small"
        style={{ width: 175 }}
        maxTagCount={1}
        maxTagPlaceholder={(omittedValues) => `+${omittedValues.length}`}
        showSearch
        filterOption={(input, option) =>
          option?.children?.toString().toLowerCase().includes(input.toLowerCase()) ?? false
        }
      >
        {ALL_MODELS.map(model => (
          <Option key={model} value={model}>
            {model}
          </Option>
        ))}
      </Select>

      {/* Actions */}
      <Select
        mode="multiple"
        placeholder="Actions"
        value={filters.operations}
        onChange={handleOperationsChange}
        size="small"
        style={{ width: 125 }}
        maxTagCount={1}
        maxTagPlaceholder={(omittedValues) => `+${omittedValues.length}`}
      >
        {ALL_OPERATIONS.map(operation => (
          <Option key={operation} value={operation}>
            {operation}
          </Option>
        ))}
      </Select>

      {/* Actor Types */}
      <Select
        mode="multiple"
        placeholder="Actors"
        value={filters.actorTypes}
        onChange={handleActorTypesChange}
        size="small"
        style={{ width: 125 }}
        maxTagCount={1}
        maxTagPlaceholder={(omittedValues) => `+${omittedValues.length}`}
      >
        {ALL_ACTOR_TYPES.map(actorType => (
          <Option key={actorType} value={actorType}>
            {actorType}
          </Option>
        ))}
      </Select>

      {/* Entity ID */}
      <Input
        placeholder="Entity ID"
        value={filters.entityId}
        onChange={handleEntityIdChange}
        size="small"
        style={{ width: 90 }}
        allowClear
      />

      {/* Search */}
      <Input
        placeholder="Search"
        value={filters.searchTerm}
        onChange={handleSearchChange}
        size="small"
        style={{ width: 100 }}
        prefix={<Search className="h-3 w-3 text-gray-400" />}
        allowClear
      />

      {/* Clear All Filters */}
      {hasActiveFilters && (
        <Button
          type="text"
          size="small"
          icon={<X className="h-3 w-3" />}
          onClick={handleClearFilters}
          className="text-gray-500 hover:text-red-600"
          title="Clear all filters"
        />
      )}
    </Space>
  )
}