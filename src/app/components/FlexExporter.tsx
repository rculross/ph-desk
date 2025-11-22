/**
 * Flex Export Component
 * 
 * Universal API exporter for any Planhat endpoint using existing UI components.
 * Supports GET/POST modes, history management, and export functionality.
 */

import { useState, useEffect, useCallback, useMemo } from 'react'



import { PlayCircleOutlined, EditOutlined, HistoryOutlined, DeleteOutlined } from '@ant-design/icons'
import { Button, Input, Radio, Dropdown } from 'antd'
import { clsx } from 'clsx'
import { format as formatDate } from 'date-fns'
import {
  DatabaseIcon,
  AlertCircleIcon
} from 'lucide-react'

import { toastService } from '@/services/toast.service'
import { getHttpClient, getTenantSlug } from '../../api/client/http-client'
import { sendRawRequest } from '../../api/request'
import { fetchAllPages } from '../../api/utils/pagination'
import { ExportFormatButtons } from '../../components/exporters'
import { ToolHeader, ToolHeaderControls, ToolHeaderDivider, CompactInput } from '../../components/ui/ToolHeader'
import { Table } from '../../components/ui/Table'
// import { useExport } from '../../hooks/useExport'
import { useEndpointHistory } from '../../hooks/useEndpointHistory'
import { useFieldDetection } from '../../hooks/useFieldDetection'
import { useFormatControl } from '../../hooks/useToolHeaderControls'
import { useActiveTenant } from '../../stores/tenant.store'
import type { EntityType, ExportFormat } from '../../types/api'
import type { FieldMapping } from '../../types/export'
import { CONTROL_CATEGORIES, EXPORT_FORMAT_OPTIONS } from '../../types/ui'
import { logger } from '../../utils/logger'

/**
 * Map endpoint path to EntityType for field detection
 * Falls back to 'custom' for unknown endpoints
 */
function inferEntityTypeFromEndpoint(endpoint: string): EntityType {
  if (!endpoint) return 'custom'

  // Extract base path (before query params) and first path segment
  const cleanEndpoint = endpoint.split('?')[0]?.toLowerCase() ?? ''
  const basePath = cleanEndpoint.split('/')[0] ?? ''

  // Map common Planhat endpoints to entity types
  const endpointMapping: Record<string, EntityType> = {
    'companies': 'company',
    'users': 'user',
    'issues': 'issue',
    'tasks': 'task',
    'notes': 'note',
    'workflows': 'workflow',
    'roles': 'role'
  }

  // Check for direct match
  if (basePath in endpointMapping) {
    return endpointMapping[basePath]!
  }

  // Check for workflows/* pattern
  if (cleanEndpoint.startsWith('workflows/') || cleanEndpoint.startsWith('workflows')) {
    return 'workflow'
  }

  // Default to custom for unknown endpoints
  return 'custom'
}

export interface FlexExporterProps {
  className?: string
  variant?: 'full' | 'minimal'
}

type RequestMode = 'GET' | 'POST' | 'PUT'

