/**
 * Centralized Field Detection Service for Planhat Extension
 *
 * Provides dynamic field detection combining:
 * 1. Standard Planhat fields (consistent across tenants)
 * 2. Custom fields (tenant-specific from /customfields API)
 * 3. Discovered fields (from actual API response analysis)
 * 4. Session persistence for field selections
 */

import { getHttpClient } from '../api/client/http-client'
import { sendValidatedRequest } from '../api/request'
import type { 
  CustomField, 
  EntityType, 
  CustomFieldType 
} from '../types/api'
import type { FieldMapping } from '../types/export'
import { logger } from '../utils/logger'


const log = logger.api

export interface DetectedField {
  key: string
  label: string
  type: FieldType
  source: FieldSource
  isStandard: boolean
  isCustom: boolean
  isDiscovered: boolean
  customFieldConfig?: CustomField
}

export type FieldType =
  | 'string'
  | 'number'
  | 'boolean'
  | 'date'
  | 'array'
  | 'object'
  | 'richtext'    // Rich text with HTML formatting
  | 'rating'      // 1-5 star rating
  | 'user'        // Single user reference
  | 'users'       // Multiple user references
export type FieldSource = 'standard' | 'custom' | 'discovered'

export interface FieldDetectionResult {
  standardFields: DetectedField[]
  customFields: DetectedField[]
  discoveredFields: DetectedField[]
  allFields: DetectedField[]
  fieldMappings: ExtendedFieldMapping[]
}

export interface FieldSelectionState {
  entityType: EntityType
  selectedFields: string[]
  lastUpdated: string
  tenantSlug?: string
}

export interface ColumnOrderState {
  entityType: EntityType
  columnOrder: string[]
  lastUpdated: string
  tenantSlug?: string
}

export interface ColumnWidthState {
  entityType: EntityType
  columnWidths: Record<string, number>
  lastUpdated: string
  tenantSlug?: string
}

// Extended FieldMapping interface with order and width
export interface ExtendedFieldMapping extends FieldMapping {
  order?: number
}


/**
 * Field Detection Service Class
 */
export class FieldDetectionService {
  private static instance: FieldDetectionService
  private customFieldsCache = new Map<string, CustomField[]>()
  private fieldSelectionsCache = new Map<string, string[]>()
  private columnOrderCache = new Map<string, string[]>()
  private columnWidthCache = new Map<string, Record<string, number>>()

  private constructor() {
    log.debug('FieldDetectionService initialized')
  }

  static getInstance(): FieldDetectionService {
    if (!FieldDetectionService.instance) {
      FieldDetectionService.instance = new FieldDetectionService()
    }
    return FieldDetectionService.instance
  }

  /**
   * Main method to detect all available fields for an entity type
   */
  async detectFields(
    entityType: EntityType,
    sampleData?: unknown[],
    tenantSlug?: string
  ): Promise<FieldDetectionResult> {
    log.info('Starting field detection', { 
      entityType, 
      sampleDataLength: sampleData?.length, 
      tenantSlug 
    })

    const startTime = performance.now()

    try {
      // Get standard fields
      const standardFields = this.getStandardFields(entityType)
      log.debug('Retrieved standard fields', { 
        entityType, 
        standardFieldCount: standardFields.length 
      })

      // Get custom fields
      const customFields = await this.getCustomFields(entityType, tenantSlug)
      log.debug('Retrieved custom fields', { 
        entityType, 
        customFieldCount: customFields.length 
      })

      // Discover fields from sample data
      const discoveredFields = sampleData ? 
        this.discoverFieldsFromData(sampleData, standardFields, customFields) : 
        []
      log.debug('Discovered fields from data', { 
        entityType, 
        discoveredFieldCount: discoveredFields.length 
      })

      // Combine all fields
      const allFields = [
        ...standardFields,
        ...customFields,
        ...discoveredFields
      ]

      // Convert to field mappings with intelligent defaults
      const fieldMappings = this.createFieldMappings(allFields)

      // Load saved selections
      const savedSelections = await this.loadFieldSelections(entityType, tenantSlug)
      if (savedSelections.length > 0) {
        this.applyFieldSelections(fieldMappings, savedSelections)
        log.debug('Applied saved field selections', {
          entityType,
          savedSelectionsCount: savedSelections.length
        })
      }

      // Load and apply saved column order
      const savedColumnOrder = await this.loadColumnOrder(entityType, tenantSlug)
      if (savedColumnOrder.length > 0) {
        this.applyColumnOrder(fieldMappings, savedColumnOrder)
        log.debug('Applied saved column order', {
          entityType,
          savedOrderLength: savedColumnOrder.length
        })
      }

      // Load and apply saved column widths
      const savedColumnWidths = await this.loadColumnWidths(entityType, tenantSlug)
      if (Object.keys(savedColumnWidths).length > 0) {
        this.applyColumnWidths(fieldMappings, savedColumnWidths)
        log.debug('Applied saved column widths', {
          entityType,
          savedWidthsCount: Object.keys(savedColumnWidths).length
        })
      }

      const result: FieldDetectionResult = {
        standardFields,
        customFields,
        discoveredFields,
        allFields,
        fieldMappings
      }

      const endTime = performance.now()
      log.info('Field detection completed', {
        entityType,
        duration: `${Math.round(endTime - startTime)}ms`,
        totalFields: allFields.length,
        standardCount: standardFields.length,
        customCount: customFields.length,
        discoveredCount: discoveredFields.length
      })

      return result
    } catch (error) {
      log.error('Field detection failed', { 
        entityType, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      })
      throw error
    }
  }

