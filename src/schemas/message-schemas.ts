/**
 * Zod schemas for Chrome extension message validation
 * Ensures type safety and security for inter-context communication
 */

import { z } from 'zod'

import { logger } from '../utils/logger'

const log = logger.api

// Base message schema with common fields
const BaseMessageSchema = z.object({
  action: z.string().min(1).max(50),
  timestamp: z.number().optional(),
  requestId: z.string().optional()
})

// Storage operations
const StorageKeysSchema = z.array(z.string().min(1).max(100)).max(50)

const StorageDataSchema = z.record(
  z.string().min(1).max(100),
  z.any()
).refine(
  (data) => Object.keys(data).length <= 100,
  { message: 'Storage data cannot have more than 100 keys' }
)

const GetStoragePayloadSchema = z.object({
  keys: StorageKeysSchema.optional()
})

const SetStoragePayloadSchema = z.object({
  data: StorageDataSchema
})

// Export data operations
const ExportFormatSchema = z.enum(['csv', 'json'])

const ExportDataPayloadSchema = z.object({
  data: z.array(z.record(z.string(), z.any())).max(100000), // Max 100k records
  filename: z.string().min(1).max(255).regex(
    /^[a-zA-Z0-9_\-. ]+$/,
    'Filename contains invalid characters'
  ),
  format: ExportFormatSchema
}).refine(
  (data) => {
    // Additional file extension validation
    const expectedExt = data.format === 'csv' ? '.csv' : '.json'
    return data.filename.endsWith(expectedExt)
  },
  { message: 'Filename extension must match format' }
)

// Content script settings
const ContentSettingsPayloadSchema = z.object({
  setting: z.string().min(1).max(50).regex(
    /^[a-zA-Z][a-zA-Z0-9_]*$/,
    'Setting name must be alphanumeric with underscores'
  ),
  enabled: z.boolean()
})

// Tenant change notification
const TenantChangedPayloadSchema = z.object({
  tenant: z.string().min(1).max(100).regex(
    /^[a-zA-Z0-9\-]+$/,
    'Tenant name must be alphanumeric with hyphens'
  ),
  url: z.string().url().max(2048),
  previousTenant: z.string().optional()
})

// Rate limiter request schema
const RateLimiterRequestSchema = z.object({
  endpoint: z.string().min(1).max(500),
  method: z.enum(['GET', 'POST', 'PUT', 'DELETE', 'PATCH']),
  payload: z.any().optional(),
  priority: z.number().min(1).max(10).default(5),
  maxRetries: z.number().min(0).max(5).default(3),
  metadata: z.object({
    isQuery: z.boolean().optional(),
    originalQueryFn: z.function().optional()
  }).optional()
})

// API request validation
const ApiRequestPayloadSchema = z.object({
  request: RateLimiterRequestSchema,
  options: z.object({
    timeout: z.number().min(1000).max(300000).optional(), // 1s to 5min
    headers: z.record(z.string(), z.string()).optional()
  }).optional()
})

// Generic data operation
const DataOperationPayloadSchema = z.object({
  operation: z.enum(['create', 'read', 'update', 'delete']),
  entity: z.string().min(1).max(50),
  data: z.any().optional(),
  filters: z.record(z.string(), z.any()).optional()
})

// Rate limiting operations
const RateLimitCheckPayloadSchema = z.object({
  priority: z.enum(['low', 'normal', 'high', 'critical']).default('normal'),
  metadata: z.object({
    endpoint: z.string().min(1).max(500),
    method: z.enum(['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS']),
    complexity: z.enum(['simple', 'moderate', 'complex', 'heavy']).default('simple'),
    isRetry: z.boolean().default(false)
  })
})

const RateLimitStatsPayloadSchema = z.object({}).optional()

const RateLimitResetPayloadSchema = z.object({}).optional()

// Message payload union type
const MessagePayloadSchema = z.union([
  GetStoragePayloadSchema,
  SetStoragePayloadSchema,
  ExportDataPayloadSchema,
  ContentSettingsPayloadSchema,
  TenantChangedPayloadSchema,
  ApiRequestPayloadSchema,
  DataOperationPayloadSchema,
  RateLimitCheckPayloadSchema,
  RateLimitStatsPayloadSchema,
  RateLimitResetPayloadSchema,
  z.undefined()
])

// Main extension message schema
export const ExtensionMessageSchema = BaseMessageSchema.extend({
  payload: MessagePayloadSchema.optional()
})

// Specific action schemas for better type safety
export const MessageSchemas = {
  GET_STORAGE: BaseMessageSchema.extend({
    action: z.literal('GET_STORAGE'),
    payload: GetStoragePayloadSchema.optional()
  }),

  SET_STORAGE: BaseMessageSchema.extend({
    action: z.literal('SET_STORAGE'),
    payload: SetStoragePayloadSchema
  }),

  GET_TENANT_INFO: BaseMessageSchema.extend({
    action: z.literal('GET_TENANT_INFO'),
    payload: z.undefined()
  }),

  EXPORT_DATA: BaseMessageSchema.extend({
    action: z.literal('EXPORT_DATA'),
    payload: ExportDataPayloadSchema
  }),

  UPDATE_CONTENT_SETTINGS: BaseMessageSchema.extend({
    action: z.literal('UPDATE_CONTENT_SETTINGS'),
    payload: ContentSettingsPayloadSchema
  }),

  TENANT_CHANGED: BaseMessageSchema.extend({
    action: z.literal('TENANT_CHANGED'),
    payload: TenantChangedPayloadSchema
  }),

  API_REQUEST: BaseMessageSchema.extend({
    action: z.literal('API_REQUEST'),
    payload: ApiRequestPayloadSchema
  }),

  DATA_OPERATION: BaseMessageSchema.extend({
    action: z.literal('DATA_OPERATION'),
    payload: DataOperationPayloadSchema
  }),

  UPDATE_SETTING: BaseMessageSchema.extend({
    action: z.literal('UPDATE_SETTING'),
    payload: ContentSettingsPayloadSchema
  }),

  RATE_LIMIT_CHECK: BaseMessageSchema.extend({
    action: z.literal('RATE_LIMIT_CHECK'),
    payload: RateLimitCheckPayloadSchema
  }),

  RATE_LIMIT_STATS: BaseMessageSchema.extend({
    action: z.literal('RATE_LIMIT_STATS'),
    payload: RateLimitStatsPayloadSchema
  }),

  RATE_LIMIT_RESET: BaseMessageSchema.extend({
    action: z.literal('RATE_LIMIT_RESET'),
    payload: RateLimitResetPayloadSchema
  })
} as const

