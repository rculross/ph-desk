/**
 * Comprehensive Zod Validation Schemas for Planhat Extension API
 *
 * This module provides Zod validation schemas for all API requests and responses
 * to ensure data integrity and security across the application.
 */

import { z } from 'zod'

// ==================================================
// Base Schemas and Common Utilities
// ==================================================

const objectIdSchema = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid ObjectId format')
const emailSchema = z.string().email('Invalid email format').max(254, 'Email too long')
const urlSchema = z.string().url('Invalid URL format').max(2048, 'URL too long')
const dateStringSchema = z.string().datetime('Invalid ISO date format')
const slugSchema = z
  .string()
  .regex(/^[a-z0-9-]+$/, 'Invalid slug format')
  .min(1)
  .max(100)

// Sanitization helpers
const sanitizeString = (str: string) => str.trim().replace(/[<>]/g, '')
const sanitizedString = (min = 0, max = 1000) =>
  z
    .string()
    .min(min, `String must be at least ${min} characters`)
    .max(max, `String must be at most ${max} characters`)
    .transform(sanitizeString)

const sanitizedText = (max = 10000) =>
  z.string().max(max, `Text must be at most ${max} characters`).transform(sanitizeString)

// ==================================================
// Enum Schemas
// ==================================================

export const issueTypeSchema = z.enum(['bug', 'feature', 'support', 'question', 'task', 'incident'])
export const issuePrioritySchema = z.enum([
  'lowest',
  'low',
  'medium',
  'high',
  'highest',
  'critical',
  'Deprioritized'
])
export const issueStatusSchema = z.enum([
  'open',
  'in-progress',
  'resolved',
  'closed',
  'cancelled',
  'on-hold'
])
export const issueSeveritySchema = z.enum(['minor', 'major', 'critical', 'blocker'])

export const companySizeSchema = z.enum(['startup', 'small', 'medium', 'large', 'enterprise'])
export const companyStatusSchema = z.enum(['prospect', 'trial', 'customer', 'churned', 'paused'])

export const workflowTypeSchema = z.enum([
  'onboarding',
  'retention',
  'expansion',
  'support',
  'automation',
  'custom'
])
export const workflowStatusSchema = z.enum(['draft', 'active', 'paused', 'archived'])
export const triggerTypeSchema = z.enum([
  'event',
  'schedule',
  'webhook',
  'manual',
  'condition',
  'property-change',
  'milestone'
])
export const actionTypeSchema = z.enum([
  'email',
  'task',
  'notification',
  'webhook',
  'property-update',
  'tag-add',
  'tag-remove',
  'integration'
])

export const exportFormatSchema = z.enum(['csv', 'json', 'xlsx', 'pdf'])
export const entityTypeSchema = z.enum([
  'company',
  'user',
  'issue',
  'workflow',
  'task',
  'note',
  'custom'
])

// ==================================================
// Base Entity Schemas
// ==================================================

export const baseEntitySchema = z.object({
  _id: objectIdSchema,
  createdAt: dateStringSchema,
  updatedAt: dateStringSchema,
  createdBy: objectIdSchema.optional(),
  updatedBy: objectIdSchema.optional()
})

export const paginationParamsSchema = z.object({
  limit: z.number().int().min(1).max(2000).default(2000),
  offset: z.number().int().min(0).default(0),
  sort: sanitizedString(1, 50).optional(),
  sortOrder: z.enum(['asc', 'desc']).default('asc')
})

export const paginatedResponseSchema = <T extends z.ZodTypeAny>(itemSchema: T) =>
  z.object({
    data: z.array(itemSchema),
    total: z.number().int().min(0),
    limit: z.number().int().min(1),
    offset: z.number().int().min(0),
    hasMore: z.boolean()
  })

export const apiErrorSchema = z.object({
  code: sanitizedString(1, 100),
  message: sanitizedString(1, 500),
  field: sanitizedString(1, 100).optional(),
  details: z.any().optional()
})