  /**
   * Get standard fields for an entity type
   * These are the common fields that should be properly typed
   */
  private getStandardFields(entityType: EntityType): DetectedField[] {
    const commonFields: DetectedField[] = [
      { key: 'createdAt', label: 'Created At', type: 'date', source: 'standard', isStandard: true, isCustom: false, isDiscovered: false },
      { key: 'updatedAt', label: 'Updated At', type: 'date', source: 'standard', isStandard: true, isCustom: false, isDiscovered: false }
    ]

    switch (entityType) {
      case 'issue':
        return [
          { key: '_id', label: 'ID', type: 'string', source: 'standard', isStandard: true, isCustom: false, isDiscovered: false },
          { key: 'title', label: 'Title', type: 'string', source: 'standard', isStandard: true, isCustom: false, isDiscovered: false },
          { key: 'status', label: 'Status', type: 'string', source: 'standard', isStandard: true, isCustom: false, isDiscovered: false },
          { key: 'priority', label: 'Priority', type: 'string', source: 'standard', isStandard: true, isCustom: false, isDiscovered: false },
          { key: 'type', label: 'Type', type: 'string', source: 'standard', isStandard: true, isCustom: false, isDiscovered: false },
          ...commonFields
        ]

      case 'company':
        return [
          { key: '_id', label: 'ID', type: 'string', source: 'standard', isStandard: true, isCustom: false, isDiscovered: false },
          { key: 'name', label: 'Company Name', type: 'string', source: 'standard', isStandard: true, isCustom: false, isDiscovered: false },
          { key: 'domain', label: 'Domain', type: 'string', source: 'standard', isStandard: true, isCustom: false, isDiscovered: false },
          { key: 'mrr', label: 'MRR', type: 'number', source: 'standard', isStandard: true, isCustom: false, isDiscovered: false },
          ...commonFields
        ]

      case 'user':
        return [
          { key: '_id', label: 'ID', type: 'string', source: 'standard', isStandard: true, isCustom: false, isDiscovered: false },
          { key: 'email', label: 'Email', type: 'string', source: 'standard', isStandard: true, isCustom: false, isDiscovered: false },
          { key: 'name', label: 'Name', type: 'string', source: 'standard', isStandard: true, isCustom: false, isDiscovered: false },
          { key: 'title', label: 'Title', type: 'string', source: 'standard', isStandard: true, isCustom: false, isDiscovered: false },
          { key: 'isExposedAsSenderOption', label: 'Public Email', type: 'boolean', source: 'standard', isStandard: true, isCustom: false, isDiscovered: false },
          ...commonFields
        ]

      case 'workflow':
        return [
          { key: '_id', label: 'ID', type: 'string', source: 'standard', isStandard: true, isCustom: false, isDiscovered: false },
          { key: 'name', label: 'Name', type: 'string', source: 'standard', isStandard: true, isCustom: false, isDiscovered: false },
          { key: 'type', label: 'Type', type: 'string', source: 'standard', isStandard: true, isCustom: false, isDiscovered: false },
          { key: 'disabled', label: 'Active', type: 'boolean', source: 'standard', isStandard: true, isCustom: false, isDiscovered: false },
          { key: 'createdBy', label: 'Created By', type: 'user', source: 'standard', isStandard: true, isCustom: false, isDiscovered: false },
          ...commonFields
        ]

      default:
        return commonFields
    }
  }

