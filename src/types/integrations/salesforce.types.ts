/**
 * Salesforce Integration TypeScript Type Definitions
 *
 * Complete type system based on the real Salesforce integration data structure.
 * Supports up to 10,000 field mappings with comprehensive error handling and validation.
 *
 * @fileVersion 3.1.2
 * @author Claude Code AI Assistant
 */

import { z } from 'zod'

/* ========================================================================
 * CORE DIRECTION AND FIELD TYPES
 * ======================================================================== */

/**
 * Synchronization direction between Salesforce and Planhat
 */
export type SalesforceDirection = 'fromSF' | 'toSF' | 'both' | 'none'

/**
 * Salesforce field data types
 */
export type SalesforceFieldType =
  | 'string'
  | 'double'
  | 'date'
  | 'datetime'
  | 'boolean'
  | 'picklist'
  | 'multipicklist'
  | 'user'
  | 'reference'
  | 'email'
  | 'url'
  | 'currency'
  | 'percent'

/**
 * Planhat field data types
 */
export type PlanhatFieldType =
  | 'string'
  | 'number'
  | 'date'
  | 'datetime'
  | 'boolean'
  | 'text'
  | 'rich text'
  | 'list'
  | 'team member'

/**
 * Field mapping categories
 */
export type FieldMappingType = 'attribute' | 'custom'

/* ========================================================================
 * FIELD MAPPING INTERFACES
 * ======================================================================== */

/**
 * Individual field mapping between Salesforce and Planhat
 * Represents a single field-to-field connection with metadata
 */
export interface SalesforceFieldMapping {
  /** Salesforce field API name */
  sfField: string

  /** Planhat field name or path (e.g., 'custom.Field Name') */
  phField: string

  /** Data synchronization direction */
  direction: SalesforceDirection

  /** Salesforce field data type */
  sfType: SalesforceFieldType

  /** Planhat field data type */
  phType: PlanhatFieldType

  /** Field mapping category */
  type: FieldMappingType

  /** Whether field is send-only (no read operations) */
  onlySend: boolean

  /** Default value when field is empty */
  default: string

  /** Reference field name for lookup fields */
  reference: string | null

  /** Available picklist values for selection fields */
  sfListValues: string[]
}

/**
 * Raw field mapping structure from API (before processing)
 * May contain partial or inconsistent data that needs validation
 */
export interface RawSalesforceFieldMapping {
  sfField?: string
  phField?: string
  direction?: string
  sfType?: string
  phType?: string
  type?: string
  onlySend?: boolean
  default?: string
  reference?: string | null
  sfListValues?: string[]
}

/* ========================================================================
 * FILTER AND FLAG STRUCTURES
 * ======================================================================== */

/**
 * Customer/contact filter configuration
 */
export interface SalesforceFilterFlag {
  /** Filter values to match */
  values: any[]

  /** Whether to include (true) or exclude (false) matched values */
  useInclude: boolean

  /** Salesforce field name used for filtering */
  name?: string
}

/**
 * Sync filtering options
 */
export interface SalesforceSyncFilter {
  /** Filtering options when fetching from Salesforce */
  fetching: {
    skipNulls: boolean
  }

  /** Filtering options when sending to Planhat */
  sending: {
    skipNulls: boolean
  }
}

/**
 * Dynamic section filter configuration
 */
export interface SalesforceSectionFilter {
  /** Salesforce field used for filtering */
  sfProp: string

  /** Values to filter by */
  values: any[]

  /** Available picklist values */
  sfListValues: any[]

  /** Salesforce field type */
  sfType: string

  /** Processed picklist values */
  picklistValues: any[]
}

/* ========================================================================
 * OBJECT SETTINGS INTERFACES
 * ======================================================================== */

/**
 * Standard object settings structure
 * Used for Account, Contact, Task, Case, Asset, Project, License objects
 */
export interface SalesforceObjectSettings {
  /** Sync direction for this object type */
  direction: SalesforceDirection

  /** Array of field mappings for this object */
  extraFieldsMap: SalesforceFieldMapping[]

  /** Customer identification filter */
  customerFlag?: SalesforceFilterFlag

  /** Contact identification filter */
  contactFlag?: SalesforceFilterFlag

  /** General field-based filter */
  filterField?: SalesforceFilterFlag

  /** Accepted profile types for sync */
  profilesAccepted?: string[]

  /** Whether to sync ownership information */
  syncOwner?: boolean

  /** Whether this object generates events */
  willGenerateEvents?: boolean

  /** Multi-currency support flag */
  multicurrency?: boolean

  /** Accept zero values in numeric fields */
  zeroValuesAccepted?: boolean