export const responseMetadataSchema = z.object({
  requestId: sanitizedString(1, 100),
  timestamp: dateStringSchema,
  executionTime: z.number().min(0),
  version: sanitizedString(1, 20)
})

export const apiResponseSchema = <T extends z.ZodTypeAny>(dataSchema: T) =>
  z.object({
    success: z.boolean(),
    data: dataSchema,
    message: sanitizedString(0, 500).optional(),
    errors: z.array(apiErrorSchema).optional(),
    metadata: responseMetadataSchema.optional()
  })

// ==================================================
// User and Authentication Schemas
// ==================================================

export const userPreferencesSchema = z.object({
  language: z.string().min(2).max(10),
  timezone: z.string().min(1).max(50),
  dateFormat: z.string().min(1).max(20),
  notifications: z.object({
    email: z.boolean(),
    browser: z.boolean(),
    slack: z.boolean(),
    webhooks: z.boolean()
  })
})

export const userRoleSchema = z.object({
  _id: objectIdSchema,
  name: sanitizedString(1, 100),
  level: z.number().int().min(0).max(100),
  permissions: z.array(sanitizedString(1, 100))
})

export const userSchema = baseEntitySchema.extend({
  email: emailSchema,
  firstName: sanitizedString(1, 100),
  lastName: sanitizedString(1, 100),
  name: sanitizedString(1, 200).optional(),
  avatar: urlSchema.optional(),
  role: userRoleSchema,
  permissions: z.array(
    z.object({
      _id: objectIdSchema,
      name: sanitizedString(1, 100),
      resource: sanitizedString(1, 50),
      action: sanitizedString(1, 50),
      conditions: z.any().optional()
    })
  ),
  isActive: z.boolean(),
  lastLogin: dateStringSchema.optional(),
  preferences: userPreferencesSchema,
  companyId: objectIdSchema.optional()
})

// Auth schemas
export const loginRequestSchema = z.object({
  email: emailSchema,
  password: z.string().min(6, 'Password must be at least 6 characters').max(128),
  rememberMe: z.boolean().default(false)
})

export const loginResponseSchema = z.object({
  user: userSchema,
  token: z.string().min(1),
  refreshToken: z.string().optional(),
  expiresAt: dateStringSchema,
  permissions: z.array(z.string())
})

export const userResponseSchema = userSchema

// ==================================================
// Company Schemas
// ==================================================

export const healthScoreSchema = z.object({
  score: z.number().min(0).max(100),
  trend: z.enum(['up', 'down', 'stable']),
  factors: z.array(
    z.object({
      name: sanitizedString(1, 100),
      weight: z.number().min(0).max(1),
      score: z.number().min(0).max(100),
      trend: z.enum(['up', 'down', 'stable'])
    })
  ),
  lastCalculated: dateStringSchema
})

export const integrationSchema = z.object({
  _id: objectIdSchema,
  type: sanitizedString(1, 50),
  name: sanitizedString(1, 100),
  status: z.enum(['active', 'inactive', 'error']),
  config: z.record(z.any()),
  lastSync: dateStringSchema.optional()
})

export const companySchema = baseEntitySchema.extend({
  name: sanitizedString(1, 200),
  slug: slugSchema,
  domain: z
    .string()
    .regex(/^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/, 'Invalid domain format')
    .optional(),
  description: sanitizedText(5000).optional(),
  industry: sanitizedString(1, 100).optional(),
  size: companySizeSchema.optional(),
  status: companyStatusSchema,
  tier: sanitizedString(1, 50).optional(),
  mrr: z.number().min(0).max(10000000).optional(),
  arr: z.number().min(0).max(120000000).optional(),
  health: healthScoreSchema.optional(),
  customFields: z.record(z.any()),
  tags: z.array(sanitizedString(1, 50)).max(20),
  owner: userSchema.optional(),
  ownerId: objectIdSchema.optional(),
  externalId: sanitizedString(1, 100).optional(),
  integrations: z.array(integrationSchema)
})

