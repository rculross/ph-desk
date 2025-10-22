/**
 * Salesforce Data Processor Service
 *
 * Transforms raw Salesforce integration configuration data into standardized,
 * privacy-filtered format optimized for display and search. Handles up to 10,000
 * field mappings with performance optimization and comprehensive error handling.
 *
 * @fileVersion 3.1.2
 * @author Claude Code AI Assistant
 */

import DOMPurify from 'dompurify'

import type {
  SalesforceRawConfiguration,
  SalesforceIntegrationData,
  SalesforceIntegrationOverview,
  SalesforceObjectMapping,
  SalesforceFieldMapping,
  SearchableField,
  SalesforceDirection,
  SalesforceProcessingOptions,
  SalesforceValidationResult,
  SalesforceIntegrationError,
  SalesforceErrorCode
} from '../types/integrations/salesforce.types'
import { logSanitizer } from '../utils/log-sanitizer'
import { logger } from '../utils/logger'

const log = logger.api

/**
 * Processing performance metrics
 */
export interface ProcessingMetrics {
  startTime: number
  endTime: number
  duration: number
  objectCount: number
  fieldCount: number
  filteredFieldCount: number
  searchableFieldCount: number
  memoryUsage?: number
  processingSteps: {
    step: string
    duration: number
    recordsProcessed: number
  }[]
}

/**
 * Processing result with metrics
 */
export interface ProcessingResult {
  data: SalesforceIntegrationData
  metrics: ProcessingMetrics
  warnings: string[]
}

/**
 * Service for processing and transforming Salesforce integration data
 *
 * Handles conversion from raw API responses to standardized display format,
 * implementing privacy filters and performance optimization for large datasets.
 */
class SalesforceDataProcessorService {
  private readonly userFieldPatterns = [
    /owner/i,
    /user/i,
    /assigned/i,
    /creator/i,
    /modifier/i,
    /^.*by$/i // CreatedBy, ModifiedBy, etc.
  ]

  private readonly maxFieldsPerObject = 10000
  private readonly maxProcessingTime = 60000 // 60 seconds
  private readonly batchSize = 1000 // Process fields in batches