export function FlexExporter({ className, variant = 'full' }: FlexExporterProps) {
  const isMinimal = variant === 'minimal'
  // State
  const [endpoint, setEndpoint] = useState('')
  const [mode, setMode] = useState<RequestMode>('GET')
  const [previousMode, setPreviousMode] = useState<RequestMode>('GET')
  const [jsonContent, setJsonContent] = useState('')
  const [responseData, setResponseData] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [maxRecords, setMaxRecords] = useState<string>('100')
  const [progress, setProgress] = useState<{ loaded: number; total: number } | null>(null)
  const [inferredEntityType, setInferredEntityType] = useState<EntityType>('custom')

  // Export state
  const formatControl = useFormatControl<ExportFormat>(
    EXPORT_FORMAT_OPTIONS[0].value,
    EXPORT_FORMAT_OPTIONS.map(f => f.value)
  )
  const [isExporting, setIsExporting] = useState(false)
  const [viewMode, setViewMode] = useState<'table' | 'json'>('json')

  // History management
  const { history, addToHistory, clearHistory } = useEndpointHistory()

  // Handle selecting endpoint from history
  const handleSelectFromHistory = useCallback((historyEndpoint: string) => {
    setEndpoint(historyEndpoint)
  }, [])

  // Handle clearing history
  const handleClearHistory = useCallback(async () => {
    await clearHistory()
    toastService.success('Endpoint history cleared')
  }, [clearHistory])

  // Helper to normalize endpoint for display (strip API domain, ensure leading slash)
  const normalizeEndpoint = (endpoint: string): string => {
    let normalized = endpoint
    // Strip common API domain prefixes
    normalized = normalized.replace(/^https?:\/\/api\.planhat(demo)?\.com\/?/i, '')
    // Ensure leading slash
    if (!normalized.startsWith('/')) {
      normalized = '/' + normalized
    }
    return normalized
  }

  // Helper to truncate endpoint text for display
  const truncateEndpoint = (text: string, maxLength: number = 75): string => {
    if (text.length <= maxLength) return text
    return text.substring(0, maxLength) + '...'
  }

  // Create history dropdown menu items
  const historyMenuItems = useMemo(() => {
    const items: any[] = history.map(item => {
      const normalizedEndpoint = normalizeEndpoint(item.endpoint)
      return {
        key: item.id,
        label: (
          <div className="flex items-center justify-between gap-3 min-w-0">
            <div className="flex-1 min-w-0">
              <div className="text-sm font-mono" title={normalizedEndpoint}>{truncateEndpoint(normalizedEndpoint)}</div>
            </div>
          <div className={clsx(
            'px-2 py-0.5 text-xs rounded font-medium shrink-0',
            item.method === 'GET' && 'bg-blue-100 text-blue-700',
            item.method === 'POST' && 'bg-green-100 text-green-700',
            item.method === 'PUT' && 'bg-orange-100 text-orange-700'
          )}>
            {item.method}
          </div>
        </div>
      ),
      onClick: () => handleSelectFromHistory(item.endpoint)
    }
  })

    // Add clear history option if there are items
    if (items.length > 0) {
      items.push(
        { type: 'divider', key: 'divider' },
        {
          key: 'clear-history',
          label: (
            <div className="flex items-center gap-2 text-red-600">
              <DeleteOutlined />
              <span>Clear History</span>
            </div>
          ),
          onClick: handleClearHistory
        }
      )
    }

    return items
  }, [history, handleSelectFromHistory, handleClearHistory])

  const log = logger.extension

  // Get current tenant from store to watch for changes
  const activeTenant = useActiveTenant()
  const tenantSlug = activeTenant?.slug ?? getTenantSlug()


  // Field detection - enabled after we have response data
  // Uses inferred entity type from endpoint and sample data from response
  const sampleDataForDetection = useMemo(() => {
    if (!responseData) return []
    return Array.isArray(responseData) ? responseData.slice(0, 100) : [responseData]
  }, [responseData])

  const fieldDetection = useFieldDetection({
    entityType: inferredEntityType,
    sampleData: sampleDataForDetection,
    tenantSlug: tenantSlug ?? undefined,
    enabled: sampleDataForDetection.length > 0 // Enable when we have response data
  })

  // Convert field mappings to FieldMapping format for Table component
  const tableFieldMappings = useMemo((): FieldMapping[] => {
    if (!fieldDetection.fieldMappings || fieldDetection.fieldMappings.length === 0) {
      return []
    }

    return fieldDetection.fieldMappings.map(field => ({
      key: field.key,
      label: field.label,
      type: field.type,
      include: field.include,
      order: field.order,
      width: field.width,
      customFieldConfig: field.customFieldConfig
    }))
  }, [fieldDetection.fieldMappings])

  // Log component mount
  useEffect(() => {
    log.info('FlexExporter component mounted', {
      tenantSlug: tenantSlug ?? 'none',
      variant
    })
  }, [log, tenantSlug, variant])

  // Track mode changes for logging
  useEffect(() => {
    setPreviousMode(mode)
  }, [mode])

  // Clear response data when tenant changes
  useEffect(() => {
    if (activeTenant) {
      log.debug('Tenant change detected, clearing response data', {
        tenantSlug: activeTenant.slug
      })
      setResponseData(null)
      setJsonContent('')
      setError(null)
    }
  }, [activeTenant?.slug, log])


  // Determine if endpoint supports pagination (data models vs config endpoints)
  const isDataModelEndpoint = useCallback((endpoint: string): boolean => {
    if (!endpoint) return false
    
    const dataModelEndpoints = [
      'data', 'companies', 'endusers', 'opportunities', 'issues', 'activities',
      'conversations', 'notes', 'assets', 'licenses', 'contacts',
      'projects', 'invoices', 'campaigns', 'tickets', 'tasks',
      'deals', 'accounts', 'users', 'events', 'metrics'
    ]
    
    const cleanEndpoint = endpoint.toLowerCase().split('/')[0]?.split('?')[0]
    return cleanEndpoint ? dataModelEndpoints.includes(cleanEndpoint) : false
  }, [])


  // Handle endpoint execution
  const handleExecute = useCallback(async () => {
    const requestMode = isMinimal ? 'GET' : mode
    if (!endpoint.trim()) {
      toastService.error('Please enter an endpoint')
      return
    }

    // Add endpoint to history before execution
    await addToHistory(endpoint.trim(), requestMode)

    setIsLoading(true)
    setError(null)
    setResponseData(null)
    setJsonContent('')
    setProgress(null)

    try {
      const isDataModel = isDataModelEndpoint(endpoint.trim())
      const maxRecs = parseInt(maxRecords ?? '100') ?? 100

      log.info('Executing flex export request', {
        endpoint: endpoint.trim(),
        mode: requestMode,
        isDataModel,
        maxRecords: isDataModel ? maxRecs : 'unlimited',
        hasJsonContent: (requestMode === 'POST' || requestMode === 'PUT') && !!jsonContent.trim(),
        willUseChunking: isDataModel && maxRecs > 2000 && requestMode === 'GET'
      })

      let result: any

      if (requestMode === 'GET') {
        if (isDataModel && maxRecs > 2000) {
          // Use chunked pagination for large requests
          log.info('Using chunked pagination for large request', {
            totalRequested: maxRecs,
            chunkSize: 2000
          })

          const client = getHttpClient()
          const baseEndpoint = endpoint.trim()

          const fetchPage = async (offset: number, limit: number) => {
            const separator = baseEndpoint.includes('?') ? '&' : '?'
            const requestEndpoint = `${baseEndpoint}${separator}limit=${limit}&offset=${offset}`

            log.debug('Fetching chunk', { offset, limit, endpoint: requestEndpoint })

            const pageResult = await sendRawRequest('get', requestEndpoint, undefined, client)

            // Handle different response formats
            let data: any[]
            if (Array.isArray(pageResult)) {
              data = pageResult
            } else if (pageResult?.data && Array.isArray(pageResult.data)) {
              data = pageResult.data
            } else if (pageResult) {
              data = [pageResult]
            } else {
              data = []
            }

            return {
              data,
              total: pageResult?.total,
              hasMore: data.length === limit
            }
          }

          const paginationResult = await fetchAllPages(fetchPage, {
            limit: 2000, // Planhat's max limit per request
            maxRecords: maxRecs,
            onProgress: (loaded, total) => {
              setProgress({ loaded, total: total ?? maxRecs })
              log.debug('Pagination progress', { loaded, total: total ?? maxRecs })
            }
          })

          result = paginationResult.data

          log.info('Chunked pagination completed', {
            totalFetched: result.length,
            totalPages: paginationResult.pages,
            hasMore: paginationResult.hasMore
          })
        } else {
          // Single request for small datasets or non-data-model endpoints
          let requestEndpoint = endpoint.trim()
          if (isDataModel) {
            const separator = requestEndpoint.includes('?') ? '&' : '?'
            requestEndpoint += `${separator}limit=${maxRecs}&offset=0`
          }
          const client = getHttpClient()
          result = await sendRawRequest('get', requestEndpoint, undefined, client)
        }
      } else {
        // POST/PUT mode - parse JSON content securely
        let requestData = undefined
        if (jsonContent.trim()) {
          try {
            const { parseSecureJson } = await import('../../utils/secure-json')
            const parseResult = parseSecureJson(jsonContent.trim(), {
              maxSize: 1024 * 1024, // 1MB limit for request body
              maxDepth: 20,
              maxKeys: 1000
            })
            
            if (!parseResult.success) {
              throw new Error(`Invalid JSON in request body: ${parseResult.error}`)
            }
            
            requestData = parseResult.data
          } catch (parseError) {
            const errorMessage = parseError instanceof Error ? parseError.message : 'Invalid JSON format'
            throw new Error(`JSON parsing failed: ${errorMessage}`)
          }
        }

        const client = getHttpClient()
        const method = requestMode.toLowerCase() as 'post' | 'put'
        result = await sendRawRequest(method, endpoint.trim(), requestData, client)
      }

      setResponseData(result)

      // Infer entity type from endpoint for field detection
      const entityType = inferEntityTypeFromEndpoint(endpoint.trim())
      setInferredEntityType(entityType)
      log.debug('Inferred entity type from endpoint', {
        endpoint: endpoint.trim(),
        entityType
      })

      const recordCount = Array.isArray(result) ? result.length : 1
      setJsonContent(JSON.stringify(result, null, 2))
      // Auto-switch to table view for larger datasets
      setViewMode(recordCount > 100 ? 'table' : 'json')
      const successMessage = progress
        ? `${requestMode} request successful - fetched ${recordCount} records in ${Math.ceil(recordCount / 2000)} chunks`
        : `${requestMode} request successful`

      toastService.success(successMessage)

      log.info('Flex export request completed successfully', {
        endpoint: endpoint.trim(),
        mode: requestMode,
        responseType: Array.isArray(result) ? 'array' : typeof result,
        recordCount,
        usedChunking: !!progress
      })

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Request failed'
      setError(errorMessage)

      toastService.error(errorMessage)

      log.error('Flex export request failed', {
        endpoint: endpoint.trim(),
        mode: requestMode,
        error: errorMessage
      })
    } finally {
      setIsLoading(false)
      setProgress(null)
    }
  }, [endpoint, mode, jsonContent, log, isDataModelEndpoint, maxRecords, isMinimal, addToHistory])


  // Handle direct export for specific format
  const handleDirectExport = useCallback(async (format: ExportFormat) => {
    if (isMinimal) {
      return
    }
    if (!responseData) {
      toastService.error('No data to export')
      return
    }

    setIsExporting(true)
    try {
      // Prepare data for export
      const exportData = Array.isArray(responseData) ? responseData : [responseData]
      const now = new Date()
      const dateStr = formatDate(now, 'yyyy-MM-dd')
      const timeStr = formatDate(now, 'HH-mm')
      const filename = `${tenantSlug || 'unknown'}_flex_export_${endpoint.replace(/[^a-zA-Z0-9]/g, '_')}_${dateStr}_${timeStr}`

      log.info('Starting flex export', {
        endpoint,
        format,
        recordCount: exportData.length
      })

      let blob: Blob
      let fullFilename: string

      if (format === 'json') {
        const jsonString = JSON.stringify(exportData, null, 2)
        blob = new Blob([jsonString], { type: 'application/json' })
        fullFilename = `${filename}.json`
      } else if (format === 'csv') {
        // Simple CSV generation
        if (exportData.length === 0) {
          blob = new Blob([''], { type: 'text/csv' })
        } else {
          const headers = Object.keys(exportData[0])
          const csvRows = [
            headers.join(','), // Header row
            ...exportData.map(row =>
              headers.map(field => {
                const value = row[field]
                // Escape quotes and wrap in quotes if contains comma
                const stringValue = String(value ?? '')
                return stringValue.includes(',') || stringValue.includes('"')
                  ? `"${stringValue.replace(/"/g, '""')}"`
                  : stringValue
              }).join(',')
            )
          ]
          blob = new Blob([csvRows.join('\n')], { type: 'text/csv' })
        }
        fullFilename = `${filename}.csv`
      } else {
        // For xlsx, we'll just export as JSON with a note
        const note = '// Note: Excel export unavailable - exported as JSON instead\n'
        const jsonString = note + JSON.stringify(exportData, null, 2)
        blob = new Blob([jsonString], { type: 'application/json' })
        fullFilename = `${filename}.json`
        toastService.success('Excel export not available - exported as JSON instead')
      }

      // Create download link
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = fullFilename
      link.style.display = 'none'

      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)

      // Clean up
      setTimeout(() => URL.revokeObjectURL(url), 1000)

      toastService.success('Export completed')

      log.info('Flex export completed', {
        endpoint,
        format,
        filename: fullFilename
      })

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Export failed'
      toastService.error(errorMessage)

      log.error('Flex export failed', {
        endpoint,
        format,
        error: errorMessage
      })
    } finally {
      setIsExporting(false)
    }
  }, [responseData, endpoint, log, isMinimal])

  // Determine if we have exportable data
  const hasExportableData = responseData && (Array.isArray(responseData) ? responseData.length > 0 : true)

  return (
    <div className={clsx('space-y-6', className)}>
      {/* Tool Header */}
      <ToolHeader title={isMinimal ? 'Flex Export (Minimal)' : 'Flex Export'} icon={DatabaseIcon}>
        {/* Data Controls */}
        <ToolHeaderControls category={CONTROL_CATEGORIES.DATA}>
          {/* Mode Toggle */}
          {!isMinimal && (
            <Radio.Group
              value={mode}
              onChange={(e) => setMode(e.target.value)}
              size="small"
              optionType="button"
              buttonStyle="solid"
            >
              <Radio.Button value="GET">
                <PlayCircleOutlined /> GET
              </Radio.Button>
              <Radio.Button value="POST">
                <EditOutlined /> POST
              </Radio.Button>
              <Radio.Button value="PUT">
                <EditOutlined /> PUT
              </Radio.Button>
            </Radio.Group>
          )}

          {/* Endpoint Input */}
          <div className='flex-1 relative'>
            <div className='relative'>
              <CompactInput
                width='w-[600px]'
                placeholder='Enter API endpoint (e.g., companies, issues, workflows/templates)'
                value={endpoint}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEndpoint(e.target.value)}
                onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => {
                  if (e.key === 'Enter' && !isLoading) {
                    handleExecute()
                  }
                }}
              />
            </div>
          </div>

          {/* History Dropdown */}
          {!isMinimal && (
            <Dropdown
              menu={{ items: historyMenuItems }}
              disabled={history.length === 0}
              placement="bottomRight"
              trigger={['click']}
            >
              <Button
                size="small"
                icon={<HistoryOutlined />}
                disabled={history.length === 0}
                title={history.length > 0 ? `${history.length} recent endpoints` : 'No endpoint history'}
                className="text-gray-500 hover:text-gray-700"
              />
            </Dropdown>
          )}

          {/* Max Records */}
          {!isMinimal && (
            <CompactInput
              type='number'
              width='w-24'
              placeholder='Max (100)'
              value={maxRecords}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setMaxRecords(e.target.value)}
              min='1'
              max='10000'
              title='Maximum records to fetch. Requests >2000 will be automatically chunked.'
            />
          )}

          <Button
            size='small'
            type='primary'
            onClick={handleExecute}
            disabled={isLoading || !endpoint.trim()}
            loading={isLoading}
          >
            {isLoading
              ? progress
                ? `Fetching... ${progress.loaded}/${progress.total ?? '?'}`
                : 'Executing...'
              : 'Execute'}
          </Button>

        </ToolHeaderControls>

        {!isMinimal && (
          <>
            <ToolHeaderDivider />

            {/* Export Controls */}
            <ToolHeaderControls category={CONTROL_CATEGORIES.EXPORT}>
              <span className="font-medium text-sm -mr-1">Export:</span>
              <ExportFormatButtons
                selectedFormat={formatControl.selectedFormat}
                onSelect={(format) => {
                  formatControl.selectFormat(format)
                  void handleDirectExport(format)
                }}
                disabled={!hasExportableData || isExporting}
                loading={isExporting}
              />
            </ToolHeaderControls>
          </>
        )}
      </ToolHeader>


      {isMinimal && (
        <>
          <p className='-mt-4 text-sm text-gray-600'>
            Basic API tester - export functionality disabled for testing
          </p>
          <div className='rounded-lg border border-gray-200 bg-gray-50 p-4'>
            <p className='text-sm text-gray-700'>
              <strong>URL Format:</strong> <code>api.planhat.com/</code>
              <span className='text-blue-600'>[your-endpoint]</span>
              <code>?tenantSlug={tenantSlug ?? '[tenant-slug]'}</code>
            </p>
          </div>
        </>
      )}



      {/* Table View for Large Datasets */}
      {!isMinimal && responseData && Array.isArray(responseData) && responseData.length > 100 && viewMode === 'table' && (
        <div className='space-y-4'>
          <div className='flex items-center justify-between'>
            <div className='flex items-center gap-2'>
              <h3 className='text-lg font-medium text-gray-900'>Response Data</h3>
              <div className='text-sm text-gray-600'>
                ({responseData.length} records)
              </div>
            </div>
            <Radio.Group
              value={viewMode}
              onChange={(e) => setViewMode(e.target.value)}
              size="small"
              optionType="button"
              buttonStyle="solid"
            >
              <Radio.Button value="table">Table View</Radio.Button>
              <Radio.Button value="json">JSON Preview</Radio.Button>
            </Radio.Group>
          </div>

          <Table
            data={responseData}
            fieldMappings={tableFieldMappings}
            entityType={inferredEntityType}
            tenantSlug={tenantSlug ?? undefined}
            enablePersistence={false}
            enableRowVirtualization={true}
            enableColumnVirtualization={true}
            enableColumnResizing={true}
            enableSorting={true}
            enableFiltering={true}
            enableGlobalFilter={true}
            loading={fieldDetection.isLoading}
          />
        </div>
      )}

      {/* JSON Response Display */}
      {(jsonContent || error) && (viewMode === 'json' || !responseData || !Array.isArray(responseData) || responseData.length <= 100) && (
        <div className='space-y-4'>
          <div className='flex items-center justify-between'>
            <div className='flex items-center gap-2'>
              <h3 className='text-lg font-medium text-gray-900'>Response Data</h3>
              {error && (
                <div className='flex items-center gap-1 text-red-600'>
                  <AlertCircleIcon className='h-4 w-4' />
                  <span className='text-sm font-medium'>Request failed</span>
                </div>
              )}
              {!error && responseData && Array.isArray(responseData) && (
                <div className='text-sm text-gray-600'>
                  ({responseData.length} records)
                </div>
              )}
            </div>
            {!error && !isMinimal && responseData && Array.isArray(responseData) && responseData.length > 100 && (
              <Radio.Group
                value={viewMode}
                onChange={(e) => setViewMode(e.target.value)}
                size="small"
                optionType="button"
                buttonStyle="solid"
              >
                <Radio.Button value="table">Table View</Radio.Button>
                <Radio.Button value="json">JSON Preview</Radio.Button>
              </Radio.Group>
            )}
          </div>

          <Input.TextArea
            value={error || jsonContent}
            onChange={!isMinimal && (mode === 'POST' || mode === 'PUT') ? (e) => setJsonContent(e.target.value) : undefined}
            className='font-mono text-sm'
            rows={20}
            readOnly={isMinimal || mode === 'GET' || !!error}
          />
          <p className='text-xs text-gray-500'>
            {error
              ? 'Error response from server'
              : !isMinimal && (mode === 'POST' || mode === 'PUT')
              ? `${mode} request body (editable) - Response will update here after execution`
              : 'Response data (read-only in GET mode)'}
          </p>

          {/* Field Detection Info */}
          {!isMinimal && fieldDetection.fieldMappings.length > 0 && (
            <div className='text-sm text-gray-600'>
              <strong>Export Fields:</strong> {fieldDetection.includedFields.length} selected, {fieldDetection.fieldMappings.length} total detected
            </div>
          )}
        </div>
      )}

      {/* Empty State */}
      {!jsonContent && !isLoading && !error && (
        <div className='rounded-lg border-2 border-dashed border-gray-300 p-12 text-center'>
          <DatabaseIcon className='mx-auto h-12 w-12 text-gray-400' />
          <h3 className='mt-4 text-lg font-medium text-gray-900'>No Data Yet</h3>
          <p className='mt-2 text-sm text-gray-500'>
            Enter an endpoint above and execute a request to see the response data
          </p>
        </div>
      )}
    </div>
  )
}