export const createCompanyRequestSchema = z.object({
  name: sanitizedString(1, 200),
  slug: slugSchema.optional(),
  domain: z
    .string()
    .regex(/^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/)
    .optional(),
  description: sanitizedText(5000).optional(),
  industry: sanitizedString(1, 100).optional(),
  size: companySizeSchema.optional(),
  status: companyStatusSchema.default('prospect'),
  tier: sanitizedString(1, 50).optional(),
  ownerId: objectIdSchema.optional(),
  customFields: z.record(z.any()).default({}),
  tags: z.array(sanitizedString(1, 50)).max(20).default([]),
  externalId: sanitizedString(1, 100).optional()
})

export const updateCompanyRequestSchema = createCompanyRequestSchema.partial()

export const companyResponseSchema = companySchema

// ==================================================
// Issue Schemas
// ==================================================

export const issueResolutionSchema = z.object({
  type: z.enum(['fixed', 'wont-fix', 'duplicate', 'invalid', 'works-as-designed']),
  description: sanitizedText(2000).optional(),
  resolvedBy: objectIdSchema.optional()
})

export const commentSchema = baseEntitySchema.extend({
  content: sanitizedText(10000),
  author: userSchema,
  authorId: objectIdSchema,
  entityType: entityTypeSchema,
  entityId: objectIdSchema,
  isInternal: z.boolean(),
  attachments: z.array(
    z.object({
      _id: objectIdSchema,
      filename: sanitizedString(1, 255),
      originalName: sanitizedString(1, 255),
      mimeType: z.string().regex(/^[a-z]+\/[a-z0-9\-\.]+$/i),
      size: z
        .number()
        .int()
        .min(0)
        .max(100 * 1024 * 1024), // 100MB max
      url: urlSchema,
      thumbnailUrl: urlSchema.optional(),
      uploadedBy: objectIdSchema,
      entityType: entityTypeSchema,
      entityId: objectIdSchema
    })
  ),
  mentions: z.array(objectIdSchema)
})

// Simplified company/enduser reference schemas for issue responses
const issueCompanyRefSchema = z.object({
  id: objectIdSchema,
  name: sanitizedString(1, 200)
})

const issueEnduserRefSchema = z.object({
  id: objectIdSchema,
  name: sanitizedString(1, 200)
})

// Updated issue schema to match actual Planhat API response
export const issueSchema = z.object({
  _id: objectIdSchema,
  title: sanitizedString(1, 500), // Made more flexible
  description: sanitizedText(100000).optional(), // Optional and more flexible

  // Core Planhat fields based on API documentation
  companyIds: z.array(objectIdSchema).optional(),
  companies: z.array(issueCompanyRefSchema).optional(),
  enduserIds: z.array(objectIdSchema).optional(),
  endusers: z.array(issueEnduserRefSchema).optional(),
  conversationIds: z.array(objectIdSchema).optional(),

  // External system integration fields
  sourceId: z.string().optional(),
  source: z.string().optional(),
  sourceUrl: z.string().optional(),

  // Status and priority (made more flexible)
  priority: z.string().optional(), // Changed from enum to string for flexibility
  status: z.string().optional(),   // Changed from enum to string for flexibility
  archived: z.boolean().optional(),

  // Financial metrics (autogenerated by Planhat)
  mrrCombined: z.number().optional(),
  arrCombined: z.number().optional(),

  // Metadata
  createdAt: dateStringSchema.optional(),
  updatedAt: dateStringSchema.optional(),
  __v: z.number().optional(), // Mongoose version field

  // User management
  followers: z.array(objectIdSchema).optional(),

  // Flexible custom data
  custom: z.record(z.any()).optional(),

  // Legacy fields for backward compatibility
  type: issueTypeSchema.optional(),
  severity: issueSeveritySchema.optional(),
  category: sanitizedString(1, 100).optional(),
  tags: z.array(sanitizedString(1, 50)).optional(),
  assigneeId: objectIdSchema.optional(),
  reporterId: objectIdSchema.optional(),
  companyId: objectIdSchema.optional(), // For single company reference
  customFields: z.record(z.any()).optional(),
  resolvedAt: dateStringSchema.optional(),
  dueDate: dateStringSchema.optional(),
  externalId: sanitizedString(1, 100).optional()

  // Allow any additional fields that Planhat might return
}).passthrough()

