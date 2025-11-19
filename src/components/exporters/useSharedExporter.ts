import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import type { ColumnSizingState } from '@tanstack/react-table'

import { useDataSelection, useExport } from '../../hooks/useExport'
import { useFieldDetection, type UseFieldDetectionOptions } from '../../hooks/useFieldDetection'
import { useFormatControl, useToggleControl } from '../../hooks/useToolHeaderControls'
import type { ExportRequest, StreamingExportRequest } from '../../services/export.service'
import type { ExtendedFieldMapping } from '../../services/field-detection.service'
import type { ExportFormat, ExportOptions, EntityType } from '../../types/api'
import { EXPORT_FORMAT_OPTIONS } from '../../types/ui'
import { logger } from '../../utils/logger'

const log = logger.extension

interface ExportConfigBase {
  includeHeaders: boolean
  includeCustomFields: boolean
  includeRelatedData: boolean
  dateFormat?: string
}

export interface ExportHandlerContext<TItem, TExportConfig extends ExportConfigBase> {
  format: ExportFormat
  filename: string
  exportOptions: ExportOptions
  exportConfig: ExportConfigState<TExportConfig>
  selectedData: TItem[]
  allData: TItem[]
  fields: ExtendedFieldMapping[]
  entityType: EntityType
  totalCount: number
}

export interface ExporterStreamingConfig<TItem, TExportConfig extends ExportConfigBase> {
  threshold?: number
  shouldStream?: (
    context: ExportHandlerContext<TItem, TExportConfig>
  ) => boolean
  createRequest: (
    context: ExportHandlerContext<TItem, TExportConfig>
  ) => StreamingExportRequest<TItem>
}

export interface ExporterImmediateConfig<TItem, TExportConfig extends ExportConfigBase> {
  createRequest?: (
    context: ExportHandlerContext<TItem, TExportConfig>
  ) => ExportRequest<TItem>
}

export interface ExporterFieldDetectionConfig<TItem>
  extends Omit<UseFieldDetectionOptions, 'entityType' | 'enabled' | 'sampleData'> {
  sampleSize?: number
  getSampleData?: (items: TItem[]) => any[]
}

export interface ExporterConfig<
  TItem extends { _id: string },
  TExportConfig extends ExportConfigBase
> {
  entityType: EntityType
  items: TItem[]
  totalCount: number
  tenantSlug?: string
  defaultExportConfig: TExportConfig
  buildFilename: (format: ExportFormat) => string
  buildExportOptions?: (
    context: ExportHandlerContext<TItem, TExportConfig>
  ) => ExportOptions
  streaming?: ExporterStreamingConfig<TItem, TExportConfig>
  immediate?: ExporterImmediateConfig<TItem, TExportConfig>
  fieldDetection?: ExporterFieldDetectionConfig<TItem>
  columnSizingDebounceMs?: number
  emptySelectionMessage?: string
  initialFormat?: ExportFormat
  formatOptions?: readonly ExportFormat[]
}

export interface ExportConfigState<TExportConfig extends ExportConfigBase> {
  format: ExportFormat
  includeHeaders: boolean
  includeCustomFields: boolean
  includeRelatedData: boolean
  dateFormat?: string
}

export interface SharedExporterResult<
  TItem extends { _id: string },
  TExportConfig extends ExportConfigBase
> {
  fieldsControl: ReturnType<typeof useToggleControl>
  reorderControl: ReturnType<typeof useToggleControl>
  formatControl: ReturnType<typeof useFormatControl<ExportFormat>>
  exportConfig: ExportConfigState<TExportConfig>
  columnSizing: ColumnSizingState
  handleColumnSizingChange: (sizing: ColumnSizingState) => void
  fieldDetection: ReturnType<typeof useFieldDetection>
  fieldMapping: {
    fields: ReturnType<typeof useFieldDetection>['fieldMappings']
    updateField: ReturnType<typeof useFieldDetection>['updateFieldMapping']
    toggleFieldInclusion: ReturnType<typeof useFieldDetection>['toggleFieldInclusion']
    reorderSelectedFields: ReturnType<typeof useFieldDetection>['reorderSelectedFields']
    selectAllFields: ReturnType<typeof useFieldDetection>['selectAllFields']
    deselectAllFields: ReturnType<typeof useFieldDetection>['deselectAllFields']
    resetToDefaults: ReturnType<typeof useFieldDetection>['resetToDefaults']
    setFieldMappings: ReturnType<typeof useFieldDetection>['setFieldMappings']
    getIncludedFields: () => ExtendedFieldMapping[]
    includedCount: number
  }
  dataSelection: ReturnType<typeof useDataSelection<TItem>>
  handleDirectExport: (format: ExportFormat) => Promise<void>
  handleExport: () => Promise<void>
  isExporting: boolean
}

