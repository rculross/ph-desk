/**
 * Input Validation and Sanitization Utility
 *
 * Provides comprehensive input validation and sanitization to prevent
 * security vulnerabilities including XSS, injection attacks, and other
 * malicious input patterns.
 *
 * @fileVersion 3.1.2
 * @author Claude Code AI Assistant
 */

/**
 * Dangerous HTML patterns that should be stripped
 */
const DANGEROUS_HTML_PATTERNS = [
  /<script[^>]*>.*?<\/script>/gi,
  /<iframe[^>]*>.*?<\/iframe>/gi,
  /<object[^>]*>.*?<\/object>/gi,
  /<embed[^>]*>/gi,
  /<link[^>]*>/gi,
  /<style[^>]*>.*?<\/style>/gi,
  /<meta[^>]*>/gi,
  /javascript:/gi,
  /vbscript:/gi,
  /data:text\/html/gi,
  /on\w+\s*=/gi // onclick, onload, etc.
]

/**
 * Dangerous characters for injection prevention
 */
const DANGEROUS_CHARS = [
  '&lt;script',
  '&gt;script',
  '<script',
  '</script>',
  'javascript:',
  'vbscript:',
  'data:',
  'onload=',
  'onerror=',
  'onclick=',
  'onmouseover='
]

/**
 * SQL injection patterns
 */