export const createIssueRequestSchema = z.object({
  title: sanitizedString(1, 200),
  description: sanitizedText(50000),
  type: issueTypeSchema,
  priority: issuePrioritySchema,
  severity: issueSeveritySchema.default('minor'),
  companyId: objectIdSchema.optional(),
  assigneeId: objectIdSchema.optional(),
  dueDate: dateStringSchema.optional(),
  tags: z.array(sanitizedString(1, 50)).max(10).default([]),
  customFields: z.record(z.any()).default({}),
  attachments: z.array(objectIdSchema).max(10).default([])
})

export const updateIssueRequestSchema = z.object({
  title: sanitizedString(1, 200).optional(),
  description: sanitizedText(50000).optional(),
  type: issueTypeSchema.optional(),
  priority: issuePrioritySchema.optional(),
  status: issueStatusSchema.optional(),
  severity: issueSeveritySchema.optional(),
  assigneeId: objectIdSchema.optional(),
  dueDate: dateStringSchema.optional(),
  tags: z.array(sanitizedString(1, 50)).max(10).optional(),
  customFields: z.record(z.any()).optional(),
  resolution: issueResolutionSchema.optional()
})

export const issueResponseSchema = issueSchema

// ==================================================
// Workflow Schemas
// ==================================================

export const workflowTriggerSchema = z.object({
  _id: objectIdSchema,
  type: triggerTypeSchema,
  config: z.record(z.any()),
  isActive: z.boolean()
})

export const workflowConditionSchema = z.object({
  _id: objectIdSchema,
  type: z.enum(['filter', 'segment', 'custom']),
  operator: z.enum(['and', 'or']),
  rules: z.array(
    z.object({
      field: sanitizedString(1, 100),
      operator: sanitizedString(1, 20),
      value: z.any(),
      type: z.enum(['string', 'number', 'boolean', 'date', 'array'])
    })
  )
})

export const workflowActionSchema = z.object({
  _id: objectIdSchema,
  type: actionTypeSchema,
  name: sanitizedString(1, 100),
  config: z.record(z.any()),
  order: z.number().int().min(0),
  isActive: z.boolean(),
  delay: z.number().int().min(0).optional()
})

export const workflowConfigSchema = z.object({
  maxExecutions: z.number().int().min(0).optional(),
  cooldownPeriod: z.number().int().min(0).optional(),
  retryPolicy: z.object({
    maxRetries: z.number().int().min(0).max(10),
    retryDelay: z.number().int().min(0),
    backoffMultiplier: z.number().min(1).max(10)
  }),
  notifications: z.object({
    onSuccess: z.boolean(),
    onFailure: z.boolean(),
    onCompletion: z.boolean(),
    recipients: z.array(emailSchema)
  })
})

export const workflowSchema = baseEntitySchema.extend({
  name: sanitizedString(1, 200),
  description: sanitizedText(2000).optional(),
  type: workflowTypeSchema,
  status: workflowStatusSchema,
  triggers: z.array(workflowTriggerSchema),
  conditions: z.array(workflowConditionSchema),
  actions: z.array(workflowActionSchema),
  config: workflowConfigSchema,
  isActive: z.boolean(),
  companyId: objectIdSchema.optional(),
  executionStats: z.object({
    totalExecutions: z.number().int().min(0),
    successfulExecutions: z.number().int().min(0),
    failedExecutions: z.number().int().min(0),
    averageExecutionTime: z.number().min(0),
    lastExecuted: dateStringSchema.optional(),
    lastResult: z.enum(['success', 'failure', 'partial']).optional()
  }),
  version: z.number().int().min(1),
  tags: z.array(sanitizedString(1, 50)).max(10)
})

