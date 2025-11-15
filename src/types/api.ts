/**
 * Core API Types for Planhat Extension
 *
 * Comprehensive type definitions for Planhat API responses,
 * domain models, and request/response interfaces.
 */

// Base Types
export interface BaseEntity {
  _id: string
  createdAt: string
  updatedAt: string
  createdBy?: string
  updatedBy?: string
}

export interface PaginationParams {
  limit?: number
  offset?: number
  sort?: string
  sortOrder?: 'asc' | 'desc'
}

export interface PaginatedResponse<T> {
  data: T[]
  total: number
  limit: number
  offset: number
  hasMore: boolean
}

export interface ApiResponse<T> {
  success: boolean
  data: T
  message?: string
  errors?: ApiError[]
  metadata?: ResponseMetadata
}

export interface ApiError {
  code: string
  message: string
  field?: string
  details?: any
}

export interface ResponseMetadata {
  requestId: string
  timestamp: string
  executionTime: number
  version: string
}

// Filter and Query Types
export interface FilterOperator {
  $eq?: any
  $ne?: any
  $in?: any[]
  $nin?: any[]
  $lt?: any
  $lte?: any
  $gt?: any
  $gte?: any
  $exists?: boolean
  $regex?: string
  $options?: string
}

export interface BaseFilters {
  [key: string]: any | FilterOperator
  createdAt?: FilterOperator
  updatedAt?: FilterOperator
  _id?: string | string[]
}

// User and Permission Types
export interface User extends BaseEntity {
  email: string
  firstName: string
  lastName: string
  name?: string
  avatar?: string
  role: UserRole
  permissions: Permission[]
  isActive: boolean
  lastLogin?: string
  preferences: UserPreferences
  companyId?: string
  isExposedAsSenderOption?: boolean
}

export interface UserRole {
  _id: string
  name: string
  level: number
  permissions: string[]
}

export interface Permission {
  _id: string
  name: string
  resource: string
  action: string
  conditions?: any
}

export interface UserPreferences {
  language: string
  timezone: string
  dateFormat: string
  notifications: NotificationSettings
}

export interface NotificationSettings {
  email: boolean
  browser: boolean
  slack: boolean
  webhooks: boolean
}

// Company Types
export interface Company extends BaseEntity {
  name: string
  slug: string
  domain?: string
  description?: string
  industry?: string
  size?: CompanySize
  status: CompanyStatus
  tier?: string
  mrr?: number
  arr?: number
  health?: HealthScore
  customFields: Record<string, any>
  tags: string[]
  owner?: User
  ownerId?: string
  externalId?: string
  integrations: Integration[]
}

export type CompanySize = 'startup' | 'small' | 'medium' | 'large' | 'enterprise'
export type CompanyStatus = 'prospect' | 'trial' | 'customer' | 'churned' | 'paused'

export interface HealthScore {
  score: number
  trend: 'up' | 'down' | 'stable'
  factors: HealthFactor[]
  lastCalculated: string
}

export interface HealthFactor {
  name: string
  weight: number
  score: number
  trend: 'up' | 'down' | 'stable'
}

export interface Integration {
  _id: string
  type: string
  name: string
  status: 'active' | 'inactive' | 'error'
  config: Record<string, any>
  lastSync?: string
}

// Issue Types
export interface Issue extends BaseEntity {
  title: string
  description: string
  type: IssueType
  priority: IssuePriority
  status: IssueStatus
  severity: IssueSeverity
  category?: string
  tags: string[]
  assignee?: User
  assigneeId?: string
  reporter?: User
  reporterId?: string
  company?: Company
  companyId?: string
  customFields: Record<string, any>
  attachments: Attachment[]
  comments: Comment[]
  resolution?: IssueResolution
  resolvedAt?: string
  dueDate?: string
  estimatedHours?: number
  actualHours?: number
  externalId?: string
  linkedIssues: string[]
}

export type IssueType = 'bug' | 'feature' | 'support' | 'question' | 'task' | 'incident'
export type IssuePriority = 'lowest' | 'low' | 'medium' | 'high' | 'highest' | 'critical'
export type IssueStatus = 'open' | 'in-progress' | 'resolved' | 'closed' | 'cancelled' | 'on-hold'
export type IssueSeverity = 'minor' | 'major' | 'critical' | 'blocker'

export interface IssueResolution {
  type: 'fixed' | 'wont-fix' | 'duplicate' | 'invalid' | 'works-as-designed'
  description?: string
  resolvedBy?: string
}

export interface IssueFilters extends BaseFilters {
  title?: FilterOperator
  type?: IssueType | IssueType[]
  priority?: IssuePriority | IssuePriority[]
  status?: IssueStatus | IssueStatus[]
  severity?: IssueSeverity | IssueSeverity[]
  assigneeId?: string | string[]
  reporterId?: string | string[]
  companyId?: string | string[]
  tags?: string | string[]
  category?: string | string[]
  dueDate?: FilterOperator
  resolvedAt?: FilterOperator
}

