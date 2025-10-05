/**
 * Centralized API Endpoints Configuration
 *
 * This file defines all Planhat API endpoints with their schemas, parameters,
 * and pagination settings for type-safe API interactions.
 */

import { z } from 'zod'

import {
  // Issue schemas
  issueSchema,
  issueFiltersSchema,
  createIssueRequestSchema,
  updateIssueRequestSchema,

  // Company schemas
  companySchema,
  companyFiltersSchema,
  createCompanyRequestSchema,
  updateCompanyRequestSchema,

  // Workflow schemas
  workflowSchema,
  workflowFiltersSchema,
  createWorkflowRequestSchema,
  updateWorkflowRequestSchema,

  // Common schemas
  paginationParamsSchema,
  paginatedResponseSchema,
  apiResponseSchema,

  // User schemas (fallback if not found)
  userResponseSchema
} from '../schemas'

// Define tenant schema if not available
const tenantSchema = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
  domain: z.string().optional(),
  status: z.string().optional()
})

// Use available schemas or create fallbacks
const tenantListResponseSchema = tenantSchema
const userProfileSchema = userResponseSchema

// ==================================================
// Common Parameter Schemas
// ==================================================

const limitParamSchema = z.number().int().min(1).max(2000).default(50)
const offsetParamSchema = z.number().int().min(0).default(0)
const sortParamSchema = z.string().optional()
const sortOrderParamSchema = z.enum(['asc', 'desc']).optional()
const tenantSlugParamSchema = z.string().min(1)

// ==================================================
// SPECIAL DATA ENDPOINT - PLANHAT MODELS ONLY
// ==================================================

/**
 * CRITICAL: This endpoint can ONLY be used with specific Planhat models/objects.
 * DO NOT attempt to use this endpoint with any other data types or models.
 *
 * APPROVED PLANHAT MODELS ONLY:
 * Asset, Campaign, Churn, Company, Conversation, EndUser, Invoice, Issue,
 * License, Nps, Objective, Opportunity, Project, Sale, Sprint, Task,
 * TimeEntry, User, Workspace, Workflow
 *
 * This is a specialized endpoint for efficient data retrieval with field selection
 * and filtering capabilities. Misuse of this endpoint may cause system instability.
 */
const APPROVED_PLANHAT_MODELS = [
  'Asset',
  'Campaign',
  'Churn',
  'Company',
  'Conversation',
  'EndUser',
  'Invoice',
  'Issue',
  'License',
  'Nps',
  'Objective',
  'Opportunity',
  'Project',
  'Sale',
  'Sprint',
  'Task',
  'TimeEntry',
  'User',
  'Workspace',
  'Workflow'
] as const

type ApprovedPlanhatModel = typeof APPROVED_PLANHAT_MODELS[number]

const planhatModelSchema = z.enum(APPROVED_PLANHAT_MODELS).describe(
  'RESTRICTED: Only approved Planhat models are allowed. See APPROVED_PLANHAT_MODELS constant.'
)

const fidParamSchema = z.string().optional().describe(
  'Filter ID - applies saved filter criteria for the specified model/object'
)

const selectParamSchema = z.string().optional().describe(
  'Comma-separated field names to select specific fields (e.g., "Name,Id" or "Name")'
)

// ==================================================
// Endpoint Definitions
// ==================================================

