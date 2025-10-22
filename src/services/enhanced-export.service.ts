/**
 * Enhanced Export Service for Planhat Extension
 *
 * Provides advanced Excel exports using xlsx-populate with rich formatting,
 * multi-sheet capabilities, and enhanced styling options while maintaining
 * compatibility with existing export service API.
 */

import { format } from 'date-fns'

// Dynamic imports to prevent service worker issues
let parseCSV: ((input: string, config?: unknown) => unknown) | undefined, unparseCSV: ((data: unknown, config?: unknown) => string) | undefined, XlsxPopulate: unknown

// Lazy load libraries
async function loadCSVLibrary() {
  if (!parseCSV || !unparseCSV) {
    const papaparse = await import('papaparse')
    parseCSV = papaparse.parse
    unparseCSV = papaparse.unparse
  }
  return { parseCSV, unparseCSV }
}

async function loadXlsxPopulateLibrary() {
  if (!XlsxPopulate) {
    XlsxPopulate = await import('xlsx-populate')
  }
  return XlsxPopulate
}

import type {
  ExportFormat,
  ExportOptions,
  ExportJob,
  Issue,
  Workflow,
  EntityType
} from '../types/api'
import type {
  EnhancedFieldMapping,
  CellStyle,
  BorderStyle,
  ConditionalFormattingRule
} from '../types/export'
import { logger } from '../utils/logger'

import { ExportJobOrchestrator } from './exports/export-job-orchestrator'


export type { EnhancedFieldMapping }


// Export Configuration Types
export interface EnhancedExportConfig {
  batchSize: number
  maxMemoryUsage: number // in MB
  timeout: number // in ms
  enableStyling: boolean
  defaultFontSize: number
  defaultFontFamily: string
}

export interface ExportProgress {
  jobId: string
  status: 'preparing' | 'processing' | 'completed' | 'failed' | 'cancelled'
  progress: number // 0-100
  totalRecords: number
  processedRecords: number
  estimatedTimeRemaining?: number
  error?: string
  startTime: number
  downloadUrl?: string
}

export interface EnhancedExportRequest<T = unknown> {
  data: T[]
  format: ExportFormat
  filename: string
  options: EnhancedExportOptions
  fields: EnhancedFieldMapping[]
  entityType: EntityType
  sheetName?: string
  includeMetadata?: boolean
}

export interface MultiSheetExportRequest {
  sheets: {
    name: string
    data: unknown[]
    fields: EnhancedFieldMapping[]
    options?: Partial<EnhancedExportOptions>
  }[]
  filename: string
  globalOptions: EnhancedExportOptions
  workbookOptions?: WorkbookOptions
}

export interface EnhancedExportOptions extends Omit<ExportOptions, 'includeRelatedData'> {
  includeHeaders: boolean
  includeCustomFields: boolean
  includeRelatedData?: boolean
  dateFormat: string
  timezone?: string
  // Enhanced styling options
  headerStyle?: CellStyle
  alternatingRowColors?: boolean
  freezeHeader?: boolean
  autoFilterHeader?: boolean
  groupByField?: string
  sortBy?: { field: string; direction: 'asc' | 'desc' }[]
  // Sheet options
  orientation?: 'portrait' | 'landscape'
  paperSize?: string
  margins?: { top: number; bottom: number; left: number; right: number }
}

export interface WorkbookOptions {
  creator?: string
  title?: string
  subject?: string
  description?: string
  category?: string
  company?: string
  properties?: Record<string, unknown>
}

export interface StreamingExportRequest<T = unknown> {
  dataProvider: (offset: number, limit: number) => Promise<{ data: T[]; total: number }>
  format: ExportFormat
  filename: string
  options: EnhancedExportOptions
  fields: EnhancedFieldMapping[]
  entityType: EntityType
  totalRecords?: number
}

// Default configuration
const DEFAULT_CONFIG: EnhancedExportConfig = {
  batchSize: 1000,
  maxMemoryUsage: 150, // 150MB for enhanced features
  timeout: 300000, // 5 minutes
  enableStyling: true,
  defaultFontSize: 11,
  defaultFontFamily: 'Calibri'
}

