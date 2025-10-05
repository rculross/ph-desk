/**
 * Centralized Fields Dropdown Hook
 *
 * Provides consistent field dropdown behavior across all exporter components.
 * Handles frozen layouts, field categorization, and state management.
 */

import { useCallback, useRef } from 'react'

import type { EntityType } from '../types/api'
import type { FieldMapping } from '../types/export'

import type { UseFieldDetectionResult } from './useFieldDetection'

export interface CategorizedFields {
  selectedFields: FieldMapping[]
  systemFields: FieldMapping[]
  customVisibleFields: FieldMapping[]
  customHiddenFields: FieldMapping[]
}

export interface UseFieldsDropdownOptions {
  fieldDetection: UseFieldDetectionResult
  entityType: EntityType
  customFieldSupport?: boolean
}

export interface UseFieldsDropdownResult {
  /**
   * Get categorized fields with frozen layout support
   */
  getCategorizedFields: () => CategorizedFields

  /**
   * Handle dropdown toggle with layout freezing
   */
  handleToggle: (toggle: () => void) => void

  /**
   * Check if layout is frozen
   */
  isLayoutFrozen: boolean

  /**
   * Clear frozen layout
   */
  clearFrozenLayout: () => void

  /**
   * Freeze current layout
   */
  freezeLayout: () => void
}

/**
 * Centralized hook for managing fields dropdown behavior
 */
export function useFieldsDropdown(options: UseFieldsDropdownOptions): UseFieldsDropdownResult {
  const { fieldDetection, entityType, customFieldSupport = false } = options

  // Frozen layout reference to prevent jumping when dropdown is open
  const frozenLayoutRef = useRef<CategorizedFields | null>(null)

  /**
   * Categorize fields based on entity type and field properties
   */
  const categorizeFields = useCallback((
    allFields: FieldMapping[],
    useCustomFields: boolean
  ): CategorizedFields => {
    // Separate selected and unselected fields
    // Keep selected fields in their original order (table column order)
    const selectedFields = allFields.filter(f => f.include)

    const unselectedFields = allFields.filter(f => !f.include)

    if (!useCustomFields) {
      // For entities without custom fields (like workflows)
      return {
        selectedFields,
        systemFields: unselectedFields,
        customVisibleFields: [],
        customHiddenFields: []
      }
    }

    // For entities with custom fields (like issues)
    const systemFields = unselectedFields.filter(f => !f.key.startsWith('custom.'))

    const customVisibleFields = unselectedFields.filter(f =>
      f.key.startsWith('custom.') &&
      !(fieldDetection.detectionResult?.customFields.find(cf =>
        cf.key === f.key && cf.customFieldConfig?.isHidden === true
      ))
    )

    const customHiddenFields = unselectedFields.filter(f =>
      f.key.startsWith('custom.') &&
      fieldDetection.detectionResult?.customFields.find(cf =>
        cf.key === f.key && cf.customFieldConfig?.isHidden === true
      )
    )

    return {
      selectedFields,
      systemFields,
      customVisibleFields,
      customHiddenFields
    }
  }, [fieldDetection.detectionResult, customFieldSupport])

  /**
   * Get categorized fields, using frozen layout if available
   */
  const getCategorizedFields = useCallback((): CategorizedFields => {
    // Use frozen layout if available to prevent jumping
    if (frozenLayoutRef.current) {
      return frozenLayoutRef.current
    }

    // Calculate fresh layout
    return categorizeFields(fieldDetection.fieldMappings, customFieldSupport)
  }, [fieldDetection.fieldMappings, categorizeFields, customFieldSupport])

  /**
   * Freeze the current layout to prevent field jumping when dropdown is open
   */
  const freezeLayout = useCallback(() => {
    // Don't reorder when opening - just freeze current layout to prevent jumping
    frozenLayoutRef.current = categorizeFields(fieldDetection.fieldMappings, customFieldSupport)
  }, [fieldDetection.fieldMappings, categorizeFields, customFieldSupport])

  /**
   * Clear the frozen layout
   */
  const clearFrozenLayout = useCallback(() => {
    frozenLayoutRef.current = null
  }, [])

  /**
   * Handle dropdown toggle with automatic layout management
   */
  const handleToggle = useCallback((toggle: () => void) => {
    const wasActive = frozenLayoutRef.current !== null

    if (!wasActive) {
      // Opening dropdown - freeze the layout without reordering
      freezeLayout()
    } else {
      // Closing dropdown - reorder fields then clear frozen layout
      fieldDetection.reorderSelectedFields()
      clearFrozenLayout()
    }

    // Execute the actual toggle
    toggle()
  }, [freezeLayout, clearFrozenLayout, fieldDetection.reorderSelectedFields])

  return {
    getCategorizedFields,
    handleToggle,
    isLayoutFrozen: frozenLayoutRef.current !== null,
    clearFrozenLayout,
    freezeLayout
  }
}