export const createWorkflowRequestSchema = z.object({
  name: sanitizedString(1, 200),
  description: sanitizedText(2000).optional(),
  type: workflowTypeSchema,
  status: workflowStatusSchema.default('draft'),
  triggers: z.array(workflowTriggerSchema).min(1),
  conditions: z.array(workflowConditionSchema).default([]),
  actions: z.array(workflowActionSchema).min(1),
  config: workflowConfigSchema,
  isActive: z.boolean().default(false),
  companyId: objectIdSchema.optional(),
  tags: z.array(sanitizedString(1, 50)).max(10).default([])
})

export const updateWorkflowRequestSchema = createWorkflowRequestSchema.partial()

export const workflowResponseSchema = workflowSchema

// ==================================================
// Export Schemas
// ==================================================

export const exportRequestSchema = z.object({
  entityType: entityTypeSchema,
  format: exportFormatSchema,
  filters: z.record(z.any()).optional(),
  fields: z.array(sanitizedString(1, 100)).optional(),
  filename: sanitizedString(1, 255).optional(),
  options: z
    .object({
      includeHeaders: z.boolean().default(true),
      includeCustomFields: z.boolean().default(true),
      includeRelatedData: z.boolean().default(false),
      dateFormat: z.string().optional(),
      timezone: z.string().optional()
    })
    .optional()
})

export const exportResponseSchema = z.object({
  jobId: objectIdSchema,
  status: z.enum(['queued', 'processing', 'completed', 'failed', 'cancelled']),
  downloadUrl: urlSchema.optional(),
  expiresAt: dateStringSchema.optional(),
  estimatedCompletion: dateStringSchema.optional()
})

// ==================================================
// Filter Schemas
// ==================================================

export const filterOperatorSchema = z.object({
  $eq: z.any().optional(),
  $ne: z.any().optional(),
  $in: z.array(z.any()).optional(),
  $nin: z.array(z.any()).optional(),
  $lt: z.any().optional(),
  $lte: z.any().optional(),
  $gt: z.any().optional(),
  $gte: z.any().optional(),
  $exists: z.boolean().optional(),
  $regex: z.string().optional(),
  $options: z.string().optional()
})

export const issueFiltersSchema = z.object({
  title: filterOperatorSchema.optional(),
  type: z.union([issueTypeSchema, z.array(issueTypeSchema)]).optional(),
  priority: z.union([issuePrioritySchema, z.array(issuePrioritySchema)]).optional(),
  status: z.union([issueStatusSchema, z.array(issueStatusSchema)]).optional(),
  severity: z.union([issueSeveritySchema, z.array(issueSeveritySchema)]).optional(),
  assigneeId: z.union([objectIdSchema, z.array(objectIdSchema)]).optional(),
  reporterId: z.union([objectIdSchema, z.array(objectIdSchema)]).optional(),
  companyId: z.union([objectIdSchema, z.array(objectIdSchema)]).optional(),
  tags: z.union([z.string(), z.array(z.string())]).optional(),
  category: z.union([z.string(), z.array(z.string())]).optional(),
  dueDate: filterOperatorSchema.optional(),
  resolvedAt: filterOperatorSchema.optional(),
  createdAt: filterOperatorSchema.optional(),
  updatedAt: filterOperatorSchema.optional(),
  _id: z.union([objectIdSchema, z.array(objectIdSchema)]).optional()
}).catchall(filterOperatorSchema)

