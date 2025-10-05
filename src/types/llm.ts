/**
 * LLM API Integration Types
 *
 * TypeScript definitions for LLM services, API interactions, and security components
 */

// LLM Provider Types
export type LLMProvider = 'claude' | 'openai' | 'gemini'

export interface LLMProviderConfig {
  provider: LLMProvider
  baseURL: string
  authHeader: string
  maxTokens: number
  rateLimits: {
    requestsPerMinute: number
    requestsPerSecond: number
    maxConcurrent: number
  }
  availableModels: LLMModel[]
}

export interface LLMModel {
  modelId: string
  displayName: string
  description: string
  maxTokens: number
  costPer1kTokens: {
    input: number
    output: number
  }
  capabilities: {
    streaming: boolean
    vision: boolean
    functionCalling: boolean
  }
}

// Chat Interface Types
export interface ChatMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: number
  metadata?: Record<string, any>
}

export interface LLMRequestOptions {
  model?: string
  temperature?: number
  maxTokens?: number
  stream?: boolean
  systemPrompt?: string
  metadata?: Record<string, any>
}

export interface LLMResponse {
  id: string
  provider: LLMProvider
  model: string
  content: string
  role: 'assistant'
  timestamp: number
  usage: {
    inputTokens: number
    outputTokens: number
    totalTokens: number
  }
  metadata?: Record<string, any>
}

export interface LLMStreamResponse extends Omit<LLMResponse, 'content'> {
  delta: string
  finished: boolean
}

// API Key Management Types
export interface ApiKeyEntry {
  provider: LLMProvider
  encryptedKey: string
  salt: string
  iv: string
  createdAt: number
  lastUsed?: number
}

export interface ApiKeyStorage {
  keys: Record<LLMProvider, ApiKeyEntry>
  securityConfig: {
    maxAttempts: number
    lockoutDuration: number
    sessionTimeout: number
    progressiveDelays: number[]
  }
}

// Encryption Types
export interface EncryptionResult {
  encryptedData: ArrayBuffer
  salt: ArrayBuffer
  iv: ArrayBuffer
}

export interface DecryptionInput {
  encryptedData: ArrayBuffer
  salt: ArrayBuffer
  iv: ArrayBuffer
  pin: string
}

// PIN Protection Types
export interface PinAttemptRecord {
  attempts: number
  lastAttempt: number
  lockedUntil: number
  progressiveDelayIndex: number
}

export interface PinSession {
  isValid: boolean
  createdAt: number
  expiresAt: number
  sessionId: string
}

export interface SecurityConfig {
  maxAttempts: number
  lockoutDuration: number
  sessionTimeout: number
  progressiveDelays: number[]
}

// Error Types
export interface LLMErrorContext {
  provider?: LLMProvider
  model?: string
  requestId?: string
  usage?: {
    inputTokens?: number
    outputTokens?: number
    totalTokens?: number
  }
  originalError?: string
  metadata?: Record<string, any>
  validationErrors?: any[]
  status?: number
  statusText?: string
  responseData?: any
}

export type LLMErrorCode =
  | 'NO_API_KEY'
  | 'INVALID_API_KEY'
  | 'REQUEST_FAILED'
  | 'RATE_LIMITED'
  | 'QUOTA_EXCEEDED'
  | 'MODEL_NOT_AVAILABLE'
  | 'VALIDATION_ERROR'
  | 'NETWORK_ERROR'
  | 'STORAGE_FAILED'
  | 'DECRYPTION_FAILED'
  | 'ENCRYPTION_FAILED'
  | 'SESSION_EXPIRED'
  | 'PIN_REQUIRED'
  | 'MAX_ATTEMPTS_EXCEEDED'
  | 'LOCKOUT_ACTIVE'
  | 'SETUP_FAILED'
  | 'REMOVAL_FAILED'
  | 'CLEAR_FAILED'
  | 'WIPE_FAILED'
  | 'STORAGE_VALIDATION_FAILED'

export type EncryptionErrorCode =
  | 'ENCRYPTION_FAILED'
  | 'DECRYPTION_FAILED'
  | 'KEY_DERIVATION_FAILED'
  | 'INVALID_INPUT'
  | 'CRYPTO_NOT_SUPPORTED'

export type PinProtectionErrorCode =
  | 'PIN_REQUIRED'
  | 'INVALID_PIN'
  | 'MAX_ATTEMPTS_EXCEEDED'
  | 'LOCKOUT_ACTIVE'
  | 'SESSION_EXPIRED'
  | 'SESSION_CREATION_FAILED'
  | 'EMERGENCY_WIPE_TRIGGERED'

// Usage and Analytics Types
export interface UsageStats {
  provider: LLMProvider
  model: string
  requestCount: number
  tokenUsage: {
    input: number
    output: number
    total: number
  }
  estimatedCost: number
  lastUsed: number
}

export interface CostTracking {
  daily: Record<string, number> // ISO date -> cost
  monthly: Record<string, number> // YYYY-MM -> cost
  byProvider: Record<LLMProvider, number>
  byModel: Record<string, number>
  total: number
}

// Chat History Types
export interface ChatSession {
  id: string
  title: string
  provider: LLMProvider
  model: string
  messages: ChatMessage[]
  createdAt: number
  updatedAt: number
  totalTokens: number
  estimatedCost: number
}

export interface ChatHistory {
  sessions: Record<string, ChatSession>
  activeSessionId?: string
  maxSessions: number
  autoCleanupDays: number
}