// Style constants adapted from your workflow example
const STYLE_CONSTANTS = {
  COLORS: {
    HEADER_BACKGROUND: 'E6E6E6',
    HYPERLINK: '0563C1',
    SUCCESS: 'E8F5E8',
    WARNING: 'FFF4E6',
    ERROR: 'FFE6E6',
    INFO: 'E6F3FF',
    ALTERNATING_ROW: 'F8F9FA'
  },
  BORDERS: {
    THIN: 'thin',
    MEDIUM: 'medium',
    THICK: 'thick'
  }
}

/**
 * Enhanced Export Service with xlsx-populate for rich formatting
 */
export class EnhancedExportService extends ExportJobOrchestrator {
  private config: EnhancedExportConfig
  private objectUrls = new WeakMap<object, string>()
  private urlCleanupTimers = new Map<string, NodeJS.Timeout>()

  constructor(config: Partial<EnhancedExportConfig> = {}) {
    super(logger.api)
    this.config = { ...DEFAULT_CONFIG, ...config }
    this.log.info('Enhanced export service initialized', {
      config: this.config,
      stylingEnabled: this.config.enableStyling,
      maxMemoryUsage: `${this.config.maxMemoryUsage}MB`
    })
  }

  /**
   * Start an enhanced export job with rich formatting
   */
  async startEnhancedExport<T = unknown>(request: EnhancedExportRequest<T>): Promise<string> {
    const { jobId, signal } = this.initializeJob({ totalRecords: request.data.length })

    this.log.info('Starting enhanced export job', {
      jobId,
      entityType: request.entityType,
      format: request.format,
      filename: request.filename,
      totalRecords: request.data.length,
      includedFields: request.fields.filter(f => f.include).length,
      includeMetadata: request.includeMetadata
    })

    // Start export in background
    this.processEnhancedExport(request, jobId, signal).catch(error => {
      this.handleError(jobId, error, {
        phase: 'processEnhancedExport',
        format: request.format,
        entityType: request.entityType
      })
    })

    return jobId
  }

  /**
   * Start multi-sheet export with individual sheet styling
   */
  async startMultiSheetExport(request: MultiSheetExportRequest): Promise<string> {
    const totalRecords = request.sheets.reduce((sum, sheet) => sum + sheet.data.length, 0)
    const { jobId, signal } = this.initializeJob({ totalRecords })

    this.log.info('Starting multi-sheet export job', {
      jobId,
      filename: request.filename,
      sheetsCount: request.sheets.length,
      totalRecords
    })

    // Start export in background
    this.processMultiSheetExport(request, jobId, signal).catch(error => {
      this.handleError(jobId, error, {
        phase: 'processMultiSheetExport'
      })
    })

    return jobId
  }

  /**
   * Process enhanced single-sheet export
   */
  private async processEnhancedExport<T>(
    request: EnhancedExportRequest<T>,
    jobId: string,
    signal: AbortSignal
  ): Promise<void> {
    this.updateProgress(jobId, { status: 'processing', progress: 10 })

    let buffer: ArrayBuffer
    
    if (request.format === 'xlsx') {
      buffer = await this.createEnhancedExcel(request.data, request.fields, request.options, signal)
    } else if (request.format === 'csv') {
      buffer = await this.createCSV(request.data, request.fields, request.options)
    } else {
      buffer = this.createJSON(request.data, request.fields, request.options)
    }

    this.updateProgress(jobId, { progress: 90 })

    // Create download URL
    const blob = new Blob([buffer], {
      type: this.getMimeType(request.format)
    })
    
    const downloadUrl = URL.createObjectURL(blob)
    
    // Track the URL for proper cleanup
    this.objectUrls.set(blob, downloadUrl)
    
    this.updateProgress(jobId, {
      status: 'completed',
      progress: 100,
      downloadUrl
    })

    // Trigger download
    this.downloadFile(downloadUrl, `${request.filename}.${request.format}`)

    this.log.info('Enhanced export completed successfully', {
      jobId,
      format: request.format,
      totalRecords: request.data.length
    })
  }