// Type inference from schemas
export type ExtensionMessage = z.infer<typeof ExtensionMessageSchema>
export type GetStorageMessage = z.infer<typeof MessageSchemas.GET_STORAGE>
export type SetStorageMessage = z.infer<typeof MessageSchemas.SET_STORAGE>
export type ExportDataMessage = z.infer<typeof MessageSchemas.EXPORT_DATA>
export type ContentSettingsMessage = z.infer<typeof MessageSchemas.UPDATE_CONTENT_SETTINGS>
export type TenantChangedMessage = z.infer<typeof MessageSchemas.TENANT_CHANGED>
export type RateLimitCheckMessage = z.infer<typeof MessageSchemas.RATE_LIMIT_CHECK>
export type RateLimitStatsMessage = z.infer<typeof MessageSchemas.RATE_LIMIT_STATS>
export type RateLimitResetMessage = z.infer<typeof MessageSchemas.RATE_LIMIT_RESET>

// Message validation function
export function validateMessage(
  message: unknown,
  action?: string
): { valid: boolean; data?: ExtensionMessage; errors?: string[] } {
  try {
    // First validate against base schema
    const baseResult = ExtensionMessageSchema.safeParse(message)
    
    if (!baseResult.success) {
      const errors = baseResult.error.errors.map(err => 
        `${err.path.join('.')}: ${err.message}`
      )
      
      log.warn('Message validation failed - base schema', { 
        errors,
        messagePreview: typeof message === 'object' ? 
          JSON.stringify(message).slice(0, 200) : String(message).slice(0, 200)
      })
      
      return { valid: false, errors }
    }

    const validatedMessage = baseResult.data

    // If specific action provided, validate against specific schema
    if (action && action in MessageSchemas) {
      const specificSchema = MessageSchemas[action as keyof typeof MessageSchemas]
      const specificResult = specificSchema.safeParse(message)
      
      if (!specificResult.success) {
        const errors = specificResult.error.errors.map(err => 
          `${err.path.join('.')}: ${err.message}`
        )
        
        log.warn('Message validation failed - specific schema', { 
          action,
          errors,
          messagePreview: JSON.stringify(message).slice(0, 200)
        })
        
        return { valid: false, errors }
      }
    }

    // Additional security checks
    if (validatedMessage.payload && typeof validatedMessage.payload === 'object') {
      // Check for prototype pollution attempts (check own properties only, not inherited)
      const dangerousKeys = ['__proto__', 'constructor', 'prototype']
      const foundKeys = dangerousKeys.filter(key => 
        Object.prototype.hasOwnProperty.call(validatedMessage.payload, key)
      )
      
      if (foundKeys.length > 0) {
        log.error('Message validation failed - prototype pollution attempt detected', {
          action: validatedMessage.action,
          suspiciousKeys: foundKeys
        })
        
        return { 
          valid: false, 
          errors: ['Message contains potentially dangerous prototype properties'] 
        }
      }

      // Check for excessively nested objects (additional depth check)
      const maxDepth = 10
      const checkDepth = (obj: any, depth = 0): boolean => {
        if (depth > maxDepth) return false
        if (obj && typeof obj === 'object') {
          for (const key in obj) {
            if (!checkDepth(obj[key], depth + 1)) return false
          }
        }
        return true
      }

      if (!checkDepth(validatedMessage.payload)) {
        log.warn('Message validation failed - payload too deeply nested', {
          action: validatedMessage.action,
          maxDepth
        })
        
        return { 
          valid: false, 
          errors: [`Payload nesting exceeds maximum depth of ${maxDepth}`] 
        }
      }
    }

    log.debug('Message validation successful', { 
      action: validatedMessage.action,
      hasPayload: !!validatedMessage.payload,
      payloadType: validatedMessage.payload ? typeof validatedMessage.payload : 'none'
    })

    return { valid: true, data: validatedMessage }

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown validation error'
    
    log.error('Message validation exception', { 
      error: errorMessage,
      messageType: typeof message
    })
    
    return { 
      valid: false, 
      errors: [`Validation exception: ${errorMessage}`] 
    }
  }
}

// Helper function to create validated messages
export function createMessage<T extends keyof typeof MessageSchemas>(
  action: T,
  payload?: z.infer<typeof MessageSchemas[T]>['payload'],
  options: { requestId?: string; timestamp?: number } = {}
): z.infer<typeof MessageSchemas[T]> {
  const message = {
    action,
    payload,
    timestamp: options.timestamp || Date.now(),
    requestId: options.requestId || `msg_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`
  }

  const validation = validateMessage(message, action)
  
  if (!validation.valid) {
    throw new Error(`Invalid message creation: ${validation.errors?.join(', ')}`)
  }

  return message as z.infer<typeof MessageSchemas[T]>
}