  /**
   * Process raw Salesforce configuration into standardized format
   *
   * @param rawConfig Raw configuration from Salesforce API
   * @param options Processing options including privacy filters
   * @returns Promise resolving to processed integration data with metrics
   * @throws {SalesforceIntegrationError} When processing fails or data is invalid
   */
  async processConfiguration(
    rawConfig: SalesforceRawConfiguration,
    options: SalesforceProcessingOptions = {}
  ): Promise<ProcessingResult> {
    const startTime = performance.now()
    const requestId = this.generateRequestId()

    const {
      filterUserFields = true,
      maxFields = this.maxFieldsPerObject,
      includeFieldMetadata = true,
      validateData = true,
      timeoutMs = this.maxProcessingTime
    } = options

    log.info('Starting Salesforce configuration processing', logSanitizer.forApi({
      requestId,
      filterUserFields,
      maxFields,
      includeFieldMetadata,
      validateData,
      timeoutMs,
      configVersion: rawConfig.key
    }))

    const metrics: ProcessingMetrics = {
      startTime,
      endTime: 0,
      duration: 0,
      objectCount: 0,
      fieldCount: 0,
      filteredFieldCount: 0,
      searchableFieldCount: 0,
      processingSteps: []
    }

    const warnings: string[] = []

    // Set up timeout protection
    const timeoutId = setTimeout(() => {
      throw this.createProcessingError(
        'PROCESSING_ERROR',
        `Processing timeout after ${timeoutMs}ms`,
        { requestId, timeoutMs }
      )
    }, timeoutMs)

    try {
      // Step 1: Validate input data
      if (validateData) {
        const stepStart = performance.now()
        await this.validateRawConfiguration(rawConfig, requestId)
        metrics.processingSteps.push({
          step: 'validation',
          duration: Math.round(performance.now() - stepStart),
          recordsProcessed: 1
        })
      }

      // Step 2: Extract integration overview
      const stepStart = performance.now()
      const overview = this.processIntegrationOverview(rawConfig, requestId)
      metrics.processingSteps.push({
        step: 'overview_extraction',
        duration: Math.round(performance.now() - stepStart),
        recordsProcessed: 1
      })

      // Step 3: Process standard object mappings
      const standardObjectsStart = performance.now()
      const standardObjectMappings = await this.processStandardObjects(
        rawConfig,
        filterUserFields,
        maxFields,
        requestId
      )
      metrics.processingSteps.push({
        step: 'standard_objects',
        duration: Math.round(performance.now() - standardObjectsStart),
        recordsProcessed: standardObjectMappings.length
      })

      // Step 4: Process dynamic sections (custom objects)
      const dynamicSectionsStart = performance.now()
      const dynamicObjectMappings = await this.processDynamicSections(
        rawConfig.sections ?? [],
        filterUserFields,
        maxFields,
        requestId
      )
      metrics.processingSteps.push({
        step: 'dynamic_sections',
        duration: Math.round(performance.now() - dynamicSectionsStart),
        recordsProcessed: dynamicObjectMappings.length
      })

      // Step 5: Combine all object mappings
      const allObjectMappings = [...standardObjectMappings, ...dynamicObjectMappings]
      metrics.objectCount = allObjectMappings.length

      // Calculate field statistics
      metrics.fieldCount = allObjectMappings.reduce((sum, obj) => sum + obj.fieldCount, 0)
      metrics.filteredFieldCount = allObjectMappings.reduce(
        (sum, obj) => sum + obj.fields.length,
        0
      )

      // Step 6: Build searchable fields index
      const searchIndexStart = performance.now()
      const searchableFields = this.buildSearchableFieldsIndex(
        allObjectMappings,
        includeFieldMetadata,
        requestId
      )
      metrics.searchableFieldCount = searchableFields.length
      metrics.processingSteps.push({
        step: 'search_index',
        duration: Math.round(performance.now() - searchIndexStart),
        recordsProcessed: searchableFields.length
      })

      // Step 7: Apply performance optimizations and HTML sanitization
      const optimizationStart = performance.now()
      this.optimizeForPerformance(allObjectMappings, warnings)
      metrics.processingSteps.push({
        step: 'optimization_and_sanitization',
        duration: Math.round(performance.now() - optimizationStart),
        recordsProcessed: allObjectMappings.length
      })

      clearTimeout(timeoutId)

      // Build final result
      const endTime = performance.now()
      metrics.endTime = endTime
      metrics.duration = Math.round(endTime - startTime)

      const processedData: SalesforceIntegrationData = {
        overview,
        objectMappings: allObjectMappings,
        searchableFields,
        rawConfig,
        processedAt: Date.now(),
        version: this.generateDataVersion(rawConfig, metrics)
      }

      log.info('Salesforce configuration processing completed', logSanitizer.forApi({
        requestId,
        ...metrics,
        warningCount: warnings.length
      }))

      return {
        data: processedData,
        metrics,
        warnings
      }

    } catch (error) {
      clearTimeout(timeoutId)

      log.error('Salesforce configuration processing failed', logSanitizer.forError({
        requestId,
        error: error instanceof Error ? error.message : 'Unknown error',
        processingTime: Math.round(performance.now() - startTime)
      }))

      throw error instanceof Error ? error : this.createProcessingError(
        'PROCESSING_ERROR',
        `Processing failed: ${String(error)}`,
        { requestId }
      )
    }
  }

  /**
   * Validate raw configuration data structure
   */
  private async validateRawConfiguration(
    rawConfig: SalesforceRawConfiguration,
    requestId: string
  ): Promise<void> {
    if (!rawConfig || typeof rawConfig !== 'object') {
      throw this.createProcessingError(
        'VALIDATION_ERROR',
        'Invalid configuration: not an object',
        { requestId }
      )
    }

    // Check required fields
    const requiredFields = ['name', 'isActive', 'apiSource']
    for (const field of requiredFields) {
      if (!(field in rawConfig)) {
        throw this.createProcessingError(
          'VALIDATION_ERROR',
          `Missing required field: ${field}`,
          { requestId, field }
        )
      }
    }

    log.debug('Raw configuration validation passed', logSanitizer.forDebug({
      requestId,
      name: rawConfig.name,
      isActive: rawConfig.isActive,
      hasObjectMappings: !!(rawConfig.accountSettings || rawConfig.contactSettings),
      hasDynamicSections: Array.isArray(rawConfig.sections) && rawConfig.sections.length > 0
    }))
  }