const SQL_INJECTION_PATTERNS = [
  /(\b(union|select|insert|update|delete|drop|create|alter|exec|execute)\s)/gi,
  /(--|#|\/\*|\*\/)/g,
  /(';|'$)/g,
  /(\bor\s+1\s*=\s*1\b)/gi,
  /(\band\s+1\s*=\s*1\b)/gi
]

/**
 * Rate limiting configuration
 */
const RATE_LIMIT_CONFIG = {
  windowMs: 60000, // 1 minute
  maxRequests: 100, // Max 100 requests per minute per user
  blockDurationMs: 300000 // Block for 5 minutes if exceeded
}

/**
 * Input validation options
 */
export interface ValidationOptions {
  /** Maximum input length */
  maxLength?: number
  /** Minimum input length */
  minLength?: number
  /** Allow HTML tags */
  allowHtml?: boolean
  /** Strip dangerous patterns */
  stripDangerous?: boolean
  /** Validate against SQL injection */
  preventSqlInjection?: boolean
  /** Custom validation pattern */
  customPattern?: RegExp
  /** Custom error message */
  customErrorMessage?: string
}

/**
 * Validation result
 */
export interface ValidationResult {
  /** Whether the input is valid */
  isValid: boolean
  /** Sanitized input value */
  sanitizedValue: string
  /** Error message if invalid */
  errorMessage?: string
  /** Array of issues found */
  issues: string[]
}

/**
 * Rate limiting state
 */
interface RateLimitState {
  requests: number[]
  blocked: boolean
  blockExpiresAt: number
}

/**
 * Rate limiter for search inputs
 */
class SearchRateLimiter {
  private readonly limits = new Map<string, RateLimitState>()
  private readonly config = RATE_LIMIT_CONFIG

  /**
   * Check if a user/IP is rate limited
   */
  isRateLimited(identifier: string): boolean {
    const now = Date.now()
    const state = this.limits.get(identifier) ?? {
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

    // Clean old requests outside the window
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

  /**
   * Record a request
   */
  recordRequest(identifier: string): void {
    const now = Date.now()
    const state = this.limits.get(identifier) ?? {
      requests: [],
      blocked: false,
      blockExpiresAt: 0
    }

    if (!state.blocked) {
      state.requests.push(now)
      this.limits.set(identifier, state)
    }
  }

  /**
   * Get time until unblocked (in seconds)
   */
  getTimeUntilUnblocked(identifier: string): number {
    const state = this.limits.get(identifier)
    if (!state || !state.blocked) {
      return 0
    }

    const now = Date.now()
    return Math.max(0, Math.ceil((state.blockExpiresAt - now) / 1000))
  }

  /**
   * Clear rate limit data
   */
  clear(): void {
    this.limits.clear()
  }
}

// Global rate limiter instance
export const searchRateLimiter = new SearchRateLimiter()

/**
 * Default validation options for search inputs
 */
const DEFAULT_SEARCH_OPTIONS: Required<ValidationOptions> = {
  maxLength: 100,
  minLength: 0,
  allowHtml: false,
  stripDangerous: true,
  preventSqlInjection: true,
  customPattern: /^[\w\s\-_.@#()[\]{}:;,!?'"+=<>/\\|~`^&*%$]*$/,
  customErrorMessage: 'Invalid characters detected in search input'
}

/**
 * Validates and sanitizes search input
 *
 * @param input - The input string to validate
 * @param options - Validation options
 * @returns Validation result with sanitized input
 */
export function validateSearchInput(
  input: string,
  options: ValidationOptions = {}
): ValidationResult {
  const opts = { ...DEFAULT_SEARCH_OPTIONS, ...options }
  const issues: string[] = []
  let sanitizedValue = input

  // Input is guaranteed to be a string by TypeScript

  // Convert to string if needed
  sanitizedValue = String(sanitizedValue).trim()

  // Length validation
  if (sanitizedValue.length > opts.maxLength) {
    issues.push('exceeds_max_length')
    sanitizedValue = sanitizedValue.substring(0, opts.maxLength)
  }

  if (sanitizedValue.length < opts.minLength) {
    return {
      isValid: false,
      sanitizedValue,
      errorMessage: `Input must be at least ${opts.minLength} characters`,
      issues: ['below_min_length']
    }
  }

  // HTML and dangerous pattern detection
  if (opts.stripDangerous) {
    const originalLength = sanitizedValue.length
    sanitizedValue = stripDangerousPatterns(sanitizedValue)

    if (sanitizedValue.length < originalLength) {
      issues.push('dangerous_patterns_removed')
    }
  }

  // HTML validation
  if (!opts.allowHtml && containsHtmlTags(sanitizedValue)) {
    issues.push('html_tags_detected')
    sanitizedValue = stripHtmlTags(sanitizedValue)
  }

  // SQL injection prevention
  if (opts.preventSqlInjection && containsSqlInjection(sanitizedValue)) {
    return {
      isValid: false,
      sanitizedValue: '',
      errorMessage: 'Potentially dangerous SQL patterns detected',
      issues: ['sql_injection_attempt']
    }
  }

  // Custom pattern validation
  if (!opts.customPattern.test(sanitizedValue)) {
    return {
      isValid: false,
      sanitizedValue,
      errorMessage: opts.customErrorMessage,
      issues: ['custom_pattern_failed']
    }
  }

  // Check for obviously malicious patterns
  if (isMaliciousInput(sanitizedValue)) {
    return {
      isValid: false,
      sanitizedValue: '',
      errorMessage: 'Input contains potentially malicious content',
      issues: ['malicious_pattern_detected']
    }
  }

  return {
    isValid: true,
    sanitizedValue,
    issues
  }
}

/**
 * Validates search input with rate limiting
 *
 * @param input - The input string to validate
 * @param userIdentifier - Unique identifier for the user (IP, session ID, etc.)
 * @param options - Validation options
 * @returns Validation result with rate limiting info
 */
export function validateSearchInputWithRateLimit(
  input: string,
  userIdentifier: string,
  options: ValidationOptions = {}
): ValidationResult & { rateLimited: boolean; timeUntilUnblocked: number } {
  // Check rate limit first
  if (searchRateLimiter.isRateLimited(userIdentifier)) {
    return {
      isValid: false,
      sanitizedValue: '',
      errorMessage: 'Too many requests. Please try again later.',
      issues: ['rate_limited'],
      rateLimited: true,
      timeUntilUnblocked: searchRateLimiter.getTimeUntilUnblocked(userIdentifier)
    }
  }

  // Record the request
  searchRateLimiter.recordRequest(userIdentifier)

  // Validate input
  const result = validateSearchInput(input, options)

  return {
    ...result,
    rateLimited: false,
    timeUntilUnblocked: 0
  }
}

/**
 * Strips dangerous HTML and script patterns
 */
function stripDangerousPatterns(input: string): string {
  let sanitized = input

  // Remove dangerous HTML patterns
  for (const pattern of DANGEROUS_HTML_PATTERNS) {
    sanitized = sanitized.replace(pattern, '')
  }

  // Remove dangerous character sequences
  for (const dangerousChar of DANGEROUS_CHARS) {
    sanitized = sanitized.replace(new RegExp(dangerousChar, 'gi'), '')
  }

  return sanitized
}

/**
 * Checks if input contains HTML tags
 */
function containsHtmlTags(input: string): boolean {
  return /<[^>]*>/g.test(input)
}

/**
 * Strips HTML tags from input
 */
function stripHtmlTags(input: string): string {
  return input.replace(/<[^>]*>/g, '')
}

/**
 * Checks for SQL injection patterns
 */
function containsSqlInjection(input: string): boolean {
  return SQL_INJECTION_PATTERNS.some(pattern => pattern.test(input))
}

/**
 * Checks for obviously malicious input patterns
 */
function isMaliciousInput(input: string): boolean {
  const maliciousPatterns = [
    // Base64 encoded scripts
    /data:text\/html;base64/i,
    // Unicode bypasses
    /\\u[\da-f]{4}/gi,
    // Hex encoding
    /\\x[\da-f]{2}/gi,
    // Multiple encoding attempts
    /%[0-9a-f]{2}.*%[0-9a-f]{2}/gi,
    // Suspicious function calls
    /eval\s*\(/gi,
    /exec\s*\(/gi,
    /function\s*\(/gi,
    // File system access attempts
    /\.\.\//g,
    /file:\/\//gi,
    // Network requests
    /fetch\s*\(/gi,
    /XMLHttpRequest/gi
  ]

  return maliciousPatterns.some(pattern => pattern.test(input))
}

/**
 * Sanitizes input for safe display (basic XSS prevention)
 */
export function sanitizeForDisplay(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;')
}

/**
 * Quick validation presets
 */
export const inputValidator = {
  /**
   * Strict validation for search inputs (recommended for production)
   */
  forSearch: (input: string) => validateSearchInput(input, {
    maxLength: 100,
    allowHtml: false,
    stripDangerous: true,
    preventSqlInjection: true
  }),

  /**
   * Lenient validation for user-friendly experiences
   */
  forSearchLenient: (input: string) => validateSearchInput(input, {
    maxLength: 200,
    allowHtml: false,
    stripDangerous: true,
    preventSqlInjection: false
  }),

  /**
   * Strict validation with rate limiting
   */
  forSearchWithRateLimit: (input: string, userIdentifier: string) =>
    validateSearchInputWithRateLimit(input, userIdentifier, {
      maxLength: 100,
      allowHtml: false,
      stripDangerous: true,
      preventSqlInjection: true
    }),

  /**
   * Basic text input validation
   */
  forTextInput: (input: string) => validateSearchInput(input, {
    maxLength: 500,
    allowHtml: false,
    stripDangerous: true,
    preventSqlInjection: false,
    customPattern: /^[\w\s\-_.@#()[\]{}:;,!?'"+=<>/\\|~`^&*%$]*$/
  })
}