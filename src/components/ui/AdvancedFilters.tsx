/**
 * Advanced Filters Component
 *
 * Provides preset filters, filter combinations, and advanced filter management
 * for TanStack Table implementations.
 */

import React, { useState, useMemo, useCallback } from 'react'

import { FilterOutlined, SaveOutlined, DeleteOutlined, MoreOutlined, PlusOutlined, ClearOutlined } from '@ant-design/icons'
import type { Table, ColumnFiltersState } from '@tanstack/react-table'
import { Button, Dropdown, Space, Tag, Divider, Input, Modal, Form, Select, notification } from 'antd'
import { clsx } from 'clsx'

export interface FilterPreset {
  id: string
  name: string
  description?: string
  columnFilters: ColumnFiltersState
  globalFilter?: any
  createdAt: string
}

export interface AdvancedFiltersProps<TData> {
  table: Table<TData>
  className?: string
  onPresetSave?: (preset: FilterPreset) => void
  onPresetLoad?: (preset: FilterPreset) => void
  onPresetDelete?: (presetId: string) => void
  presets?: FilterPreset[]
  showClearAll?: boolean
  showSavePreset?: boolean
  showQuickActions?: boolean
}

/**
 * Advanced filter management component
 */
export function AdvancedFilters<TData>({
  table,
  className,
  onPresetSave,
  onPresetLoad,
  onPresetDelete,
  presets = [],
  showClearAll = true,
  showSavePreset = true,
  showQuickActions = true
}: AdvancedFiltersProps<TData>) {
  const [savePresetModalOpen, setSavePresetModalOpen] = useState(false)
  const [presetForm] = Form.useForm()

  // Current filter state
  const columnFilters = table.getState().columnFilters
  const globalFilter = table.getState().globalFilter
  const hasActiveFilters = columnFilters.length > 0 || globalFilter

  // Active column filters summary
  const activeFiltersInfo = useMemo(() => {
    return columnFilters.map(filter => {
      const column = table.getColumn(filter.id)
      const columnName = column?.columnDef.header || filter.id
      return {
        id: filter.id,
        name: String(columnName),
        value: filter.value,
        type: Array.isArray(filter.value) ? 'multi-select' : 'text'
      }
    })
  }, [columnFilters, table])

  // Clear all filters
  const handleClearAll = useCallback(() => {
    table.resetColumnFilters()
    table.resetGlobalFilter()
  }, [table])

  // Save current filters as preset
  const handleSavePreset = useCallback(() => {
    if (!hasActiveFilters) {
      notification.warning({
        message: 'No Filters to Save',
        description: 'Please apply some filters before saving a preset.'
      })
      return
    }
    setSavePresetModalOpen(true)
  }, [hasActiveFilters])

  // Handle preset save form submission
  const handlePresetSaveSubmit = useCallback(async () => {
    try {
      const values = await presetForm.validateFields()
      const preset: FilterPreset = {
        id: `preset_${Date.now()}`,
        name: values.name,
        description: values.description,
        columnFilters,
        globalFilter,
        createdAt: new Date().toISOString()
      }

      onPresetSave?.(preset)
      setSavePresetModalOpen(false)
      presetForm.resetFields()
      notification.success({
        message: 'Preset Saved',
        description: `Filter preset "${preset.name}" has been saved successfully.`
      })
    } catch (error) {
      console.error('Failed to save preset:', error)
    }
  }, [presetForm, columnFilters, globalFilter, onPresetSave])

  // Load a preset
  const handlePresetLoad = useCallback((preset: FilterPreset) => {
    // Clear existing filters first
    table.resetColumnFilters()
    table.resetGlobalFilter()

    // Apply preset filters
    if (preset.columnFilters.length > 0) {
      table.setColumnFilters(preset.columnFilters)
    }
    if (preset.globalFilter) {
      table.setGlobalFilter(preset.globalFilter)
    }

    onPresetLoad?.(preset)
    notification.success({
      message: 'Preset Loaded',
      description: `Filter preset "${preset.name}" has been applied.`
    })
  }, [table, onPresetLoad])

  // Delete a preset
  const handlePresetDelete = useCallback((preset: FilterPreset) => {
    Modal.confirm({
      title: 'Delete Filter Preset',
      content: `Are you sure you want to delete the preset "${preset.name}"?`,
      okText: 'Delete',
      okType: 'danger',
      onOk: () => {
        onPresetDelete?.(preset.id)
        notification.success({
          message: 'Preset Deleted',
          description: `Filter preset "${preset.name}" has been deleted.`
        })
      }
    })
  }, [onPresetDelete])

  // Quick action presets
  const quickActions = useMemo(() => [
    {
      key: 'clear-all',
      label: 'Clear All Filters',
      icon: <ClearOutlined />,
      onClick: handleClearAll,
      disabled: !hasActiveFilters
    },
    {
      key: 'save-preset',
      label: 'Save Current Filters',
      icon: <SaveOutlined />,
      onClick: handleSavePreset,
      disabled: !hasActiveFilters
    }
  ], [handleClearAll, handleSavePreset, hasActiveFilters])

  // Preset dropdown menu
  const presetMenuItems = useMemo(() => {
    const items = []

    if (presets.length > 0) {
      items.push({
        key: 'presets-header',
        label: <div className="font-medium text-gray-700">Saved Presets</div>,
        disabled: true
      })

      presets.forEach(preset => {
        items.push({
          key: preset.id,
          label: (
            <div className="flex items-center justify-between min-w-[200px]">
              <div className="flex-1">
                <div className="font-medium">{preset.name}</div>
                {preset.description && (
                  <div className="text-xs text-gray-500">{preset.description}</div>
                )}
              </div>
              <Button
                type="text"
                size="small"
                icon={<DeleteOutlined />}
                onClick={(e) => {
                  e.stopPropagation()
                  handlePresetDelete(preset)
                }}
                className="text-red-500 hover:text-red-700"
              />
            </div>
          ),
          onClick: () => handlePresetLoad(preset)
        })
      })

      items.push({ type: 'divider' as const })
    }

    if (showQuickActions) {
      quickActions.forEach(action => {
        items.push({
          key: action.key,
          label: action.label,
          icon: action.icon,
          disabled: action.disabled,
          onClick: action.onClick
        })
      })
    }

    return items
  }, [presets, quickActions, showQuickActions, handlePresetLoad, handlePresetDelete])

  return (
    <div className={clsx('space-y-3', className)}>
      {/* Filter Actions Bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FilterOutlined className="text-gray-500" />
          <span className="text-sm font-medium text-gray-700">Advanced Filters</span>
          {hasActiveFilters && (
            <Tag color="blue">{columnFilters.length + (globalFilter ? 1 : 0)} active</Tag>
          )}
        </div>

        <Space size="small">
          {showSavePreset && (
            <Button
              size="small"
              icon={<SaveOutlined />}
              onClick={handleSavePreset}
              disabled={!hasActiveFilters}
              title="Save current filters as preset"
            >
              Save Preset
            </Button>
          )}

          <Dropdown
            menu={{ items: presetMenuItems }}
            trigger={['click']}
            placement="bottomRight"
          >
            <Button size="small" icon={<MoreOutlined />} />
          </Dropdown>

          {showClearAll && (
            <Button
              size="small"
              icon={<ClearOutlined />}
              onClick={handleClearAll}
              disabled={!hasActiveFilters}
              title="Clear all filters"
            >
              Clear All
            </Button>
          )}
        </Space>
      </div>

      {/* Active Filters Display */}
      {hasActiveFilters && (
        <div className="rounded-md bg-blue-50 p-3">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-sm font-medium text-blue-900">Active Filters:</span>
          </div>
          <div className="flex flex-wrap gap-1">
            {globalFilter && (
              <Tag
                color="green"
                closable
                onClose={() => table.resetGlobalFilter()}
              >
                Global: {String(globalFilter)}
              </Tag>
            )}
            {activeFiltersInfo.map(filter => (
              <Tag
                key={filter.id}
                color="blue"
                closable
                onClose={() => table.getColumn(filter.id)?.setFilterValue(undefined)}
              >
                {filter.name}: {
                  filter.type === 'multi-select' && Array.isArray(filter.value)
                    ? `${filter.value.length} selected`
                    : String(filter.value)
                }
              </Tag>
            ))}
          </div>
        </div>
      )}

      {/* Save Preset Modal */}
      <Modal
        title="Save Filter Preset"
        open={savePresetModalOpen}
        onOk={handlePresetSaveSubmit}
        onCancel={() => {
          setSavePresetModalOpen(false)
          presetForm.resetFields()
        }}
        okText="Save Preset"
        cancelText="Cancel"
      >
        <Form
          form={presetForm}
          layout="vertical"
          initialValues={{ name: '', description: '' }}
        >
          <Form.Item
            name="name"
            label="Preset Name"
            rules={[
              { required: true, message: 'Please enter a preset name' },
              { max: 50, message: 'Name must be less than 50 characters' }
            ]}
          >
            <Input placeholder="Enter a name for this filter preset" />
          </Form.Item>
          <Form.Item
            name="description"
            label="Description (optional)"
            rules={[
              { max: 200, message: 'Description must be less than 200 characters' }
            ]}
          >
            <Input.TextArea
              placeholder="Describe what this filter preset is for"
              rows={3}
            />
          </Form.Item>
          <div className="text-sm text-gray-500">
            <div className="mb-1 font-medium">This preset will save:</div>
            <ul className="list-disc list-inside space-y-1">
              {columnFilters.length > 0 && (
                <li>{columnFilters.length} column filter{columnFilters.length > 1 ? 's' : ''}</li>
              )}
              {globalFilter && <li>Global search: "{globalFilter}"</li>}
            </ul>
          </div>
        </Form>
      </Modal>
    </div>
  )
}