  /**
   * Process integration overview information
   */
  private processIntegrationOverview(
    rawConfig: SalesforceRawConfiguration,
    requestId: string
  ): SalesforceIntegrationOverview {
    log.debug('Processing integration overview', logSanitizer.forDebug({ requestId }))

    // Determine auth status from OAuth information
    const authStatus = rawConfig.oauth.access_token ? 'authenticated' : 'not_authenticated'

    // Determine overall sync status
    let totalSyncStatus: 'success' | 'error' | 'warning' | null = null
    if (rawConfig.totalSyncStatus) {
      if (rawConfig.totalSyncStatus.isBusy) {
        totalSyncStatus = 'warning'
      } else if (rawConfig.lastSync && !rawConfig.lastIssue) {
        totalSyncStatus = 'success'
      } else if (rawConfig.lastIssue) {
        totalSyncStatus = 'error'
      }
    }

    // Format last sync timestamp
    let lastSync: string | null = null
    if (rawConfig.lastSync) {
      try {
        lastSync = new Date(rawConfig.lastSync).toISOString()
      } catch {
        log.warn('Invalid lastSync timestamp', logSanitizer.forError({ requestId, lastSync: rawConfig.lastSync }))
      }
    }

    return {
      name: rawConfig.name ?? 'Salesforce',
      description: '', // Empty for privacy - no user data exposed
      isActive: rawConfig.isActive || false,
      lastSync,
      totalSyncStatus,
      authStatus,
      connectionId: rawConfig.key,
      instanceUrl: rawConfig.oauth.instance_url,
      environment: rawConfig.conn.environment
    }
  }

  /**
   * Process standard Salesforce objects (Account, Contact, etc.)
   */
  private async processStandardObjects(
    rawConfig: SalesforceRawConfiguration,
    filterUserFields: boolean,
    maxFields: number,
    requestId: string
  ): Promise<SalesforceObjectMapping[]> {
    const standardObjects = [
      { key: 'accountSettings', sfObject: 'Account', phObject: 'Company' },
      { key: 'contactSettings', sfObject: 'Contact', phObject: 'Contact' },
      { key: 'taskSettings', sfObject: 'Task', phObject: 'Task' },
      { key: 'caseSettings', sfObject: 'Case', phObject: 'Case' },
      { key: 'assetSettings', sfObject: 'Asset', phObject: 'Asset' },
      { key: 'projectSettings', sfObject: 'Project', phObject: 'Project' },
      { key: 'licenseFields', sfObject: 'License', phObject: 'License' },
      { key: 'noteSettings', sfObject: 'Note', phObject: 'Note' }
    ]

    const mappings: SalesforceObjectMapping[] = []

    for (const objectDef of standardObjects) {
      const objectSettings = (rawConfig as any)[objectDef.key]

      if (!objectSettings) {
        continue // Skip if not configured
      }

      log.debug('Processing standard object', logSanitizer.forDebug({
        requestId,
        object: objectDef.sfObject,
        hasSettings: !!objectSettings
      }))

      // Process field mappings
      const rawFields = Array.isArray(objectSettings.extraFieldsMap)
        ? objectSettings.extraFieldsMap
        : []

      const processedFields = await this.processFieldMappings(
        rawFields,
        filterUserFields,
        maxFields,
        objectDef.sfObject,
        requestId
      )

      // Determine sync direction
      const direction: SalesforceDirection | null = objectSettings.direction ?? null

      // Build object mapping
      const mapping: SalesforceObjectMapping = {
        sfObject: objectDef.sfObject,
        phObject: objectDef.phObject,
        direction,
        fieldCount: rawFields.length,
        fields: processedFields,
        filters: this.buildFilterDescription(objectSettings),
        syncOwner: objectSettings.syncOwner || false,
        lastSync: this.formatTimestamp(objectSettings.lastSync),
        isCustom: false,
        isBidirectional: direction === 'both',
        complexity: this.calculateComplexity(processedFields.length, direction)
      }

      mappings.push(mapping)
    }

    log.debug('Completed processing standard objects', logSanitizer.forDebug({
      requestId,
      objectCount: mappings.length,
      totalFields: mappings.reduce((sum, obj) => sum + obj.fieldCount, 0)
    }))

    return mappings
  }

