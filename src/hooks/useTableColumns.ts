/**
 * Table Columns Hook (Simplified)
 *
 * Converts field detection results to TanStack Table column definitions.
 * Works with the new simplified table architecture.
 */

import { useMemo } from 'react'

import type { ColumnDef, ColumnSizingState } from '@tanstack/react-table'

import type { EntityType } from '../types/api'
import type { FieldMapping } from '../types/export'
import { createColumnsFromFields } from '../utils/table-columns'

import type { UseFieldDetectionResult } from './useFieldDetection'

export interface UseTableColumnsOptions<T = any> {
  /** Field detection result */
  fieldDetection: UseFieldDetectionResult

  /** Entity type for column behavior */
  entityType: EntityType

  /** Current column sizing state */
  columnSizing: ColumnSizingState

  /** Tenant slug for tenant-aware column caching */
  tenantSlug?: string
}

/**
 * Generate table columns from field detection results
 * Simplified to work with the new table architecture
 */
export function useTableColumns<T = any>(
  options: UseTableColumnsOptions<T>
): ColumnDef<T>[] {
  const { fieldDetection, entityType, columnSizing, tenantSlug } = options

  // Convert field mappings to standard format with tenant-aware caching
  const fieldMappings: FieldMapping[] = useMemo(() => {
    return fieldDetection.includedFields.map(field => ({
      key: field.key,
      label: field.label,
      type: field.type,
      include: true, // Only included fields are passed here
      source: field.key.startsWith('custom.') ? 'custom' : 'standard',
      customFieldConfig: field.customFieldConfig,
      width: field.width
    }))
  }, [fieldDetection.includedFields, tenantSlug])

  // Create columns using the utility function with tenant-aware caching
  const columns = useMemo((): ColumnDef<T>[] => {
    // If field detection hasn't completed yet, return empty columns
    if (fieldDetection.isLoading || fieldMappings.length === 0) {
      return []
    }

    return createColumnsFromFields<T>(fieldMappings, entityType, columnSizing)
  }, [fieldMappings, entityType, columnSizing, fieldDetection.isLoading, tenantSlug])

  return columns
}