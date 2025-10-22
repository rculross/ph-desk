/**
 * React Hook for Dynamic Field Detection
 *
 * Provides easy-to-use React hook for field detection across different entity types
 * with automatic caching, persistence, and state management.
 *
 * PERFORMANCE OPTIMIZATIONS:
 * - Extended cache staleTime to 20 minutes for tenant-specific field data
 * - Enhanced query key structure for better tenant-specific caching
 * - Tenant-specific cache invalidation utilities
 * - Field data is stable per tenant and only changes when tenant changes
 */

import { useState, useEffect, useCallback, useMemo } from 'react'

import { useQuery, useQueryClient } from '@tanstack/react-query'

import {
  fieldDetectionService,
  type FieldDetectionResult,
  type DetectedField,
  type ExtendedFieldMapping
} from '../services/field-detection.service'
import type { EntityType } from '../types/api'
import type { FieldMapping } from '../types/export'
import { logger } from '../utils/logger'

const log = logger.extension

export interface UseFieldDetectionOptions {
  entityType: EntityType
  sampleData?: any[]
  tenantSlug?: string
  enabled?: boolean
  gcTime?: number
  staleTime?: number
}

export interface UseFieldDetectionResult {
  // Detection results
  detectionResult: FieldDetectionResult | undefined
  standardFields: DetectedField[]
  customFields: DetectedField[]
  discoveredFields: DetectedField[]
  allFields: DetectedField[]

  // Field mappings for export
  fieldMappings: ExtendedFieldMapping[]
  includedFields: ExtendedFieldMapping[]
  excludedFields: ExtendedFieldMapping[]

  // State management
  isLoading: boolean
  isError: boolean
  error: Error | null
  isRefetching: boolean

  // Actions
  refetch: () => void
  updateFieldMapping: (key: string, updates: Partial<ExtendedFieldMapping>) => void
  toggleFieldInclusion: (key: string) => void
  reorderSelectedFields: () => void
  selectAllFields: () => void
  deselectAllFields: () => void
  saveFieldSelections: () => Promise<void>
  resetToDefaults: () => void
  setFieldMappings: (mappings: ExtendedFieldMapping[]) => void

  // Cache management
  invalidateTenantCache: (targetTenantSlug?: string) => Promise<void>

  // Column width persistence
  saveColumnWidths: (columnWidths: Record<string, number>) => Promise<void>
  loadColumnWidths: () => Promise<Record<string, number>>
  clearColumnWidths: (targetEntityType?: EntityType, targetTenantSlug?: string) => Promise<void>

  // Statistics
  stats: {
    totalFields: number
    includedCount: number
    standardCount: number
    customCount: number
    discoveredCount: number
  }
}

/**
 * Hook for dynamic field detection with React Query integration
 */