// Workflow Types
export interface Workflow extends BaseEntity {
  name: string
  description?: string
  type: WorkflowType
  status: WorkflowStatus
  triggers: WorkflowTrigger[]
  conditions: WorkflowCondition[]
  actions: WorkflowAction[]
  config: WorkflowConfig
  isActive: boolean
  companyId?: string
  executionStats: WorkflowExecutionStats
  version: number
  tags: string[]
}

export type WorkflowType =
  | 'onboarding'
  | 'retention'
  | 'expansion'
  | 'support'
  | 'automation'
  | 'custom'
export type WorkflowStatus = 'draft' | 'active' | 'paused' | 'archived'

export interface WorkflowTrigger {
  _id: string
  type: TriggerType
  config: Record<string, any>
  isActive: boolean
}

export type TriggerType =
  | 'event'
  | 'schedule'
  | 'webhook'
  | 'manual'
  | 'condition'
  | 'property-change'
  | 'milestone'

export interface WorkflowCondition {
  _id: string
  type: ConditionType
  operator: 'and' | 'or'
  rules: ConditionRule[]
}

export type ConditionType = 'filter' | 'segment' | 'custom'

export interface ConditionRule {
  field: string
  operator: string
  value: any
  type: 'string' | 'number' | 'boolean' | 'date' | 'array'
}

export interface WorkflowAction {
  _id: string
  type: ActionType
  name: string
  config: Record<string, any>
  order: number
  isActive: boolean
  delay?: number
}

export type ActionType =
  | 'email'
  | 'task'
  | 'notification'
  | 'webhook'
  | 'property-update'
  | 'tag-add'
  | 'tag-remove'
  | 'integration'

export interface WorkflowConfig {
  maxExecutions?: number
  cooldownPeriod?: number
  retryPolicy: RetryPolicy
  notifications: WorkflowNotifications
}

export interface RetryPolicy {
  maxRetries: number
  retryDelay: number
  backoffMultiplier: number
}

export interface WorkflowNotifications {
  onSuccess: boolean
  onFailure: boolean
  onCompletion: boolean
  recipients: string[]
}

export interface WorkflowExecutionStats {
  totalExecutions: number
  successfulExecutions: number
  failedExecutions: number
  averageExecutionTime: number
  lastExecuted?: string
  lastResult?: 'success' | 'failure' | 'partial'
}

export interface WorkflowExecution extends BaseEntity {
  workflowId: string
  triggerId: string
  companyId?: string
  userId?: string
  status: ExecutionStatus
  startTime: string
  endTime?: string
  duration?: number
  steps: ExecutionStep[]
  error?: ExecutionError
  context: Record<string, any>
}

export type ExecutionStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled'

export interface ExecutionStep {
  actionId: string
  name: string
  status: ExecutionStatus
  startTime: string
  endTime?: string
  duration?: number
  result?: any
  error?: ExecutionError
}

export interface ExecutionError {
  code: string
  message: string
  details?: any
  retryable: boolean
}

export interface WorkflowFilters extends BaseFilters {
  name?: FilterOperator
  type?: WorkflowType | WorkflowType[]
  status?: WorkflowStatus | WorkflowStatus[]
  isActive?: boolean
  companyId?: string | string[]
  tags?: string | string[]
}

// Activity and Event Types
export interface Activity extends BaseEntity {
  type: ActivityType
  entityType: EntityType
  entityId: string
  userId?: string
  companyId?: string
  title: string
  description?: string
  properties: Record<string, any>
  source: ActivitySource
  timestamp: string
  metadata: ActivityMetadata
}

export type ActivityType =
  | 'created'
  | 'updated'
  | 'deleted'
  | 'viewed'
  | 'logged-in'
  | 'feature-used'
  | 'email-sent'
  | 'email-opened'
  | 'email-clicked'
  | 'custom'

export type EntityType =
  | 'company'
  | 'user'
  | 'issue'
  | 'workflow'
  | 'task'
  | 'note'
  | 'custom'
  | 'salesforce-field'
  | 'role'

export interface ActivitySource {
  type: 'web' | 'api' | 'integration' | 'automation' | 'import'
  name?: string
  version?: string
}

export interface ActivityMetadata {
  ip?: string
  userAgent?: string
  location?: string
  sessionId?: string
  requestId?: string
}

// Comment and Attachment Types
export interface Comment extends BaseEntity {
  content: string
  author: User
  authorId: string
  entityType: EntityType
  entityId: string
  isInternal: boolean
  attachments: Attachment[]
  mentions: string[]
}

export interface Attachment extends BaseEntity {
  filename: string
  originalName: string
  mimeType: string
  size: number
  url: string
  thumbnailUrl?: string
  uploadedBy: string
  entityType: EntityType
  entityId: string
}

// Custom Field Types
export interface CustomField {
  _id: string
  name: string
  key: string
  type: CustomFieldType
  description?: string
  isRequired: boolean
  isActive: boolean
  isHidden?: boolean
  entityType: EntityType
  options?: CustomFieldOption[]
  validation?: CustomFieldValidation
  defaultValue?: any
}

