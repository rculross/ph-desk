/**
 * Log Sanitization Utility
 *
 * Provides secure sanitization of log data to prevent sensitive information
 * from being exposed in logs. Masks or removes PII, credentials, and other
 * sensitive data while preserving debugging utility.
 *
 * @fileVersion 3.1.2
 * @author Claude Code AI Assistant
 */

/**
 * Sensitive field patterns that should be masked or removed
 */
const SENSITIVE_FIELD_PATTERNS = [
  // User identifiers
  /user.*id/i,
  /.*user.*id/i,
  /userId/i,
  /uid/i,

  // Email addresses
  /email/i,
  /.*email.*/i,
  /mail/i,

  // Authentication tokens
  /token/i,
  /auth/i,
  /key/i,
  /secret/i,
  /password/i,
  /pwd/i,
  /credential/i,

  // Session data
  /session/i,
  /cookie/i,

  // Tenant/organization data
  /tenant.*slug/i,
  /org.*id/i,
  /organization/i,

  // API keys and URLs
  /api.*key/i,
  /access.*token/i,
  /refresh.*token/i,
  /instance.*url/i,

  // Personal data
  /name/i,
  /phone/i,
  /address/i,
  /ssn/i,
  /social.*security/i,

  // Salesforce specific
  /oauth/i,
  /sf.*token/i,
  /salesforce.*id/i,
  /sf.*id/i
]

/**
 * Fields that should be completely removed from logs
 */
const EXCLUDE_FIELDS = [
  'password',
  'pwd',
  'secret',
  'token',
  'access_token',
  'refresh_token',
  'api_key',
  'apikey',
  'oauth',
  'credential',
  'authorization'
]

/**
 * Email regex pattern
 */
const EMAIL_REGEX = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g

/**
 * URL regex pattern for instance URLs and API endpoints
 */
