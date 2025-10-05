/**
 * LLM Zod Schemas
 *
 * Runtime validation schemas for LLM API integration types
 */

import { z } from 'zod'

// Basic type schemas
export const LLMProviderSchema = z.enum(['claude', 'openai', 'gemini'])

export const ChatMessageRoleSchema = z.enum(['user', 'assistant', 'system'])

export const LLMErrorCodeSchema = z.enum([
  'NO_API_KEY',
  'INVALID_API_KEY',
  'REQUEST_FAILED',
  'RATE_LIMITED',
  'QUOTA_EXCEEDED',
  'MODEL_NOT_AVAILABLE',
  'VALIDATION_ERROR',
  'NETWORK_ERROR',
  'STORAGE_FAILED',
  'DECRYPTION_FAILED',
  'ENCRYPTION_FAILED',
  'SESSION_EXPIRED',
  'PIN_REQUIRED',
  'MAX_ATTEMPTS_EXCEEDED',
  'LOCKOUT_ACTIVE',
  'SETUP_FAILED',
  'REMOVAL_FAILED',
  'CLEAR_FAILED',
  'WIPE_FAILED',
  'STORAGE_VALIDATION_FAILED'
])

// Model configuration schemas
export const LLMModelSchema = z.object({
  modelId: z.string().min(1),
  displayName: z.string().min(1),
  description: z.string(),
  maxTokens: z.number().positive(),
  costPer1kTokens: z.object({
    input: z.number().nonnegative(),
    output: z.number().nonnegative()
  }),
  capabilities: z.object({
    streaming: z.boolean(),
    vision: z.boolean(),
    functionCalling: z.boolean()
  })
})

export const LLMProviderConfigSchema = z.object({
  provider: LLMProviderSchema,
  baseURL: z.string().url(),
  authHeader: z.string().min(1),
  maxTokens: z.number().positive(),
  rateLimits: z.object({
    requestsPerMinute: z.number().positive(),
    requestsPerSecond: z.number().positive(),
    maxConcurrent: z.number().positive()
  }),
  availableModels: z.array(LLMModelSchema).min(1)
})

// Chat message schemas
export const ChatMessageSchema = z.object({
  id: z.string().min(1),
  role: ChatMessageRoleSchema,
  content: z.string(),
  timestamp: z.number().positive(),
  metadata: z.record(z.any()).optional()
})

export const LLMRequestOptionsSchema = z.object({
  model: z.string().optional(),
  temperature: z.number().min(0).max(2).optional(),
  maxTokens: z.number().positive().optional(),
  stream: z.boolean().optional(),
  systemPrompt: z.string().optional(),
  metadata: z.record(z.any()).optional()
}).strict()

export const LLMResponseSchema = z.object({
  id: z.string().min(1),
  provider: LLMProviderSchema,
  model: z.string().min(1),
  content: z.string(),
  role: z.literal('assistant'),
  timestamp: z.number().positive(),
  usage: z.object({
    inputTokens: z.number().nonnegative(),
    outputTokens: z.number().nonnegative(),
    totalTokens: z.number().nonnegative()
  }),
  metadata: z.record(z.any()).optional()
})

export const LLMStreamResponseSchema = LLMResponseSchema.omit({ content: true }).extend({
  delta: z.string(),
  finished: z.boolean()
})

// API Key management schemas
export const ApiKeyEntrySchema = z.object({
  provider: LLMProviderSchema,
  encryptedKey: z.string().min(1),
  salt: z.string().min(1),
  iv: z.string().min(1),
  createdAt: z.number().positive(),
  lastUsed: z.number().positive().optional()
})

export const SecurityConfigSchema = z.object({
  maxAttempts: z.number().positive(),
  lockoutDuration: z.number().positive(),
  sessionTimeout: z.number().positive(),
  progressiveDelays: z.array(z.number().positive()).min(1)
})

export const ApiKeyStorageSchema = z.object({
  keys: z.record(LLMProviderSchema, ApiKeyEntrySchema),
  securityConfig: SecurityConfigSchema
})

// Encryption schemas
export const EncryptionResultSchema = z.object({
  encryptedData: z.instanceof(ArrayBuffer),
  salt: z.instanceof(ArrayBuffer),
  iv: z.instanceof(ArrayBuffer)
})

export const DecryptionInputSchema = z.object({
  encryptedData: z.instanceof(ArrayBuffer),
  salt: z.instanceof(ArrayBuffer),
  iv: z.instanceof(ArrayBuffer),
  pin: z.string().min(4).max(16)
})