  /**
   * Process dynamic sections (custom objects)
   */
  private async processDynamicSections(
    sections: any[],
    filterUserFields: boolean,
    maxFields: number,
    requestId: string
  ): Promise<SalesforceObjectMapping[]> {
    if (!Array.isArray(sections) || sections.length === 0) {
      log.debug('No dynamic sections to process', logSanitizer.forDebug({ requestId }))
      return []
    }

    const mappings: SalesforceObjectMapping[] = []

    for (const section of sections) {
      if (!section || typeof section !== 'object') {
        log.warn('Invalid dynamic section structure', logSanitizer.forError({ requestId, section }))
        continue
      }

      log.debug('Processing dynamic section', logSanitizer.forDebug({
        requestId,
        sectionId: section._id,
        sfObject: section.sfObject,
        phObject: section.phObject,
        isValid: section.isValid
      }))

      // Skip invalid sections
      if (!section.isValid) {
        log.debug('Skipping invalid dynamic section', logSanitizer.forDebug({
          requestId,
          sectionId: section._id,
          sfObject: section.sfObject
        }))
        continue
      }

      // Process field mappings
      const rawFields = Array.isArray(section.fields) ? section.fields : []
      const processedFields = await this.processDynamicFieldMappings(
        rawFields,
        filterUserFields,
        maxFields,
        section.sfObject,
        requestId
      )

      // Build object mapping
      const mapping: SalesforceObjectMapping = {
        sfObject: section.sfObject ?? 'Unknown',
        phObject: section.phObject ?? 'Unknown',
        direction: section.direction ?? null,
        fieldCount: rawFields.length,
        fields: processedFields,
        filters: this.buildDynamicFilterDescription(section),
        syncOwner: false, // Dynamic sections typically don't sync ownership
        lastSync: this.formatTimestamp(section.lastSync),
        sectionId: section._id,
        isCustom: true,
        isBidirectional: section.direction === 'both',
        complexity: this.calculateComplexity(processedFields.length, section.direction)
      }

      mappings.push(mapping)
    }

    log.debug('Completed processing dynamic sections', logSanitizer.forDebug({
      requestId,
      sectionCount: mappings.length,
      totalFields: mappings.reduce((sum, obj) => sum + obj.fieldCount, 0)
    }))

    return mappings
  }

  /**
   * Process standard field mappings
   */
  private async processFieldMappings(
    rawFields: any[],
    filterUserFields: boolean,
    maxFields: number,
    objectName: string,
    requestId: string
  ): Promise<SalesforceFieldMapping[]> {
    if (!Array.isArray(rawFields)) {
      return []
    }

    // Limit field count for performance
    const fieldsToProcess = rawFields.slice(0, maxFields)
    if (rawFields.length > maxFields) {
      log.warn('Field count exceeds maximum, truncating', logSanitizer.forError({
        requestId,
        objectName,
        originalCount: rawFields.length,
        processedCount: maxFields
      }))
    }

    const processedFields: SalesforceFieldMapping[] = []

    // Process fields in batches for better performance
    for (let i = 0; i < fieldsToProcess.length; i += this.batchSize) {
      const batch = fieldsToProcess.slice(i, i + this.batchSize)

      for (const rawField of batch) {
        // Skip invalid fields
        if (!this.isValidFieldMapping(rawField)) {
          continue
        }

        // Apply user field filter
        if (filterUserFields && this.isUserField(rawField)) {
          continue
        }

        // Convert to standardized format
        const field: SalesforceFieldMapping = {
          sfField: rawField.sfField ?? '',
          phField: rawField.phField ?? '',
          direction: rawField.direction ?? 'none',
          sfType: rawField.sfType ?? 'string',
          phType: rawField.phType ?? 'string',
          type: rawField.type ?? 'custom',
          onlySend: rawField.onlySend || false,
          default: rawField.default ?? '',
          reference: rawField.reference ?? null,
          sfListValues: Array.isArray(rawField.sfListValues) ? rawField.sfListValues : []
        }

        processedFields.push(field)
      }

      // Yield control periodically for large datasets
      if (i > 0 && i % (this.batchSize * 10) === 0) {
        await this.sleep(0) // Allow other tasks to run
      }
    }

    return processedFields
  }