function createDefaultExportOptions<TItem, TExportConfig extends ExportConfigBase>(
  context: ExportHandlerContext<TItem, TExportConfig>
): ExportOptions {
  return {
    includeHeaders: context.exportConfig.includeHeaders,
    includeCustomFields: context.exportConfig.includeCustomFields,
    includeRelatedData: context.exportConfig.includeRelatedData,
    dateFormat: context.exportConfig.dateFormat,
    timezone: 'UTC'
  }
}

export function useSharedExporter<
  TItem extends { _id: string },
  TExportConfig extends ExportConfigBase
>(config: ExporterConfig<TItem, TExportConfig>): SharedExporterResult<TItem, TExportConfig> {
  const {
    entityType,
    items,
    totalCount,
    tenantSlug,
    defaultExportConfig,
    buildFilename,
    buildExportOptions = createDefaultExportOptions,
    streaming,
    immediate,
    fieldDetection: fieldDetectionConfig,
    columnSizingDebounceMs = 1000,
    emptySelectionMessage = 'No data to export. Please select items or ensure data is loaded.',
    initialFormat,
    formatOptions
  } = config

  const availableFormats = formatOptions ?? EXPORT_FORMAT_OPTIONS.map(option => option.value)
  const fieldsControl = useToggleControl(false)
  const reorderControl = useToggleControl(false)
  const formatControl = useFormatControl<ExportFormat>(
    initialFormat, // undefined by default - no format selected initially
    availableFormats
  )

  const exportConfig = useMemo<ExportConfigState<TExportConfig>>(
    () => ({
      ...defaultExportConfig,
      format: formatControl.selectedFormat ?? 'csv' // Default to csv if no format selected
    }),
    [defaultExportConfig, formatControl.selectedFormat]
  )

  const dataSelection = useDataSelection(items)
  const sampleData = useMemo(() => {
    if (fieldDetectionConfig?.getSampleData) {
      return fieldDetectionConfig.getSampleData(items)
    }

    const size = fieldDetectionConfig?.sampleSize ?? 10
    return items.slice(0, size)
  }, [fieldDetectionConfig, items])

  const fieldDetection = useFieldDetection({
    entityType,
    sampleData,
    tenantSlug,
    enabled: items.length > 0,
    ...fieldDetectionConfig
  })

  const [columnSizing, setColumnSizing] = useState<ColumnSizingState>({})
  const saveColumnWidthsTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  const handleColumnSizingChange = useCallback(
    (sizing: ColumnSizingState) => {
      setColumnSizing(sizing)

      if (saveColumnWidthsTimeoutRef.current) {
        clearTimeout(saveColumnWidthsTimeoutRef.current)
      }

      saveColumnWidthsTimeoutRef.current = setTimeout(async () => {
        try {
          await fieldDetection.saveColumnWidths(sizing)
          log.debug('Column widths persisted', {
            entityType,
            columnCount: Object.keys(sizing).length
          })
        } catch (error) {
          log.error('Failed to persist column widths', {
            entityType,
            error: error instanceof Error ? error.message : 'Unknown error'
          })
        }
      }, columnSizingDebounceMs)
    },
    [columnSizingDebounceMs, entityType, fieldDetection]
  )

  useEffect(() => {
    return () => {
      if (saveColumnWidthsTimeoutRef.current) {
        clearTimeout(saveColumnWidthsTimeoutRef.current)
      }
    }
  }, [])

  useEffect(() => {
    if (!fieldDetection.isLoading && fieldDetection.fieldMappings.length > 0) {
      fieldDetection
        .loadColumnWidths()
        .then(saved => {
          if (Object.keys(saved).length > 0) {
            setColumnSizing(saved)
          }
        })
        .catch(error => {
          log.error('Failed to load saved column widths', {
            entityType,
            error: error instanceof Error ? error.message : 'Unknown error'
          })
        })
    }
  }, [entityType, fieldDetection.isLoading, fieldDetection.fieldMappings.length, fieldDetection.loadColumnWidths])

  useEffect(() => {
    if (fieldDetection.fieldMappings.length > 0) {
      const timeoutId = setTimeout(() => {
        fieldDetection.saveFieldSelections().catch(error => {
          log.error('Failed to auto-save field selections', {
            entityType,
            error: error instanceof Error ? error.message : 'Unknown error'
          })
        })
      }, 1000)

      return () => clearTimeout(timeoutId)
    }

    return undefined
  }, [entityType, fieldDetection.fieldMappings.length, fieldDetection.saveFieldSelections])

  const fieldMapping = useMemo(() => ({
    fields: fieldDetection.fieldMappings,
    updateField: fieldDetection.updateFieldMapping,
    toggleFieldInclusion: fieldDetection.toggleFieldInclusion,
    reorderSelectedFields: fieldDetection.reorderSelectedFields,
    selectAllFields: fieldDetection.selectAllFields,
    deselectAllFields: fieldDetection.deselectAllFields,
    resetToDefaults: fieldDetection.resetToDefaults,
    setFieldMappings: fieldDetection.setFieldMappings,
    getIncludedFields: () => fieldDetection.includedFields,
    includedCount: fieldDetection.stats.includedCount
  }), [fieldDetection])

  const { startExport, startStreamingExport, isExporting } = useExport()

  const handleDirectExport = useCallback(
    async (format: ExportFormat) => {
      const selectedData =
        dataSelection.selectedCount > 0 ? dataSelection.getSelectedData() : items

      if (selectedData.length === 0) {
        alert(emptySelectionMessage)
        return
      }

      const filename = buildFilename(format)
      const context: ExportHandlerContext<TItem, TExportConfig> = {
        format,
        filename,
        exportOptions: { includeHeaders: true, includeCustomFields: true, includeRelatedData: true },
        exportConfig,
        selectedData,
        allData: items,
        fields: fieldDetection.includedFields,
        entityType,
        totalCount
      }

      const exportOptions = buildExportOptions(context)
      context.exportOptions = exportOptions

      const shouldUseStreaming = (() => {
        if (!streaming) return false
        if (streaming.shouldStream) {
          return streaming.shouldStream(context)
        }
        const threshold = streaming.threshold ?? Number.MAX_SAFE_INTEGER
        return selectedData.length > threshold
      })()

      if (shouldUseStreaming && streaming) {
        const request = streaming.createRequest({ ...context, exportOptions })
        await startStreamingExport(request)
        return
      }

      const createImmediateRequest = immediate?.createRequest
      const request = createImmediateRequest
        ? createImmediateRequest({ ...context, exportOptions })
        : {
            data: selectedData,
            format,
            filename,
            options: exportOptions,
            fields: fieldDetection.includedFields,
            entityType
          }

      await startExport(request)
    },
    [
      buildExportOptions,
      buildFilename,
      dataSelection,
      emptySelectionMessage,
      entityType,
      exportConfig,
      fieldDetection.includedFields,
      immediate?.createRequest,
      items,
      startExport,
      startStreamingExport,
      streaming,
      totalCount
    ]
  )

  const handleExport = useCallback(async () => {
    await handleDirectExport(formatControl.selectedFormat)
  }, [formatControl.selectedFormat, handleDirectExport])

  return {
    fieldsControl,
    reorderControl,
    formatControl,
    exportConfig,
    columnSizing,
    handleColumnSizingChange,
    fieldDetection,
    fieldMapping,
    dataSelection,
    handleDirectExport,
    handleExport,
    isExporting
  }
}