  /**
   * Fetch custom fields from Planhat API
   */
  private async getCustomFields(
    entityType: EntityType,
    tenantSlug?: string
  ): Promise<DetectedField[]> {
    if (!tenantSlug) {
      log.debug('No tenantSlug provided, skipping custom fields')
      return []
    }

    const cacheKey = `${entityType}-${tenantSlug}`
    
    // Check cache first
    if (this.customFieldsCache.has(cacheKey)) {
      const cached = this.customFieldsCache.get(cacheKey)!
      log.debug('Using cached custom fields', { entityType, tenantSlug, count: cached.length })
      return this.convertCustomFieldsToDetected(cached)
    }

    try {
      log.debug('Fetching custom fields from API', { entityType, tenantSlug })

      const client = getHttpClient()

      const response = await sendValidatedRequest<CustomField[]>(
        'get',
        `/customfields?parent=${entityType.toLowerCase()}&tenantSlug=${tenantSlug}`,
        undefined,
        {
          skipRequestValidation: true,
          skipResponseValidation: true,
          clientType: 'http'
        },
        client
      )

      if (Array.isArray(response)) {
        // Log sample field for debugging
        if (response.length > 0) {
          const sampleField = response[0]
          if (sampleField) {
            log.debug('Sample custom field structure', {
              entityType,
              fieldName: sampleField.name,
              fieldType: sampleField.type,
              isActive: sampleField.isActive,
              isHidden: sampleField.isHidden,
              hasIsHidden: 'isHidden' in sampleField
            })
          }

          // Log the Reviewed Date field specifically if it exists
          const reviewedDateField = response.find(f => f.name === 'Reviewed Date')
          if (reviewedDateField) {
            log.info('Reviewed Date field found in custom fields', {
              name: reviewedDateField.name,
              type: reviewedDateField.type,
              isActive: reviewedDateField.isActive,
              willBeType: this.mapCustomFieldType(reviewedDateField.type)
            })
          }
        }

        // Include all fields, both visible and hidden (we'll separate them in UI)
        const allFields = response

        // Cache the results (include all fields)
        this.customFieldsCache.set(cacheKey, allFields)
        
        log.info('Custom fields loaded successfully', {
          entityType,
          tenantSlug,
          total: response.length,
          visible: allFields.filter(f => !f.isHidden).length,
          hidden: allFields.filter(f => f.isHidden).length,
          activeCounts: {
            active: response.filter(f => f.isActive).length,
            inactive: response.filter(f => !f.isActive).length
          },
          hiddenCounts: {
            explicitlyHidden: response.filter(f => f.isHidden === true).length,
            notHidden: response.filter(f => f.isHidden !== true).length,
            undefinedHidden: response.filter(f => f.isHidden === undefined).length
          }
        })

        return this.convertCustomFieldsToDetected(allFields)
      } else {
        log.warn('Unexpected custom fields response format', { entityType, tenantSlug, response })
        return []
      }
    } catch (error) {
      log.error('Failed to fetch custom fields', { 
        entityType, 
        tenantSlug, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      })
      return []
    }
  }

  /**
   * Convert Planhat CustomField objects to DetectedField objects
   */
  private convertCustomFieldsToDetected(customFields: CustomField[]): DetectedField[] {
    return customFields.map(field => ({
      key: `custom.${field.name}`, // Use field.name instead of field.key to match JSON structure
      label: field.name, // Clean label without "Custom →" prefix
      type: this.mapCustomFieldType(field.type),
      source: 'custom' as FieldSource,
      isStandard: false,
      isCustom: true,
      isDiscovered: false,
      customFieldConfig: field
    }))
  }

  /**
   * Map Planhat custom field types to our field types
   */
  private mapCustomFieldType(customType: CustomFieldType): FieldType {
    switch (customType) {
      case 'text':
      case 'textarea':
      case 'select':
      case 'url':
      case 'email':
      case 'phone':
        return 'string'
      case 'richtext':
        return 'richtext'
      case 'number':
        return 'number'
      case 'rating':
        return 'rating'
      case 'boolean':
        return 'boolean'
      case 'date':
      case 'datetime':
      case 'day':
        return 'date'
      case 'multiselect':
        return 'array'
      case 'teammember':
      case 'enduser':
        return 'user'
      case 'teammembers':
      case 'endusers':
        return 'users'
      default:
        return 'string'
    }
  }

