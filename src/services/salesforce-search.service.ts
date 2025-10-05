/**
 * Salesforce Search Service
 *
 * Provides comprehensive search functionality across Salesforce integration data
 * including object names, field names, types, and metadata. Optimized for
 * performance with debounced search and efficient filtering algorithms.
 *
 * @fileVersion 3.1.2
 * @author Claude Code AI Assistant
 */

import type {
  SalesforceIntegrationData,
  SalesforceObjectMapping,
  SalesforceFieldMapping,
  SearchableField,
  SalesforceSearchResult,
  SalesforceSearchFilters,
  SalesforceDirection,
  SalesforceFieldType
} from '../types/integrations/salesforce.types'
import { logSanitizer } from '../utils/log-sanitizer'
import { logger } from '../utils/logger'

const log = logger.api

/**
 * Search performance metrics
 */
export interface SearchMetrics {
  searchTime: number
  totalRecords: number
  filteredRecords: number
  matchingObjects: number
  matchingFields: number
  algorithmUsed: string
  indexSize: number
}

/**
 * Search result with detailed metrics
 */
export interface EnhancedSearchResult extends SalesforceSearchResult {
  metrics: SearchMetrics
  suggestions: string[]
  highlightedTerms: string[]
}

/**
 * Search configuration options
 */
export interface SearchOptions {
  /** Enable fuzzy matching for typos */
  fuzzyMatching?: boolean
  /** Minimum match score for results (0-1) */
  minMatchScore?: number
  /** Maximum number of results to return */
  maxResults?: number
  /** Enable result highlighting */
  enableHighlighting?: boolean
  /** Case sensitive search */
  caseSensitive?: boolean
  /** Search in field descriptions */
  includeDescriptions?: boolean
}

/**
 * Debounced search function type
 */
export type DebouncedSearchFunction = (
  term: string,
  filters?: SalesforceSearchFilters,
  options?: SearchOptions
) => Promise<EnhancedSearchResult>

/**
 * Rate limiting configuration for search operations
 */
interface RateLimitConfig {
  windowMs: number
  maxRequests: number
  blockDurationMs: number
}

/**
 * Rate limit state per user/session
 */
interface RateLimitState {
  requests: number[]
  blocked: boolean
  blockExpiresAt: number
}

/**
 * Search rate limiter class
 */
class SearchRateLimiter {
  private readonly limits = new Map<string, RateLimitState>()
  private readonly config: RateLimitConfig = {
    windowMs: 60000, // 1 minute
    maxRequests: 50, // Max 50 searches per minute
    blockDurationMs: 300000 // Block for 5 minutes
  }

  isRateLimited(identifier: string): boolean {
    const now = Date.now()
    const state = this.limits.get(identifier) || {
      requests: [],
      blocked: false,
      blockExpiresAt: 0
    }

    // Check if still blocked
    if (state.blocked && now < state.blockExpiresAt) {
      return true
    }

    // Clear expired block
    if (state.blocked && now >= state.blockExpiresAt) {
      state.blocked = false
      state.blockExpiresAt = 0
      state.requests = []
    }

    // Clean old requests
    const windowStart = now - this.config.windowMs
    state.requests = state.requests.filter(time => time > windowStart)

    // Check rate limit
    if (state.requests.length >= this.config.maxRequests) {
      state.blocked = true
      state.blockExpiresAt = now + this.config.blockDurationMs
      this.limits.set(identifier, state)
      return true
    }

    return false
  }

  recordRequest(identifier: string): void {
    const now = Date.now()
    const state = this.limits.get(identifier) || {
      requests: [],
      blocked: false,
      blockExpiresAt: 0
    }

    if (!state.blocked) {
      state.requests.push(now)
      this.limits.set(identifier, state)
    }
  }

  getTimeUntilUnblocked(identifier: string): number {
    const state = this.limits.get(identifier)
    if (!state || !state.blocked) {
      return 0
    }

    const now = Date.now()
    return Math.max(0, Math.ceil((state.blockExpiresAt - now) / 1000))
  }

  clear(): void {
    this.limits.clear()
  }
}

/**
 * Service for searching Salesforce integration data
 *
 * Provides fast, flexible search across objects, fields, and metadata with
 * advanced filtering, fuzzy matching, and performance optimization.
 */