  /**
   * Process dynamic field mappings (from sections)
   */
  private async processDynamicFieldMappings(
    rawFields: any[],
    filterUserFields: boolean,
    maxFields: number,
    objectName: string,
    requestId: string
  ): Promise<SalesforceFieldMapping[]> {
    if (!Array.isArray(rawFields)) {
      return []
    }

    const fieldsToProcess = rawFields.slice(0, maxFields)
    const processedFields: SalesforceFieldMapping[] = []

    for (const rawField of fieldsToProcess) {
      if (!this.isValidDynamicFieldMapping(rawField)) {
        continue
      }

      // Apply user field filter
      if (filterUserFields && this.isDynamicUserField(rawField)) {
        continue
      }

      // Convert dynamic field format to standard format
      const field: SalesforceFieldMapping = {
        sfField: rawField.sfProp ?? '',
        phField: rawField.phProp ?? '',
        direction: rawField.direction ?? 'none',
        sfType: rawField.sfType ?? 'string',
        phType: rawField.phType ?? 'string',
        type: 'custom', // Dynamic fields are always custom
        onlySend: false,
        default: (rawField.sfDefaultVal || rawField.phDefaultVal) ?? '',
        reference: null,
        sfListValues: Array.isArray(rawField.sfListValues) ? rawField.sfListValues : []
      }

      processedFields.push(field)
    }

    return processedFields
  }

  /**
   * Build searchable fields index
   */
  private buildSearchableFieldsIndex(
    objectMappings: SalesforceObjectMapping[],
    includeFieldMetadata: boolean,
    requestId: string
  ): SearchableField[] {
    const searchableFields: SearchableField[] = []

    for (const objectMapping of objectMappings) {
      // Add object-level searchable entry
      searchableFields.push({
        objectName: objectMapping.sfObject,
        fieldName: objectMapping.sfObject,
        fieldType: 'object',
        searchTerm: this.normalizeSearchTerm(objectMapping.sfObject),
        displayLabel: `${objectMapping.sfObject} → ${objectMapping.phObject}`,
        category: objectMapping.isCustom ? 'custom_object' : 'standard_object'
      })

      // Add field-level searchable entries (sanitized)
      for (const field of objectMapping.fields) {
        // Sanitize field data for search index
        const sanitizedSfField = this.sanitizeHtmlContent(field.sfField)
        const sanitizedPhField = this.sanitizeHtmlContent(field.phField)
        const sanitizedSfType = this.sanitizeHtmlContent(field.sfType)
        const sanitizedPhType = this.sanitizeHtmlContent(field.phType)

        // Salesforce field
        searchableFields.push({
          objectName: objectMapping.sfObject,
          fieldName: sanitizedSfField,
          fieldType: 'field',
          searchTerm: this.normalizeSearchTerm(sanitizedSfField),
          displayLabel: includeFieldMetadata
            ? `${sanitizedSfField} (${sanitizedSfType}) → ${sanitizedPhField} (${sanitizedPhType})`
            : `${sanitizedSfField} → ${sanitizedPhField}`,
          category: field.type
        })

        // Planhat field (if different)
        if (sanitizedPhField !== sanitizedSfField) {
          searchableFields.push({
            objectName: objectMapping.sfObject,
            fieldName: sanitizedPhField,
            fieldType: 'field',
            searchTerm: this.normalizeSearchTerm(sanitizedPhField),
            displayLabel: includeFieldMetadata
              ? `${sanitizedPhField} (${sanitizedPhType}) ← ${sanitizedSfField} (${sanitizedSfType})`
              : `${sanitizedPhField} ← ${sanitizedSfField}`,
            category: field.type
          })
        }
      }
    }

    log.debug('Built searchable fields index', logSanitizer.forDebug({
      requestId,
      totalSearchableFields: searchableFields.length,
      objectFields: searchableFields.filter(f => f.fieldType === 'object').length,
      fieldFields: searchableFields.filter(f => f.fieldType === 'field').length
    }))

    return searchableFields
  }

