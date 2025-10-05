/**
 * Logz Filters Component
 *
 * Filter controls for the Logz Explorer including date range,
 * models, operations, actor types, entity ID, and search.
 */

import { useCallback } from 'react'

import { DatePicker, Select, Input, Button, Space, Row, Col, Tag } from 'antd'
import { Search, X, Calendar, Filter } from 'lucide-react'

import {
  ALL_MODELS,
  ALL_OPERATIONS,
  ALL_ACTOR_TYPES,
  QUICK_DATE_FILTERS,
  getDateRangeValue,
  hasActiveFilters as filtersAreActive,
  handleDateRangeChange as onDateRangeChange,
  handleQuickDateFilter as onQuickDateFilter,
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

export function LogzFilters() {
  const filters = useLogzFilters()
  const { updateFilters, clearFilters, applyQuickDateFilter } = useLogzActions()

  // Convert date strings to dayjs objects for DatePicker
  const dateRange = getDateRangeValue(filters)

  // Handle date range change
  const handleDateRangeChange = useCallback(
    (dates: Parameters<typeof onDateRangeChange>[1]) => {
      onDateRangeChange(updateFilters, dates)
    },
    [updateFilters]
  )

  // Handle quick date filter
  const handleQuickDateFilter = useCallback(
    (daysAgo: Parameters<typeof onQuickDateFilter>[1]) => {
      onQuickDateFilter(applyQuickDateFilter, daysAgo)
    },
    [applyQuickDateFilter]
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
    <div className="space-y-4">
      {/* Quick Date Filters */}
      <div>
        <div className="mb-2 flex items-center gap-2">
          <Calendar className="h-4 w-4 text-gray-500" />
          <span className="text-sm font-medium text-gray-700">Quick Filters</span>
        </div>
        <Space wrap>
          {QUICK_DATE_FILTERS.map(filter => (
            <Button
              key={filter.value}
              size="small"
              onClick={() => handleQuickDateFilter(filter.value)}
            >
              {filter.label}
            </Button>
          ))}
        </Space>
      </div>

      {/* Date Range */}
      <Row gutter={16}>
        <Col span={12}>
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">
              Date Range (max {LOGZ_CONSTRAINTS.MAX_DATE_RANGE_DAYS} days)
            </label>
            <RangePicker
              value={dateRange}
              onChange={handleDateRangeChange}
              format="YYYY-MM-DD"
              allowClear={false}
              className="w-full"
              disabledDate={(current) =>
                isDateDisabled(current, dateRange, LOGZ_CONSTRAINTS.MAX_DATE_RANGE_DAYS)
              }
            />
          </div>
        </Col>
        <Col span={12}>
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">
              Entity ID
            </label>
            <Input
              placeholder="Filter by entity ID"
              value={filters.entityId}
              onChange={handleEntityIdChange}
              allowClear
            />
          </div>
        </Col>
      </Row>

      {/* Model and Operations */}
      <Row gutter={16}>
        <Col span={12}>
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">
              Models
            </label>
            <Select
              mode="multiple"
              placeholder="Select models"
              value={filters.models}
              onChange={handleModelChange}
              className="w-full"
              showSearch
              filterOption={(input, option) =>
                option?.children?.toString().toLowerCase().includes(input.toLowerCase()) ?? false
              }
              maxTagCount="responsive"
            >
              {ALL_MODELS.map(model => (
                <Option key={model} value={model}>
                  {model}
                </Option>
              ))}
            </Select>
          </div>
        </Col>
        <Col span={12}>
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">
              Operations
            </label>
            <Select
              mode="multiple"
              placeholder="Select operations"
              value={filters.operations}
              onChange={handleOperationsChange}
              className="w-full"
              maxTagCount="responsive"
            >
              {ALL_OPERATIONS.map(operation => (
                <Option key={operation} value={operation}>
                  {operation}
                </Option>
              ))}
            </Select>
          </div>
        </Col>
      </Row>

      {/* Actor Types and Search */}
      <Row gutter={16}>
        <Col span={12}>
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">
              Actor Types
            </label>
            <Select
              mode="multiple"
              placeholder="Select actor types"
              value={filters.actorTypes}
              onChange={handleActorTypesChange}
              className="w-full"
              maxTagCount="responsive"
            >
              {ALL_ACTOR_TYPES.map(actorType => (
                <Option key={actorType} value={actorType}>
                  {actorType}
                </Option>
              ))}
            </Select>
          </div>
        </Col>
        <Col span={12}>
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">
              Search
            </label>
            <Input
              placeholder="Search in logs..."
              value={filters.searchTerm}
              onChange={handleSearchChange}
              prefix={<Search className="h-4 w-4 text-gray-400" />}
              allowClear
            />
          </div>
        </Col>
      </Row>

      {/* Active Filters & Actions */}
      {hasActiveFilters && (
        <div className="flex items-center justify-between rounded-md bg-blue-50 p-3">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-blue-600" />
            <span className="text-sm font-medium text-blue-900">Active Filters:</span>
            <div className="flex flex-wrap gap-1">
              {filters.models.length > 0 && (
                <Tag color="blue">{filters.models.length} model(s)</Tag>
              )}
              {filters.operations.length > 0 && (
                <Tag color="green">{filters.operations.length} operation(s)</Tag>
              )}
              {filters.actorTypes.length > 0 && (
                <Tag color="purple">{filters.actorTypes.length} actor type(s)</Tag>
              )}
              {filters.entityId.trim() && (
                <Tag color="orange">Entity ID</Tag>
              )}
              {filters.searchTerm.trim() && (
                <Tag color="red">Search</Tag>
              )}
            </div>
          </div>
          <Button
            type="text"
            size="small"
            icon={<X className="h-4 w-4" />}
            onClick={handleClearFilters}
          >
            Clear All
          </Button>
        </div>
      )}
    </div>
  )
}