const URL_REGEX = /https?:\/\/[^\s<>"'{}|\\^`[\]]+/g

/**
 * Tenant slug pattern (alphanumeric with hyphens)
 */
const TENANT_SLUG_REGEX = /\b[a-z0-9-]+\.(planhat|planhatdemo)\.com\b/gi

/**
 * UUID pattern
 */
const UUID_REGEX = /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi

/**
 * Options for log sanitization
 */
export interface LogSanitizerOptions {
  /** Mask sensitive values instead of removing them */
  maskInsteadOfRemove?: boolean
  /** Custom mask character */
  maskChar?: string
  /** Number of characters to show when masking */
  showLastChars?: number
  /** Additional field patterns to sanitize */
  customSensitivePatterns?: RegExp[]
  /** Fields to exclude completely */
  customExcludeFields?: string[]
}

/**
 * Default sanitization options
 */
const DEFAULT_OPTIONS: Required<LogSanitizerOptions> = {
  maskInsteadOfRemove: true,
  maskChar: '*',
  showLastChars: 4,
  customSensitivePatterns: [],
  customExcludeFields: []
}

/**
 * Sanitizes log data by removing or masking sensitive information
 *
 * @param data - The data object to sanitize
 * @param options - Sanitization options
 * @returns Sanitized data safe for logging
 */
export function sanitizeLogData(
  data: any,
  options: LogSanitizerOptions = {}
): any {
  const opts = { ...DEFAULT_OPTIONS, ...options }

  return sanitizeValue(data, opts, new Set())
}

/**
 * Recursively sanitizes a value
 */
function sanitizeValue(
  value: any,
  options: Required<LogSanitizerOptions>,
  visited: Set<any>
): any {
  // Prevent circular references
  if (value && typeof value === 'object' && visited.has(value)) {
    return '[Circular Reference]'
  }

  // Handle null/undefined
  if (value == null) {
    return value
  }

  // Handle primitives
  if (typeof value !== 'object') {
    return sanitizeString(String(value), options)
  }

  // Add to visited set
  if (typeof value === 'object') {
    visited.add(value)
  }

  // Handle arrays
  if (Array.isArray(value)) {
    return value.map(item => sanitizeValue(item, options, visited))
  }

  // Handle Error objects
  if (value instanceof Error) {
    return {
      name: value.name,
      message: sanitizeString(value.message, options),
      // Don't include stack trace as it might contain sensitive paths
      stack: '[REDACTED]'
    }
  }

  // Handle Date objects
  if (value instanceof Date) {
    return value.toISOString()
  }

  // Handle regular objects
  const sanitized: any = {}

  for (const [key, val] of Object.entries(value)) {
    const keyLower = key.toLowerCase()

    // Check if field should be excluded completely
    if (shouldExcludeField(key, options)) {
      continue
    }

    // Check if field is sensitive and should be masked/sanitized
    if (isSensitiveField(key, options)) {
      sanitized[key] = maskValue(val, options)
    } else {
      sanitized[key] = sanitizeValue(val, options, visited)
    }
  }

  return sanitized
}

/**
 * Checks if a field should be completely excluded
 */
function shouldExcludeField(
  fieldName: string,
  options: Required<LogSanitizerOptions>
): boolean {
  const fieldLower = fieldName.toLowerCase()

  // Check default exclude list
  if (EXCLUDE_FIELDS.includes(fieldLower)) {
    return true
  }

  // Check custom exclude list
  if (options.customExcludeFields.some(field =>
    fieldLower.includes(field.toLowerCase())
  )) {
    return true
  }

  return false
}

/**
 * Checks if a field is sensitive and should be sanitized
 */
function isSensitiveField(
  fieldName: string,
  options: Required<LogSanitizerOptions>
): boolean {
  // Check default patterns
  if (SENSITIVE_FIELD_PATTERNS.some(pattern => pattern.test(fieldName))) {
    return true
  }

  // Check custom patterns
  if (options.customSensitivePatterns.some(pattern => pattern.test(fieldName))) {
    return true
  }

  return false
}

/**
 * Masks a sensitive value
 */
function maskValue(
  value: any,
  options: Required<LogSanitizerOptions>
): string {
  if (value == null) {
    return String(value)
  }

  const str = String(value)

  if (str.length === 0) {
    return str
  }

  if (options.maskInsteadOfRemove) {
    // Show last few characters, mask the rest
    if (str.length <= options.showLastChars) {
      return options.maskChar.repeat(str.length)
    }

    const maskedLength = str.length - options.showLastChars
    const lastChars = str.slice(-options.showLastChars)
    return options.maskChar.repeat(maskedLength) + lastChars
  }

  return '[REDACTED]'
}

/**
 * Sanitizes strings for sensitive patterns
 */
function sanitizeString(
  str: string,
  options: Required<LogSanitizerOptions>
): string {
  let sanitized = str

  // Mask emails
  sanitized = sanitized.replace(EMAIL_REGEX, (match) =>
    maskEmailAddress(match, options)
  )

  // Mask URLs but preserve domain structure for debugging
  sanitized = sanitized.replace(URL_REGEX, (match) =>
    maskUrl(match, options)
  )

  // Mask tenant slugs
  sanitized = sanitized.replace(TENANT_SLUG_REGEX, (match) =>
    maskTenantSlug(match, options)
  )

  // Mask UUIDs partially (keep first 8 chars for correlation)
  sanitized = sanitized.replace(UUID_REGEX, (match) =>
    `${match.substring(0, 8)}-${options.maskChar.repeat(28)}`
  )

  return sanitized
}

/**
 * Masks email address while preserving domain for debugging
 */
function maskEmailAddress(
  email: string,
  options: Required<LogSanitizerOptions>
): string {
  const [local, domain] = email.split('@')
  if (!local || !domain) {
    return maskValue(email, options)
  }

  const maskedLocal = local.length > 2
    ? local[0] + options.maskChar.repeat(local.length - 2) + local[local.length - 1]
    : options.maskChar.repeat(local.length)

  return `${maskedLocal}@${domain}`
}

/**
 * Masks URL while preserving structure for debugging
 */
function maskUrl(
  url: string,
  options: Required<LogSanitizerOptions>
): string {
  try {
    const parsed = new URL(url)

    // Keep protocol and domain for debugging, mask path
    let maskedUrl = `${parsed.protocol}//${parsed.host}`

    if (parsed.pathname && parsed.pathname !== '/') {
      maskedUrl += `/${options.maskChar.repeat(8)}`
    }

    if (parsed.search) {
      maskedUrl += `?${options.maskChar.repeat(6)}`
    }

    return maskedUrl
  } catch {
    // If URL parsing fails, just mask the whole thing
    return maskValue(url, options)
  }
}

/**
 * Masks tenant slug while preserving environment info
 */
function maskTenantSlug(
  slug: string,
  options: Required<LogSanitizerOptions>
): string {
  const parts = slug.split('.')
  if (parts.length >= 2) {
    // Mask the tenant part, keep the domain
    const maskedTenant = options.maskChar.repeat(8)
    return [maskedTenant, ...parts.slice(1)].join('.')
  }

  return maskValue(slug, options)
}

/**
 * Quick sanitization for common log scenarios
 */
export const logSanitizer = {
  /**
   * Sanitize for API logs (more permissive, keeps structure)
   */
  forApi: (data: any) => sanitizeLogData(data, {
    maskInsteadOfRemove: true,
    showLastChars: 4,
    customSensitivePatterns: [/configVersion/i] // Keep config versions masked but trackable
  }),

  /**
   * Sanitize for error logs (more restrictive)
   */
  forError: (data: any) => sanitizeLogData(data, {
    maskInsteadOfRemove: false, // Completely remove sensitive data
    customExcludeFields: ['response', 'request', 'data']
  }),

  /**
   * Sanitize for search logs (very restrictive on user input)
   */
  forSearch: (data: any) => sanitizeLogData(data, {
    maskInsteadOfRemove: true,
    showLastChars: 2, // Show less characters
    customSensitivePatterns: [/term/i, /searchTerm/i, /query/i]
  }),

  /**
   * Sanitize for debug logs (balanced approach)
   */
  forDebug: (data: any) => sanitizeLogData(data, {
    maskInsteadOfRemove: true,
    showLastChars: 6 // Show more characters for debugging
  })
}