  /** Sync filtering configuration */
  filter: SalesforceSyncFilter

  /** Last sync timestamp */
  lastSync?: string
}

/**
 * Note settings (special handling)
 */
export interface SalesforceNoteSettings {
  /** Sync direction for notes */
  direction: SalesforceDirection

  /** Enable new note functionality */
  hasNewNoteEnabled: boolean

  /** Salesforce object used for notes */
  noteObject: string

  /** Whether to sync user information with notes */
  syncUsers: boolean
}

/**
 * Case settings with additional options
 */
export interface SalesforceCaseSettings extends SalesforceObjectSettings {
  /** Process for fetching all cases */
  fetchAllProcess?: {
    wasCompleted: boolean
  }

  /** Allow empty email addresses */
  allowEmptyEmail: boolean

  /** Mode for syncing cases */
  syncCasesMode: string

  /** Allow syncing feed items */
  allowSyncFeedItems: boolean

  /** Last modified date field configuration */
  lastModifiedDateField: {
    FeedItem: string
    FeedComment: string
  }
}

/* ========================================================================
 * DYNAMIC SECTIONS
 * ======================================================================== */

/**
 * Dynamic section field mapping (nested structure)
 */
export interface SalesforceDynamicField {
  /** Unique field identifier */
  _id: string

  /** Salesforce property name */
  sfProp: string

  /** Salesforce default value */
  sfDefaultVal: string | null

  /** Salesforce field type */
  sfType: SalesforceFieldType

  /** Planhat property name */
  phProp: string

  /** Planhat default value */
  phDefaultVal: string | null

  /** Planhat field type */
  phType: PlanhatFieldType

  /** Sync direction */
  direction: SalesforceDirection

  /** Available picklist values */
  sfListValues: string[]
}

/**
 * Dynamic section configuration for custom objects
 */
export interface SalesforceDynamicSection {
  /** Unique section identifier */
  _id: string

  /** Salesforce object API name */
  sfObject: string

  /** Planhat object name */
  phObject: string

  /** Parent reference field in Salesforce */
  sfParentRef: string

  /** Parent object type */
  sfParentObject: string

  /** Planhat source ID reference field */
  phSourceIdRef: string

  /** Sync direction for this section */
  direction: SalesforceDirection

  /** Whether section configuration is valid */
  isValid: boolean

  /** Section filtering configuration */
  sfFilter: SalesforceSectionFilter

  /** Array of field mappings */
  fields: SalesforceDynamicField[]

  /** Sync filtering options */
  filter: SalesforceSyncFilter

  /** Last sync timestamp */
  lastSync: string | null
}

/* ========================================================================
 * MAIN CONFIGURATION INTERFACES
 * ======================================================================== */

/**
 * Authentication and connection information
 */
export interface SalesforceConnection {
  /** OAuth client ID */
  clientId: string

  /** OAuth client secret (masked) */
  clientSecret: string

  /** OAuth redirect URI */
  redirectUri: string

  /** OAuth authorization code (masked) */
  code: string

  /** Salesforce environment (production/sandbox) */
  environment: string

  /** Integration mode */
  mode: string

  /** Auto-refresh token setting */
  autoRefresh: boolean
}

/**
 * Total sync status information
 */
export interface SalesforceTotalSyncStatus {
  /** Whether sync is currently running */
  isBusy: boolean

  /** Last sync timestamp */
  syncDate: string
}

/**
 * System-wide integration settings
 */
export interface SalesforceSystemSettings {
  /** Use system timestamp for records */
  useSystemTimeStamp: boolean
}

/**
 * User settings configuration
 */
export interface SalesforceUserSettings {
  /** User filter configuration */
  filterField: SalesforceFilterFlag

  /** Sync filtering options */
  filter: SalesforceSyncFilter
}

/**
 * OAuth token information
 */
export interface SalesforceOAuth {
  /** Access token (masked) */
  access_token: string

  /** Refresh token (masked) */
  refresh_token: string

  /** Token signature (masked) */
  signature: string

  /** OAuth scope permissions */
  scope: string

  /** ID token (masked) */
  id_token: string

  /** Salesforce instance URL */
  instance_url: string

  /** User identity URL */
  id: string

  /** Token type */
  token_type: string

  /** Token issue timestamp */
  issued_at: string
}

/* ========================================================================
 * RAW CONFIGURATION (API RESPONSE)
 * ======================================================================== */

/**
 * Complete raw Salesforce integration configuration from API
 * This represents the exact structure returned by the Planhat API
 */
export interface SalesforceRawConfiguration {
  /** Integration display name */
  name: string

  /** Whether integration is currently active */
  isActive: boolean