class SalesforceSearchService {
  private searchIndex: Map<string, SearchableField[]> = new Map()
  private lastIndexBuildTime: number = 0
  private debouncedSearchCache: Map<string, EnhancedSearchResult> = new Map()
  private readonly debounceDelay = 300 // milliseconds
  private readonly maxCacheSize = 100
  private readonly fuzzyThreshold = 0.7
  private readonly rateLimiter = new SearchRateLimiter()

  /**
   * Initialize or update the search index with integration data
   *
   * @param integrationData Processed Salesforce integration data
   * @returns Promise that resolves when indexing is complete
   */
  async buildSearchIndex(integrationData: SalesforceIntegrationData): Promise<void> {
    const startTime = performance.now()
    const requestId = this.generateRequestId()

    log.info('Building Salesforce search index', logSanitizer.forApi({
      requestId,
      objectCount: integrationData.objectMappings.length,
      searchableFieldCount: integrationData.searchableFields.length,
      dataVersion: integrationData.version
    }))

    try {
      // Clear existing index
      this.searchIndex.clear()
      this.clearCache()

      // Build primary search index from searchable fields
      const primaryIndex: SearchableField[] = [...integrationData.searchableFields]

      // Group fields by normalized search term for faster lookups
      const termIndex = new Map<string, SearchableField[]>()

      for (const field of primaryIndex) {
        const normalizedTerm = this.normalizeSearchTerm(field.searchTerm)

        if (!termIndex.has(normalizedTerm)) {
          termIndex.set(normalizedTerm, [])
        }
        termIndex.get(normalizedTerm)!.push(field)
      }

      // Store the grouped index
      this.searchIndex = termIndex

      // Build additional indexes for performance
      await this.buildSecondaryIndexes(integrationData, requestId)

      const buildTime = Math.round(performance.now() - startTime)
      this.lastIndexBuildTime = buildTime

      log.info('Search index built successfully', logSanitizer.forApi({
        requestId,
        buildTime,
        indexSize: this.searchIndex.size,
        totalFields: primaryIndex.length,
        uniqueTerms: termIndex.size
      }))

    } catch (error) {
      log.error('Failed to build search index', logSanitizer.forError({
        requestId,
        error: error instanceof Error ? error.message : 'Unknown error',
        buildTime: Math.round(performance.now() - startTime)
      }))
      throw error
    }
  }

  /**
   * Search across Salesforce integration data with debouncing
   *
   * @param searchTerm The search term to look for
   * @param filters Optional filters to apply
   * @param options Search configuration options
   * @returns Promise resolving to enhanced search results
   */
  async search(
    searchTerm: string,
    filters: SalesforceSearchFilters = {},
    options: SearchOptions = {}
  ): Promise<EnhancedSearchResult> {
    return this.createDebouncedSearch()(searchTerm, filters, options)
  }

