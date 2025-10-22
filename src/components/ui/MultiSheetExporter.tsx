/**
 * Multi-Sheet Export Component
 * 
 * Provides UI for creating multi-sheet Excel exports combining different data types
 * (Issues, Workflows, etc.) into a single workbook with professional formatting.
 */

import { useState, useCallback, useMemo, useEffect, useRef } from 'react'

import { clsx } from 'clsx'
import { format } from 'date-fns'
import { 
  DownloadIcon, 
  FileSpreadsheetIcon, 
  PlusIcon, 
  TrashIcon, 
  SettingsIcon,
  AlertCircleIcon 
} from 'lucide-react'

import { getTenantSlug } from '../../api/client/http-client'
import { issuesService } from '../../api/services/issues.service'
import { useFieldDetection } from '../../hooks/useFieldDetection'
import type { MultiSheetExportRequest } from '../../services/enhanced-export.service'
import { enhancedExportService } from '../../services/enhanced-export.service'
import type { EnhancedFieldMapping } from '../../types/export'
import { logger } from '../../utils/logger'

// Sheet configuration interface
export interface SheetConfig {
  id: string
  name: string
  entityType: 'issue' | 'workflow' | 'company' | 'enduser'
  enabled: boolean
  filters?: Record<string, any>
  fieldMappings: EnhancedFieldMapping[]
  estimatedRows?: number
}

// Component props
export interface MultiSheetExporterProps {
  className?: string
  initialSheets?: Partial<SheetConfig>[]
  onExportStart?: (jobId: string) => void
  onExportComplete?: (downloadUrl: string) => void
  onExportError?: (error: string) => void
}

/**
 * Multi-sheet export component
 */
