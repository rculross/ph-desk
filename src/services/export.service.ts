/**
 * Export Service for Planhat Extension
 *
 * Handles CSV, Excel, and JSON exports with streaming support for large datasets.
 * Provides progress tracking and efficient memory management.
 */

import { format } from 'date-fns'

// Dynamic imports for Excel libraries to prevent service worker issues
let parseCSV: ((input: string, config?: unknown) => unknown) | undefined, unparseCSV: ((data: unknown, config?: unknown) => string) | undefined
let XLSXUtils: unknown, writeXLSX: unknown

// Lazy load CSV and Excel libraries
async function loadCSVLibrary() {
  if (!parseCSV || !unparseCSV) {
    const papaparse = await import('papaparse')
    parseCSV = papaparse.parse
    unparseCSV = papaparse.unparse
  }
  return { parseCSV, unparseCSV }
}

async function loadXLSXLibrary() {
  if (!XLSXUtils || !writeXLSX) {
    const xlsx = await import('xlsx')
    XLSXUtils = xlsx.utils
    writeXLSX = xlsx.write
  }
  return { XLSXUtils, writeXLSX }
}

import type {
  ExportFormat,
  ExportOptions,
  ExportJob,
  Issue,
  Workflow,
  EntityType
} from '../types/api'
import type { FieldMapping } from '../types/export'
import { processDataTransformation, processBatchOperations } from '../utils/chunk-processor'
import { logger } from '../utils/logger'
import { stripHtml } from '../utils/text-utils'

import { ExportJobOrchestrator, type ExportProgress } from './exports/export-job-orchestrator'
export type { ExportProgress } from './exports/export-job-orchestrator'


// Export Configuration Types
export interface ExportConfig {
  batchSize: number
  maxMemoryUsage: number // in MB
  compressionLevel: number
  timeout: number // in ms
}



export interface ExportRequest<T = unknown> {
  data: T[]
  format: ExportFormat
  filename: string
  options: ExportOptions
  fields: FieldMapping[]
  entityType: EntityType
}

export interface StreamingExportRequest<T = unknown> {
  dataProvider: (offset: number, limit: number) => Promise<{ data: T[]; total: number }>
  format: ExportFormat
  filename: string
  options: ExportOptions
  fields: FieldMapping[]
  entityType: EntityType
  totalRecords?: number
}

// Default export configuration
const DEFAULT_CONFIG: ExportConfig = {
  batchSize: 1000,
  maxMemoryUsage: 100, // 100MB
  compressionLevel: 6,
  timeout: 300000 // 5 minutes
}

export class ExportService extends ExportJobOrchestrator {
  private config: ExportConfig

  constructor(config: Partial<ExportConfig> = {}) {
    super(logger.api)
    this.config = { ...DEFAULT_CONFIG, ...config }
    this.log.info('Export service initialized', {
      config: this.config,
      batchSize: this.config.batchSize,
      maxMemoryUsage: `${this.config.maxMemoryUsage}MB`,
      timeout: `${this.config.timeout}ms`
    })
  }

  /**
   * Start a new export job with progress tracking
   */
  async startExport<T = unknown>(request: ExportRequest<T>): Promise<string> {
    const { jobId, signal } = this.initializeJob({ totalRecords: request.data.length })

    this.log.info('Starting export job', {
      jobId,
      entityType: request.entityType,
      format: request.format,
      filename: request.filename,
      totalRecords: request.data.length,
      includedFields: request.fields.filter(f => f.include).length
    })

    // Start export in background
    this.processExport(request, jobId, signal).catch(error => {
      this.handleError(jobId, error, {
        phase: 'processExport',
        format: request.format,
        entityType: request.entityType
      })
    })

    return jobId
  }