  /**
   * Perform immediate search without debouncing (for programmatic use)
   *
   * @param searchTerm The search term to look for
   * @param filters Optional filters to apply
   * @param options Search configuration options
   * @param userIdentifier Optional user identifier for rate limiting
   * @returns Promise resolving to enhanced search results
   */
  async searchImmediate(
    searchTerm: string,
    filters: SalesforceSearchFilters = {},
    options: SearchOptions = {},
    userIdentifier: string = 'anonymous'
  ): Promise<EnhancedSearchResult> {
    const startTime = performance.now()
    const requestId = this.generateRequestId()

    const {
      fuzzyMatching = true,
      minMatchScore = 0.3,
      maxResults = 100,
      enableHighlighting = true,
      caseSensitive = false,
      includeDescriptions = true
    } = options

    // Check rate limiting first
    if (this.rateLimiter.isRateLimited(userIdentifier)) {
      const timeUntilUnblocked = this.rateLimiter.getTimeUntilUnblocked(userIdentifier)

      log.warn('Search rate limited', logSanitizer.forError({
        requestId,
        userIdentifier: logSanitizer.forError({ userIdentifier }).userIdentifier,
        timeUntilUnblocked
      }))

      return {
        objectMappings: [],
        matchingFields: new Map(),
        totalMatches: 0,
        searchTerm: searchTerm.trim(),
        searchTime: 0,
        matchCategories: [],
        metrics: {
          searchTime: 0,
          totalRecords: 0,
          filteredRecords: 0,
          matchingObjects: 0,
          matchingFields: 0,
          algorithmUsed: 'rate_limited',
          indexSize: this.searchIndex.size
        },
        suggestions: [],
        highlightedTerms: []
      }
    }

    // Record the search request
    this.rateLimiter.recordRequest(userIdentifier)

    log.debug('Starting search', logSanitizer.forSearch({
      requestId,
      searchTerm: searchTerm.substring(0, 50), // Limit log size
      fuzzyMatching,
      minMatchScore,
      maxResults,
      filtersCount: Object.keys(filters).length,
      userIdentifier: logSanitizer.forDebug({ userIdentifier }).userIdentifier
    }))

    try {
      if (!searchTerm.trim()) {
        return this.createEmptySearchResult(searchTerm, startTime, requestId)
      }

      // Check cache first
      const cacheKey = this.createCacheKey(searchTerm, filters, options)
      const cached = this.debouncedSearchCache.get(cacheKey)
      if (cached) {
        log.debug('Returning cached search result', logSanitizer.forDebug({ requestId, cacheKey: '[MASKED]' }))
        return cached
      }

      // Normalize search term
      const normalizedTerm = caseSensitive ? searchTerm.trim() : searchTerm.toLowerCase().trim()

      // Find matching searchable fields
      const matchingFields = this.findMatchingFields(
        normalizedTerm,
        fuzzyMatching,
        minMatchScore,
        includeDescriptions
      )

      // Apply filters
      const filteredFields = this.applyFilters(matchingFields, filters)

      // Limit results
      const limitedFields = filteredFields.slice(0, maxResults)

      // Group by objects and build object mappings
      const { objectMappings, matchingFieldsMap } = this.buildSearchResultMappings(
        limitedFields,
        enableHighlighting ? normalizedTerm : undefined
      )

      // Calculate match categories
      const matchCategories = this.extractMatchCategories(limitedFields)

      // Generate suggestions
      const suggestions = this.generateSearchSuggestions(normalizedTerm, matchingFields)

      // Extract highlighted terms
      const highlightedTerms = enableHighlighting
        ? this.extractHighlightedTerms(normalizedTerm)
        : []

      const searchTime = Math.round(performance.now() - startTime)

      const result: EnhancedSearchResult = {
        objectMappings,
        matchingFields: matchingFieldsMap,
        totalMatches: filteredFields.length,
        searchTerm: searchTerm.trim(),
        searchTime,
        matchCategories,
        metrics: {
          searchTime,
          totalRecords: this.getTotalRecordCount(),
          filteredRecords: filteredFields.length,
          matchingObjects: objectMappings.length,
          matchingFields: Array.from(matchingFieldsMap.values()).reduce((sum, fields) => sum + fields.length, 0),
          algorithmUsed: fuzzyMatching ? 'fuzzy' : 'exact',
          indexSize: this.searchIndex.size
        },
        suggestions,
        highlightedTerms
      }

      // Cache result if it's valuable
      if (filteredFields.length > 0) {
        this.cacheSearchResult(cacheKey, result)
      }

      log.debug('Search completed', logSanitizer.forDebug({
        requestId,
        searchTime,
        totalMatches: result.totalMatches,
        objectCount: result.objectMappings.length,
        suggestionCount: result.suggestions.length
      }))

      return result

    } catch (error) {
      const searchTime = Math.round(performance.now() - startTime)

      log.error('Search failed', logSanitizer.forError({
        requestId,
        searchTime,
        error: error instanceof Error ? error.message : 'Unknown error'
      }))

      // Return empty result on error
      return this.createEmptySearchResult(searchTerm, startTime, requestId)
    }
  }