export type CustomFieldType =
  | 'text'
  | 'textarea'
  | 'richtext'        // Rich text with formatting
  | 'number'
  | 'rating'          // 1-5 star rating scale
  | 'boolean'
  | 'date'
  | 'datetime'
  | 'day'             // Date without timezone consideration
  | 'select'          // Single select (List in Planhat)
  | 'multiselect'     // Multi-picklist
  | 'teammember'      // Single Planhat team user
  | 'teammembers'     // Multiple Planhat team users
  | 'enduser'         // Single customer contact
  | 'endusers'        // Multiple customer contacts
  | 'url'
  | 'email'
  | 'phone'

export interface CustomFieldOption {
  value: string
  label: string
  isActive: boolean
  order: number
}

export interface CustomFieldValidation {
  minLength?: number
  maxLength?: number
  min?: number
  max?: number
  pattern?: string
  required?: boolean
}

// Specialized interfaces for different field types
export interface RatingFieldConfig {
  minValue: number     // Should be 1 for Planhat ratings
  maxValue: number     // Should be 5 for Planhat ratings
  allowHalfRatings?: boolean
}

export interface UserFieldConfig {
  allowMultiple: boolean
  restrictToActiveUsers?: boolean
  restrictToRoles?: string[]
}

export interface RichTextFieldConfig {
  allowFormatting: boolean
  allowLinks?: boolean
  maxLength?: number
}

export interface DateFieldConfig {
  includeTime: boolean
  timezone?: string
  format?: string
}

// Export and Import Types
export interface ExportRequest {
  entityType: EntityType
  format: ExportFormat
  filters?: Record<string, any>
  fields?: string[]
  filename?: string
  options?: ExportOptions
}

export type ExportFormat = 'csv' | 'json' | 'xlsx'

export interface ExportOptions {
  includeHeaders: boolean
  includeCustomFields: boolean
  includeRelatedData: boolean
  dateFormat?: string
  timezone?: string
}

export interface ExportJob extends BaseEntity {
  status: JobStatus
  progress: number
  entityType: EntityType
  format: ExportFormat
  filters: Record<string, any>
  totalRecords: number
  processedRecords: number
  downloadUrl?: string
  expiresAt?: string
  error?: string
  userId: string
}

export type JobStatus = 'queued' | 'processing' | 'completed' | 'failed' | 'cancelled'

// Search Types
export interface SearchRequest {
  query: string
  entityTypes?: EntityType[]
  filters?: Record<string, any>
  limit?: number
  offset?: number
  highlight?: boolean
}

export interface SearchResult {
  entityType: EntityType
  entityId: string
  title: string
  description?: string
  url: string
  score: number
  highlights?: string[]
  metadata: Record<string, any>
}

export interface SearchResponse {
  results: SearchResult[]
  total: number
  query: string
  facets?: SearchFacet[]
  suggestions?: string[]
}

export interface SearchFacet {
  field: string
  values: SearchFacetValue[]
}

export interface SearchFacetValue {
  value: string
  count: number
  selected: boolean
}

// Authentication and Session Types
export interface AuthSession {
  id: string
  userId: string
  tenantId: string
  token: string
  refreshToken?: string
  expiresAt: string
  createdAt: string
  lastActivity: string
  isActive: boolean
  deviceInfo?: DeviceInfo
}

export interface DeviceInfo {
  type: 'desktop' | 'mobile' | 'tablet'
  os: string
  browser: string
  version: string
  userAgent: string
}

export interface UserInfo {
  id: string
  email: string
  firstName: string
  lastName: string
  displayName?: string
  avatar?: string
  role: string
  permissions: string[]
  preferences: UserPreferences
  isActive: boolean
  lastLogin?: string
  createdAt: string
  updatedAt: string
}

export interface AuthError {
  code: string
  message: string
  details?: any
  retryable: boolean
}

// Tenant and Multi-tenancy Types
export interface TenantContext {
  id: string
  slug: string
  name: string
  domain?: string
  logo?: string
  settings: TenantSettings
  features: TenantFeatures
  limits: TenantLimits
  billing: TenantBilling
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export interface TenantSettings {
  timezone: string
  locale: string
  dateFormat: string
  currency: string
  workingDays: number[]
  workingHours: {
    start: string
    end: string
  }
  customFields: Record<string, any>
}

export type TenantFeatures = string[]

export interface TenantLimits {
  maxUsers: number
  maxProjects: number
  maxStorageGB: number
  maxApiCallsPerMonth: number
  maxExportRecords: number
}

export interface TenantBilling {
  plan: string
  status: 'active' | 'suspended' | 'cancelled'
  billingCycle: 'monthly' | 'yearly'
  nextBillingDate?: string
  usage: TenantUsage
}

export interface TenantUsage {
  users: number
  projects: number
  storageGB: number
  apiCallsThisMonth: number
  lastUpdated: string
}