export function MultiSheetExporter({
  className,
  initialSheets = [],
  onExportStart,
  onExportComplete,
  onExportError
}: MultiSheetExporterProps) {
  const [sheets, setSheets] = useState<SheetConfig[]>(() =>
    initialSheets.map((sheet, index) => ({
      id: `sheet-${Date.now()}-${index}`,
      name: sheet.name ?? `Sheet ${index + 1}`,
      entityType: sheet.entityType ?? 'issue',
      enabled: sheet.enabled ?? true,
      filters: sheet.filters ?? {},
      fieldMappings: sheet.fieldMappings ?? [],
      estimatedRows: 0
    }))
  )
  
  const [isExporting, setIsExporting] = useState(false)
  const [exportProgress, setExportProgress] = useState<number>(0)
  const [showAdvancedOptions, setShowAdvancedOptions] = useState(false)
  const progressIntervalRef = useRef<NodeJS.Timeout | null>(null)
  
  // Global export options
  const [globalOptions, setGlobalOptions] = useState({
    includeHeaders: true,
    includeCustomFields: true,
    dateFormat: 'yyyy-MM-dd',
    timezone: 'UTC',
    headerStyle: {
      bold: true,
      fontSize: 11,
      fill: 'E8F4FD',
      fontColor: '1F2937'
    },
    alternateRowFill: 'F9FAFB'
  })
  
  const log = logger.extension
  const tenantSlug = getTenantSlug()

  useEffect(() => {
    return () => {
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current)
        progressIntervalRef.current = null
      }
    }
  }, [])

  // Add new sheet
  const addSheet = useCallback((entityType: SheetConfig['entityType'] = 'issue') => {
    const newSheet: SheetConfig = {
      id: `sheet-${Date.now()}`,
      name: `${entityType.charAt(0).toUpperCase() + entityType.slice(1)}s`,
      entityType,
      enabled: true,
      filters: {},
      fieldMappings: [],
      estimatedRows: 0
    }
    
    setSheets(prev => [...prev, newSheet])
    log.info('Added new sheet to multi-sheet export', { 
      sheetId: newSheet.id, 
      entityType 
    })
  }, [log])

  // Remove sheet
  const removeSheet = useCallback((sheetId: string) => {
    setSheets(prev => prev.filter(sheet => sheet.id !== sheetId))
    log.info('Removed sheet from multi-sheet export', { sheetId })
  }, [log])

  // Update sheet configuration
  const updateSheet = useCallback((sheetId: string, updates: Partial<SheetConfig>) => {
    setSheets(prev => prev.map(sheet => 
      sheet.id === sheetId ? { ...sheet, ...updates } : sheet
    ))
  }, [])

  // Field detection for each sheet
  const useSheetFieldDetection = (sheet: SheetConfig) => {
    // For now, we'll use static field mappings based on entity type
    // This could be enhanced to use dynamic field detection per sheet
    return useMemo((): EnhancedFieldMapping[] => {
      switch (sheet.entityType) {
        case 'issue':
          return [
            { key: '_id', label: 'ID', type: 'string', include: true, conditionalFormatting: [] },
            { key: 'title', label: 'Title', type: 'string', include: true, width: 300, conditionalFormatting: [] },
            { key: 'status', label: 'Status', type: 'string', include: true, conditionalFormatting: [] },
            { key: 'type', label: 'Type', type: 'string', include: true, conditionalFormatting: [] },
            { key: 'priority', label: 'Priority', type: 'string', include: true, conditionalFormatting: [] },
            { key: 'createdAt', label: 'Created At', type: 'date', include: true, conditionalFormatting: [] },
            { key: 'updatedAt', label: 'Updated At', type: 'date', include: false, conditionalFormatting: [] }
          ]
          
        case 'workflow':
          return [
            { key: '_id', label: 'ID', type: 'string', include: true, conditionalFormatting: [] },
            { key: 'name', label: 'Name', type: 'string', include: true, width: 250, conditionalFormatting: [] },
            { key: 'type', label: 'Type', type: 'string', include: true, conditionalFormatting: [] },
            { key: 'status', label: 'Status', type: 'string', include: true, conditionalFormatting: [] },
            { key: 'isActive', label: 'Active', type: 'boolean', include: true, conditionalFormatting: [] },
            { key: 'createdAt', label: 'Created At', type: 'date', include: true, conditionalFormatting: [] }
          ]
          
        case 'company':
          return [
            { key: '_id', label: 'ID', type: 'string', include: true, conditionalFormatting: [] },
            { key: 'name', label: 'Company Name', type: 'string', include: true, width: 250, conditionalFormatting: [] },
            { key: 'domain', label: 'Domain', type: 'string', include: true, conditionalFormatting: [] },
            { key: 'mrr', label: 'MRR', type: 'currency', include: true, conditionalFormatting: [] },
            { key: 'createdAt', label: 'Created At', type: 'date', include: true, conditionalFormatting: [] }
          ]
          
        case 'enduser':
          return [
            { key: '_id', label: 'ID', type: 'string', include: true, conditionalFormatting: [] },
            { key: 'email', label: 'Email', type: 'string', include: true, width: 200, conditionalFormatting: [] },
            { key: 'name', label: 'Name', type: 'string', include: true, width: 150, conditionalFormatting: [] },
            { key: 'title', label: 'Title', type: 'string', include: true, conditionalFormatting: [] },
            { key: 'createdAt', label: 'Created At', type: 'date', include: true, conditionalFormatting: [] }
          ]
          
        default:
          return []
      }
    }, [sheet.entityType])
  }

  // Handle multi-sheet export
  const handleExport = useCallback(async () => {
    if (sheets.filter(s => s.enabled).length === 0) {
      onExportError?.('No sheets selected for export')
      return
    }

    setIsExporting(true)
    setExportProgress(0)
    
    try {
      log.info('Starting multi-sheet export', {
        totalSheets: sheets.filter(s => s.enabled).length,
        sheetTypes: sheets.filter(s => s.enabled).map(s => s.entityType)
      })

      // Prepare sheet data
      const exportSheets = []
      
      for (const sheet of sheets.filter(s => s.enabled)) {
        log.info('Preparing sheet data', { sheetName: sheet.name, entityType: sheet.entityType })
        
        let data: any[] = []
        
        // Fetch data based on entity type
        switch (sheet.entityType) {
          case 'issue':
            // For demo purposes, fetch a sample of issues
            const issuesResponse = await issuesService.getIssues({}, { limit: 100, offset: 0 })
            data = issuesResponse.data ?? []
            break
            
          case 'workflow':
            // Mock workflow data - replace with actual API call
            data = [
              { 
                _id: '1', 
                name: 'Sample Workflow', 
                type: 'automation', 
                status: 'active', 
                isActive: true, 
                createdAt: new Date().toISOString() 
              }
            ]
            break
            
          case 'company':
          case 'enduser':
            // Mock data - replace with actual API calls
            data = []
            break
        }
        
        const fieldMappings = useSheetFieldDetection(sheet)
        
        exportSheets.push({
          name: sheet.name,
          data,
          fields: fieldMappings.filter(f => f.include),
          options: {
            includeHeaders: globalOptions.includeHeaders,
            headerStyle: globalOptions.headerStyle
          }
        })
        
        log.debug('Sheet prepared', { 
          sheetName: sheet.name, 
          dataCount: data.length,
          fieldsCount: fieldMappings.filter(f => f.include).length
        })
      }

      // Create multi-sheet export request
      const exportRequest: MultiSheetExportRequest = {
        sheets: exportSheets,
        filename: `planhat-multi-export-${format(new Date(), 'yyyy-MM-dd')}.xlsx`,
        globalOptions: {
          includeHeaders: globalOptions.includeHeaders,
          includeCustomFields: globalOptions.includeCustomFields,
          dateFormat: globalOptions.dateFormat,
          timezone: globalOptions.timezone,
          headerStyle: globalOptions.headerStyle
        }
      }

      // Start export
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current)
        progressIntervalRef.current = null
      }

      const jobId = await enhancedExportService.startMultiSheetExport(exportRequest)
      onExportStart?.(jobId)

      log.info('Multi-sheet export job started', { jobId })

      progressIntervalRef.current = setInterval(() => {
        const progress = enhancedExportService.getProgress(jobId)
        if (!progress) return

        setExportProgress(progress.progress)

        if (progress.status === 'completed') {
          clearInterval(progressIntervalRef.current as NodeJS.Timeout)
          progressIntervalRef.current = null
          setIsExporting(false)
          onExportComplete?.(progress.downloadUrl ?? '')
          log.info('Multi-sheet export completed', { jobId })
        } else if (progress.status === 'failed' || progress.status === 'cancelled') {
          clearInterval(progressIntervalRef.current as NodeJS.Timeout)
          progressIntervalRef.current = null
          setIsExporting(false)
          onExportError?.(progress.error ?? 'Export cancelled')
          log.warn('Multi-sheet export ended without completion', {
            jobId,
            status: progress.status,
            error: progress.error
          })
        }
      }, 500)

    } catch (error) {
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current)
        progressIntervalRef.current = null
      }
      log.error('Multi-sheet export failed', { error: error instanceof Error ? error.message : 'Unknown error' })
      setIsExporting(false)
      setExportProgress(0)
      onExportError?.(error instanceof Error ? error.message : 'Export failed')
    }
  }, [sheets, globalOptions, onExportStart, onExportComplete, onExportError, log])

  const enabledSheets = sheets.filter(s => s.enabled)
  const totalEstimatedRows = enabledSheets.reduce((sum, sheet) => sum + (sheet.estimatedRows ?? 0), 0)

  return (
    <div className={clsx('space-y-6', className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileSpreadsheetIcon className="h-5 w-5 text-blue-600" />
          <h3 className="text-lg font-semibold text-gray-900">Multi-Sheet Export</h3>
        </div>
        
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowAdvancedOptions(!showAdvancedOptions)}
            className={clsx(
              'flex items-center gap-1 rounded-md border px-3 py-1 text-sm transition-colors',
              showAdvancedOptions
                ? 'border-blue-200 bg-blue-50 text-blue-700'
                : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
            )}
          >
            <SettingsIcon className="h-4 w-4" />
            Options
          </button>
          
          <button
            onClick={handleExport}
            disabled={isExporting || enabledSheets.length === 0}
            className="flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <DownloadIcon className="h-4 w-4" />
            {isExporting ? `Exporting... ${exportProgress}%` : 'Export All Sheets'}
          </button>
        </div>
      </div>

      {/* Advanced Options */}
      {showAdvancedOptions && (
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
          <h4 className="mb-3 font-medium text-gray-900">Export Options</h4>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={globalOptions.includeHeaders}
                onChange={e => setGlobalOptions(prev => ({ ...prev, includeHeaders: e.target.checked }))}
                className="h-4 w-4 rounded border-gray-300 text-blue-600"
              />
              Include headers
            </label>
            
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={globalOptions.includeCustomFields}
                onChange={e => setGlobalOptions(prev => ({ ...prev, includeCustomFields: e.target.checked }))}
                className="h-4 w-4 rounded border-gray-300 text-blue-600"
              />
              Include custom fields
            </label>
            
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Date Format</label>
              <select
                value={globalOptions.dateFormat}
                onChange={e => setGlobalOptions(prev => ({ ...prev, dateFormat: e.target.value }))}
                className="w-full rounded-md border border-gray-300 px-3 py-1 text-sm"
              >
                <option value="yyyy-MM-dd">YYYY-MM-DD</option>
                <option value="MM/dd/yyyy">MM/DD/YYYY</option>
                <option value="dd/MM/yyyy">DD/MM/YYYY</option>
              </select>
            </div>
          </div>
        </div>
      )}

      {/* Sheets Configuration */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="font-medium text-gray-900">Sheets ({enabledSheets.length} enabled)</h4>
          <div className="flex gap-2">
            <button
              onClick={() => addSheet('issue')}
              className="flex items-center gap-1 rounded-md border border-gray-300 bg-white px-2 py-1 text-xs text-gray-700 transition-colors hover:bg-gray-50"
            >
              <PlusIcon className="h-3 w-3" />
              Issue Sheet
            </button>
            <button
              onClick={() => addSheet('workflow')}
              className="flex items-center gap-1 rounded-md border border-gray-300 bg-white px-2 py-1 text-xs text-gray-700 transition-colors hover:bg-gray-50"
            >
              <PlusIcon className="h-3 w-3" />
              Workflow Sheet
            </button>
          </div>
        </div>

        {sheets.length === 0 ? (
          <div className="rounded-lg border-2 border-dashed border-gray-300 p-8 text-center">
            <FileSpreadsheetIcon className="mx-auto h-8 w-8 text-gray-400" />
            <p className="mt-2 text-sm text-gray-500">No sheets added yet</p>
            <p className="text-xs text-gray-400">Click the buttons above to add data sheets</p>
          </div>
        ) : (
          <div className="space-y-2">
            {sheets.map((sheet) => (
              <div
                key={sheet.id}
                className={clsx(
                  'rounded-lg border p-3 transition-colors',
                  sheet.enabled 
                    ? 'border-blue-200 bg-blue-50' 
                    : 'border-gray-200 bg-gray-50'
                )}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={sheet.enabled}
                      onChange={e => updateSheet(sheet.id, { enabled: e.target.checked })}
                      className="h-4 w-4 rounded border-gray-300 text-blue-600"
                    />
                    <div>
                      <input
                        type="text"
                        value={sheet.name}
                        onChange={e => updateSheet(sheet.id, { name: e.target.value })}
                        className="font-medium text-gray-900 bg-transparent border-none focus:ring-2 focus:ring-blue-500 focus:bg-white rounded px-1"
                      />
                      <p className="text-xs text-gray-500">
                        {sheet.entityType} • {sheet.estimatedRows ?? 0} estimated rows
                      </p>
                    </div>
                  </div>
                  
                  <button
                    onClick={() => removeSheet(sheet.id)}
                    className="text-gray-400 hover:text-red-600 transition-colors"
                  >
                    <TrashIcon className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Export Summary */}
      {enabledSheets.length > 0 && (
        <div className="rounded-lg bg-blue-50 border border-blue-200 p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertCircleIcon className="h-4 w-4 text-blue-600" />
            <span className="text-sm font-medium text-blue-900">Export Summary</span>
          </div>
          <div className="text-sm text-blue-800 space-y-1">
            <p>{enabledSheets.length} sheets will be exported</p>
            <p>Estimated total rows: {totalEstimatedRows}</p>
            <p>Format: Excel (.xlsx) with professional formatting</p>
          </div>
        </div>
      )}

      {/* Progress Bar */}
      {isExporting && (
        <div className="rounded-lg bg-gray-100 p-4">
          <div className="mb-2 flex justify-between text-sm">
            <span className="text-gray-600">Exporting sheets...</span>
            <span className="text-gray-900">{exportProgress}%</span>
          </div>
          <div className="h-2 rounded-full bg-gray-300">
            <div 
              className="h-2 rounded-full bg-blue-600 transition-all duration-300"
              style={{ width: `${exportProgress}%` }}
            />
          </div>
        </div>
      )}
    </div>
  )
}