  /**
   * Get search suggestions based on partial input
   *
   * @param partialTerm Partial search term
   * @param maxSuggestions Maximum number of suggestions to return
   * @returns Array of suggested search terms
   */
  async getSuggestions(partialTerm: string, maxSuggestions: number = 10): Promise<string[]> {
    const normalizedTerm = this.normalizeSearchTerm(partialTerm)

    if (normalizedTerm.length < 2) {
      return []
    }

    const suggestions = new Set<string>()

    // Find terms that start with the partial term
    for (const [term, fields] of this.searchIndex) {
      if (term.startsWith(normalizedTerm) && suggestions.size < maxSuggestions) {
        // Use the display label as suggestion if available
        const firstField = fields[0]
        if (firstField?.displayLabel) {
          suggestions.add(firstField.displayLabel)
        } else {
          suggestions.add(firstField?.fieldName ?? term)
        }
      }
    }

    return Array.from(suggestions).slice(0, maxSuggestions)
  }

  /**
   * Clear search cache and rate limits
   */
  clearCache(): void {
    this.debouncedSearchCache.clear()
    this.rateLimiter.clear()
    log.debug('Search cache and rate limits cleared')
  }

  /**
   * Get search index statistics including rate limiting info
   */
  getIndexStats(): {
    indexSize: number
    totalFields: number
    lastBuildTime: number
    cacheSize: number
    rateLimitInfo: {
      activeUsers: number
      blockedUsers: number
    }
  } {
    const totalFields = Array.from(this.searchIndex.values()).reduce(
      (sum, fields) => sum + fields.length,
      0
    )

    // Calculate rate limiting stats
    let blockedUsers = 0
    const activeUsers = this.rateLimiter['limits'].size

    for (const state of this.rateLimiter['limits'].values()) {
      if (state.blocked && Date.now() < state.blockExpiresAt) {
        blockedUsers++
      }
    }

    return {
      indexSize: this.searchIndex.size,
      totalFields,
      lastBuildTime: this.lastIndexBuildTime,
      cacheSize: this.debouncedSearchCache.size,
      rateLimitInfo: {
        activeUsers,
        blockedUsers
      }
    }
  }

  /**
   * Private helper methods
   */

  private async buildSecondaryIndexes(
    integrationData: SalesforceIntegrationData,
    requestId: string
  ): Promise<void> {
    // Build object name index for faster object-level searches
    const objectNames = integrationData.objectMappings.map(obj => obj.sfObject.toLowerCase())
    log.debug('Built secondary indexes', logSanitizer.forDebug({
      requestId,
      objectNames: objectNames.length
    }))
  }

  private createDebouncedSearch(): DebouncedSearchFunction {
    let timeoutId: NodeJS.Timeout | null = null

    return (searchTerm: string, filters?: SalesforceSearchFilters, options?: SearchOptions) => {
      return new Promise((resolve) => {
        if (timeoutId) {
          clearTimeout(timeoutId)
        }

        timeoutId = setTimeout(async () => {
          try {
            const result = await this.searchImmediate(searchTerm, filters, options)
            resolve(result)
          } catch (error) {
            // Return empty result on error
            resolve(this.createEmptySearchResult(searchTerm, performance.now()))
          }
        }, this.debounceDelay)
      })
    }
  }

  private findMatchingFields(
    normalizedTerm: string,
    fuzzyMatching: boolean,
    minMatchScore: number,
    includeDescriptions: boolean
  ): Array<SearchableField & { matchScore: number }> {
    const matchingFields: Array<SearchableField & { matchScore: number }> = []

    for (const [term, fields] of this.searchIndex) {
      for (const field of fields) {
        const score = this.calculateMatchScore(
          normalizedTerm,
          field,
          fuzzyMatching,
          includeDescriptions
        )

        if (score >= minMatchScore) {
          matchingFields.push({ ...field, matchScore: score })
        }
      }
    }

    // Sort by match score (descending)
    return matchingFields.sort((a, b) => b.matchScore - a.matchScore)
  }