  /** API source identifier */
  apiSource: string

  /** Integration description */
  description: string

  /** Logo/icon path */
  logo: string

  /** Integration categories */
  category: string[]

  /** Connection configuration */
  conn: SalesforceConnection

  /** Overall sync status */
  totalSyncStatus: SalesforceTotalSyncStatus

  /** System settings */
  systemSettings: SalesforceSystemSettings

  /** Account (Company) object settings */
  accountSettings: SalesforceObjectSettings

  /** License fields configuration */
  licenseFields: SalesforceObjectSettings

  /** Contact object settings */
  contactSettings: SalesforceObjectSettings

  /** Task object settings */
  taskSettings: SalesforceObjectSettings

  /** Case object settings */
  caseSettings: SalesforceCaseSettings

  /** Asset object settings */
  assetSettings: SalesforceObjectSettings

  /** Project object settings */
  projectSettings: SalesforceObjectSettings

  /** User settings */
  userSettings: SalesforceUserSettings

  /** Note settings */
  noteSettings: SalesforceNoteSettings

  /** Dynamic sections for custom objects */
  sections: SalesforceDynamicSection[]

  /** Available Salesforce objects */
  sfobjects: any[]

  /** Integration deployment metadata */
  canCreateAuditFields: boolean
  notifyActorsOnError: boolean
  usersSubscribedToErrors: string[]
  addedToAppCenterAt: string

  /** OAuth authentication data */
  oauth: SalesforceOAuth

  /** Sync timestamps */
  lastSync: number
  lastCasesSync: number

  /** Error information */
  lastIssue: string
  lastCasesIssue: string
  devLogNotificationCursor: string

  /** Integration key/identifier */
  key: string
}

/* ========================================================================
 * PROCESSED/STANDARDIZED INTERFACES
 * ======================================================================== */

/**
 * Integration overview summary
 */
export interface SalesforceIntegrationOverview {
  /** Integration name */
  name: string

  /** Description (usually empty for privacy) */
  description: string

  /** Whether integration is active and configured */
  isActive: boolean

  /** Last successful sync timestamp */
  lastSync: string | null

  /** Overall sync status */
  totalSyncStatus: 'success' | 'error' | 'warning' | null

  /** Authentication status */
  authStatus: 'authenticated' | 'not_authenticated'

  /** Connection identifier */
  connectionId?: string

  /** Salesforce instance URL */
  instanceUrl?: string

  /** Environment type */
  environment?: string
}

/**
 * Standardized object mapping
 */
export interface SalesforceObjectMapping {
  /** Salesforce object API name */
  sfObject: string

  /** Planhat object name */
  phObject: string

  /** Sync direction */
  direction: SalesforceDirection | null

  /** Number of mapped fields */
  fieldCount: number

  /** Array of field mappings (filtered for privacy) */
  fields: SalesforceFieldMapping[]

  /** Applied filters description */
  filters: string | null

  /** Whether owner/user sync is enabled */
  syncOwner: boolean

  /** Last sync timestamp for this object */
  lastSync: string | null

  /** Section ID for dynamic sections */
  sectionId?: string

  /** Whether this is a custom object mapping */
  isCustom?: boolean

  /** Whether sync is bidirectional */
  isBidirectional?: boolean

  /** Estimated sync complexity */
  complexity?: 'low' | 'medium' | 'high'
}

/**
 * Complete processed integration data
 */
export interface SalesforceIntegrationData {
  /** Integration overview */
  overview: SalesforceIntegrationOverview

  /** All object mappings */
  objectMappings: SalesforceObjectMapping[]

  /** Searchable fields index */
  searchableFields: SearchableField[]

  /** Original raw configuration */
  rawConfig: SalesforceRawConfiguration

  /** Processing timestamp */
  processedAt: number

  /** Data version for cache invalidation */
  version: string
}

/* ========================================================================
 * SEARCH AND FILTER TYPES
 * ======================================================================== */

/**
 * Searchable field index entry
 */
export interface SearchableField {
  /** Object name containing the field */
  objectName: string

  /** Field name or identifier */
  fieldName: string

  /** Field type for categorization */
  fieldType: 'object' | 'field'

  /** Normalized search term */
  searchTerm: string

  /** Display label */
  displayLabel?: string

  /** Field category */
  category?: string
}

/**
 * Search results structure
 */
export interface SalesforceSearchResult {
  /** Filtered object mappings matching search */
  objectMappings: SalesforceObjectMapping[]

  /** Map of object names to matching fields */
  matchingFields: Map<string, SalesforceFieldMapping[]>

  /** Total number of matches found */
  totalMatches: number

