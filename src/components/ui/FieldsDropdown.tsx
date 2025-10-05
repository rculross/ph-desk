/**
 * Centralized Fields Dropdown Component
 *
 * Reusable dropdown for field selection with consistent styling and behavior.
 * Supports both custom field entities (Issues) and standard entities (Workflows).
 */

import React from 'react'

import { SettingOutlined } from '@ant-design/icons'

import type { UseFieldDetectionResult } from '../../hooks/useFieldDetection'
import { useFieldsDropdown } from '../../hooks/useFieldsDropdown'
import type { EntityType } from '../../types/api'
import type { FieldMapping } from '../../types/export'

export interface FieldsDropdownProps {
  /** Field detection result */
  fieldDetection: UseFieldDetectionResult

  /** Entity type for field categorization */
  entityType: EntityType

  /** Whether this entity supports custom fields */
  customFieldSupport?: boolean

  /** Whether dropdown is currently visible */
  isVisible: boolean

  /** Function to toggle field inclusion */
  onToggleField: (fieldKey: string) => void

  /** Function to select all fields */
  onSelectAll: () => void

  /** Function to deselect all fields */
  onDeselectAll: () => void

  /** Function to handle manage/reorder action */
  onManage?: () => void

  /** Additional CSS classes */
  className?: string
}

/**
 * Reusable fields dropdown component
 */
export function FieldsDropdown({
  fieldDetection,
  entityType,
  customFieldSupport = false,
  isVisible,
  onToggleField,
  onSelectAll,
  onDeselectAll,
  onManage,
  className = ''
}: FieldsDropdownProps) {
  const dropdown = useFieldsDropdown({
    fieldDetection,
    entityType,
    customFieldSupport
  })

  if (!isVisible) {
    return null
  }

  const categorizedFields = dropdown.getCategorizedFields()

  /**
   * Helper function to sort fields alphabetically
   */
  const sortFields = (fields: FieldMapping[]) =>
    fields.sort((a, b) => a.label.localeCompare(b.label))

  /**
   * Render a group of fields with a title
   */
  const renderFieldGroup = (fields: FieldMapping[], title: string) => (
    <div key={title}>
      {fields.length > 0 && (
        <div className='text-xs font-medium text-gray-500 mt-3 mb-1 uppercase tracking-wide'>
          {title}
        </div>
      )}
      {fields.map(field => {
        // Get the current checked state from live field data
        const currentField = fieldDetection.fieldMappings.find(f => f.key === field.key)
        const isChecked = currentField?.include ?? field.include

        return (
          <label
            key={field.key}
            className='flex items-center gap-2 text-sm cursor-pointer hover:bg-gray-50 p-1 rounded'
          >
            <input
              type='checkbox'
              checked={isChecked}
              onChange={() => onToggleField(field.key)}
              className='h-4 w-4 rounded border-2 border-gray-300 text-blue-600 focus:ring-2 focus:ring-blue-500 focus:ring-offset-0 flex-shrink-0'
            />
            <span className={`${isChecked ? 'text-gray-900' : 'text-gray-500'} truncate`}>
              {field.label}
            </span>
          </label>
        )
      })}
    </div>
  )

  return (
    <div className={`absolute left-0 top-full z-50 mt-1 w-[480px] max-w-2xl rounded-md border border-gray-200 bg-white shadow-lg ${className}`}>
      <div className='p-4'>
        <div className='flex items-center justify-between mb-3'>
          <h4 className='font-medium text-gray-900 text-base'>Export Fields</h4>
          <div className='flex gap-2 items-center'>
            <button
              onClick={onSelectAll}
              className='text-sm text-blue-600 hover:text-blue-800'
            >
              All
            </button>
            <button
              onClick={onDeselectAll}
              className='text-sm text-gray-600 hover:text-gray-800'
            >
              None
            </button>
            {onManage && (
              <button
                onClick={onManage}
                className='flex items-center gap-1 text-sm text-gray-600 hover:text-gray-800 px-2 py-1 rounded hover:bg-gray-100'
              >
                <SettingOutlined className='text-xs' />
                Manage
              </button>
            )}
          </div>
        </div>

        <div className='max-h-[60vh] overflow-y-auto space-y-1'>
          {/* Selected fields at the top - maintain original order */}
          {categorizedFields.selectedFields.length > 0 &&
            renderFieldGroup(categorizedFields.selectedFields, 'Selected')
          }

          {/* Unselected system fields */}
          {renderFieldGroup(sortFields(categorizedFields.systemFields), 'System')}

          {/* Custom fields sections (only for entities that support them) */}
          {customFieldSupport && (
            <>
              {/* Unselected custom visible fields */}
              {renderFieldGroup(sortFields(categorizedFields.customVisibleFields), 'Custom')}

              {/* Unselected custom hidden fields */}
              {renderFieldGroup(sortFields(categorizedFields.customHiddenFields), 'Hidden')}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

/**
 * Wrapper component that handles the toggle logic automatically
 */
export interface FieldsDropdownWrapperProps extends Omit<FieldsDropdownProps, 'isVisible'> {
  /** Control object from useToggleControl */
  fieldsControl: {
    isActive: boolean
    toggle: () => void
  }
}

export function FieldsDropdownWrapper({
  fieldsControl,
  fieldDetection,
  entityType,
  customFieldSupport = false,
  onToggleField,
  onSelectAll,
  onDeselectAll,
  onManage,
  className
}: FieldsDropdownWrapperProps) {
  const dropdown = useFieldsDropdown({
    fieldDetection,
    entityType,
    customFieldSupport
  })

  // Enhanced toggle handler that manages layout freezing
  const handleToggle = React.useCallback(() => {
    dropdown.handleToggle(fieldsControl.toggle)
  }, [dropdown, fieldsControl.toggle])

  return (
    <>
      {/* This component doesn't render the button - that's handled by the parent */}
      <FieldsDropdown
        fieldDetection={fieldDetection}
        entityType={entityType}
        customFieldSupport={customFieldSupport}
        isVisible={fieldsControl.isActive}
        onToggleField={onToggleField}
        onSelectAll={onSelectAll}
        onDeselectAll={onDeselectAll}
        onManage={onManage}
        className={className}
      />
    </>
  )
}

export { useFieldsDropdown } from '../../hooks/useFieldsDropdown'
export type {
  CategorizedFields,
  UseFieldsDropdownOptions,
  UseFieldsDropdownResult
} from '../../hooks/useFieldsDropdown'