  /**
   * Start a streaming export for large datasets
   */
  async startStreamingExport<T = unknown>(request: StreamingExportRequest<T>): Promise<string> {
    // Get total count if not provided
    let totalRecords = request.totalRecords
    if (!totalRecords) {
      this.log.debug('Fetching total record count for streaming export', {
        entityType: request.entityType,
        filename: request.filename
      })
      const firstBatch = await request.dataProvider(0, 1)
      totalRecords = firstBatch.total
    }

    const { jobId, signal } = this.initializeJob({ totalRecords: totalRecords ?? 0 })

    this.log.debug('Streaming export job initialized', {
      jobId,
      totalRecords: totalRecords ?? 0,
      activeJobs: this.activeJobs.size
    })

    this.log.info('Starting streaming export job', {
      jobId,
      entityType: request.entityType,
      format: request.format,
      filename: request.filename,
      providedTotalRecords: request.totalRecords,
      resolvedTotalRecords: totalRecords,
      includedFields: request.fields.filter(f => f.include).length
    })

    // Start streaming export in background
    this.processStreamingExport({ ...request, totalRecords }, jobId, signal).catch(error => {
      this.handleError(jobId, error, {
        phase: 'processStreamingExport',
        format: request.format,
        entityType: request.entityType
      })
    })

    return jobId
  }

  /**
   * Cancel an active export job
   */
  cancelExport(jobId: string): boolean {
    return this.cancel(jobId)
  }

