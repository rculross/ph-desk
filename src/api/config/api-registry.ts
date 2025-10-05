/**
 * API Endpoint Registry for HTTP Client
 *
 * Maps all Planhat API endpoints to a simple structure compatible
 * with the HTTP client. This maintains all endpoint information
 * in a clean, type-safe format.
 */

import { z } from 'zod'

import {
  // Issue schemas
  issueSchema,
  createIssueRequestSchema,
  updateIssueRequestSchema,

  // Company schemas
  companySchema,
  createCompanyRequestSchema,
  updateCompanyRequestSchema,

  // Workflow schemas
  workflowSchema,
  createWorkflowRequestSchema,
  updateWorkflowRequestSchema,

  // Common schemas
  paginatedResponseSchema,
  apiResponseSchema,
  userResponseSchema
} from '../schemas'

// ==================================================
// Common Parameter Schemas (preserved from endpoints.ts)
// ==================================================

const limitParamSchema = z.number().int().min(1).max(2000).default(50)
const offsetParamSchema = z.number().int().min(0).default(0)
const sortParamSchema = z.string().optional()
const sortOrderParamSchema = z.enum(['asc', 'desc']).optional()
const tenantSlugParamSchema = z.string().min(1)

// Define tenant schema (from endpoints.ts)
const tenantSchema = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
  domain: z.string().optional(),
  status: z.string().optional()
})

// ==================================================
// HTTP Method Types
// ==================================================

export type HttpMethod = 'GET' | 'POST' | 'PATCH' | 'DELETE' | 'PUT'

// ==================================================
// Parameter Definitions
// ==================================================

export interface QueryParam {
  name: string
  schema: z.ZodSchema
  description: string
  required?: boolean
  default?: any
}

export interface PathParam {
  name: string
  schema: z.ZodSchema
  description: string
  required: true
}

export interface BodyParam {
  schema: z.ZodSchema
  description: string
  required?: boolean
}

export interface EndpointDefinition {
  method: HttpMethod
  path: string
  alias: string
  description: string
  queryParams?: QueryParam[]
  pathParams?: PathParam[]
  bodyParam?: BodyParam
  responseSchema: z.ZodSchema
  responseType: 'array' | 'paginated' | 'single' | 'void'
  expectedStatus: number
}

// ==================================================
// Endpoint Registry
// ==================================================