export const companyFiltersSchema = z.object({
  name: filterOperatorSchema.optional(),
  slug: z.string().optional(),
  domain: z.string().optional(),
  industry: z.union([z.string(), z.array(z.string())]).optional(),
  size: z.union([companySizeSchema, z.array(companySizeSchema)]).optional(),
  status: z.union([companyStatusSchema, z.array(companyStatusSchema)]).optional(),
  tier: z.union([z.string(), z.array(z.string())]).optional(),
  ownerId: z.union([objectIdSchema, z.array(objectIdSchema)]).optional(),
  tags: z.union([z.string(), z.array(z.string())]).optional(),
  healthScore: z
    .object({
      min: z.number().min(0).max(100).optional(),
      max: z.number().min(0).max(100).optional()
    })
    .optional(),
  mrr: z
    .object({
      min: z.number().min(0).optional(),
      max: z.number().min(0).optional()
    })
    .optional(),
  arr: z
    .object({
      min: z.number().min(0).optional(),
      max: z.number().min(0).optional()
    })
    .optional(),
  hasIntegration: z.string().optional(),
  lastActivityDate: z
    .object({
      $gte: dateStringSchema.optional(),
      $lte: dateStringSchema.optional()
    })
    .optional(),
  createdAt: filterOperatorSchema.optional(),
  updatedAt: filterOperatorSchema.optional(),
  _id: z.union([objectIdSchema, z.array(objectIdSchema)]).optional()
}).catchall(filterOperatorSchema)

export const workflowFiltersSchema = z.object({
  name: filterOperatorSchema.optional(),
  type: z.union([workflowTypeSchema, z.array(workflowTypeSchema)]).optional(),
  status: z.union([workflowStatusSchema, z.array(workflowStatusSchema)]).optional(),
  isActive: z.boolean().optional(),
  companyId: z.union([objectIdSchema, z.array(objectIdSchema)]).optional(),
  tags: z.union([z.string(), z.array(z.string())]).optional(),
  createdAt: filterOperatorSchema.optional(),
  updatedAt: filterOperatorSchema.optional(),
  _id: z.union([objectIdSchema, z.array(objectIdSchema)]).optional()
}).catchall(filterOperatorSchema)

// ==================================================
// Common Response Schemas
// ==================================================

export const errorResponseSchema = z.object({
  success: z.literal(false),
  error: apiErrorSchema,
  message: sanitizedString(1, 500),
  timestamp: dateStringSchema,
  requestId: sanitizedString(1, 100).optional()
})

// ==================================================
// Type Exports for TypeScript Integration
// ==================================================

export type CreateIssueRequest = z.infer<typeof createIssueRequestSchema>
export type UpdateIssueRequest = z.infer<typeof updateIssueRequestSchema>
export type IssueResponse = z.infer<typeof issueResponseSchema>
export type IssueFilters = z.infer<typeof issueFiltersSchema>

export type CreateCompanyRequest = z.infer<typeof createCompanyRequestSchema>
export type UpdateCompanyRequest = z.infer<typeof updateCompanyRequestSchema>
export type CompanyResponse = z.infer<typeof companyResponseSchema>
export type CompanyFilters = z.infer<typeof companyFiltersSchema>

export type CreateWorkflowRequest = z.infer<typeof createWorkflowRequestSchema>
export type UpdateWorkflowRequest = z.infer<typeof updateWorkflowRequestSchema>
export type WorkflowResponse = z.infer<typeof workflowResponseSchema>
export type WorkflowFilters = z.infer<typeof workflowFiltersSchema>

export type ExportRequest = z.infer<typeof exportRequestSchema>
export type ExportResponse = z.infer<typeof exportResponseSchema>

export type LoginRequest = z.infer<typeof loginRequestSchema>
export type LoginResponse = z.infer<typeof loginResponseSchema>
export type UserResponse = z.infer<typeof userResponseSchema>

export type PaginationParams = z.infer<typeof paginationParamsSchema>
export type ErrorResponse = z.infer<typeof errorResponseSchema>

// Export utility functions
export { sanitizeString, sanitizedString, sanitizedText }