export const planhatEndpoints = [
  // ===== ISSUES ENDPOINTS =====
  {
    method: 'get',
    path: '/issues',
    alias: 'getIssues',
    description: 'Get list of issues with filtering (returns direct array)',
    parameters: [
      {
        name: 'limit',
        type: 'Query',
        schema: limitParamSchema.default(2000),
        description: 'Number of records per page (max 2000)'
      },
      {
        name: 'offset',
        type: 'Query',
        schema: offsetParamSchema,
        description: 'Number of records to skip'
      },
      {
        name: 'sort',
        type: 'Query',
        schema: sortParamSchema.default('-createdAt'),
        description: 'Sort field (prefix with - for descending)'
      },
      {
        name: 'sortOrder',
        type: 'Query',
        schema: sortOrderParamSchema,
        description: 'Sort order (asc or desc)'
      },
      {
        name: 'filters',
        type: 'Query',
        schema: z.record(z.any()).optional(),
        description: 'Additional filters to apply'
      },
      {
        name: 'tenantSlug',
        type: 'Query',
        schema: tenantSlugParamSchema,
        description: 'Tenant slug for multi-tenant access'
      }
    ],
    response: z.array(issueSchema),
    status: 200
  },

  {
    method: 'get',
    path: '/issues/:id',
    alias: 'getIssueById',
    description: 'Get a single issue by ID',
    parameters: [
      {
        name: 'id',
        type: 'Path',
        schema: z.string().min(1),
        description: 'Issue ID'
      }
    ],
    response: apiResponseSchema(issueSchema),
    status: 200
  },

  {
    method: 'post',
    path: '/issues',
    alias: 'createIssue',
    description: 'Create a new issue',
    parameters: [
      {
        name: 'body',
        type: 'Body',
        schema: createIssueRequestSchema,
        description: 'Issue data'
      }
    ],
    response: apiResponseSchema(issueSchema),
    status: 201
  },

  // ===== COMPANIES ENDPOINTS =====
  {
    method: 'get',
    path: '/companies',
    alias: 'getCompanies',
    description: 'Get paginated list of companies with filtering',
    parameters: [
      {
        name: 'limit',
        type: 'Query',
        schema: limitParamSchema.default(2000),
        description: 'Number of records per page (max 2000)'
      },
      {
        name: 'offset',
        type: 'Query',
        schema: offsetParamSchema,
        description: 'Number of records to skip'
      },
      {
        name: 'sort',
        type: 'Query',
        schema: sortParamSchema.default('name'),
        description: 'Sort field (prefix with - for descending)'
      },
      {
        name: 'sortOrder',
        type: 'Query',
        schema: sortOrderParamSchema,
        description: 'Sort order (asc or desc)'
      },
      {
        name: 'filters',
        type: 'Query',
        schema: z.record(z.any()).optional(),
        description: 'Additional filters to apply'
      },
      {
        name: 'tenantSlug',
        type: 'Query',
        schema: tenantSlugParamSchema,
        description: 'Tenant slug for multi-tenant access'
      }
    ],
    response: paginatedResponseSchema(companySchema),
    status: 200
  },

  {
    method: 'get',
    path: '/companies/:id',
    alias: 'getCompanyById',
    description: 'Get a single company by ID',
    parameters: [
      {
        name: 'id',
        type: 'Path',
        schema: z.string().min(1),
        description: 'Company ID'
      }
    ],
    response: apiResponseSchema(companySchema),
    status: 200
  },

  {
    method: 'post',
    path: '/companies',
    alias: 'createCompany',
    description: 'Create a new company',
    parameters: [
      {
        name: 'body',
        type: 'Body',
        schema: createCompanyRequestSchema,
        description: 'Company data'
      }
    ],
    response: apiResponseSchema(companySchema),
    status: 201
  },

  // ===== WORKFLOWS ENDPOINTS =====
  {
    method: 'get',
    path: '/workflows',
    alias: 'getWorkflows',
    description: 'Get paginated list of workflows with filtering',
    parameters: [
      {
        name: 'limit',
        type: 'Query',
        schema: limitParamSchema.default(2000),
        description: 'Number of records per page (max 2000)'
      },
      {
        name: 'offset',
        type: 'Query',
        schema: offsetParamSchema,
        description: 'Number of records to skip'
      },
      {
        name: 'sort',
        type: 'Query',
        schema: sortParamSchema.default('-updatedAt'),
        description: 'Sort field (prefix with - for descending)'
      },
      {
        name: 'sortOrder',
        type: 'Query',
        schema: sortOrderParamSchema,
        description: 'Sort order (asc or desc)'
      },
      {
        name: 'filters',
        type: 'Query',
        schema: z.record(z.any()).optional(),
        description: 'Additional filters to apply'
      },
      {
        name: 'tenantSlug',
        type: 'Query',
        schema: tenantSlugParamSchema,
        description: 'Tenant slug for multi-tenant access'
      }
    ],
    response: paginatedResponseSchema(workflowSchema),
    status: 200
  },

  {
    method: 'get',
    path: '/workflows/:id',
    alias: 'getWorkflowById',
    description: 'Get a single workflow by ID',
    parameters: [
      {
        name: 'id',
        type: 'Path',
        schema: z.string().min(1),
        description: 'Workflow ID'
      }
    ],
    response: apiResponseSchema(workflowSchema),
    status: 200
  },

  {
    method: 'post',
    path: '/workflows',
    alias: 'createWorkflow',
    description: 'Create a new workflow',
    parameters: [
      {
        name: 'body',
        type: 'Body',
        schema: createWorkflowRequestSchema,
        description: 'Workflow data'
      }
    ],
    response: apiResponseSchema(workflowSchema),
    status: 201
  },

  // ===== WORKFLOW TEMPLATES ENDPOINTS =====
  {
    method: 'get',
    path: '/workflowtemplates',
    alias: 'getWorkflowTemplates',
    description: 'Get list of workflow templates with filtering support',
    parameters: [
      {
        name: 'limit',
        type: 'Query',
        schema: limitParamSchema.default(2000),
        description: 'Number of records to return (max 2000)'
      },
      {
        name: 'offset',
        type: 'Query',
        schema: offsetParamSchema,
        description: 'Number of records to skip before fetching'
      },
      {
        name: 'sort',
        type: 'Query',
        schema: sortParamSchema.default('-updatedAt'),
        description: 'Sort field (prefix with - for descending order)'
      },
      {
        name: 'filters',
        type: 'Query',
        schema: z.record(z.any()).optional(),
        description: 'Additional filters to apply to the workflow templates list'
      },
      {
        name: 'tenantSlug',
        type: 'Query',
        schema: tenantSlugParamSchema,
        description: 'Tenant slug for multi-tenant access'
      }
    ],
    response: z.array(workflowSchema),
    status: 200
  },

  // ===== WORKFLOW TEMPLATE STEPS ENDPOINTS =====
  {
    method: 'get',
    path: '/workflowtemplatesteps',
    alias: 'getWorkflowTemplateSteps',
    description: 'Get list of workflow template steps with filtering',
    parameters: [
      {
        name: 'limit',
        type: 'Query',
        schema: limitParamSchema.default(2000),
        description: 'Number of records per page (max 2000)'
      },
      {
        name: 'offset',
        type: 'Query',
        schema: offsetParamSchema,
        description: 'Number of records to skip'
      },
      {
        name: 'sort',
        type: 'Query',
        schema: sortParamSchema,
        description: 'Sort field (prefix with - for descending)'
      },
      {
        name: 'sortOrder',
        type: 'Query',
        schema: sortOrderParamSchema,
        description: 'Sort order (asc or desc)'
      },
      {
        name: 'filters',
        type: 'Query',
        schema: z.record(z.any()).optional(),
        description: 'Additional filters to apply'
      },
      {
        name: 'tenantSlug',
        type: 'Query',
        schema: tenantSlugParamSchema,
        description: 'Tenant slug for multi-tenant access'
      }
    ],
    response: z.array(z.record(z.any())),
    status: 200
  },

  // ===== AUTOMATIONS ENDPOINTS =====
  {
    method: 'get',
    path: '/automations',
    alias: 'getAutomations',
    description: 'Get list of automation configurations with filtering',
    parameters: [
      {
        name: 'limit',
        type: 'Query',
        schema: limitParamSchema.default(2000),
        description: 'Number of records per page (max 2000)'
      },
      {
        name: 'offset',
        type: 'Query',
        schema: offsetParamSchema,
        description: 'Number of records to skip'
      },
      {
        name: 'sort',
        type: 'Query',
        schema: sortParamSchema,
        description: 'Sort field (prefix with - for descending)'
      },
      {
        name: 'sortOrder',
        type: 'Query',
        schema: sortOrderParamSchema,
        description: 'Sort order (asc or desc)'
      },
      {
        name: 'filters',
        type: 'Query',
        schema: z.record(z.any()).optional(),
        description: 'Additional filters to apply'
      },
      {
        name: 'tenantSlug',
        type: 'Query',
        schema: tenantSlugParamSchema,
        description: 'Tenant slug for multi-tenant access'
      }
    ],
    response: z.array(z.record(z.any())),
    status: 200
  },

  // ===== WORKFLOWS WITH STEPS ENDPOINTS =====
  {
    method: 'get',
    path: '/workflows/withsteps',
    alias: 'getWorkflowsWithSteps',
    description: 'Get workflows with their steps included',
    parameters: [
      {
        name: 'limit',
        type: 'Query',
        schema: limitParamSchema.default(2000),
        description: 'Number of records per page (max 2000)'
      },
      {
        name: 'offset',
        type: 'Query',
        schema: offsetParamSchema,
        description: 'Number of records to skip'
      },
      {
        name: 'sort',
        type: 'Query',
        schema: sortParamSchema,
        description: 'Sort field (prefix with - for descending)'
      },
      {
        name: 'sortOrder',
        type: 'Query',
        schema: sortOrderParamSchema,
        description: 'Sort order (asc or desc)'
      },
      {
        name: 'filters',
        type: 'Query',
        schema: z.record(z.any()).optional(),
        description: 'Additional filters to apply'
      },
      {
        name: 'tenantSlug',
        type: 'Query',
        schema: tenantSlugParamSchema,
        description: 'Tenant slug for multi-tenant access'
      }
    ],
    response: z.array(z.record(z.any())),
    status: 200
  },

  // ===== FILTERS ENDPOINTS =====
  {
    method: 'get',
    path: '/filters',
    alias: 'getFilters',
    description: 'Get filter definitions with filtering',
    parameters: [
      {
        name: 'limit',
        type: 'Query',
        schema: limitParamSchema.default(2000),
        description: 'Number of records per page (max 2000)'
      },
      {
        name: 'offset',
        type: 'Query',
        schema: offsetParamSchema,
        description: 'Number of records to skip'
      },
      {
        name: 'sort',
        type: 'Query',
        schema: sortParamSchema,
        description: 'Sort field (prefix with - for descending)'
      },
      {
        name: 'sortOrder',
        type: 'Query',
        schema: sortOrderParamSchema,
        description: 'Sort order (asc or desc)'
      },
      {
        name: 'filters',
        type: 'Query',
        schema: z.record(z.any()).optional(),
        description: 'Additional filters to apply'
      },
      {
        name: 'tenantSlug',
        type: 'Query',
        schema: tenantSlugParamSchema,
        description: 'Tenant slug for multi-tenant access'
      }
    ],
    response: z.array(z.record(z.any())),
    status: 200
  },

  // ===== CUSTOM FIELDS ENDPOINTS =====
  {
    method: 'get',
    path: '/customfields',
    alias: 'getCustomFields',
    description: 'Get custom field definitions with filtering',
    parameters: [
      {
        name: 'limit',
        type: 'Query',
        schema: limitParamSchema.default(2000),
        description: 'Number of records per page (max 2000)'
      },
      {
        name: 'offset',
        type: 'Query',
        schema: offsetParamSchema,
        description: 'Number of records to skip'
      },
      {
        name: 'sort',
        type: 'Query',
        schema: sortParamSchema,
        description: 'Sort field (prefix with - for descending)'
      },
      {
        name: 'sortOrder',
        type: 'Query',
        schema: sortOrderParamSchema,
        description: 'Sort order (asc or desc)'
      },
      {
        name: 'filters',
        type: 'Query',
        schema: z.record(z.any()).optional(),
        description: 'Additional filters to apply'
      },
      {
        name: 'tenantSlug',
        type: 'Query',
        schema: tenantSlugParamSchema,
        description: 'Tenant slug for multi-tenant access'
      }
    ],
    response: z.array(z.record(z.any())),
    status: 200
  },

  // ===== COMMENTS ENDPOINTS =====
  {
    method: 'get',
    path: '/comments',
    alias: 'getComments',
    description: 'Get comments on entities with filtering',
    parameters: [
      {
        name: 'limit',
        type: 'Query',
        schema: limitParamSchema.default(2000),
        description: 'Number of records per page (max 2000)'
      },
      {
        name: 'offset',
        type: 'Query',
        schema: offsetParamSchema,
        description: 'Number of records to skip'
      },
      {
        name: 'sort',
        type: 'Query',
        schema: sortParamSchema,
        description: 'Sort field (prefix with - for descending)'
      },
      {
        name: 'sortOrder',
        type: 'Query',
        schema: sortOrderParamSchema,
        description: 'Sort order (asc or desc)'
      },
      {
        name: 'filters',
        type: 'Query',
        schema: z.record(z.any()).optional(),
        description: 'Additional filters to apply'
      },
      {
        name: 'tenantSlug',
        type: 'Query',
        schema: tenantSlugParamSchema,
        description: 'Tenant slug for multi-tenant access'
      }
    ],
    response: z.array(z.record(z.any())),
    status: 200
  },

  // ===== DEV LOGS ENDPOINTS =====
  {
    method: 'get',
    path: '/devlogs',
    alias: 'getDevLogs',
    description: 'Get development logs with filtering',
    parameters: [
      {
        name: 'limit',
        type: 'Query',
        schema: limitParamSchema.default(2000),
        description: 'Number of records per page (max 2000)'
      },
      {
        name: 'offset',
        type: 'Query',
        schema: offsetParamSchema,
        description: 'Number of records to skip'
      },
      {
        name: 'sort',
        type: 'Query',
        schema: sortParamSchema,
        description: 'Sort field (prefix with - for descending)'
      },
      {
        name: 'sortOrder',
        type: 'Query',
        schema: sortOrderParamSchema,
        description: 'Sort order (asc or desc)'
      },
      {
        name: 'filters',
        type: 'Query',
        schema: z.record(z.any()).optional(),
        description: 'Additional filters to apply'
      },
      {
        name: 'tenantSlug',
        type: 'Query',
        schema: tenantSlugParamSchema,
        description: 'Tenant slug for multi-tenant access'
      }
    ],
    response: z.array(z.record(z.any())),
    status: 200
  },

  // ===== SPECIAL DATA ENDPOINT =====
  /**
   * WARNING: RESTRICTED ENDPOINT - PLANHAT MODELS ONLY
   *
   * This endpoint provides efficient data retrieval with field selection and filtering.
   * It can ONLY be used with approved Planhat models (see APPROVED_PLANHAT_MODELS).
   *
   * Examples:
   * - /data?model=Company&select=Name           → Get only company names and IDs
   * - /data?model=Sale&fid=abc123               → Get sales filtered by saved filter
   * - /data?model=EndUser&select=Name,Email     → Get user names and emails only
   *
   * DO NOT use this endpoint for any other purposes or with unapproved models.
   */
  {
    method: 'get',
    path: '/data',
    alias: 'getPlanhatData',
    description: 'RESTRICTED: Get Planhat model data with field selection and filtering (approved models only)',
    parameters: [
      {
        name: 'model',
        type: 'Query',
        schema: planhatModelSchema,
        description: 'REQUIRED: Planhat model/object name (see APPROVED_PLANHAT_MODELS)'
      },
      {
        name: 'limit',
        type: 'Query',
        schema: limitParamSchema.default(2000),
        description: 'Number of records per page (max 2000)'
      },
      {
        name: 'offset',
        type: 'Query',
        schema: offsetParamSchema,
        description: 'Number of records to skip'
      },
      {
        name: 'sort',
        type: 'Query',
        schema: sortParamSchema,
        description: 'Sort by property (prefix with - for descending)'
      },
      {
        name: 'select',
        type: 'Query',
        schema: selectParamSchema,
        description: 'Comma-separated field names for efficient payload (e.g., "Name,Id")'
      },
      {
        name: 'fid',
        type: 'Query',
        schema: fidParamSchema,
        description: 'Filter ID to apply saved filter criteria for the model'
      },
      {
        name: 'filters',
        type: 'Query',
        schema: z.record(z.any()).optional(),
        description: 'Additional filters to apply'
      },
      {
        name: 'tenantSlug',
        type: 'Query',
        schema: tenantSlugParamSchema,
        description: 'Tenant slug for multi-tenant access'
      }
    ],
    response: z.array(z.record(z.any())),
    status: 200
  },

  // ===== LOGS ENDPOINT =====
  /**
   * WARNING: STRICT PARAMETER ORDERING REQUIRED
   *
   * The /logs endpoint has CRITICAL parameter ordering requirements.
   * Parameters MUST be in this EXACT order or the API will fail:
   * 1. model, 2. operation, 3. actorType, 4. partitionDateFrom, 5. partitionDateTo,
   * 6. offset, 7. tzOffset, 8. tenantSlug
   *
   * Parameter ordering is handled in logz.service.ts - DO NOT change the service implementation
   * without understanding these strict requirements.
   *
   * Examples:
   * - /logs?partitionDateFrom=2025-09-13T05:00:00.000Z&partitionDateTo=2025-09-21T04:59:59.999Z&offset=0&tzOffset=0&tenantSlug=planhat
   * - /logs?model=Company&operation=created,updated&actorType=user&partitionDateFrom=...&tenantSlug=planhat
   */
  {
    method: 'get',
    path: '/logs',
    alias: 'getLogs',
    description: 'Get system logs with strict parameter ordering requirements',
    parameters: [
      {
        name: 'model',
        type: 'Query',
        schema: z.string().optional(),
        description: 'Filter by specific model/object type (single value only)'
      },
      {
        name: 'operation',
        type: 'Query',
        schema: z.string().optional(),
        description: 'Comma-separated operations (created,updated,deleted) - must be lowercase'
      },
      {
        name: 'actorType',
        type: 'Query',
        schema: z.string().optional(),
        description: 'Comma-separated actor types (user,hiddenuser,system) - must be lowercase'
      },
      {
        name: 'partitionDateFrom',
        type: 'Query',
        schema: z.string(),
        description: 'REQUIRED: Start date in ISO-8601 UTC format (e.g., 2025-09-13T05:00:00.000Z)'
      },
      {
        name: 'partitionDateTo',
        type: 'Query',
        schema: z.string(),
        description: 'REQUIRED: End date in ISO-8601 UTC format (e.g., 2025-09-21T04:59:59.999Z)'
      },
      {
        name: 'offset',
        type: 'Query',
        schema: z.number().int().min(0).default(0),
        description: 'REQUIRED: Number of records to skip for pagination'
      },
      {
        name: 'tzOffset',
        type: 'Query',
        schema: z.number().default(0),
        description: 'REQUIRED: Timezone offset from UTC in hours (even if 0)'
      },
      {
        name: 'tenantSlug',
        type: 'Query',
        schema: tenantSlugParamSchema,
        description: 'REQUIRED: Tenant slug for multi-tenant access'
      },
      {
        name: 'entityId',
        type: 'Query',
        schema: z.string().optional(),
        description: 'Filter by specific entity ID'
      },
      {
        name: 'limit',
        type: 'Query',
        schema: limitParamSchema.default(2000),
        description: 'Number of records to return (max 2000)'
      }
    ],
    response: z.array(z.record(z.any())),
    status: 200
  },

  // ===== SETTINGS ENDPOINTS =====
  /**
   * Settings endpoints provide configuration and structural data rather than business records.
   *
   * Key characteristics:
   * - No pagination (no limit/offset parameters)
   * - Return configuration objects or small arrays
   * - Focus on system settings, permissions, and structure
   * - Typically cached and updated infrequently
   */

  // User Roles and Permissions
  {
    method: 'get',
    path: '/roles',
    alias: 'getRoles',
    description: 'Get user roles - groups of permissions assigned to users',
    parameters: [
      {
        name: 'tenantSlug',
        type: 'Query',
        schema: tenantSlugParamSchema,
        description: 'Tenant slug for multi-tenant access'
      }
    ],
    response: z.array(z.record(z.any())),
    status: 200
  },

  {
    method: 'get',
    path: '/rolespermissions',
    alias: 'getRolePermissions',
    description: 'Get role permissions - detailed permissions for each role',
    parameters: [
      {
        name: 'tenantSlug',
        type: 'Query',
        schema: tenantSlugParamSchema,
        description: 'Tenant slug for multi-tenant access'
      }
    ],
    response: z.array(z.record(z.any())),
    status: 200
  },

  {
    method: 'get',
    path: '/teams',
    alias: 'getTeams',
    description: 'Get teams - groups of users',
    parameters: [
      {
        name: 'tenantSlug',
        type: 'Query',
        schema: tenantSlugParamSchema,
        description: 'Tenant slug for multi-tenant access'
      }
    ],
    response: z.array(z.record(z.any())),
    status: 200
  },

  // Workspace Structure Hierarchy
  /**
   * WORKSPACE HIERARCHY: phworkspaces → phSections → pages → pagepointers
   *
   * - phworkspaces: Top-level containers for organizing content
   * - phSections: Organizational units within workspaces
   * - pages: Individual content pages within sections
   * - pagepointers: Cross-reference links connecting pages to sections
   *   (allows pages to appear in multiple sections)
   */
  {
    method: 'get',
    path: '/phworkspaces',
    alias: 'getWorkspaces',
    description: 'Get Planhat workspaces - top level of tree structure',
    parameters: [
      {
        name: 'tenantSlug',
        type: 'Query',
        schema: tenantSlugParamSchema,
        description: 'Tenant slug for multi-tenant access'
      }
    ],
    response: z.array(z.record(z.any())),
    status: 200
  },

  {
    method: 'get',
    path: '/phSections',
    alias: 'getSections',
    description: 'Get Planhat sections - 2nd level, can be part of workspace or free floating',
    parameters: [
      {
        name: 'tenantSlug',
        type: 'Query',
        schema: tenantSlugParamSchema,
        description: 'Tenant slug for multi-tenant access'
      }
    ],
    response: z.array(z.record(z.any())),
    status: 200
  },

  {
    method: 'get',
    path: '/pages',
    alias: 'getPages',
    description: 'Get page definitions - 3rd level, can belong to sections or be free floating',
    parameters: [
      {
        name: 'tenantSlug',
        type: 'Query',
        schema: tenantSlugParamSchema,
        description: 'Tenant slug for multi-tenant access'
      }
    ],
    response: z.array(z.record(z.any())),
    status: 200
  },

  {
    method: 'get',
    path: '/pagepointers',
    alias: 'getPagePointers',
    description: 'Get page pointer data - relation table linking workspaces, sections, and pages',
    parameters: [
      {
        name: 'tenantSlug',
        type: 'Query',
        schema: tenantSlugParamSchema,
        description: 'Tenant slug for multi-tenant access'
      }
    ],
    response: z.array(z.record(z.any())),
    status: 200
  },

  // Integration and Connection Settings
  {
    method: 'get',
    path: '/integrations/salesforce',
    alias: 'getSalesforceIntegration',
    description: 'Get Salesforce integration configuration and settings',
    parameters: [
      {
        name: 'tenantSlug',
        type: 'Query',
        schema: tenantSlugParamSchema,
        description: 'Tenant slug for multi-tenant access'
      }
    ],
    response: z.record(z.any()),
    status: 200
  },

  {
    method: 'get',
    path: '/integrations',
    alias: 'getIntegrations',
    description: 'Get integration configurations',
    parameters: [
      {
        name: 'tenantSlug',
        type: 'Query',
        schema: tenantSlugParamSchema,
        description: 'Tenant slug for multi-tenant access'
      }
    ],
    response: z.array(z.record(z.any())),
    status: 200
  },

  {
    method: 'get',
    path: '/connectionconfig',
    alias: 'getConnectionConfig',
    description: 'Get connection configurations',
    parameters: [
      {
        name: 'tenantSlug',
        type: 'Query',
        schema: tenantSlugParamSchema,
        description: 'Tenant slug for multi-tenant access'
      }
    ],
    response: z.array(z.record(z.any())),
    status: 200
  },

  {
    method: 'get',
    path: '/connectiondata',
    alias: 'getConnectionData',
    description: 'Get connection data',
    parameters: [
      {
        name: 'tenantSlug',
        type: 'Query',
        schema: tenantSlugParamSchema,
        description: 'Tenant slug for multi-tenant access'
      }
    ],
    response: z.array(z.record(z.any())),
    status: 200
  },

  // Dashboard and UI Settings
  {
    method: 'get',
    path: '/dashboards',
    alias: 'getDashboards',
    description: 'Get dashboard configurations',
    parameters: [
      {
        name: 'tenantSlug',
        type: 'Query',
        schema: tenantSlugParamSchema,
        description: 'Tenant slug for multi-tenant access'
      }
    ],
    response: z.array(z.record(z.any())),
    status: 200
  },

  {
    method: 'get',
    path: '/widgets',
    alias: 'getWidgets',
    description: 'Get widget configurations',
    parameters: [
      {
        name: 'tenantSlug',
        type: 'Query',
        schema: tenantSlugParamSchema,
        description: 'Tenant slug for multi-tenant access'
      }
    ],
    response: z.array(z.record(z.any())),
    status: 200
  },

  {
    method: 'get',
    path: '/tableprefs',
    alias: 'getTablePreferences',
    description: 'Get table preferences and configurations',
    parameters: [
      {
        name: 'tenantSlug',
        type: 'Query',
        schema: tenantSlugParamSchema,
        description: 'Tenant slug for multi-tenant access'
      }
    ],
    response: z.array(z.record(z.any())),
    status: 200
  },

  // ===== TENANT ENDPOINTS =====
  {
    method: 'get',
    path: '/myprofile/tenants',
    alias: 'getTenants',
    description: 'Get list of tenants accessible to current user',
    parameters: [
      {
        name: 'tenantSlug',
        type: 'Query',
        schema: tenantSlugParamSchema,
        description: 'Tenant slug for multi-tenant access'
      }
    ],
    response: z.array(tenantListResponseSchema),
    status: 200
  },

  {
    method: 'get',
    path: '/myprofile',
    alias: 'getCurrentUser',
    description: 'Get current user profile information',
    parameters: [
      {
        name: 'tenantSlug',
        type: 'Query',
        schema: tenantSlugParamSchema,
        description: 'Tenant slug for multi-tenant access'
      }
    ],
    response: userProfileSchema,
    status: 200
  }
] as const