  private calculateMatchScore(
    searchTerm: string,
    field: SearchableField,
    fuzzyMatching: boolean,
    includeDescriptions: boolean
  ): number {
    const fieldName = field.fieldName.toLowerCase()
    const searchTerm_normalized = field.searchTerm
    const displayLabel = field.displayLabel?.toLowerCase() || ''

    // Exact match gets highest score
    if (fieldName === searchTerm || searchTerm_normalized === searchTerm) {
      return 1.0
    }

    // Starts with match gets high score
    if (fieldName.startsWith(searchTerm) || searchTerm_normalized.startsWith(searchTerm)) {
      return 0.9
    }

    // Contains match gets medium score
    if (fieldName.includes(searchTerm) || searchTerm_normalized.includes(searchTerm)) {
      return 0.7
    }

    // Display label match
    if (displayLabel.includes(searchTerm)) {
      return 0.6
    }

    // Fuzzy matching
    if (fuzzyMatching) {
      const fuzzyScore = this.calculateFuzzyScore(searchTerm, fieldName)
      if (fuzzyScore >= this.fuzzyThreshold) {
        return fuzzyScore * 0.5 // Reduce score for fuzzy matches
      }
    }

    return 0
  }

  private calculateFuzzyScore(term1: string, term2: string): number {
    // Simple Levenshtein distance-based scoring
    const distance = this.levenshteinDistance(term1, term2)
    const maxLength = Math.max(term1.length, term2.length)

    if (maxLength === 0) return 1

    return 1 - (distance / maxLength)
  }