export function useFieldDetection(options: UseFieldDetectionOptions): UseFieldDetectionResult {
  const {
    entityType,
    sampleData,
    tenantSlug,
    enabled = true,
    gcTime = 5 * 60 * 1000, // 5 minutes
    staleTime = 20 * 60 * 1000   // 20 minutes - field data is tenant-specific and stable
  } = options

  // Access query client for tenant-specific cache operations
  const queryClient = useQueryClient()

  // Local state for field mappings
  const [fieldMappings, setFieldMappings] = useState<ExtendedFieldMapping[]>([])

  // Enhanced query key structure for better tenant-specific caching
  const queryKey = useMemo(() => [
    'field-detection',
    entityType,
    tenantSlug ?? 'default-tenant'
  ], [entityType, tenantSlug])

  // Query for field detection
  const {
    data: detectionResult,
    isLoading,
    isError,
    error,
    isRefetching,
    refetch
  } = useQuery({
    queryKey,
    queryFn: async (): Promise<FieldDetectionResult> => {
      log.debug('Starting field detection query', { 
        entityType, 
        tenantSlug, 
        sampleDataLength: sampleData?.length 
      })

      const result = await fieldDetectionService.detectFields(
        entityType,
        sampleData,
        tenantSlug
      )

      log.info('Field detection query completed', {
        entityType,
        tenantSlug,
        totalFields: result.allFields.length,
        standardCount: result.standardFields.length,
        customCount: result.customFields.length,
        discoveredCount: result.discoveredFields.length
      })

      return result
    },
    enabled,
    gcTime,
    staleTime,
    refetchOnWindowFocus: false,
    retry: (failureCount, error) => {
      // Only retry on network errors, not on API errors
      if (failureCount < 3 && error instanceof Error) {
        const isNetworkError = error.message.includes('network') || 
                              error.message.includes('fetch')
        return isNetworkError
      }
      return false
    }
  })

  // Update local field mappings when detection result changes
  useEffect(() => {
    if (detectionResult?.fieldMappings) {
      log.debug('Updating field mappings from detection result', {
        entityType,
        mappingCount: detectionResult.fieldMappings.length
      })
      setFieldMappings([...detectionResult.fieldMappings])
    }
  }, [detectionResult, entityType])

  // Field mapping operations
  const updateFieldMapping = useCallback((key: string, updates: Partial<ExtendedFieldMapping>) => {
    setFieldMappings(prev => {
      const field = prev.find(f => f.key === key)
      if (field) {
        log.debug('Updating field mapping', { 
          fieldKey: key, 
          fieldLabel: field.label, 
          updates 
        })
      }
      
      return prev.map(field => 
        field.key === key ? { ...field, ...updates } : field
      )
    })
  }, [])

  const toggleFieldInclusion = useCallback((key: string) => {
    setFieldMappings(prev => {
      const field = prev.find(f => f.key === key)
      const newIncludeState = !field?.include

      if (field) {
        log.debug('Toggling field inclusion', {
          fieldKey: key,
          fieldLabel: field.label,
          wasIncluded: field.include,
          willBeIncluded: newIncludeState
        })
      }

      // Just toggle inclusion state - don't reorder yet
      return prev.map(field =>
        field.key === key ? { ...field, include: !field.include } : field
      )
    })
  }, [])

  // New method to reorder fields after dropdown closes
  const reorderSelectedFields = useCallback(() => {
    setFieldMappings(prev => {
      const selectedFields = prev.filter(f => f.include)
      const unselectedFields = prev.filter(f => !f.include)

      log.debug('Reordering fields after dropdown close', {
        selectedCount: selectedFields.length,
        unselectedCount: unselectedFields.length
      })

      // Selected fields first, then unselected
      return [...selectedFields, ...unselectedFields]
    })
  }, [])

  const selectAllFields = useCallback(() => {
    setFieldMappings(prev => {
      const updatedMappings = prev.map(field => ({ ...field, include: true }))
      
      log.info('Selected all fields', {
        entityType,
        totalFields: prev.length,
        previouslyIncluded: prev.filter(f => f.include).length
      })
      
      return updatedMappings
    })
  }, [entityType])

  const deselectAllFields = useCallback(() => {
    setFieldMappings(prev => {
      const updatedMappings = prev.map(field => ({ ...field, include: false }))
      
      log.info('Deselected all fields', {
        entityType,
        totalFields: prev.length,
        previouslyIncluded: prev.filter(f => f.include).length
      })
      
      return updatedMappings
    })
  }, [entityType])

  const saveFieldSelections = useCallback(async () => {
    const selectedFields = fieldMappings
      .filter(field => field.include)
      .map(field => field.key)
    
    try {
      await fieldDetectionService.saveFieldSelections(
        entityType,
        selectedFields,
        tenantSlug
      )
      
      log.info('Field selections saved successfully', {
        entityType,
        tenantSlug,
        selectedCount: selectedFields.length
      })
    } catch (error) {
      log.error('Failed to save field selections', {
        entityType,
        tenantSlug,
        error: error instanceof Error ? error.message : 'Unknown error'
      })
      throw error
    }
  }, [fieldMappings, entityType, tenantSlug])

  const resetToDefaults = useCallback(() => {
    if (detectionResult?.fieldMappings) {
      log.info('Resetting field mappings to defaults', {
        entityType,
        totalFields: detectionResult.fieldMappings.length
      })
      setFieldMappings([...detectionResult.fieldMappings])
    }
  }, [detectionResult, entityType])

  // Tenant-specific cache invalidation utility
  const invalidateTenantCache = useCallback(async (targetTenantSlug?: string) => {
    const tenant = targetTenantSlug ?? tenantSlug ?? 'default-tenant'

    log.debug('Invalidating field detection cache for tenant', {
      entityType,
      tenant,
      queryPattern: ['field-detection', entityType, tenant]
    })

    await queryClient.invalidateQueries({
      queryKey: ['field-detection', entityType, tenant],
      exact: false
    })
  }, [queryClient, entityType, tenantSlug])

  // Column width persistence methods
  const saveColumnWidths = useCallback(async (columnWidths: Record<string, number>) => {
    try {
      await fieldDetectionService.saveColumnWidths(
        entityType,
        columnWidths,
        tenantSlug
      )

      log.debug('Column widths saved via hook', {
        entityType,
        tenantSlug,
        columnCount: Object.keys(columnWidths).length
      })
    } catch (error) {
      log.error('Failed to save column widths via hook', {
        entityType,
        tenantSlug,
        error: error instanceof Error ? error.message : 'Unknown error'
      })
      throw error
    }
  }, [entityType, tenantSlug])

  const loadColumnWidths = useCallback(async (): Promise<Record<string, number>> => {
    try {
      const columnWidths = await fieldDetectionService.loadColumnWidths(
        entityType,
        tenantSlug
      )


      return columnWidths
    } catch (error) {
      log.error('Failed to load column widths via hook', {
        entityType,
        tenantSlug,
        error: error instanceof Error ? error.message : 'Unknown error'
      })
      return {}
    }
  }, [entityType, tenantSlug])

  const clearColumnWidths = useCallback(async (targetEntityType?: EntityType, targetTenantSlug?: string): Promise<void> => {
    try {
      await fieldDetectionService.clearColumnWidths(targetEntityType, targetTenantSlug)

      log.debug('Column widths cleared via hook', {
        targetEntityType,
        targetTenantSlug,
        currentEntityType: entityType,
        currentTenantSlug: tenantSlug
      })
    } catch (error) {
      log.error('Failed to clear column widths via hook', {
        targetEntityType,
        targetTenantSlug,
        error: error instanceof Error ? error.message : 'Unknown error'
      })
      throw error
    }
  }, [entityType, tenantSlug])

  // Derived values with safe defaults
  const standardFields = detectionResult?.standardFields ?? []
  const customFields = detectionResult?.customFields ?? []
  const discoveredFields = detectionResult?.discoveredFields ?? []
  const allFields = detectionResult?.allFields ?? []

  const includedFields = useMemo(() => 
    fieldMappings.filter(field => field.include), 
    [fieldMappings]
  )
  
  const excludedFields = useMemo(() => 
    fieldMappings.filter(field => !field.include), 
    [fieldMappings]
  )

  // Statistics
  const stats = useMemo(() => ({
    totalFields: allFields.length,
    includedCount: includedFields.length,
    standardCount: standardFields.length,
    customCount: customFields.length,
    discoveredCount: discoveredFields.length
  }), [allFields, includedFields, standardFields, customFields, discoveredFields])

  return {
    // Detection results
    detectionResult,
    standardFields,
    customFields,
    discoveredFields,
    allFields,

    // Field mappings for export
    fieldMappings,
    includedFields,
    excludedFields,

    // State management
    isLoading,
    isError,
    error,
    isRefetching,

    // Actions
    refetch,
    updateFieldMapping,
    toggleFieldInclusion,
    reorderSelectedFields,
    selectAllFields,
    deselectAllFields,
    saveFieldSelections,
    resetToDefaults,
    setFieldMappings,

    // Cache management
    invalidateTenantCache,

    // Column width persistence
    saveColumnWidths,
    loadColumnWidths,
    clearColumnWidths,

    // Statistics
    stats
  }
}

/**
 * Simplified hook for basic field detection without React Query
 */
export function useSimpleFieldDetection(
  entityType: EntityType,
  sampleData?: any[],
  tenantSlug?: string
) {
  const [result, setResult] = useState<FieldDetectionResult | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const detectFields = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    
    try {
      log.debug('Starting simple field detection', { 
        entityType, 
        tenantSlug, 
        sampleDataLength: sampleData?.length 
      })

      const detectionResult = await fieldDetectionService.detectFields(
        entityType,
        sampleData,
        tenantSlug
      )
      
      setResult(detectionResult)
      
      log.info('Simple field detection completed', {
        entityType,
        tenantSlug,
        totalFields: detectionResult.allFields.length
      })
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Field detection failed')
      setError(error)
      
      log.error('Simple field detection failed', {
        entityType,
        tenantSlug,
        error: error.message
      })
    } finally {
      setIsLoading(false)
    }
  }, [entityType, sampleData, tenantSlug])

  useEffect(() => {
    detectFields()
  }, [detectFields])

  return {
    result,
    isLoading,
    error,
    refetch: detectFields
  }
}