// ==================================================
// Endpoint Configuration Metadata
// ==================================================

export type EndpointAlias = typeof planhatEndpoints[number]['alias']

export const endpointConfig = {
  issues: {
    endpoint: 'getIssues',
    defaultLimit: 2000,
    maxLimit: 2000,
    defaultSort: '-createdAt',
    responseType: 'array' as const,
    requiresModelParam: false
  },
  companies: {
    endpoint: 'getCompanies',
    defaultLimit: 2000,
    maxLimit: 2000,
    defaultSort: 'name',
    responseType: 'paginated' as const,
    requiresModelParam: false
  },
  workflows: {
    endpoint: 'getWorkflows',
    defaultLimit: 2000,
    maxLimit: 2000,
    defaultSort: '-updatedAt',
    responseType: 'paginated' as const,
    requiresModelParam: false
  },
  workflowTemplates: {
    endpoint: 'getWorkflowTemplates',
    defaultLimit: 2000,
    maxLimit: 2000,
    defaultSort: '-updatedAt',
    responseType: 'array' as const,
    requiresModelParam: false
  },
  tenants: {
    endpoint: 'getTenants',
    defaultLimit: 2000,
    maxLimit: 2000,
    defaultSort: 'name',
    responseType: 'array' as const,
    requiresModelParam: false
  },
  data: {
    endpoint: 'getPlanhatData',
    defaultLimit: 2000,
    maxLimit: 2000,
    defaultSort: undefined,
    responseType: 'array' as const,
    requiresModelParam: true,
    approvedModels: APPROVED_PLANHAT_MODELS,
    specialParams: ['model', 'fid', 'select']
  },
  logs: {
    endpoint: 'getLogs',
    defaultLimit: 2000,
    maxLimit: 2000,
    defaultSort: undefined,
    responseType: 'array' as const,
    requiresModelParam: false,
    specialParams: ['model', 'operation', 'actorType', 'partitionDateFrom', 'partitionDateTo', 'offset', 'tzOffset', 'entityId'],
    requiresStrictParameterOrder: true
  },
  workflowTemplateSteps: {
    endpoint: 'getWorkflowTemplateSteps',
    defaultLimit: 2000,
    maxLimit: 2000,
    defaultSort: undefined,
    responseType: 'array' as const,
    requiresModelParam: false
  },
  automations: {
    endpoint: 'getAutomations',
    defaultLimit: 2000,
    maxLimit: 2000,
    defaultSort: undefined,
    responseType: 'array' as const,
    requiresModelParam: false
  },
  workflowsWithSteps: {
    endpoint: 'getWorkflowsWithSteps',
    defaultLimit: 2000,
    maxLimit: 2000,
    defaultSort: undefined,
    responseType: 'array' as const,
    requiresModelParam: false
  },
  filters: {
    endpoint: 'getFilters',
    defaultLimit: 2000,
    maxLimit: 2000,
    defaultSort: undefined,
    responseType: 'array' as const,
    requiresModelParam: false
  },
  customFields: {
    endpoint: 'getCustomFields',
    defaultLimit: 2000,
    maxLimit: 2000,
    defaultSort: undefined,
    responseType: 'array' as const,
    requiresModelParam: false
  },
  comments: {
    endpoint: 'getComments',
    defaultLimit: 2000,
    maxLimit: 2000,
    defaultSort: undefined,
    responseType: 'array' as const,
    requiresModelParam: false
  },
  devLogs: {
    endpoint: 'getDevLogs',
    defaultLimit: 2000,
    maxLimit: 2000,
    defaultSort: undefined,
    responseType: 'array' as const,
    requiresModelParam: false
  },
  roles: {
    endpoint: 'getRoles',
    defaultLimit: undefined,
    maxLimit: undefined,
    defaultSort: undefined,
    responseType: 'array' as const,
    requiresModelParam: false,
    isSettingsEndpoint: true
  },
  rolePermissions: {
    endpoint: 'getRolePermissions',
    defaultLimit: undefined,
    maxLimit: undefined,
    defaultSort: undefined,
    responseType: 'array' as const,
    requiresModelParam: false,
    isSettingsEndpoint: true
  },
  teams: {
    endpoint: 'getTeams',
    defaultLimit: undefined,
    maxLimit: undefined,
    defaultSort: undefined,
    responseType: 'array' as const,
    requiresModelParam: false,
    isSettingsEndpoint: true
  },
  workspaces: {
    endpoint: 'getWorkspaces',
    defaultLimit: undefined,
    maxLimit: undefined,
    defaultSort: undefined,
    responseType: 'array' as const,
    requiresModelParam: false,
    isSettingsEndpoint: true
  },
  sections: {
    endpoint: 'getSections',
    defaultLimit: undefined,
    maxLimit: undefined,
    defaultSort: undefined,
    responseType: 'array' as const,
    requiresModelParam: false,
    isSettingsEndpoint: true
  },
  pages: {
    endpoint: 'getPages',
    defaultLimit: undefined,
    maxLimit: undefined,
    defaultSort: undefined,
    responseType: 'array' as const,
    requiresModelParam: false,
    isSettingsEndpoint: true
  },
  pagePointers: {
    endpoint: 'getPagePointers',
    defaultLimit: undefined,
    maxLimit: undefined,
    defaultSort: undefined,
    responseType: 'array' as const,
    requiresModelParam: false,
    isSettingsEndpoint: true
  },
  salesforceIntegration: {
    endpoint: 'getSalesforceIntegration',
    defaultLimit: undefined,
    maxLimit: undefined,
    defaultSort: undefined,
    responseType: 'object' as const,
    requiresModelParam: false,
    isSettingsEndpoint: true
  },
  integrations: {
    endpoint: 'getIntegrations',
    defaultLimit: undefined,
    maxLimit: undefined,
    defaultSort: undefined,
    responseType: 'array' as const,
    requiresModelParam: false,
    isSettingsEndpoint: true
  },
  connectionConfig: {
    endpoint: 'getConnectionConfig',
    defaultLimit: undefined,
    maxLimit: undefined,
    defaultSort: undefined,
    responseType: 'array' as const,
    requiresModelParam: false,
    isSettingsEndpoint: true
  },
  connectionData: {
    endpoint: 'getConnectionData',
    defaultLimit: undefined,
    maxLimit: undefined,
    defaultSort: undefined,
    responseType: 'array' as const,
    requiresModelParam: false,
    isSettingsEndpoint: true
  },
  dashboards: {
    endpoint: 'getDashboards',
    defaultLimit: undefined,
    maxLimit: undefined,
    defaultSort: undefined,
    responseType: 'array' as const,
    requiresModelParam: false,
    isSettingsEndpoint: true
  },
  widgets: {
    endpoint: 'getWidgets',
    defaultLimit: undefined,
    maxLimit: undefined,
    defaultSort: undefined,
    responseType: 'array' as const,
    requiresModelParam: false,
    isSettingsEndpoint: true
  },
  tablePreferences: {
    endpoint: 'getTablePreferences',
    defaultLimit: undefined,
    maxLimit: undefined,
    defaultSort: undefined,
    responseType: 'array' as const,
    requiresModelParam: false,
    isSettingsEndpoint: true
  }
} as const

export type EntityType = keyof typeof endpointConfig
export type EndpointConfig = typeof endpointConfig[EntityType]

// ==================================================
// Special Data Endpoint Exports
// ==================================================

export { APPROVED_PLANHAT_MODELS }
export type { ApprovedPlanhatModel }

// ==================================================
// Type Exports
// ==================================================

export type PlanhatEndpoints = typeof planhatEndpoints
export type PlanhatApi = {
  [K in PlanhatEndpoints[number]['alias']]: any // Will be properly typed by HTTP client
}