export const apiRegistry: Record<string, EndpointDefinition> = {
  // ===== ISSUES ENDPOINTS =====
  getIssues: {
    method: 'GET',
    path: '/issues',
    alias: 'getIssues',
    description: 'Get list of issues with filtering (returns direct array)',
    queryParams: [
      {
        name: 'limit',
        schema: limitParamSchema.default(2000),
        description: 'Number of records per page (max 2000)',
        default: 2000
      },
      {
        name: 'offset',
        schema: offsetParamSchema,
        description: 'Number of records to skip',
        default: 0
      },
      {
        name: 'sort',
        schema: sortParamSchema.default('-createdAt'),
        description: 'Sort field (prefix with - for descending)',
        default: '-createdAt'
      },
      {
        name: 'sortOrder',
        schema: sortOrderParamSchema,
        description: 'Sort order (asc or desc)'
      },
      {
        name: 'filters',
        schema: z.record(z.any()).optional(),
        description: 'Additional filters to apply'
      },
      {
        name: 'tenantSlug',
        schema: tenantSlugParamSchema.optional(),
        description: 'Tenant slug for multi-tenant access'
      }
    ],
    responseSchema: z.array(issueSchema),
    responseType: 'array',
    expectedStatus: 200
  },

  getIssueById: {
    method: 'GET',
    path: '/issues/:id',
    alias: 'getIssueById',
    description: 'Get a single issue by ID',
    pathParams: [
      {
        name: 'id',
        schema: z.string().min(1),
        description: 'Issue ID',
        required: true
      }
    ],
    responseSchema: apiResponseSchema(issueSchema),
    responseType: 'single',
    expectedStatus: 200
  },

  createIssue: {
    method: 'POST',
    path: '/issues',
    alias: 'createIssue',
    description: 'Create a new issue',
    bodyParam: {
      schema: createIssueRequestSchema,
      description: 'Issue data',
      required: true
    },
    responseSchema: apiResponseSchema(issueSchema),
    responseType: 'single',
    expectedStatus: 201
  },

  updateIssue: {
    method: 'PATCH',
    path: '/issues/:id',
    alias: 'updateIssue',
    description: 'Update an existing issue',
    pathParams: [
      {
        name: 'id',
        schema: z.string().min(1),
        description: 'Issue ID',
        required: true
      }
    ],
    bodyParam: {
      schema: updateIssueRequestSchema,
      description: 'Issue update data',
      required: true
    },
    responseSchema: apiResponseSchema(issueSchema),
    responseType: 'single',
    expectedStatus: 200
  },

  deleteIssue: {
    method: 'DELETE',
    path: '/issues/:id',
    alias: 'deleteIssue',
    description: 'Delete an issue',
    pathParams: [
      {
        name: 'id',
        schema: z.string().min(1),
        description: 'Issue ID',
        required: true
      }
    ],
    responseSchema: z.void(),
    responseType: 'void',
    expectedStatus: 204
  },

  // ===== COMPANIES ENDPOINTS =====
  getCompanies: {
    method: 'GET',
    path: '/companies',
    alias: 'getCompanies',
    description: 'Get paginated list of companies with filtering',
    queryParams: [
      {
        name: 'limit',
        schema: limitParamSchema.default(500),
        description: 'Number of records per page (max 2000)',
        default: 500
      },
      {
        name: 'offset',
        schema: offsetParamSchema,
        description: 'Number of records to skip',
        default: 0
      },
      {
        name: 'sort',
        schema: sortParamSchema.default('name'),
        description: 'Sort field (prefix with - for descending)',
        default: 'name'
      },
      {
        name: 'sortOrder',
        schema: sortOrderParamSchema,
        description: 'Sort order (asc or desc)'
      },
      {
        name: 'filters',
        schema: z.record(z.any()).optional(),
        description: 'Additional filters to apply'
      },
      {
        name: 'tenantSlug',
        schema: tenantSlugParamSchema.optional(),
        description: 'Tenant slug for multi-tenant access'
      }
    ],
    responseSchema: paginatedResponseSchema(companySchema),
    responseType: 'paginated',
    expectedStatus: 200
  },

  getCompanyById: {
    method: 'GET',
    path: '/companies/:id',
    alias: 'getCompanyById',
    description: 'Get a single company by ID',
    pathParams: [
      {
        name: 'id',
        schema: z.string().min(1),
        description: 'Company ID',
        required: true
      }
    ],
    responseSchema: apiResponseSchema(companySchema),
    responseType: 'single',
    expectedStatus: 200
  },

  createCompany: {
    method: 'POST',
    path: '/companies',
    alias: 'createCompany',
    description: 'Create a new company',
    bodyParam: {
      schema: createCompanyRequestSchema,
      description: 'Company data',
      required: true
    },
    responseSchema: apiResponseSchema(companySchema),
    responseType: 'single',
    expectedStatus: 201
  },

  updateCompany: {
    method: 'PATCH',
    path: '/companies/:id',
    alias: 'updateCompany',
    description: 'Update an existing company',
    pathParams: [
      {
        name: 'id',
        schema: z.string().min(1),
        description: 'Company ID',
        required: true
      }
    ],
    bodyParam: {
      schema: updateCompanyRequestSchema,
      description: 'Company update data',
      required: true
    },
    responseSchema: apiResponseSchema(companySchema),
    responseType: 'single',
    expectedStatus: 200
  },

  deleteCompany: {
    method: 'DELETE',
    path: '/companies/:id',
    alias: 'deleteCompany',
    description: 'Delete a company',
    pathParams: [
      {
        name: 'id',
        schema: z.string().min(1),
        description: 'Company ID',
        required: true
      }
    ],
    responseSchema: z.void(),
    responseType: 'void',
    expectedStatus: 204
  },

  // ===== WORKFLOWS ENDPOINTS =====
  getWorkflows: {
    method: 'GET',
    path: '/workflows',
    alias: 'getWorkflows',
    description: 'Get paginated list of workflows with filtering',
    queryParams: [
      {
        name: 'limit',
        schema: limitParamSchema.default(100),
        description: 'Number of records per page (max 2000)',
        default: 100
      },
      {
        name: 'offset',
        schema: offsetParamSchema,
        description: 'Number of records to skip',
        default: 0
      },
      {
        name: 'sort',
        schema: sortParamSchema.default('-updatedAt'),
        description: 'Sort field (prefix with - for descending)',
        default: '-updatedAt'
      },
      {
        name: 'sortOrder',
        schema: sortOrderParamSchema,
        description: 'Sort order (asc or desc)'
      },
      {
        name: 'filters',
        schema: z.record(z.any()).optional(),
        description: 'Additional filters to apply'
      },
      {
        name: 'tenantSlug',
        schema: tenantSlugParamSchema.optional(),
        description: 'Tenant slug for multi-tenant access'
      }
    ],
    responseSchema: paginatedResponseSchema(workflowSchema),
    responseType: 'paginated',
    expectedStatus: 200
  },

  getWorkflowById: {
    method: 'GET',
    path: '/workflows/:id',
    alias: 'getWorkflowById',
    description: 'Get a single workflow by ID',
    pathParams: [
      {
        name: 'id',
        schema: z.string().min(1),
        description: 'Workflow ID',
        required: true
      }
    ],
    responseSchema: apiResponseSchema(workflowSchema),
    responseType: 'single',
    expectedStatus: 200
  },

  createWorkflow: {
    method: 'POST',
    path: '/workflows',
    alias: 'createWorkflow',
    description: 'Create a new workflow',
    bodyParam: {
      schema: createWorkflowRequestSchema,
      description: 'Workflow data',
      required: true
    },
    responseSchema: apiResponseSchema(workflowSchema),
    responseType: 'single',
    expectedStatus: 201
  },

  updateWorkflow: {
    method: 'PATCH',
    path: '/workflows/:id',
    alias: 'updateWorkflow',
    description: 'Update an existing workflow',
    pathParams: [
      {
        name: 'id',
        schema: z.string().min(1),
        description: 'Workflow ID',
        required: true
      }
    ],
    bodyParam: {
      schema: updateWorkflowRequestSchema,
      description: 'Workflow update data',
      required: true
    },
    responseSchema: apiResponseSchema(workflowSchema),
    responseType: 'single',
    expectedStatus: 200
  },

  deleteWorkflow: {
    method: 'DELETE',
    path: '/workflows/:id',
    alias: 'deleteWorkflow',
    description: 'Delete a workflow',
    pathParams: [
      {
        name: 'id',
        schema: z.string().min(1),
        description: 'Workflow ID',
        required: true
      }
    ],
    responseSchema: z.void(),
    responseType: 'void',
    expectedStatus: 204
  },

  // ===== WORKFLOW TEMPLATES ENDPOINTS =====
  getWorkflowTemplates: {
    method: 'GET',
    path: '/workflowtemplates',
    alias: 'getWorkflowTemplates',
    description: 'Get list of workflow templates with filtering support',
    queryParams: [
      {
        name: 'limit',
        schema: limitParamSchema.default(1000),
        description: 'Number of records to return (max 1000)',
        default: 1000
      },
      {
        name: 'offset',
        schema: offsetParamSchema,
        description: 'Number of records to skip before fetching',
        default: 0
      },
      {
        name: 'sort',
        schema: sortParamSchema.default('-updatedAt'),
        description: 'Sort field (prefix with - for descending order)',
        default: '-updatedAt'
      },
      {
        name: 'filters',
        schema: z.record(z.any()).optional(),
        description: 'Additional filters to apply to the workflow templates list'
      },
      {
        name: 'tenantSlug',
        schema: tenantSlugParamSchema.optional(),
        description: 'Tenant slug for multi-tenant access'
      }
    ],
    responseSchema: z.array(workflowSchema),
    responseType: 'array',
    expectedStatus: 200
  },

  // ===== TENANT ENDPOINTS =====
  getTenants: {
    method: 'GET',
    path: '/myprofile/tenants',
    alias: 'getTenants',
    description: 'Get list of tenants accessible to current user',
    queryParams: [
      {
        name: 'tenantSlug',
        schema: tenantSlugParamSchema.optional(),
        description: 'Tenant slug for multi-tenant access'
      }
    ],
    responseSchema: z.array(tenantSchema),
    responseType: 'array',
    expectedStatus: 200
  },

  getCurrentUser: {
    method: 'GET',
    path: '/myprofile',
    alias: 'getCurrentUser',
    description: 'Get current user profile information',
    queryParams: [
      {
        name: 'tenantSlug',
        schema: tenantSlugParamSchema.optional(),
        description: 'Tenant slug for multi-tenant access'
      }
    ],
    responseSchema: userResponseSchema,
    responseType: 'single',
    expectedStatus: 200
  }
}