  /**
   * Process multi-sheet export
   */
  private async processMultiSheetExport(
    request: MultiSheetExportRequest,
    jobId: string,
    signal: AbortSignal
  ): Promise<void> {
    this.updateProgress(jobId, { status: 'processing', progress: 10 })

    const xlsxPopulate = await loadXlsxPopulateLibrary()
    const workbook = await xlsxPopulate.default.fromBlankAsync()

    // Set workbook properties
    if (request.workbookOptions) {
      const props = request.workbookOptions
      if (props.title) workbook.property('title', props.title)
      if (props.creator) workbook.property('creator', props.creator)
      if (props.subject) workbook.property('subject', props.subject)
      if (props.description) workbook.property('description', props.description)
    }

    // Create summary sheet if more than one data sheet
    if (request.sheets.length > 1) {
      await this.createSummarySheet(workbook, request.sheets)
    }

    // Process each sheet
    const progressIncrement = 80 / request.sheets.length
    let currentProgress = 10
    
    for (const [index, sheet] of request.sheets.entries()) {
      if (signal.aborted) return

      const sheetName = this.sanitizeSheetName(sheet.name, index + 1)
      const worksheet = index === 0 ? workbook.sheet(0) : workbook.addSheet(sheetName)
      
      if (index === 0) {
        worksheet.name(sheetName)
      }

      const sheetOptions = { ...request.globalOptions, ...sheet.options }
      await this.populateWorksheet(worksheet, sheet.data, sheet.fields, sheetOptions)

      currentProgress += progressIncrement
      this.updateProgress(jobId, { progress: Math.round(currentProgress) })
    }

    this.updateProgress(jobId, { progress: 90 })

    // Generate file buffer
    const buffer = await workbook.outputAsync()
    
    // Create download URL
    const blob = new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    })
    
    const downloadUrl = URL.createObjectURL(blob)
    
    // Track the URL for proper cleanup
    this.objectUrls.set(blob, downloadUrl)
    
    this.updateProgress(jobId, {
      status: 'completed',
      progress: 100,
      downloadUrl
    })

    // Trigger download
    this.downloadFile(downloadUrl, `${request.filename}.xlsx`)

    this.log.info('Multi-sheet export completed successfully', {
      jobId,
      sheetsCount: request.sheets.length,
      totalRecords: request.sheets.reduce((sum, sheet) => sum + sheet.data.length, 0)
    })
  }

  /**
   * Create enhanced Excel with xlsx-populate
   */
  private async createEnhancedExcel<T>(
    data: T[],
    fields: EnhancedFieldMapping[],
    options: EnhancedExportOptions,
    signal: AbortSignal
  ): Promise<ArrayBuffer> {
    const xlsxPopulate = await loadXlsxPopulateLibrary()
    const workbook = await xlsxPopulate.default.fromBlankAsync()
    const worksheet = workbook.sheet(0)
    
    const activeFields = fields.filter(field => field.include)
    const sheetName = options.includeHeaders ? 'Data' : 'Sheet1'
    worksheet.name(sheetName)

    await this.populateWorksheet(worksheet, data, activeFields, options)

    return await workbook.outputAsync()
  }

  /**
   * Populate worksheet with data and styling
   */
  private async populateWorksheet(
    worksheet: unknown,
    data: unknown[],
    fields: EnhancedFieldMapping[],
    options: EnhancedExportOptions
  ): Promise<void> {
    let currentRow = 1

    // Add headers if requested
    if (options.includeHeaders) {
      await this.addHeaders(worksheet, fields, currentRow, options)
      currentRow = 2
      
      if (options.freezeHeader) {
        worksheet.freezePanes(2, 1) // Freeze first row
      }
      
      if (options.autoFilterHeader) {
        const range = `A1:${this.columnIndexToLetter(fields.length)}1`
        worksheet.autoFilter(range)
      }
    }

    // Add data rows
    for (const [rowIndex, rowData] of data.entries()) {
      await this.addDataRow(worksheet, rowData, fields, currentRow + rowIndex, options, rowIndex)
    }

    // Set column widths
    fields.forEach((field, colIndex) => {
      const width = field.width || this.calculateColumnWidth(field.type, field.label)
      worksheet.column(colIndex + 1).width(width)
    })

    // Apply sheet-level formatting
    if (options.orientation === 'landscape') {
      worksheet.pageSetup('orientation', 'landscape')
    }

    this.log.debug('Worksheet populated successfully', {
      dataRows: data.length,
      columns: fields.length,
      headers: options.includeHeaders
    })
  }

  /**
   * Add headers with styling
   */
  private async addHeaders(
    worksheet: unknown,
    fields: EnhancedFieldMapping[],
    row: number,
    options: EnhancedExportOptions
  ): Promise<void> {
    const defaultHeaderStyle: CellStyle = {
      bold: true,
      fill: STYLE_CONSTANTS.COLORS.HEADER_BACKGROUND,
      horizontalAlignment: 'center',
      verticalAlignment: 'center',
      fontSize: this.config.defaultFontSize + 1,
      ...options.headerStyle
    }

    fields.forEach((field, colIndex) => {
      const cell = worksheet.cell(row, colIndex + 1)
      cell.value(field.label)
      
      const headerStyle = { ...defaultHeaderStyle, ...field.headerStyle }
      this.applyCellStyle(cell, headerStyle)
    })
  }

  /**
   * Add data row with conditional formatting and styling
   */
  private async addDataRow(
    worksheet: unknown,
    rowData: unknown,
    fields: EnhancedFieldMapping[],
    row: number,
    options: EnhancedExportOptions,
    rowIndex: number
  ): Promise<void> {
    // Apply alternating row colors if enabled
    const isAlternatingRow = options.alternatingRowColors && rowIndex % 2 === 1

    fields.forEach((field, colIndex) => {
      const cell = worksheet.cell(row, colIndex + 1)
      const rawValue = this.getNestedValue(rowData, field.key)
      const formattedValue = this.formatCellValue(rawValue, field)
      
      cell.value(formattedValue)

      // Apply base cell style
      let cellStyle: CellStyle = { ...field.cellStyle }
      
      // Apply alternating row color
      if (isAlternatingRow && !cellStyle.fill) {
        cellStyle.fill = STYLE_CONSTANTS.COLORS.ALTERNATING_ROW
      }

      // Apply conditional formatting
      if (field.conditionalFormatting) {
        const conditionalStyle = this.evaluateConditionalFormatting(rawValue, field.conditionalFormatting)
        if (conditionalStyle) {
          cellStyle = { ...cellStyle, ...conditionalStyle }
        }
      }

      // Apply type-specific formatting
      cellStyle = { ...cellStyle, ...this.getTypeSpecificStyle(field.type, rawValue) }

      this.applyCellStyle(cell, cellStyle)
    })
  }

  /**
   * Apply cell style using xlsx-populate
   */
  private applyCellStyle(cell: unknown, style: CellStyle): void {
    if (!this.config.enableStyling) return

    if (style.bold) cell.style('bold', true)
    if (style.italic) cell.style('italic', true)
    if (style.underline) cell.style('underline', true)
    if (style.fontSize) cell.style('fontSize', style.fontSize)
    if (style.fontFamily) cell.style('fontFamily', style.fontFamily)
    if (style.fontColor) cell.style('fontColor', style.fontColor)
    if (style.fill) cell.style('fill', style.fill)
    if (style.horizontalAlignment) cell.style('horizontalAlignment', style.horizontalAlignment)
    if (style.verticalAlignment) cell.style('verticalAlignment', style.verticalAlignment)
    if (style.numberFormat) cell.style('numberFormat', style.numberFormat)
    if (style.wrapText) cell.style('wrapText', true)
    
    if (style.border) {
      if (typeof style.border === 'boolean' && style.border) {
        cell.style('border', true)
      } else if (typeof style.border === 'object') {
        const border = style.border
        if (border.top) cell.style('topBorder', border.top)
        if (border.bottom) cell.style('bottomBorder', border.bottom)
        if (border.left) cell.style('leftBorder', border.left)
        if (border.right) cell.style('rightBorder', border.right)
      }
    }
  }

  /**
   * Format cell value based on field type and formatter
   */
  private formatCellValue(value: unknown, field: EnhancedFieldMapping): unknown {
    if (value === null || value === undefined) return ''
    
    // Use custom formatter if provided
    if (field.formatter) {
      try {
        return field.formatter(value)
      } catch (error) {
        this.log.warn('Custom formatter failed', { field: field.key, error })
        return value
      }
    }

    // Apply type-specific formatting
    switch (field.type) {
      case 'date':
        return value instanceof Date ? value : new Date(value)
      case 'currency':
        return typeof value === 'number' ? value : parseFloat(value) || 0
      case 'percentage':
        return typeof value === 'number' ? value / 100 : parseFloat(value) / 100 || 0
      case 'boolean':
        return value ? 'Yes' : 'No'
      case 'array':
        return Array.isArray(value) ? value.join(', ') : value
      case 'object':
        return typeof value === 'object' ? JSON.stringify(value) : value
      case 'url':
        return value // URLs will be styled as hyperlinks
      default:
        return value
    }
  }

  /**
   * Get type-specific styling
   */
  private getTypeSpecificStyle(type: string, value: unknown): CellStyle {
    const style: CellStyle = {}

    switch (type) {
      case 'date':
        style.numberFormat = 'yyyy-mm-dd'
        break
      case 'currency':
        style.numberFormat = '$#,##0.00'
        style.horizontalAlignment = 'right'
        break
      case 'percentage':
        style.numberFormat = '0.00%'
        style.horizontalAlignment = 'right'
        break
      case 'number':
        style.horizontalAlignment = 'right'
        break
      case 'url':
        if (value && typeof value === 'string' && (value.startsWith('http') || value.startsWith('mailto'))) {
          style.fontColor = STYLE_CONSTANTS.COLORS.HYPERLINK
          style.underline = true
        }
        break
      case 'boolean':
        style.horizontalAlignment = 'center'
        if (value === true) {
          style.fontColor = '008000' // Green for true
        } else if (value === false) {
          style.fontColor = 'FF0000' // Red for false
        }
        break
    }

    return style
  }

  /**
   * Evaluate conditional formatting rules
   */
  private evaluateConditionalFormatting(
    value: unknown,
    rules: ConditionalFormattingRule[]
  ): CellStyle | null {
    for (const rule of rules) {
      if (this.evaluateCondition(value, rule)) {
        return rule.style
      }
    }
    return null
  }

  /**
   * Evaluate a single conditional formatting condition
   */
  private evaluateCondition(value: unknown, rule: ConditionalFormattingRule): boolean {
    switch (rule.condition) {
      case 'equal':
        return value === rule.value
      case 'not_equal':
        return value !== rule.value
      case 'greater_than':
        return value > (rule.value as any)
      case 'less_than':
        return value < (rule.value as any)
      case 'contains':
        return String(value).toLowerCase().includes(String(rule.value).toLowerCase())
      case 'between':
        return value >= (rule.value as any) && value <= (rule.value2 as any)
      default:
        return false
    }
  }

  /**
   * Create summary sheet for multi-sheet exports
   */
  private async createSummarySheet(workbook: unknown, sheets: { name: string; data: unknown[]; fields: EnhancedFieldMapping[] }[]): Promise<void> {
    const summarySheet = workbook.sheet(0)
    summarySheet.name('Summary')

    // Headers
    summarySheet.cell(1, 1).value('Sheet Name')
    summarySheet.cell(1, 2).value('Records')
    summarySheet.cell(1, 3).value('Columns')
    summarySheet.cell(1, 4).value('Link')

    // Apply header styling
    for (let col = 1; col <= 4; col++) {
      const cell = summarySheet.cell(1, col)
      this.applyCellStyle(cell, {
        bold: true,
        fill: STYLE_CONSTANTS.COLORS.HEADER_BACKGROUND,
        horizontalAlignment: 'center'
      })
    }

    // Add sheet summaries
    sheets.forEach((sheet, index) => {
      const row = index + 2
      const sheetName = this.sanitizeSheetName(sheet.name, index + 1)
      
      summarySheet.cell(row, 1).value(sheet.name)
      summarySheet.cell(row, 2).value(sheet.data.length)
      summarySheet.cell(row, 3).value(sheet.fields.filter((f: EnhancedFieldMapping) => f.include).length)
      
      // Create hyperlink to sheet
      const linkCell = summarySheet.cell(row, 4)
      linkCell.value('Go to Sheet')
      linkCell.hyperlink(`#'${sheetName}'!A1`)
      this.applyCellStyle(linkCell, {
        fontColor: STYLE_CONSTANTS.COLORS.HYPERLINK,
        underline: true
      })
    })

    // Set column widths
    summarySheet.column(1).width(30)
    summarySheet.column(2).width(15)
    summarySheet.column(3).width(15)
    summarySheet.column(4).width(20)
  }

  /**
   * Calculate optimal column width based on content type and label
   */
  private calculateColumnWidth(type: string, label: string): number {
    const baseWidth = Math.max(label.length * 1.2, 10)
    
    switch (type) {
      case 'date':
        return Math.max(baseWidth, 15)
      case 'currency':
      case 'number':
        return Math.max(baseWidth, 12)
      case 'boolean':
        return Math.max(baseWidth, 8)
      case 'url':
        return Math.max(baseWidth, 25)
      case 'object':
      case 'array':
        return Math.max(baseWidth, 30)
      default:
        return Math.max(baseWidth, 20)
    }
  }

  /**
   * Convert column index to Excel letter (A, B, C, ..., AA, AB, ...)
   */
  private columnIndexToLetter(index: number): string {
    let result = ''
    while (index > 0) {
      index-- // Make it 0-based
      result = String.fromCharCode(65 + (index % 26)) + result
      index = Math.floor(index / 26)
    }
    return result
  }

  /**
   * Sanitize sheet name for Excel compatibility
   */
  private sanitizeSheetName(name: string, index: number): string {
    if (!name) return `Sheet_${index.toString().padStart(2, '0')}`
    
    // Remove invalid characters and limit length
    let sanitized = name
      .replace(/[:\\\/\?\*\[\]']/g, '-')
      .replace(/^-+|-+$/g, '')
      .replace(/-+/g, '-')
      .trim()
    
    if (!sanitized) sanitized = 'Sheet'
    
    // Truncate and add index if needed
    const indexSuffix = `_${index.toString().padStart(2, '0')}`
    if (sanitized.length > 28) {
      sanitized = `${sanitized.substring(0, 25).replace(/-+$/, '')}${indexSuffix}`
    } else {
      sanitized = `${sanitized}${indexSuffix}`
    }
    
    return sanitized
  }

  /**
   * Create CSV export (maintaining compatibility)
   */
  private async createCSV<T>(data: T[], fields: EnhancedFieldMapping[], options: EnhancedExportOptions): Promise<ArrayBuffer> {
    const activeFields = fields.filter(field => field.include)

    const csvData = data.map(row => {
      const csvRow: Record<string, unknown> = {}
      activeFields.forEach(field => {
        const value = this.getNestedValue(row, field.key)
        csvRow[field.label] = this.formatCellValue(value, field)
      })
      return csvRow
    })

    const { unparseCSV: unparseFunction } = await loadCSVLibrary()
    
    const csv = unparseFunction(csvData, {
      header: options.includeHeaders,
      skipEmptyLines: true
    })

    return new TextEncoder().encode(csv).buffer
  }

  /**
   * Create JSON export (maintaining compatibility)
   */
  private createJSON<T>(data: T[], fields: EnhancedFieldMapping[], options: EnhancedExportOptions): ArrayBuffer {
    const activeFields = fields.filter(field => field.include)

    const jsonData = data.map(row => {
      const jsonRow: Record<string, unknown> = {}
      activeFields.forEach(field => {
        const value = this.getNestedValue(row, field.key)
        jsonRow[field.label] = this.formatCellValue(value, field)
      })
      return jsonRow
    })

    return new TextEncoder().encode(JSON.stringify(jsonData, null, 2)).buffer
  }

  /**
   * Get nested object value using dot notation
   */
  private getNestedValue(obj: unknown, path: string): unknown {
    if (!obj || !path) return undefined

    return path.split('.').reduce((current: unknown, key: string) => {
      return current && typeof current === 'object' && current !== null && key in current ? (current as Record<string, unknown>)[key] : undefined
    }, obj)
  }

  /**
   * Get MIME type for format
   */
  private getMimeType(format: ExportFormat): string {
    switch (format) {
      case 'xlsx':
        return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      case 'csv':
        return 'text/csv'
      case 'json':
        return 'application/json'
      default:
        return 'application/octet-stream'
    }
  }

  /**
   * Trigger file download with proper URL cleanup tracking
   */
  private downloadFile(url: string, filename: string): void {
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    link.style.display = 'none'
    document.body.appendChild(link)
    
    try {
      link.click()
      
      // Schedule URL cleanup with proper tracking
      this.scheduleUrlCleanup(url)
      
      this.log.debug('File download initiated', {
        filename,
        hasCleanupTimer: this.urlCleanupTimers.has(url)
      })
    } catch (error) {
      this.log.error('Download failed', { filename, error })
      // Immediate cleanup on failure
      this.cleanupUrl(url)
    } finally {
      document.body.removeChild(link)
    }
  }

  protected override updateProgress(jobId: string, updates: Partial<ExportProgress>): void {
    const previous = this.getProgress(jobId)
    super.updateProgress(jobId, updates)
    const progress = this.getProgress(jobId)

    if (progress) {
      this.log.debug('Export progress updated', {
        jobId,
        status: progress.status,
        progress: progress.progress,
        processedRecords: progress.processedRecords
      })

      if (previous && updates.status && updates.status !== previous.status) {
        this.log.info('Enhanced export status changed', {
          jobId,
          previousStatus: previous.status,
          newStatus: updates.status
        })
      }
    }
  }

  /**
   * Cancel export job
   */
  cancelExport(jobId: string): boolean {
    return this.cancel(jobId)
  }

  /**
   * Schedule URL cleanup with proper error handling
   */
  private scheduleUrlCleanup(url: string, delay: number = 1000): void {
    // Clear existing timer if present
    const existingTimer = this.urlCleanupTimers.get(url)
    if (existingTimer) {
      clearTimeout(existingTimer)
    }
    
    // Schedule new cleanup
    const timer = setTimeout(() => {
      this.cleanupUrl(url)
    }, delay)
    
    this.urlCleanupTimers.set(url, timer)
  }
  
  /**
   * Clean up a specific URL and its timer
   */
  private cleanupUrl(url: string): void {
    try {
      URL.revokeObjectURL(url)
      
      const timer = this.urlCleanupTimers.get(url)
      if (timer) {
        clearTimeout(timer)
        this.urlCleanupTimers.delete(url)
      }
      
      this.log.debug('URL cleaned up successfully', { url: `${url.substring(0, 50)}...` })
    } catch (error) {
      this.log.warn('URL cleanup failed', { 
        url: `${url.substring(0, 50)}...`, 
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  }
  
  /**
   * Clean up completed jobs and associated resources
   */
  protected override cleanup(jobId: string): void {
    const progress = this.getProgress(jobId)

    if (progress?.downloadUrl) {
      this.cleanupUrl(progress.downloadUrl)
    }

    super.cleanup(jobId)
  }

  cleanupStaleJobs(): void {
    const now = Date.now()
    const maxAge = 60 * 60 * 1000 // 1 hour

    for (const [jobId, progress] of this.activeJobs.entries()) {
      if (now - progress.startTime > maxAge &&
          (progress.status === 'completed' || progress.status === 'failed' || progress.status === 'cancelled')) {

        this.cleanup(jobId)

        this.log.debug('Job cleaned up', {
          jobId,
          status: progress.status,
          age: now - progress.startTime
        })
      }
    }
    
    // Clean up any orphaned URL timers
    const urlTimerCount = this.urlCleanupTimers.size
    if (urlTimerCount > 10) {
      this.log.warn('Large number of URL cleanup timers detected', { count: urlTimerCount })
    }
  }
  
  /**
   * Force cleanup of all resources (for context invalidation)
   */
  forceCleanup(): void {
    this.log.info('Force cleanup initiated', {
      activeJobs: this.getActiveJobs().length,
      urlTimers: this.urlCleanupTimers.size
    })

    // Cancel all active jobs
    for (const job of this.getActiveJobs()) {
      try {
        this.cancel(job.jobId)
      } catch (error) {
        this.log.warn('Failed to abort job', { jobId: job.jobId, error })
      }
    }

    // Clean up all URLs and timers
    for (const [url, timer] of this.urlCleanupTimers.entries()) {
      try {
        clearTimeout(timer)
        URL.revokeObjectURL(url)
      } catch (error) {
        this.log.warn('Failed to cleanup URL during force cleanup', { error })
      }
    }

    // Clear all maps
    this.urlCleanupTimers.clear()

    this.log.info('Force cleanup completed')
  }
}

// Create singleton instance
export const enhancedExportService = new EnhancedExportService()