  /**
   * Apply performance optimizations and HTML sanitization
   */
  private optimizeForPerformance(
    objectMappings: SalesforceObjectMapping[],
    warnings: string[]
  ): void {
    const totalFields = objectMappings.reduce((sum, obj) => sum + obj.fieldCount, 0)

    if (totalFields > 5000) {
      warnings.push(`Large dataset detected (${totalFields} fields). Consider implementing field filtering for better performance.`)
    }

    // Sanitize all text fields in object mappings
    for (const mapping of objectMappings) {
      // Sanitize object names and filters
      mapping.sfObject = this.sanitizeHtmlContent(mapping.sfObject)
      mapping.phObject = this.sanitizeHtmlContent(mapping.phObject)
      if (mapping.filters) {
        mapping.filters = this.sanitizeHtmlContent(mapping.filters)
      }

      // Sanitize field data
      for (const field of mapping.fields) {
        field.sfField = this.sanitizeHtmlContent(field.sfField)
        field.phField = this.sanitizeHtmlContent(field.phField)
        field.default = this.sanitizeHtmlContent(field.default)

        // Sanitize list values
        if (field.sfListValues) {
          field.sfListValues = field.sfListValues.map(value =>
            this.sanitizeHtmlContent(value)
          )
        }

        // Sanitize reference field if present
        if (field.reference) {
          field.reference = this.sanitizeHtmlContent(field.reference)
        }
      }
    }

    // Sort objects by complexity for better rendering performance
    objectMappings.sort((a, b) => {
      const complexityOrder = { low: 1, medium: 2, high: 3 }
      const aOrder = complexityOrder[a.complexity ?? 'medium']
      const bOrder = complexityOrder[b.complexity ?? 'medium']
      return aOrder - bOrder
    })
  }

  /**
   * Utility methods
   */

  private isValidFieldMapping(field: any): boolean {
    return field &&
           typeof field === 'object' &&
           typeof field.sfField === 'string' &&
           typeof field.phField === 'string' &&
           field.sfField.length > 0 &&
           field.phField.length > 0
  }

  private isValidDynamicFieldMapping(field: any): boolean {
    return field &&
           typeof field === 'object' &&
           typeof field.sfProp === 'string' &&
           typeof field.phProp === 'string' &&
           field.sfProp.length > 0 &&
           field.phProp.length > 0
  }

  private isUserField(field: any): boolean {
    const fieldName = (field.sfField || field.phField) ?? ''
    return this.userFieldPatterns.some(pattern => pattern.test(fieldName))
  }

  private isDynamicUserField(field: any): boolean {
    const fieldName = (field.sfProp || field.phProp) ?? ''
    return this.userFieldPatterns.some(pattern => pattern.test(fieldName))
  }

  private buildFilterDescription(settings: any): string | null {
    const filters: string[] = []

    if (settings.customerFlag?.values?.length) {
      filters.push(`Customer filter: ${settings.customerFlag.values.join(', ')}`)
    }

    if (settings.contactFlag?.values?.length) {
      filters.push(`Contact filter: ${settings.contactFlag.values.join(', ')}`)
    }

    if (settings.filterField?.values?.length) {
      filters.push(`Field filter: ${settings.filterField.values.join(', ')}`)
    }

    return filters.length > 0 ? filters.join('; ') : null
  }

  private buildDynamicFilterDescription(section: any): string | null {
    if (!section.sfFilter?.values?.length) {
      return null
    }

    return `${section.sfFilter.sfProp}: ${section.sfFilter.values.join(', ')}`
  }