  /**
   * Discover fields by analyzing sample data
   */
  private discoverFieldsFromData(
    sampleData: unknown[],
    existingStandardFields: DetectedField[],
    existingCustomFields: DetectedField[]
  ): DetectedField[] {
    if (!sampleData || sampleData.length === 0) {
      return []
    }

    log.debug('Analyzing sample data for field discovery', { 
      sampleSize: sampleData.length 
    })

    const existingKeys = new Set([
      ...existingStandardFields.map(f => f.key),
      ...existingCustomFields.map(f => f.key)
    ])

    const fieldMap = new Map<string, { types: Set<string>, count: number }>()

    // Analyze sample data
    sampleData.slice(0, Math.min(100, sampleData.length)).forEach(item => {
      this.analyzeObjectFields(item, fieldMap, existingKeys)
    })

    // Convert to DetectedField objects
    const discoveredFields: DetectedField[] = []
    for (const [key, analysis] of fieldMap.entries()) {
      // Only include fields that appear in at least 10% of samples
      const threshold = Math.max(1, Math.floor(sampleData.length * 0.1))
      if (analysis.count >= threshold) {
        const type = this.inferFieldType(analysis.types)

        // DEBUG: Log discovered field types
        log.debug(`[DBG : API] Discovery: Field: ${key}, Types detected: [${Array.from(analysis.types).join(', ')}], Final type: ${type}, Count: ${analysis.count}/${threshold}`)

        discoveredFields.push({
          key,
          label: this.formatFieldLabel(key),
          type,
          source: 'discovered',
          isStandard: false,
          isCustom: false,
          isDiscovered: true
        })
      } else {
        // DEBUG: Log fields that didn't meet threshold
        log.debug(`[DBG : API] Discovery: Field ${key} excluded - count ${analysis.count} < threshold ${threshold}`)
      }
    }

    log.debug('Field discovery completed', { 
      discoveredCount: discoveredFields.length,
      totalAnalyzed: fieldMap.size,
      threshold: Math.max(1, Math.floor(sampleData.length * 0.1))
    })

    return discoveredFields
  }