// ==================================================
// Endpoint Configuration (preserved from endpoints.ts)
// ==================================================

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
    defaultLimit: 500,
    maxLimit: 1000,
    defaultSort: 'name',
    responseType: 'paginated' as const,
    requiresModelParam: false
  },
  workflows: {
    endpoint: 'getWorkflows',
    defaultLimit: 100,
    maxLimit: 500,
    defaultSort: '-updatedAt',
    responseType: 'paginated' as const,
    requiresModelParam: false
  },
  workflowTemplates: {
    endpoint: 'getWorkflowTemplates',
    defaultLimit: 1000,
    maxLimit: 1000,
    defaultSort: '-updatedAt',
    responseType: 'array' as const,
    requiresModelParam: false
  },
  tenants: {
    endpoint: 'getTenants',
    defaultLimit: 50,
    maxLimit: 100,
    defaultSort: 'name',
    responseType: 'array' as const,
    requiresModelParam: false
  }
} as const

// ==================================================
// Utility Functions
// ==================================================

/**
 * Get endpoint definition by alias
 */
export function getEndpointDefinition(alias: string): EndpointDefinition | undefined {
  return apiRegistry[alias]
}

/**
 * Build URL with path parameters
 */
export function buildUrlWithPathParams(path: string, pathParams: Record<string, string>): string {
  let url = path
  for (const [key, value] of Object.entries(pathParams)) {
    url = url.replace(`:${key}`, encodeURIComponent(value))
  }
  return url
}