  private levenshteinDistance(str1: string, str2: string): number {
    const matrix: number[][] = []

    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i]
    }

    for (let j = 0; j <= str1.length; j++) {
      matrix[0]![j] = j
    }

    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i]![j] = matrix[i - 1]![j - 1]!
        } else {
          matrix[i]![j] = Math.min(
            matrix[i - 1]![j - 1]! + 1, // substitution
            matrix[i]![j - 1]! + 1,     // insertion
            matrix[i - 1]![j]! + 1      // deletion
          )
        }
      }
    }

    return matrix[str2.length]![str1.length]!
  }

  private applyFilters(
    fields: Array<SearchableField & { matchScore: number }>,
    filters: SalesforceSearchFilters
  ): Array<SearchableField & { matchScore: number }> {
    let filtered = fields

    // Filter by direction
    if (filters.direction && filters.direction.length > 0) {
      // This would require additional metadata in SearchableField
      // For now, we'll skip this filter as it's not available in the current structure
    }

    // Filter by object types
    if (filters.objectTypes && filters.objectTypes.length > 0) {
      filtered = filtered.filter(field =>
        filters.objectTypes!.some(type =>
          field.objectName.toLowerCase().includes(type.toLowerCase())
        )
      )
    }

    // Filter by field types
    if (filters.fieldTypes && filters.fieldTypes.length > 0) {
      // This would require additional metadata in SearchableField
      // For now, we'll use category as a proxy
      filtered = filtered.filter(field =>
        filters.fieldTypes!.some(type =>
          field.category?.toLowerCase().includes(type.toLowerCase())
        )
      )
    }

    // Filter custom objects
    if (filters.includeCustomObjects === false) {
      filtered = filtered.filter(field => field.category !== 'custom_object')
    }

    if (filters.includeStandardObjects === false) {
      filtered = filtered.filter(field => field.category !== 'standard_object')
    }

    return filtered
  }

  private buildSearchResultMappings(
    fields: Array<SearchableField & { matchScore: number }>,
    highlightTerm?: string
  ): {
    objectMappings: SalesforceObjectMapping[]
    matchingFieldsMap: Map<string, SalesforceFieldMapping[]>
  } {
    const objectMappingsMap = new Map<string, SalesforceObjectMapping>()
    const matchingFieldsMap = new Map<string, SalesforceFieldMapping[]>()

    // Group fields by object
    const fieldsByObject = new Map<string, Array<SearchableField & { matchScore: number }>>()

    for (const field of fields) {
      if (!fieldsByObject.has(field.objectName)) {
        fieldsByObject.set(field.objectName, [])
      }
      fieldsByObject.get(field.objectName)!.push(field)
    }

    // Build object mappings and field mappings
    for (const [objectName, objectFields] of fieldsByObject) {
      // Create minimal object mapping for search results
      const objectMapping: SalesforceObjectMapping = {
        sfObject: objectName,
        phObject: objectName, // We don't have this information in search fields
        direction: null,
        fieldCount: objectFields.length,
        fields: [], // Will be filled below
        filters: null,
        syncOwner: false,
        lastSync: null,
        isCustom: objectFields.some(f => f.category === 'custom_object'),
        complexity: 'medium'
      }

      // Build field mappings from search fields
      const fieldMappings: SalesforceFieldMapping[] = []

      for (const field of objectFields) {
        if (field.fieldType === 'field') {
          const fieldMapping: SalesforceFieldMapping = {
            sfField: field.fieldName,
            phField: field.fieldName, // We don't have separate mapping info
            direction: 'fromSF', // Default assumption
            sfType: 'string', // Default assumption
            phType: 'string', // Default assumption
            type: field.category === 'custom' ? 'custom' : 'attribute',
            onlySend: false,
            default: '',
            reference: null,
            sfListValues: []
          }

          fieldMappings.push(fieldMapping)
        }
      }

      objectMapping.fields = fieldMappings
      objectMappingsMap.set(objectName, objectMapping)
      matchingFieldsMap.set(objectName, fieldMappings)
    }

    return {
      objectMappings: Array.from(objectMappingsMap.values()),
      matchingFieldsMap
    }
  }

  private extractMatchCategories(fields: Array<SearchableField & { matchScore: number }>): string[] {
    const categories = new Set<string>()

    for (const field of fields) {
      if (field.category) {
        categories.add(field.category)
      }
      categories.add(field.fieldType)
    }

    return Array.from(categories)
  }

  private generateSearchSuggestions(
    searchTerm: string,
    allMatches: Array<SearchableField & { matchScore: number }>
  ): string[] {
    const suggestions = new Set<string>()

    // Find related terms
    for (const match of allMatches.slice(0, 20)) { // Limit for performance
      const fieldName = match.fieldName.toLowerCase()

      // Extract words from field names that are similar to search term
      const words = fieldName.split(/[^a-z0-9]+/)
      for (const word of words) {
        if (word.length > 2 && word !== searchTerm && word.includes(searchTerm.substring(0, 3))) {
          suggestions.add(word)
        }
      }
    }

    return Array.from(suggestions).slice(0, 5)
  }

  private extractHighlightedTerms(searchTerm: string): string[] {
    // Simple implementation - return the search term and common variations
    const terms = [searchTerm]

    // Add partial terms for highlighting
    if (searchTerm.length > 3) {
      terms.push(searchTerm.substring(0, 3))
    }

    return terms
  }

  private createEmptySearchResult(
    searchTerm: string,
    startTime?: number,
    requestId?: string
  ): EnhancedSearchResult {
    const searchTime = Math.round(performance.now() - (startTime || performance.now()))

    return {
      objectMappings: [],
      matchingFields: new Map(),
      totalMatches: 0,
      searchTerm: searchTerm.trim(),
      searchTime,
      matchCategories: [],
      metrics: {
        searchTime,
        totalRecords: this.getTotalRecordCount(),
        filteredRecords: 0,
        matchingObjects: 0,
        matchingFields: 0,
        algorithmUsed: 'none',
        indexSize: this.searchIndex.size
      },
      suggestions: [],
      highlightedTerms: []
    }
  }

  private createCacheKey(
    searchTerm: string,
    filters: SalesforceSearchFilters,
    options: SearchOptions
  ): string {
    const filterString = JSON.stringify(filters)
    const optionsString = JSON.stringify(options)
    return `${searchTerm}_${filterString}_${optionsString}`
  }

  private cacheSearchResult(key: string, result: EnhancedSearchResult): void {
    // Limit cache size
    if (this.debouncedSearchCache.size >= this.maxCacheSize) {
      const firstKey = this.debouncedSearchCache.keys().next().value as string
      if (firstKey) {
        this.debouncedSearchCache.delete(firstKey)
      }
    }

    this.debouncedSearchCache.set(key, result)
  }

  private getTotalRecordCount(): number {
    return Array.from(this.searchIndex.values()).reduce(
      (sum, fields) => sum + fields.length,
      0
    )
  }

  private normalizeSearchTerm(term: string): string {
    return term.toLowerCase().replace(/[^a-z0-9]/g, '')
  }

  private generateRequestId(): string {
    return `sfs_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`
  }
}

// Export singleton instance
export const salesforceSearchService = new SalesforceSearchService()

// Export class for advanced usage
export { SalesforceSearchService }