  /**
   * Recursively analyze object fields
   */
  private analyzeObjectFields(
    obj: unknown,
    fieldMap: Map<string, { types: Set<string>, count: number }>,
    existingKeys: Set<string>,
    prefix = ''
  ): void {
    if (!obj || typeof obj !== 'object') {
      return
    }

    for (const [key, value] of Object.entries(obj)) {
      const fullKey = prefix ? `${prefix}.${key}` : key

      // Skip if already exists
      if (existingKeys.has(fullKey)) {
        continue
      }

      // Skip the "custom" object itself - it's not a field, it's a container for custom fields
      if (key === 'custom' && !prefix) {
        // But still analyze its contents for custom fields
        if (value && typeof value === 'object' && !Array.isArray(value)) {
          this.analyzeObjectFields(value, fieldMap, existingKeys, 'custom')
        }
        continue
      }

      // Track this field
      if (!fieldMap.has(fullKey)) {
        fieldMap.set(fullKey, { types: new Set(), count: 0 })
      }

      const fieldData = fieldMap.get(fullKey)!
      fieldData.count++

      // Enhanced type detection including date detection
      const detectedType = this.detectValueType(value)
      fieldData.types.add(detectedType)

      // DEBUG: Log date detection for fields that might be dates
      if (typeof value === 'string' && (value.includes('T') || value.includes('-'))) {
        log.debug(`[DBG : API] Field detection: Field: ${fullKey}, Value: ${value}, DetectedType: ${detectedType}`)
        if (detectedType === 'date') {
          log.debug(`[DBG : API] Field detection: ✅ Successfully detected as date: ${fullKey}`)
        } else {
          log.debug(`[DBG : API] Field detection: ❌ Failed to detect as date: ${fullKey}`)
          // Test the ISO regex manually
          const isoTest = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z?$/.test(value)
          log.debug(`[DBG : API] Field detection: ISO regex test result: ${isoTest} for value: ${value}`)
        }
      }

      // Recursively analyze nested objects (but not arrays)
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        this.analyzeObjectFields(value, fieldMap, existingKeys, fullKey)
      }
    }
  }

  /**
   * Detect the type of a value with enhanced logic for dates
   */
  private detectValueType(value: unknown): string {
    if (value === null || value === undefined) return 'null'
    if (typeof value === 'number') return 'number'
    if (typeof value === 'boolean') return 'boolean'
    if (Array.isArray(value)) return 'array'
    if (typeof value === 'object') return 'object'

    // Enhanced string analysis for dates
    if (typeof value === 'string') {
      // Check for ISO date pattern (YYYY-MM-DDTHH:mm:ss.sssZ or variations)
      if (this.isISODateString(value)) {
        return 'date'
      }
      return 'string'
    }

    return typeof value
  }

  /**
   * Check if a string is an ISO date
   * Supports comprehensive ISO 8601 format including timezone offsets and variable fractional seconds
   */
  private isISODateString(value: string): boolean {
    // Comprehensive ISO 8601 pattern supporting:
    // - Timezone offsets: +05:00, -07:00, +05:30
    // - Variable fractional seconds: .1, .12, .123, .1234, .123456
    // - Z suffix or timezone offsets
    const isoDatePattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,6})?(Z|[+-]\d{2}:\d{2})?$/
    if (!isoDatePattern.test(value)) return false

    // Extract date components for validation before expensive Date constructor
    const match = value.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})/)
    if (!match) return false

    const [, yearStr, monthStr, dayStr, hourStr, minuteStr, secondStr] = match
    const year = parseInt(yearStr!, 10)
    const month = parseInt(monthStr!, 10)
    const day = parseInt(dayStr!, 10)
    const hour = parseInt(hourStr!, 10)
    const minute = parseInt(minuteStr!, 10)
    const second = parseInt(secondStr!, 10)

    // Basic range validation
    if (month < 1 || month > 12) return false
    if (hour > 23 || minute > 59 || second > 59) return false

    // Validate timezone offset if present
    const tzMatch = value.match(/[+-](\d{2}):(\d{2})$/)
    if (tzMatch) {
      const tzHour = parseInt(tzMatch[1]!, 10)
      const tzMinute = parseInt(tzMatch[2]!, 10)
      if (tzHour > 14 || (tzHour === 14 && tzMinute > 0) || tzMinute > 59) return false
      if (tzHour < 0 || (tzHour === 0 && tzMinute === 0 && value.includes('-'))) {
        // Check for invalid negative offset like -00:00
        const negativeMatch = value.match(/-(\d{2}):(\d{2})$/)
        if (negativeMatch) {
          const negTzHour = parseInt(negativeMatch[1]!, 10)
          if (negTzHour > 12) return false
        }
      }
    }

    // Day validation including leap year check
    const daysInMonth = this.getDaysInMonth(year, month)
    if (day < 1 || day > daysInMonth) return false

    // Only now use expensive Date constructor for final validation
    const date = new Date(value)
    if (isNaN(date.getTime())) return false

    // Additional validation: ensure the date components match what we parsed
    // This catches cases where JavaScript Date accepts invalid dates and adjusts them
    const utcDate = new Date(date.getTime() - (date.getTimezoneOffset() * 60000))
    if (utcDate.getUTCFullYear() !== year ||
        utcDate.getUTCMonth() + 1 !== month ||
        utcDate.getUTCDate() !== day) {
      return false
    }

    return true
  }

  /**
   * Get number of days in a month, accounting for leap years
   */
  private getDaysInMonth(year: number, month: number): number {
    if (month === 2) {
      return this.isLeapYear(year) ? 29 : 28
    }
    if ([4, 6, 9, 11].includes(month)) {
      return 30
    }
    return 31
  }

  /**
   * Check if a year is a leap year
   */
  private isLeapYear(year: number): boolean {
    return (year % 4 === 0 && year % 100 !== 0) || (year % 400 === 0)
  }

  /**
   * Infer field type from discovered types
   */
  private inferFieldType(types: Set<string>): FieldType {
    if (types.has('date')) return 'date'
    if (types.has('number')) return 'number'
    if (types.has('boolean')) return 'boolean'
    if (types.has('array')) return 'array'
    if (types.has('object') && !types.has('string')) return 'object'
    if (types.size === 1 && types.has('object')) return 'array'
    return 'string'
  }

  /**
   * Format field key into readable label
   */
  private formatFieldLabel(key: string): string {
    return key
      .split('.')
      .map(part => part.replace(/([A-Z])/g, ' $1').trim())
      .map(part => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' → ')
  }

  /**
   * Convert detected fields to field mappings with intelligent defaults
   */
  private createFieldMappings(fields: DetectedField[]): ExtendedFieldMapping[] {
    return fields.map((field, index) => ({
      key: field.key,
      label: field.label,
      type: field.type,
      include: this.shouldIncludeByDefault(field),
      order: index, // Default order based on detection order
      width: this.getDefaultColumnWidth(field.type),
      customFieldConfig: field.customFieldConfig
    }))
  }

  /**
   * Determine if a field should be included by default
   */
  private shouldIncludeByDefault(field: DetectedField): boolean {
    // Always include key fields
    if (['_id', 'name', 'title'].includes(field.key)) {
      return true
    }
    
    // Include standard fields except internal ones
    if (field.isStandard && !field.key.startsWith('_')) {
      return true
    }
    
    // Include custom fields by default
    // Users can always deselect them if they don't want them
    if (field.isCustom) {
      return true
    }
    
    // Don't include discovered fields by default
    if (field.isDiscovered) {
      return false
    }
    
    return false
  }

  /**
   * Save field selections to Chrome storage
   */
  async saveFieldSelections(
    entityType: EntityType,
    selectedFields: string[],
    tenantSlug?: string
  ): Promise<void> {
    const key = this.getStorageKey(entityType, tenantSlug)
    
    const state: FieldSelectionState = {
      entityType,
      selectedFields,
      lastUpdated: new Date().toISOString(),
      tenantSlug
    }

    try {
      await chrome.storage.local.set({ [key]: state })
      
      // Update cache
      this.fieldSelectionsCache.set(key, selectedFields)
      
      log.info('Field selections saved', { 
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
    }
  }

  /**
   * Load field selections from Chrome storage
   */
  async loadFieldSelections(
    entityType: EntityType,
    tenantSlug?: string
  ): Promise<string[]> {
    const key = this.getStorageKey(entityType, tenantSlug)
    
    // Check cache first
    if (this.fieldSelectionsCache.has(key)) {
      const cached = this.fieldSelectionsCache.get(key)!
      log.debug('Using cached field selections', { entityType, tenantSlug, count: cached.length })
      return cached
    }

    try {
      const result = await chrome.storage.local.get(key)
      const state = result[key] as FieldSelectionState | undefined
      
      if (state?.selectedFields) {
        // Update cache
        this.fieldSelectionsCache.set(key, state.selectedFields)
        
        log.debug('Field selections loaded from storage', { 
          entityType, 
          tenantSlug, 
          selectedCount: state.selectedFields.length,
          lastUpdated: state.lastUpdated
        })
        
        return state.selectedFields
      } else {
        log.debug('No saved field selections found', { entityType, tenantSlug })
        return []
      }
    } catch (error) {
      log.error('Failed to load field selections', { 
        entityType, 
        tenantSlug, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      })
      return []
    }
  }

  /**
   * Apply saved field selections to field mappings
   */
  private applyFieldSelections(
    fieldMappings: ExtendedFieldMapping[],
    savedSelections: string[]
  ): void {
    log.debug('Applying field selections - before matching', {
      savedSelections,
      currentFieldKeys: fieldMappings.map(m => m.key),
      mappingCount: fieldMappings.length
    })

    const selectedSet = new Set(savedSelections)
    let matchCount = 0
    
    fieldMappings.forEach(mapping => {
      const isDirectMatch = selectedSet.has(mapping.key)
      let isMatch = isDirectMatch
      
      // If no direct match, try alternative matching strategies
      if (!isDirectMatch) {
        // Try matching without custom prefix
        if (mapping.key.startsWith('custom.')) {
          const unprefixedKey = mapping.key.substring(7) // Remove 'custom.' prefix
          isMatch = selectedSet.has(unprefixedKey)
          if (isMatch) {
            log.debug('Matched field using unprefixed key', {
              savedKey: unprefixedKey,
              currentKey: mapping.key
            })
          }
        }
        
        // Try matching with custom prefix (for backwards compatibility)
        if (!isMatch && !mapping.key.startsWith('custom.')) {
          const prefixedKey = `custom.${mapping.key}`
          isMatch = selectedSet.has(prefixedKey)
          if (isMatch) {
            log.debug('Matched field using prefixed key', {
              savedKey: prefixedKey,
              currentKey: mapping.key
            })
          }
        }
      }
      
      mapping.include = isMatch
      if (isMatch) matchCount++
    })

    log.info('Applied field selections - matching results', {
      totalSavedSelections: savedSelections.length,
      totalCurrentFields: fieldMappings.length,
      successfulMatches: matchCount,
      includedFields: fieldMappings.filter(m => m.include).map(m => m.key)
    })
  }

  /**
   * Generate storage key for field selections
   */
  private getStorageKey(entityType: EntityType, tenantSlug?: string): string {
    return tenantSlug ? 
      `field-selections-${entityType}-${tenantSlug}` : 
      `field-selections-${entityType}`
  }

  /**
   * Clear custom fields cache (useful for testing or tenant switching)
   */
  clearCustomFieldsCache(): void {
    this.customFieldsCache.clear()
    log.debug('Custom fields cache cleared')
  }

  /**
   * Get default column width based on field type
   */
  private getDefaultColumnWidth(fieldType: FieldType): number {
    switch (fieldType) {
      case 'boolean':
        return 80
      case 'number':
      case 'rating':
        return 100
      case 'date':
        return 120
      case 'string':
      case 'richtext':
        return 200
      case 'user':
      case 'users':
        return 150
      case 'array':
      case 'object':
        return 250
      default:
        return 150
    }
  }

  /**
   * Save column order to Chrome storage
   */
  async saveColumnOrder(
    entityType: EntityType,
    columnOrder: string[],
    tenantSlug?: string
  ): Promise<void> {
    const key = this.getColumnOrderStorageKey(entityType, tenantSlug)

    const state: ColumnOrderState = {
      entityType,
      columnOrder,
      lastUpdated: new Date().toISOString(),
      tenantSlug
    }

    try {
      await chrome.storage.local.set({ [key]: state })

      // Update cache
      this.columnOrderCache.set(key, columnOrder)

      log.info('Column order saved', {
        entityType,
        tenantSlug,
        columnCount: columnOrder.length
      })
    } catch (error) {
      log.error('Failed to save column order', {
        entityType,
        tenantSlug,
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  }

  /**
   * Load column order from Chrome storage
   */
  async loadColumnOrder(
    entityType: EntityType,
    tenantSlug?: string
  ): Promise<string[]> {
    const key = this.getColumnOrderStorageKey(entityType, tenantSlug)

    // Check cache first
    if (this.columnOrderCache.has(key)) {
      const cached = this.columnOrderCache.get(key)!
      log.debug('Using cached column order', { entityType, tenantSlug, count: cached.length })
      return cached
    }

    try {
      const result = await chrome.storage.local.get(key)
      const state = result[key] as ColumnOrderState | undefined

      if (state?.columnOrder) {
        // Update cache
        this.columnOrderCache.set(key, state.columnOrder)

        log.debug('Column order loaded from storage', {
          entityType,
          tenantSlug,
          columnCount: state.columnOrder.length,
          lastUpdated: state.lastUpdated
        })

        return state.columnOrder
      } else {
        log.debug('No saved column order found', { entityType, tenantSlug })
        return []
      }
    } catch (error) {
      log.error('Failed to load column order', {
        entityType,
        tenantSlug,
        error: error instanceof Error ? error.message : 'Unknown error'
      })
      return []
    }
  }

  /**
   * Save column widths to Chrome storage
   */
  async saveColumnWidths(
    entityType: EntityType,
    columnWidths: Record<string, number>,
    tenantSlug?: string
  ): Promise<void> {
    const key = this.getColumnWidthStorageKey(entityType, tenantSlug)

    const state: ColumnWidthState = {
      entityType,
      columnWidths,
      lastUpdated: new Date().toISOString(),
      tenantSlug
    }

    try {
      await chrome.storage.local.set({ [key]: state })

      // Update cache
      this.columnWidthCache.set(key, columnWidths)

      log.info('Column widths saved', {
        entityType,
        tenantSlug,
        columnCount: Object.keys(columnWidths).length
      })
    } catch (error) {
      log.error('Failed to save column widths', {
        entityType,
        tenantSlug,
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  }

  /**
   * Load column widths from Chrome storage
   */
  async loadColumnWidths(
    entityType: EntityType,
    tenantSlug?: string
  ): Promise<Record<string, number>> {
    const key = this.getColumnWidthStorageKey(entityType, tenantSlug)

    // Check cache first
    if (this.columnWidthCache.has(key)) {
      const cached = this.columnWidthCache.get(key)!
      return cached
    }

    try {
      const result = await chrome.storage.local.get(key)
      const state = result[key] as ColumnWidthState | undefined

      if (state?.columnWidths) {
        // Update cache
        this.columnWidthCache.set(key, state.columnWidths)

        log.debug('Column widths loaded from storage', {
          entityType,
          tenantSlug,
          columnCount: Object.keys(state.columnWidths).length,
          lastUpdated: state.lastUpdated
        })

        return state.columnWidths
      } else {
        log.debug('No saved column widths found', { entityType, tenantSlug })
        return {}
      }
    } catch (error) {
      log.error('Failed to load column widths', {
        entityType,
        tenantSlug,
        error: error instanceof Error ? error.message : 'Unknown error'
      })
      return {}
    }
  }

  /**
   * Apply saved column order to field mappings
   */
  private applyColumnOrder(
    fieldMappings: ExtendedFieldMapping[],
    savedOrder: string[]
  ): void {
    log.debug('Applying column order', {
      savedOrder,
      currentFields: fieldMappings.map(m => m.key),
      mappingCount: fieldMappings.length
    })

    const orderMap = new Map(savedOrder.map((key, index) => [key, index]))
    let maxOrder = savedOrder.length

    fieldMappings.forEach(mapping => {
      const savedOrderIndex = orderMap.get(mapping.key)
      if (savedOrderIndex !== undefined) {
        mapping.order = savedOrderIndex
      } else {
        // Assign new order for fields not in saved order
        mapping.order = maxOrder++
      }
    })

    // Sort by order to maintain consistency
    fieldMappings.sort((a, b) => (a.order || 0) - (b.order || 0))

    log.debug('Applied column order', {
      appliedOrders: fieldMappings.map(m => ({ key: m.key, order: m.order }))
    })
  }

  /**
   * Apply saved column widths to field mappings
   */
  private applyColumnWidths(
    fieldMappings: ExtendedFieldMapping[],
    savedWidths: Record<string, number>
  ): void {
    log.debug('Applying column widths', {
      savedWidths,
      currentFields: fieldMappings.map(m => m.key),
      mappingCount: fieldMappings.length
    })

    let appliedCount = 0

    fieldMappings.forEach(mapping => {
      const savedWidth = savedWidths[mapping.key]
      if (savedWidth !== undefined && savedWidth > 0) {
        mapping.width = savedWidth
        appliedCount++
      }
    })

    log.debug('Applied column widths', {
      appliedCount,
      totalSavedWidths: Object.keys(savedWidths).length
    })
  }

  /**
   * Generate storage key for column order
   */
  private getColumnOrderStorageKey(entityType: EntityType, tenantSlug?: string): string {
    return tenantSlug ?
      `column-order-${entityType}-${tenantSlug}` :
      `column-order-${entityType}`
  }

  /**
   * Generate storage key for column widths
   */
  private getColumnWidthStorageKey(entityType: EntityType, tenantSlug?: string): string {
    return tenantSlug ?
      `column-widths-${entityType}-${tenantSlug}` :
      `column-widths-${entityType}`
  }

  /**
   * Clear field selections cache
   */
  clearFieldSelectionsCache(): void {
    this.fieldSelectionsCache.clear()
    log.debug('Field selections cache cleared')
  }

  /**
   * Clear column order cache
   */
  clearColumnOrderCache(): void {
    this.columnOrderCache.clear()
    log.debug('Column order cache cleared')
  }

  /**
   * Clear column width cache
   */
  clearColumnWidthCache(): void {
    this.columnWidthCache.clear()
    log.debug('Column width cache cleared')
  }

  /**
   * Clear stored column widths from Chrome storage
   */
  async clearColumnWidths(entityType?: EntityType, tenantSlug?: string): Promise<void> {
    try {
      if (entityType && tenantSlug) {
        // Clear specific entity and tenant
        const key = this.getColumnWidthStorageKey(entityType, tenantSlug)
        await chrome.storage.local.remove(key)
        this.columnWidthCache.delete(key)
        log.info('Column widths cleared for specific entity and tenant', { entityType, tenantSlug })
      } else if (entityType) {
        // Clear all for specific entity type
        const keys = [`column-widths-${entityType}`, `table-column-widths-${entityType}`]
        // Also get all tenant-specific keys for this entity
        const allData = await chrome.storage.local.get(null)
        const entityKeys = Object.keys(allData).filter(key =>
          key.startsWith(`column-widths-${entityType}-`) ||
          key.startsWith(`table-column-widths-${entityType}-`)
        )
        const allKeys = [...keys, ...entityKeys]

        if (allKeys.length > 0) {
          await chrome.storage.local.remove(allKeys)
          allKeys.forEach(key => this.columnWidthCache.delete(key))
        }
        log.info('Column widths cleared for entity type', { entityType, clearedKeys: allKeys.length })
      } else {
        // Clear all column width data
        const allData = await chrome.storage.local.get(null)
        const widthKeys = Object.keys(allData).filter(key =>
          key.startsWith('column-widths-') || key.startsWith('table-column-widths-')
        )

        if (widthKeys.length > 0) {
          await chrome.storage.local.remove(widthKeys)
          this.columnWidthCache.clear()
        }
        log.info('All column widths cleared', { clearedKeys: widthKeys.length })
      }
    } catch (error) {
      log.error('Failed to clear column widths', {
        entityType,
        tenantSlug,
        error: error instanceof Error ? error.message : 'Unknown error'
      })
      throw error
    }
  }

  /**
   * Clear all caches
   */
  clearAllCaches(): void {
    this.clearCustomFieldsCache()
    this.clearFieldSelectionsCache()
    this.clearColumnOrderCache()
    this.clearColumnWidthCache()
    log.info('All caches cleared')
  }
}

// Export singleton instance
export const fieldDetectionService = FieldDetectionService.getInstance()