// PIN protection schemas
export const PinAttemptRecordSchema = z.object({
  attempts: z.number().nonnegative(),
  lastAttempt: z.number().nonnegative(),
  lockedUntil: z.number().nonnegative(),
  progressiveDelayIndex: z.number().nonnegative()
})

export const PinSessionSchema = z.object({
  isValid: z.boolean(),
  createdAt: z.number().positive(),
  expiresAt: z.number().positive(),
  sessionId: z.string().min(1)
})

// Usage tracking schemas
export const UsageStatsSchema = z.object({
  provider: LLMProviderSchema,
  model: z.string().min(1),
  requestCount: z.number().nonnegative(),
  tokenUsage: z.object({
    input: z.number().nonnegative(),
    output: z.number().nonnegative(),
    total: z.number().nonnegative()
  }),
  estimatedCost: z.number().nonnegative(),
  lastUsed: z.number().positive()
})

export const CostTrackingSchema = z.object({
  daily: z.record(z.string(), z.number().nonnegative()),
  monthly: z.record(z.string(), z.number().nonnegative()),
  byProvider: z.record(LLMProviderSchema, z.number().nonnegative()),
  byModel: z.record(z.string(), z.number().nonnegative()),
  total: z.number().nonnegative()
})

// Chat history schemas
export const ChatSessionSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  provider: LLMProviderSchema,
  model: z.string().min(1),
  messages: z.array(ChatMessageSchema),
  createdAt: z.number().positive(),
  updatedAt: z.number().positive(),
  totalTokens: z.number().nonnegative(),
  estimatedCost: z.number().nonnegative()
})

export const ChatHistorySchema = z.object({
  sessions: z.record(z.string(), ChatSessionSchema),
  activeSessionId: z.string().optional(),
  maxSessions: z.number().positive(),
  autoCleanupDays: z.number().positive()
})

// Input validation schemas for API endpoints
export const ValidateApiKeyInputSchema = z.object({
  provider: LLMProviderSchema,
  apiKey: z.string().min(1).max(200)
})

export const SetupProviderInputSchema = z.object({
  provider: LLMProviderSchema,
  apiKey: z.string().min(1).max(200),
  pin: z.string().min(4).max(16)
})

export const ChatRequestInputSchema = z.object({
  provider: LLMProviderSchema,
  messages: z.array(ChatMessageSchema).min(1).max(100),
  options: LLMRequestOptionsSchema.optional(),
  pin: z.string().min(4).max(16).optional()
})

export const PinInputSchema = z.object({
  pin: z.string().min(4).max(16)
})

// Export type inference helpers
export type LLMProviderType = z.infer<typeof LLMProviderSchema>
export type ChatMessageType = z.infer<typeof ChatMessageSchema>
export type LLMRequestOptionsType = z.infer<typeof LLMRequestOptionsSchema>
export type LLMResponseType = z.infer<typeof LLMResponseSchema>
export type ApiKeyStorageType = z.infer<typeof ApiKeyStorageSchema>
export type SecurityConfigType = z.infer<typeof SecurityConfigSchema>
export type UsageStatsType = z.infer<typeof UsageStatsSchema>
export type ChatSessionType = z.infer<typeof ChatSessionSchema>

// Validation helper functions
export const validateChatMessage = (data: unknown) => {
  const result = ChatMessageSchema.safeParse(data)
  return {
    success: result.success,
    data: result.success ? result.data : undefined,
    errors: result.success ? undefined : result.error.errors
  }
}

export const validateLLMResponse = (data: unknown) => {
  const result = LLMResponseSchema.safeParse(data)
  return {
    success: result.success,
    data: result.success ? result.data : undefined,
    errors: result.success ? undefined : result.error.errors
  }
}

export const validateApiKeyStorage = (data: unknown) => {
  const result = ApiKeyStorageSchema.safeParse(data)
  return {
    success: result.success,
    data: result.success ? result.data : undefined,
    errors: result.success ? undefined : result.error.errors
  }
}

export const validatePinInput = (pin: string) => {
  const result = PinInputSchema.safeParse({ pin })
  return {
    success: result.success,
    errors: result.success ? undefined : result.error.errors
  }
}

export const validateSetupProviderInput = (data: unknown) => {
  const result = SetupProviderInputSchema.safeParse(data)
  return {
    success: result.success,
    data: result.success ? result.data : undefined,
    errors: result.success ? undefined : result.error.errors
  }
}

export const validateChatRequestInput = (data: unknown) => {
  const result = ChatRequestInputSchema.safeParse(data)
  return {
    success: result.success,
    data: result.success ? result.data : undefined,
    errors: result.success ? undefined : result.error.errors
  }
}