  /**
   * Process export for small to medium datasets
   */
  private async processExport<T>(
    request: ExportRequest<T>,
    jobId: string,
    signal: AbortSignal
  ): Promise<void> {
    try {
      this.log.debug('Starting export processing', {
        jobId,
        dataLength: request.data.length
      })
      
      this.updateProgress(jobId, { status: 'processing', progress: 10 })

      // Transform data with field mappings
      this.log.debug('Transforming data with field mappings', {
        jobId,
        inputRecords: request.data.length,
        activeFields: request.fields.filter(f => f.include).length
      })
      
      const transformedData = await this.transformData(request.data, request.fields, request.options)
      this.updateProgress(jobId, { progress: 30 })

      this.log.debug('Data transformation completed', {
        jobId,
        outputRecords: transformedData.length
      })

      if (signal.aborted) {
        this.log.info('Export processing aborted during transformation', { jobId })
        return
      }

      // Generate export content
      this.log.debug('Generating export content', {
        jobId,
        format: request.format
      })
      
      let content: string | ArrayBuffer
      let mimeType: string

      switch (request.format) {
        case 'csv':
          content = await this.generateCSV(transformedData, request.fields, request.options)
          mimeType = 'text/csv'
          break
        case 'json':
          content = this.generateJSON(transformedData, request.options)
          mimeType = 'application/json'
          break
        case 'xlsx':
          content = await this.generateExcel(transformedData, request.fields, request.options)
          mimeType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
          break
        default:
          this.log.error('Unsupported export format', {
            jobId,
            format: request.format
          })
          throw new Error(`Unsupported export format: ${request.format}`)
      }

      const contentSize = content instanceof ArrayBuffer ? content.byteLength : content.length
      this.log.info('Export content generated', {
        jobId,
        format: request.format,
        contentSize,
        mimeType
      })

      this.updateProgress(jobId, { progress: 80 })

      if (signal.aborted) {
        this.log.info('Export processing aborted during content generation', { jobId })
        return
      }

      // Create download URL
      const blob = new Blob([content], { type: mimeType })
      const downloadUrl = URL.createObjectURL(blob)
      
      this.log.info('Export completed successfully', {
        jobId,
        format: request.format,
        totalRecords: request.data.length,
        blobSize: blob.size,
        processingTime: Date.now() - (this.activeJobs.get(jobId)?.startTime ?? 0)
      })

      this.updateProgress(jobId, {
        status: 'completed',
        progress: 100,
        processedRecords: request.data.length,
        downloadUrl
      })

      // Trigger automatic download
      this.triggerDownload(downloadUrl, `${request.filename}.${request.format}`)

      // Schedule cleanup after 1 hour
      setTimeout(() => {
        this.log.debug('Scheduled cleanup executed', { jobId })
        this.cleanup(jobId)
      }, 3600000)
    } catch (error) {
      this.log.error('Export processing failed', {
        jobId,
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      })
      
      this.updateProgress(jobId, {
        status: 'failed',
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  }

  /**
   * Process streaming export for large datasets
   */
  private async processStreamingExport<T>(
    request: StreamingExportRequest<T>,
    jobId: string,
    signal: AbortSignal
  ): Promise<void> {
    try {
      this.log.debug('Starting streaming export processing', {
        jobId,
        totalRecords: request.totalRecords,
        batchSize: this.config.batchSize
      })
      
      this.updateProgress(jobId, { status: 'processing', progress: 5 })

      const chunks: Record<string, unknown>[] = []
      let processedRecords = 0
      let offset = 0
      let batchNumber = 0

      // Initialize progress tracking
      const startTime = Date.now()

      while (processedRecords < (request.totalRecords ?? 0)) {
        if (signal.aborted) {
          this.log.info('Streaming export processing aborted', {
            jobId,
            processedRecords,
            batchNumber
          })
          return
        }

        batchNumber++
        this.log.debug('Fetching batch data', {
          jobId,
          batchNumber,
          offset,
          batchSize: this.config.batchSize
        })

        // Fetch next batch
        const batch = await request.dataProvider(offset, this.config.batchSize)
        if (!batch.data.length) {
          this.log.debug('No more data available, ending processing', {
            jobId,
            batchNumber,
            processedRecords
          })
          break
        }

        this.log.debug('Batch fetched successfully', {
          jobId,
          batchNumber,
          batchSize: batch.data.length
        })

        // Transform batch data
        const transformedBatch = await this.transformData(batch.data, request.fields, request.options)
        chunks.push(...transformedBatch)

        processedRecords += batch.data.length
        offset += this.config.batchSize

        // Update progress
        const progress = Math.min(
          (processedRecords / (request.totalRecords ?? processedRecords)) * 80,
          80
        )
        const elapsed = Date.now() - startTime
        const estimatedTimeRemaining =
          processedRecords > 0
            ? (elapsed / processedRecords) * ((request.totalRecords ?? 0) - processedRecords)
            : undefined

        this.log.debug('Batch processing completed', {
          jobId,
          batchNumber,
          processedRecords,
          progress: progress.toFixed(1),
          estimatedTimeRemaining: estimatedTimeRemaining ? `${Math.round(estimatedTimeRemaining / 1000)}s` : 'unknown'
        })

        this.updateProgress(jobId, {
          progress,
          processedRecords,
          estimatedTimeRemaining
        })

        // Memory management - process in chunks if getting large
        if (chunks.length >= this.config.batchSize * 2) {
          const currentMemoryUsage = this.getMemoryUsage()
          
          this.log.warn('Memory usage check', {
            jobId,
            chunksLength: chunks.length,
            estimatedMemoryUsage: `${currentMemoryUsage}MB`,
            maxMemoryUsage: `${this.config.maxMemoryUsage}MB`
          })
          
          // For very large exports, we might need to implement streaming to file
          // For now, continue accumulating in memory with monitoring
          if (currentMemoryUsage > this.config.maxMemoryUsage) {
            this.log.error('Memory limit exceeded during streaming export', {
              jobId,
              currentUsage: `${currentMemoryUsage}MB`,
              maxUsage: `${this.config.maxMemoryUsage}MB`,
              processedRecords,
              totalRecords: request.totalRecords
            })
            throw new Error(
              'Export size exceeds memory limit. Please use smaller batches or add filters.'
            )
          }
          
          if (currentMemoryUsage > this.config.maxMemoryUsage * 0.8) {
            this.log.warn('Memory usage approaching limit', {
              jobId,
              currentUsage: `${currentMemoryUsage}MB`,
              maxUsage: `${this.config.maxMemoryUsage}MB`,
              warningThreshold: '80%'
            })
          }
        }
      }

      if (signal.aborted) {
        this.log.info('Streaming export processing aborted after batch processing', { jobId })
        return
      }

      this.log.debug('Batch processing completed, generating final export', {
        jobId,
        totalBatches: batchNumber,
        totalProcessedRecords: processedRecords,
        totalChunks: chunks.length
      })

      this.updateProgress(jobId, { progress: 85 })

      // Generate final export
      let content: string | ArrayBuffer
      let mimeType: string

      switch (request.format) {
        case 'csv':
          content = await this.generateCSV(chunks, request.fields, request.options)
          mimeType = 'text/csv'
          break
        case 'json':
          content = this.generateJSON(chunks, request.options)
          mimeType = 'application/json'
          break
        case 'xlsx':
          content = await this.generateExcel(chunks, request.fields, request.options)
          mimeType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
          break
        default:
          this.log.error('Unsupported streaming export format', {
            jobId,
            format: request.format
          })
          throw new Error(`Unsupported export format: ${request.format}`)
      }

      const contentSize = content instanceof ArrayBuffer ? content.byteLength : content.length
      this.log.info('Final export content generated', {
        jobId,
        format: request.format,
        contentSize,
        mimeType
      })

      this.updateProgress(jobId, { progress: 95 })

      // Create download URL
      const blob = new Blob([content], { type: mimeType })
      const downloadUrl = URL.createObjectURL(blob)
      
      const processingTime = Date.now() - startTime
      this.log.info('Streaming export completed successfully', {
        jobId,
        format: request.format,
        totalRecords: processedRecords,
        totalBatches: batchNumber,
        blobSize: blob.size,
        processingTime,
        averageRecordsPerSecond: Math.round(processedRecords / (processingTime / 1000))
      })

      this.updateProgress(jobId, {
        status: 'completed',
        progress: 100,
        processedRecords,
        downloadUrl
      })

      // Trigger automatic download
      this.triggerDownload(downloadUrl, `${request.filename}.${request.format}`)

      // Schedule cleanup
      setTimeout(() => {
        this.log.debug('Scheduled streaming export cleanup executed', { jobId })
        this.cleanup(jobId)
      }, 3600000)
    } catch (error) {
      this.log.error('Streaming export processing failed', {
        jobId,
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      })
      
      this.updateProgress(jobId, {
        status: 'failed',
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  }

  /**
   * Transform raw data using field mappings
   * Uses the Bottleneck scheduler for optimal performance with large datasets
   */
  private async transformData<T>(
    data: T[],
    fields: FieldMapping[],
    options: ExportOptions
  ): Promise<Record<string, unknown>[]> {
    const activeFields = fields.filter(field => field.include)

    // For small datasets, use synchronous processing
    if (data.length < 1000) {
      return data.map(item => this.transformItem(item, activeFields, options))
    }

    // For larger datasets, use Bottleneck-backed chunk processing
    try {
      return await processDataTransformation(
        data,
        (item: T, index: number) => this.transformItem(item, activeFields, options),
        {
          concurrency: 4,
          chunkSize: 500,
          debug: false
        }
      )
    } catch (error) {
      this.log.warn('Bottleneck transformation failed, falling back to synchronous processing', {
        error: error instanceof Error ? error.message : error,
        dataLength: data.length
      })
      
      // Fallback to synchronous processing
      return data.map(item => this.transformItem(item, activeFields, options))
    }
  }

  /**
   * Transform a single data item using field mappings
   */
  private transformItem<T>(
    item: T,
    activeFields: FieldMapping[],
    options: ExportOptions
  ): Record<string, unknown> {
    const transformedItem: Record<string, unknown> = {}

    activeFields.forEach(field => {
      const rawValue = this.getNestedValue(item, field.key)
      let formattedValue: unknown

      if (field.formatter) {
        formattedValue = field.formatter(rawValue)
      } else {
        formattedValue = this.formatValue(rawValue, field.type, options)
      }

      transformedItem[field.label] = formattedValue
    })

    return transformedItem
  }

  /**
   * Generate CSV content
   */
  private async generateCSV(
    data: Record<string, unknown>[],
    fields: FieldMapping[],
    options: ExportOptions
  ): Promise<string> {
    const { unparseCSV: unparseFunction } = await loadCSVLibrary()
    
    const activeFields = fields.filter(field => field.include)
    const headers = options.includeHeaders ? activeFields.map(field => field.label) : undefined

    const csvConfig = {
      header: !!headers,
      skipEmptyLines: true,
      quotes: true,
      quoteChar: '"',
      escapeChar: '"',
      delimiter: ',',
      newline: '\r\n'
    }

    if (headers && data.length > 0) {
      // Ensure headers match data structure
      const csvData = [
        headers,
        ...data.map(row => activeFields.map(field => row[field.label] ?? ''))
      ]
      return unparseFunction(csvData, csvConfig)
    } else {
      return unparseFunction(data, csvConfig)
    }
  }

  /**
   * Generate JSON content
   */
  private generateJSON(data: Record<string, unknown>[], options: ExportOptions): string {
    const jsonData = {
      exportInfo: {
        exportedAt: new Date().toISOString(),
        timezone: options.timezone ?? 'UTC',
        totalRecords: data.length,
        version: '1.0'
      },
      data
    }

    return JSON.stringify(jsonData, null, 2)
  }

  /**
   * Generate Excel content
   */
  private async generateExcel(
    data: Record<string, unknown>[],
    fields: FieldMapping[],
    options: ExportOptions
  ): Promise<ArrayBuffer> {
    const { XLSXUtils: utils, writeXLSX: write } = await loadXLSXLibrary()

    const workbook = (utils as { book_new: () => unknown }).book_new()
    const activeFields = fields.filter(field => field.include)

    // Prepare data for Excel
    const worksheetData = data.map(row => {
      const excelRow: Record<string, unknown> = {}
      activeFields.forEach(field => {
        excelRow[field.label] = row[field.label] ?? ''
      })
      return excelRow
    })

    // Create worksheet
    const worksheet = (utils as { json_to_sheet: (data: unknown) => unknown }).json_to_sheet(worksheetData)

    // Add worksheet to workbook
    ;(utils as { book_append_sheet: (book: unknown, sheet: unknown, name: string) => void }).book_append_sheet(workbook, worksheet, 'Export Data')

    // Add metadata sheet
    const metaData = [
      ['Export Information', ''],
      ['Exported At', new Date().toISOString()],
      ['Timezone', options.timezone ?? 'UTC'],
      ['Total Records', data.length],
      ['Fields Exported', activeFields.length],
      ['', ''],
      ['Field Mappings', ''],
      ...activeFields.map(field => [field.label, field.key])
    ]

    const metaWorksheet = (utils as { aoa_to_sheet: (data: unknown) => unknown }).aoa_to_sheet(metaData)
    ;(utils as { book_append_sheet: (book: unknown, sheet: unknown, name: string) => void }).book_append_sheet(workbook, metaWorksheet, 'Export Info')

    // Generate Excel file
    return (write as (book: unknown, options: unknown) => ArrayBuffer)(workbook, {
      type: 'array',
      bookType: 'xlsx',
      compression: true
    })
  }

  /**
   * Get nested object value using dot notation
   */
  private getNestedValue(obj: unknown, path: string): unknown {
    return path.split('.').reduce((current: unknown, key: string) => {
      return current && typeof current === 'object' && current !== null && key in current ? (current as Record<string, unknown>)[key] : undefined
    }, obj)
  }

  /**
   * Format value based on type and options
   */
  private formatValue(value: unknown, type: FieldMapping['type'], options: ExportOptions): unknown {
    if (value == null) return ''

    switch (type) {
      case 'date':
        if (value instanceof Date || typeof value === 'string') {
          const date = value instanceof Date ? value : new Date(value)
          return format(date, options.dateFormat ?? 'yyyy-MM-dd')
        }
        return value

      case 'boolean':
        return typeof value === 'boolean' ? (value ? 'Yes' : '') : value

      case 'array':
        if (Array.isArray(value)) {
          return value.map(item => {
            if (typeof item === 'object' && item !== null) {
              // For objects, try to find a meaningful string representation
              if (item.name) return item.name
              if (item.title) return item.title
              if (item.label) return item.label
              if (item.id) return item.id
              return JSON.stringify(item)
            }
            return String(item)
          }).join(', ')
        }
        return value

      case 'object':
        if (typeof value === 'object' && value !== null) {
          // Return empty string for empty objects
          const keys = Object.keys(value)
          if (keys.length === 0) return ''
          return JSON.stringify(value)
        }
        return value

      case 'number':
        return typeof value === 'number' ? value : parseFloat(value) || value

      case 'richtext':
        // For rich text, strip HTML by default unless preserving formatting
        if (typeof value === 'string') {
          try {
            return stripHtml(value)
          } catch (error) {
            // Fallback: simple HTML tag removal
            return value.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim()
          }
        }
        return String(value)

      case 'rating':
        // Convert rating to stars representation or numeric
        const rating = Number(value)
        if (!isNaN(rating) && rating >= 1 && rating <= 5) {
          // Export as numeric value with star representation
          return `${rating} ${'★'.repeat(rating)}${'☆'.repeat(5 - rating)}`
        }
        return value

      case 'user':
        // Extract user name or email for single user
        if (typeof value === 'string') {
          return value
        }
        if (typeof value === 'object' && value) {
          return (value.name || value.email || value.id) ?? 'Unknown User'
        }
        return value

      case 'users':
        // Format multiple users as comma-separated list
        if (Array.isArray(value)) {
          return value.map(user => {
            if (typeof user === 'string') return user
            if (typeof user === 'object' && user) {
              return (user.name || user.email || user.id) ?? 'Unknown User'
            }
            return String(user)
          }).join(', ')
        }
        return value

      case 'string':
      default:
        return String(value)
    }
  }

  protected override updateProgress(jobId: string, updates: Partial<ExportProgress>): void {
    const previous = this.getProgress(jobId)
    super.updateProgress(jobId, updates)
    const current = this.getProgress(jobId)

    if (previous && updates.status && updates.status !== previous.status && current) {
      this.log.info('Export status changed', {
        jobId,
        previousStatus: previous.status,
        newStatus: updates.status,
        progress: current.progress
      })
    }
  }

  /**
   * Get approximate memory usage (simplified)
   */
  private getMemoryUsage(): number {
    // Simplified memory estimation - in real implementation might use performance.memory
    return Math.round(JSON.stringify(Array.from(this.activeJobs.values())).length / 1024 / 1024)
  }

  /**
   * Trigger file download
   */
  private triggerDownload(downloadUrl: string, filename: string): void {
    this.log.info('Triggering automatic file download', {
      filename,
      url: `${downloadUrl.substring(0, 50)}...` // Log partial URL for privacy
    })

    const link = document.createElement('a')
    link.href = downloadUrl
    link.download = filename
    link.style.display = 'none'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)

    this.log.info('File download triggered successfully', { filename })
  }

  /**
   * Clean up completed/failed jobs
   */
  protected override cleanup(jobId: string): void {
    const progress = this.getProgress(jobId)

    this.log.debug('Cleaning up export job', {
      jobId,
      finalStatus: progress?.status,
      hadDownloadUrl: !!progress?.downloadUrl
    })
    
    if (progress?.downloadUrl) {
      URL.revokeObjectURL(progress.downloadUrl)
    }

    super.cleanup(jobId)

    this.log.debug('Export job cleanup completed', {
      jobId,
      remainingActiveJobs: this.getActiveJobs().length
    })
  }
}

// Create default instance
export const exportService = new ExportService()

// Types are already exported above with 'export interface'
