/**
 * Logz Explorer Type Definitions
 *
 * Complete type definitions for the Logz Explorer based on the
 * comprehensive architecture documentation.
 */

// Planhat Model Types (45 total)
export type PlanhatModel =
  | 'Asset' | 'Automation' | 'ConnectionData' | 'ConnectionConfig' | 'Comment' | 'Company'
  | 'EndUser' | 'Task' | 'Conversation' | 'Churn' | 'Opportunity' | 'Project' | 'Invoice'
  | 'License' | 'Sale' | 'Nps' | 'Workflow' | 'WorkflowStep' | 'Notification' | 'User'
  | 'Issue' | 'CustomField' | 'UserRole' | 'EmailTemplate' | 'Element' | 'ServiceAccount'
  | 'Page' | 'Team' | 'HealthProfile' | 'WorkflowTemplate' | 'WorkflowTemplateStep'
  | 'Campaign' | 'Workspace' | 'Objective' | 'Snippet' | 'Sprint' | 'PhWorkspace'
  | 'PagePointer' | 'SectionPointer' | 'PhSection' | 'ModelDraft' | 'EmailEngagement'
  | 'UsageMetricDef' | 'NpsCampaign' | 'CodeSnippet' | 'Document' | 'ExternalUser'
  | 'ObjectTemplate' | 'PromotionCampaign' | 'PromotionContent' | 'WorkspaceTemplate'
  | 'Label' | 'TouchType' | 'Call' | 'Currency' | 'SharedDocumentTemplate' | 'SuccessUnit'
  | 'EmailDraft' | 'Email' | 'Filter' | 'ProductRecurring' | 'Profile' | 'TimeEntry'
  | 'ProductOneoff' | 'SalesStage' | 'Reference' | 'ModelDefinition'

// Log Operation Types (5 total) - MUST be lowercase for API
export type LogOperation =
  | 'created'
  | 'updated'
  | 'deleted'
  | 'removed from filter'
  | 'added to filter'

// Actor Types (6 total) - MUST be lowercase for API
export type LogActorType =
  | 'user'
  | 'hiddenuser'        // Special user type for system users
  | 'integration'
  | 'automation'
  | 'system'
  | 'trigger'
  | 'service account'    // Note: space in the value

// Raw Log Data Structure (from Planhat API)
export interface RawLogEntry {
  eventId: string
  timestamp: { value: string } | string   // Can be wrapped in object or direct string
  model: PlanhatModel
  operation: LogOperation
  actorType: LogActorType
  actorId?: string                        // User ID when actorType is 'user'
  companyId?: string                      // Can be comma-separated for Issues: "comp1,comp2,comp3"
  entityId?: string                       // ID of the entity being logged
  context?: string                        // JSON string with additional data
  // Other fields may be present
}

// Parsed Log Structure (for display)
export interface ParsedLogEntry {
  // Core display fields
  id: string                              // Generated: "log_timestamp_hash"
  time: string                            // ISO timestamp
  model: PlanhatModel
  operation: LogOperation
  actorDisplay: string                    // Resolved user name or actor type
  companyDisplay: string                  // Formatted company names
  entityId: string

  // Resolved entity data
  companyIds: string[]                    // Array of company IDs
  companyNames: string[]                  // Array of resolved company names

  // Parsed JSON context
  parsedContext: {
    companyName?: string
    actor?: { name: string }
    [key: string]: any
  } | null

  // Legacy compatibility fields (for backward compatibility)
  objectType: PlanhatModel               // Same as model
  actor: string                          // Raw actorId or actor type
  company: string                        // First company ID or resolved name
  action: LogOperation                   // Same as operation

  // Raw data for debugging
  _raw: RawLogEntry
}

// Entity Resolution Types
export interface UserEntity {
  _id: string
  firstName?: string
  lastName?: string
  name?: string
  email?: string
}

export interface CompanyEntity {
  _id: string
  name: string
}

// API Parameters Interface
export interface LogsApiParams {
  // Optional filters (must be first in parameter order)
  model?: PlanhatModel                    // Object model filter
  operation?: string                      // CSV of operations (MUST be lowercase)
  actorType?: string                      // CSV of actor types (MUST be lowercase)

  // REQUIRED date range (ISO-8601 UTC format) - API will fail without these!
  partitionDateFrom: string               // e.g., '2023-01-01T05:00:00.000Z' - MANDATORY
  partitionDateTo: string                 // e.g., '2023-01-01T04:59:59.999Z' - MANDATORY

  // Pagination
  limit: number                           // Max records per request (typical: 100-2000)
  offset: number                          // Pagination offset

  // Optional parameters
  tzOffset?: number                       // Timezone offset from UTC
  entityId?: string                       // Specific entity ID filter
  companyId?: string                      // Company ID filter
}

// Filter State Interface
export interface LogsFilterState {
  dateRange: {
    startDate: string                     // YYYY-MM-DD format
    endDate: string                       // YYYY-MM-DD format
  }
  models: PlanhatModel[]
  operations: LogOperation[]
  actorTypes: LogActorType[]
  entityId: string
  searchTerm: string
}

// Pagination State Interface
export interface PaginationState {
  currentOffset: number                   // Current pagination offset
  recordsPerPull: 100 | 500 | 1000 | 2000 // User-configurable limit
  totalLoaded: number                     // Total records loaded so far
  hasMore: boolean                        // Whether more records are available
}

// Entity Cache Interface
export interface EntityCache {
  users: Map<string, UserEntity | null>     // Key: `${tenantId}:${userId}`
  companies: Map<string, CompanyEntity | null> // Key: `${tenantId}:${companyId}`
}

// Logz Store Interface
export interface LogzStore {
  // Filter state
  filters: LogsFilterState

  // Pagination state
  pagination: PaginationState

  // Data state
  logs: ParsedLogEntry[]
  totalCount: number
  isLoading: boolean
  error: string | null

  // Entity resolution cache
  entityCache: EntityCache

  // Actions
  updateFilters: (filters: Partial<LogsFilterState>) => void
  updatePagination: (pagination: Partial<PaginationState>) => void
  setLogs: (logs: ParsedLogEntry[]) => void
  appendLogs: (logs: ParsedLogEntry[]) => void
  clearLogs: () => void
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void
  clearFilters: () => void
  applyQuickDateFilter: (daysAgo: QuickDateFilter) => void

  // Entity cache actions
  cacheUser: (tenantId: string, userId: string, user: UserEntity | null) => void
  cacheCompany: (tenantId: string, companyId: string, company: CompanyEntity | null) => void
  getCachedUser: (tenantId: string, userId: string) => UserEntity | null | undefined
  getCachedCompany: (tenantId: string, companyId: string) => CompanyEntity | null | undefined
}

// API Constraints
export const LOGZ_CONSTRAINTS = {
  MAX_DATE_RANGE_DAYS: 7,                 // Maximum date range allowed by Planhat
  MAX_RECORDS_PER_REQUEST: 2000,          // Maximum records per API request
  DEFAULT_RECORDS_PER_PULL: 100,          // Default pagination size
  MIN_RECORDS_PER_PULL: 100              // Minimum pagination size
} as const

// Quick date filter options
export type QuickDateFilter = 1 | 3 | 7  // 1, 3, or 7 days ago

// Error types
export interface LogzError {
  code: string
  message: string
  details?: any
  retryable: boolean
}

// Validation result types
export interface DateRangeValidation {
  isValid: boolean
  error?: string
  adjustedEndDate?: string
}