  /** Search term used */
  searchTerm: string

  /** Search execution timestamp */
  searchTime: number

  /** Categories of matches found */
  matchCategories: string[]
}

/**
 * Advanced search filters
 */
export interface SalesforceSearchFilters {
  /** Filter by sync direction */
  direction?: SalesforceDirection[]

  /** Filter by object types */
  objectTypes?: string[]

  /** Filter by field types */
  fieldTypes?: SalesforceFieldType[]

  /** Include/exclude custom objects */
  includeCustomObjects?: boolean

  /** Include/exclude standard objects */
  includeStandardObjects?: boolean

  /** Minimum field count */
  minFieldCount?: number

  /** Maximum field count */
  maxFieldCount?: number
}

/* ========================================================================
 * ERROR HANDLING TYPES
 * ======================================================================== */

/**
 * Integration-specific error codes
 */
export type SalesforceErrorCode =
  | 'CONFIG_NOT_FOUND'
  | 'PROCESSING_ERROR'
  | 'API_ERROR'
  | 'VALIDATION_ERROR'
  | 'AUTHENTICATION_ERROR'
  | 'PERMISSION_ERROR'
  | 'RATE_LIMIT_ERROR'
  | 'NETWORK_ERROR'
  | 'DATA_CORRUPTION_ERROR'
  | 'FIELD_MAPPING_ERROR'
  | 'SYNC_ERROR'

/**
 * Comprehensive error information
 */
export interface SalesforceIntegrationError {
  /** Error classification code */
  code: SalesforceErrorCode

  /** Human-readable error message */
  message: string

  /** Detailed error information */
  details?: any

  /** Error occurrence timestamp */
  timestamp: number

  /** Whether error is retryable */
  retryable: boolean

  /** Affected object or component */
  affectedComponent?: string

  /** Suggested recovery actions */
  recoveryActions?: string[]

  /** Error severity level */
  severity: 'low' | 'medium' | 'high' | 'critical'

  /** Original error stack trace */
  stackTrace?: string
}

/**
 * Error context information
 */
export interface SalesforceErrorContext {
  /** Operation being performed when error occurred */
  operation: string

  /** Tenant or user context */
  tenantSlug?: string

  /** Integration configuration version */
  configVersion?: string

  /** User agent information */
  userAgent?: string

  /** Additional context data */
  metadata?: Record<string, any>
}

/* ========================================================================
 * LOG ANALYTICS TYPES
 * ======================================================================== */

/**
 * Integration log entry
 */
export interface SalesforceLogEntry {
  /** Error or event type */
  error: string

  /** Log message */
  message: string

  /** Affected data model */
  model: string

  /** Entry timestamp */
  timestamp: string

  /** Log level */
  level: 'debug' | 'info' | 'warn' | 'error'

  /** Additional log data */
  data?: any
}

/**
 * Log analytics summary
 */
export interface SalesforceLogAnalytics {
  /** Total number of errors */
  totalErrors: number

  /** Errors grouped by type */
  errorsByType: Record<string, number>

  /** Errors grouped by affected model */
  errorsByModel: Record<string, number>

  /** Recent error entries */
  recentErrors: SalesforceLogEntry[]

  /** Analysis date range */
  dateRange: {
    start: string
    end: string
  }

  /** Error trend information */
  trend: 'increasing' | 'decreasing' | 'stable'

  /** Most common error patterns */
  commonPatterns: string[]
}

/* ========================================================================
 * ZOD VALIDATION SCHEMAS
 * ======================================================================== */

/**
 * Field mapping validation schema
 */
export const SalesforceFieldMappingSchema = z.object({
  sfField: z.string().min(1, 'Salesforce field name is required'),
  phField: z.string().min(1, 'Planhat field name is required'),
  direction: z.enum(['fromSF', 'toSF', 'both', 'none']),
  sfType: z.enum([
    'string', 'double', 'date', 'datetime', 'boolean', 'picklist',
    'multipicklist', 'user', 'reference', 'email', 'url', 'currency', 'percent'
  ]),
  phType: z.enum([
    'string', 'number', 'date', 'datetime', 'boolean',
    'text', 'rich text', 'list', 'team member'
  ]),
  type: z.enum(['attribute', 'custom']),
  onlySend: z.boolean(),
  default: z.string(),
  reference: z.string().nullable(),
  sfListValues: z.array(z.string())
}).strict()

/**
 * Object mapping validation schema
 */