/**
 * Extract path parameters from URL pattern
 */
export function extractPathParamNames(path: string): string[] {
  const matches = path.match(/:(\w+)/g)
  return matches ? matches.map(match => match.substring(1)) : []
}

/**
 * Validate query parameters against schema
 */
export function validateQueryParams(
  params: Record<string, any>,
  queryParams: QueryParam[]
): Record<string, any> {
  const validated: Record<string, any> = {}

  for (const paramDef of queryParams) {
    const value = params[paramDef.name]

    if (value !== undefined) {
      try {
        validated[paramDef.name] = paramDef.schema.parse(value)
      } catch (error) {
        throw new Error(`Invalid value for query parameter '${paramDef.name}': ${error}`)
      }
    } else if (paramDef.default !== undefined) {
      validated[paramDef.name] = paramDef.default
    }
  }

  return validated
}

/**
 * Validate path parameters against schema
 */
export function validatePathParams(
  params: Record<string, string>,
  pathParams: PathParam[]
): Record<string, string> {
  const validated: Record<string, string> = {}

  for (const paramDef of pathParams) {
    const value = params[paramDef.name]

    if (value === undefined) {
      throw new Error(`Missing required path parameter: ${paramDef.name}`)
    }

    try {
      validated[paramDef.name] = paramDef.schema.parse(value)
    } catch (error) {
      throw new Error(`Invalid value for path parameter '${paramDef.name}': ${error}`)
    }
  }

  return validated
}

/**
 * Validate request body against schema
 */
export function validateRequestBody<T>(data: T, bodyParam?: BodyParam): T {
  if (!bodyParam) {
    return data
  }

  if (data === undefined && bodyParam.required) {
    throw new Error('Request body is required but not provided')
  }

  if (data !== undefined) {
    try {
      return bodyParam.schema.parse(data) as T
    } catch (error) {
      throw new Error(`Invalid request body: ${error}`)
    }
  }

  return data
}

// ==================================================
// Type Exports
// ==================================================

export type EntityType = keyof typeof endpointConfig
export type EndpointConfig = typeof endpointConfig[EntityType]
export type EndpointAlias = keyof typeof apiRegistry