  private formatTimestamp(timestamp: any): string | null {
    if (!timestamp) return null

    try {
      return new Date(timestamp).toISOString()
    } catch {
      return null
    }
  }

  private calculateComplexity(
    fieldCount: number,
    direction: SalesforceDirection | null
  ): 'low' | 'medium' | 'high' {
    if (fieldCount > 100 || direction === 'both') return 'high'
    if (fieldCount > 20 || direction === 'toSF') return 'medium'
    return 'low'
  }

  private normalizeSearchTerm(term: string): string {
    return term.toLowerCase().replace(/[^a-z0-9]/g, '')
  }

  private generateDataVersion(
    rawConfig: SalesforceRawConfiguration,
    metrics: ProcessingMetrics
  ): string {
    const configHash = rawConfig.key ?? 'unknown'
    const fieldHash = metrics.fieldCount.toString()
    const timestamp = Math.floor(Date.now() / 1000).toString()
    return `${configHash}_${fieldHash}_${timestamp}`
  }

  private generateRequestId(): string {
    return `sfp_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`
  }

  /**
   * Sanitizes HTML content using DOMPurify
   *
   * @param content The content to sanitize
   * @returns Sanitized content safe for display
   */
  private sanitizeHtmlContent(content: any): string {
    if (content == null) {
      return ''
    }

    const str = String(content)

    // Return empty string for obviously malicious content
    if (this.isMaliciousContent(str)) {
      return ''
    }

    // Use DOMPurify to sanitize HTML while preserving safe text
    try {
      return DOMPurify.sanitize(str, {
        // Only allow safe text, strip all HTML tags
        ALLOWED_TAGS: [],
        ALLOWED_ATTR: [],
        KEEP_CONTENT: true, // Keep text content, strip tags
        ALLOW_DATA_ATTR: false,
        ALLOW_UNKNOWN_PROTOCOLS: false,
        SANITIZE_DOM: true,
        WHOLE_DOCUMENT: false,
        RETURN_DOM: false,
        RETURN_DOM_FRAGMENT: false
      })
    } catch (error) {
      // If sanitization fails, return empty string
      log.warn('HTML sanitization failed', logSanitizer.forError({
        content: str.substring(0, 100),
        error: error instanceof Error ? error.message : 'Unknown error'
      }))
      return ''
    }
  }

  /**
   * Checks for obviously malicious content patterns
   */
  private isMaliciousContent(content: string): boolean {
    const maliciousPatterns = [
      // Script tags and javascript URLs
      /<script[^>]*>/gi,
      /<\/script>/gi,
      /javascript:/gi,
      /vbscript:/gi,

      // Event handlers
      /on\w+\s*=/gi,

      // Data URLs with HTML
      /data:text\/html/gi,
      /data:application\/javascript/gi,

      // Base64 encoded scripts
      /data:[^;]*;base64,[a-zA-Z0-9+\/]+=*.*<script/gi,

      // Style with javascript
      /style\s*=.*expression\s*\(/gi,
      /style\s*=.*javascript:/gi,

      // Import statements
      /@import/gi,

      // SVG with scripts
      /<svg[^>]*.*<script/gi,

      // Object/embed tags
      /<object[^>]*>/gi,
      /<embed[^>]*>/gi,

      // Meta refresh
      /<meta[^>]*http-equiv[^>]*refresh/gi,

      // Link with javascript
      /<link[^>]*href[^>]*javascript:/gi
    ]

    return maliciousPatterns.some(pattern => pattern.test(content))
  }

  private createProcessingError(
    code: SalesforceErrorCode,
    message: string,
    context: any
  ): SalesforceIntegrationError {
    return {
      code,
      message,
      details: context,
      timestamp: Date.now(),
      retryable: false,
      affectedComponent: 'salesforce-data-processor',
      recoveryActions: ['Check data format', 'Retry with smaller dataset'],
      severity: 'medium',
      stackTrace: new Error().stack
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }
}

// Export singleton instance
export const salesforceDataProcessorService = new SalesforceDataProcessorService()

// Export class for advanced usage
export { SalesforceDataProcessorService }