export const SalesforceObjectMappingSchema = z.object({
  sfObject: z.string().min(1),
  phObject: z.string().min(1),
  direction: z.enum(['fromSF', 'toSF', 'both', 'none']).nullable(),
  fieldCount: z.number().min(0).max(10000), // Support up to 10,000 mappings
  fields: z.array(SalesforceFieldMappingSchema).max(10000),
  filters: z.string().nullable(),
  syncOwner: z.boolean(),
  lastSync: z.string().nullable(),
  sectionId: z.string().optional(),
  isCustom: z.boolean().optional(),
  isBidirectional: z.boolean().optional(),
  complexity: z.enum(['low', 'medium', 'high']).optional()
}).strict()

/**
 * Integration overview validation schema
 */
export const SalesforceIntegrationOverviewSchema = z.object({
  name: z.string().min(1),
  description: z.string(),
  isActive: z.boolean(),
  lastSync: z.string().nullable(),
  totalSyncStatus: z.enum(['success', 'error', 'warning']).nullable(),
  authStatus: z.enum(['authenticated', 'not_authenticated']),
  connectionId: z.string().optional(),
  instanceUrl: z.string().optional(),
  environment: z.string().optional()
}).strict()

/**
 * Complete integration data validation schema
 */
export const SalesforceIntegrationDataSchema = z.object({
  overview: SalesforceIntegrationOverviewSchema,
  objectMappings: z.array(SalesforceObjectMappingSchema),
  searchableFields: z.array(z.object({
    objectName: z.string(),
    fieldName: z.string(),
    fieldType: z.enum(['object', 'field']),
    searchTerm: z.string(),
    displayLabel: z.string().optional(),
    category: z.string().optional()
  })),
  rawConfig: z.any(), // Raw config can be flexible for backward compatibility
  processedAt: z.number(),
  version: z.string()
}).strict()

/**
 * Error validation schema
 */
export const SalesforceIntegrationErrorSchema = z.object({
  code: z.enum([
    'CONFIG_NOT_FOUND', 'PROCESSING_ERROR', 'API_ERROR', 'VALIDATION_ERROR',
    'AUTHENTICATION_ERROR', 'PERMISSION_ERROR', 'RATE_LIMIT_ERROR',
    'NETWORK_ERROR', 'DATA_CORRUPTION_ERROR', 'FIELD_MAPPING_ERROR', 'SYNC_ERROR'
  ]),
  message: z.string().min(1),
  details: z.any().optional(),
  timestamp: z.number(),
  retryable: z.boolean(),
  affectedComponent: z.string().optional(),
  recoveryActions: z.array(z.string()).optional(),
  severity: z.enum(['low', 'medium', 'high', 'critical']),
  stackTrace: z.string().optional()
}).strict()

/* ========================================================================
 * TYPE GUARDS AND UTILITIES
 * ======================================================================== */

/**
 * Type guard for field mapping
 */
export function isSalesforceFieldMapping(obj: any): obj is SalesforceFieldMapping {
  try {
    SalesforceFieldMappingSchema.parse(obj)
    return true
  } catch {
    return false
  }
}

/**
 * Type guard for integration data
 */
export function isSalesforceIntegrationData(obj: any): obj is SalesforceIntegrationData {
  try {
    SalesforceIntegrationDataSchema.parse(obj)
    return true
  } catch {
    return false
  }
}

/**
 * Type guard for integration error
 */
export function isSalesforceIntegrationError(obj: any): obj is SalesforceIntegrationError {
  try {
    SalesforceIntegrationErrorSchema.parse(obj)
    return true
  } catch {
    return false
  }
}

/* ========================================================================
 * UTILITY TYPES
 * ======================================================================== */

/**
 * Configuration validation result
 */
export type SalesforceValidationResult = {
  isValid: boolean
  errors: string[]
  warnings: string[]
  processedData?: SalesforceIntegrationData
}

/**
 * Processing options
 */
export interface SalesforceProcessingOptions {
  /** Filter out user-related fields for privacy */
  filterUserFields?: boolean

  /** Maximum number of fields to process */
  maxFields?: number

  /** Include detailed field metadata */
  includeFieldMetadata?: boolean

  /** Validate data during processing */
  validateData?: boolean

  /** Processing timeout in milliseconds */
  timeoutMs?: number
}

/**
 * Export utility types for external consumption
 */
export type {
  // Main interfaces
  SalesforceRawConfiguration as RawConfig,
  SalesforceIntegrationData as IntegrationData,
  SalesforceObjectMapping as ObjectMapping,
  SalesforceFieldMapping as FieldMapping,

  // Search and filter - Note: SearchResult conflicts with API types, use SalesforceSearchResult directly
  SalesforceSearchFilters as SearchFilters,

  // Error handling
  SalesforceIntegrationError as IntegrationError,
  SalesforceErrorCode as ErrorCode
}