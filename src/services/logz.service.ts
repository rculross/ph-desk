/**
 * Logz API Service
 *
 * Service for interacting with the Planhat /logs endpoint with proper
 * parameter validation, entity resolution, and constraint enforcement.
 */

import { differenceInDays, parseISO } from 'date-fns'

import { getHttpClient, getTenantSlug } from '../api/client/http-client'
import { sendValidatedRequest } from '../api/request'
import { ensureTenantSlug as ensureSharedTenantSlug } from '../api/services/tenant.service'
import type {
  LogsApiParams,
  RawLogEntry,
  ParsedLogEntry,
  UserEntity,
  CompanyEntity,
  LogsFilterState,
  PaginationState,
  DateRangeValidation,
  LogzError
} from '../types/logz.types'
import { LOGZ_CONSTRAINTS } from '../types/logz.types'
import { logger } from '../utils/logger'

const log = logger.api

/**
 * Validate date range for Logz API constraints
 */
export function validateDateRange(startDate: string, endDate: string): DateRangeValidation {
  try {
    const start = parseISO(startDate)
    const end = parseISO(endDate)
    const daysDiff = differenceInDays(end, start)

    if (daysDiff > LOGZ_CONSTRAINTS.MAX_DATE_RANGE_DAYS) {
      return {
        isValid: false,
        error: `Date range cannot exceed ${LOGZ_CONSTRAINTS.MAX_DATE_RANGE_DAYS} days. Current range: ${daysDiff} days.`
      }
    }

    if (daysDiff < 0) {
      return {
        isValid: false,
        error: 'Start date cannot be after end date.'
      }
    }

    return { isValid: true }
  } catch (error) {
    return {
      isValid: false,
      error: 'Invalid date format. Please use YYYY-MM-DD format.'
    }
  }
}

/**
 * Transform date string to API format (ISO-8601 UTC)
 *
 * CRITICAL: This transformation is required for partition date parameters.
 * The Planhat Logs API mandates partition dates in this exact ISO-8601 UTC format.
 */
export function transformDateToApiFormat(dateString: string): string {
  // Input: "2023-01-01" (YYYY-MM-DD)
  // Output: "2023-01-01T05:00:00.000Z" (ISO-8601 UTC)
  return `${dateString}T05:00:00.000Z`
}

/**
 * Build CSV parameter from array of values
 */
export function buildCsvParam(values: string[]): string | undefined {
  const filtered = values.filter(Boolean)
  return filtered.length > 0 ? filtered.join(',') : undefined
}

/**
 * Transform filter state to API parameters
 */
export function transformFiltersToApiParams(
  filters: LogsFilterState,
  pagination: PaginationState
): LogsApiParams {
  // Validate date range
  const validation = validateDateRange(filters.dateRange.startDate, filters.dateRange.endDate)
  if (!validation.isValid) {
    throw new Error(validation.error)
  }

  // Build API parameters
  // CRITICAL: partitionDateFrom and partitionDateTo are REQUIRED parameters
  // The Planhat Logs API will fail without these date range parameters
  // They must be in ISO-8601 UTC format (e.g., '2023-01-01T05:00:00.000Z')
  const params: LogsApiParams = {
    partitionDateFrom: transformDateToApiFormat(filters.dateRange.startDate),
    partitionDateTo: transformDateToApiFormat(filters.dateRange.endDate),
    limit: Math.min(pagination.recordsPerPull, LOGZ_CONSTRAINTS.MAX_RECORDS_PER_REQUEST),
    offset: pagination.currentOffset,
    // CRITICAL: tzOffset is REQUIRED by Planhat, even if 0
    // This represents the timezone offset from UTC in hours
    tzOffset: (new Date().getTimezoneOffset() * -1) / 60 // Convert to hours format that Planhat expects
  }

  // Add optional filters
  if (filters.models.length > 0) {
    params.model = filters.models[0] // API only supports single model
  }

  if (filters.operations.length > 0) {
    // CRITICAL: Must be lowercase
    params.operation = buildCsvParam(filters.operations.map(op => op.toLowerCase()))
  }

  if (filters.actorTypes.length > 0) {
    // CRITICAL: Must be lowercase
    params.actorType = buildCsvParam(filters.actorTypes.map(type => type.toLowerCase()))
  }

  if (filters.entityId.trim()) {
    params.entityId = filters.entityId.trim()
  }

  log.debug('Transformed filters to API params', { filters, params })

  return params
}

/**
 * Build logs URL with EXACT parameter order required by Planhat API
 *
 * CRITICAL REQUIREMENTS - DO NOT CHANGE:
 * Planhat is VERY specific about parameter order for /logs endpoint.
 * The parameters MUST be in this EXACT order or the API will fail:
 *
 * REQUIRED (must always be present):
 * 1. model (if specified)
 * 2. operation (if specified)
 * 3. actorType (if specified)
 * 4. partitionDateFrom (ALWAYS REQUIRED)
 * 5. partitionDateTo (ALWAYS REQUIRED)
 * 6. offset (ALWAYS REQUIRED)
 * 7. tzOffset (ALWAYS REQUIRED - timezone offset)
 * 8. tenantSlug (ALWAYS REQUIRED)
 *
 * Examples from Planhat documentation:
 * Minimal: https://api.planhat.com/logs?partitionDateFrom=2025-09-13T05%3A00%3A00.000Z&partitionDateTo=2025-09-21T04%3A59%3A59.999Z&offset=0&tzOffset=-0&tenantSlug=planhat
 * Full: https://api.planhat.com/logs?model=Company&operation=created%2Cupdated&actorType=user%2ChiddenUser&partitionDateFrom=2025-09-13T05%3A00%3A00.000Z&partitionDateTo=2025-09-21T04%3A59%3A59.999Z&offset=0&tzOffset=0&tenantSlug=planhat
 */
export function buildLogsUrl(apiParams: LogsApiParams, tenantSlug: string): string {
  // WARNING: DO NOT USE URLSearchParams - it does not guarantee parameter order!
  // We must manually build the query string to ensure exact parameter order

  const urlParts: string[] = []

  // 1. model (optional, but must be first if present)
  if (apiParams.model) {
    urlParts.push(`model=${encodeURIComponent(apiParams.model)}`)
  }

  // 2. operation (optional, but must be second if present)
  if (apiParams.operation) {
    urlParts.push(`operation=${encodeURIComponent(apiParams.operation)}`)
  }

  // 3. actorType (optional, but must be third if present)
  if (apiParams.actorType) {
    urlParts.push(`actorType=${encodeURIComponent(apiParams.actorType)}`)
  }

  // 4. partitionDateFrom (ALWAYS REQUIRED - must be fourth)
  urlParts.push(`partitionDateFrom=${encodeURIComponent(apiParams.partitionDateFrom)}`)

  // 5. partitionDateTo (ALWAYS REQUIRED - must be fifth)
  urlParts.push(`partitionDateTo=${encodeURIComponent(apiParams.partitionDateTo)}`)

  // 6. offset (ALWAYS REQUIRED - must be sixth)
  urlParts.push(`offset=${apiParams.offset}`)

  // 7. tzOffset (ALWAYS REQUIRED - must be seventh)
  // Note: Planhat expects tzOffset parameter even if 0
  const tzOffset = apiParams.tzOffset || 0
  urlParts.push(`tzOffset=${tzOffset}`)

  // 8. tenantSlug (ALWAYS REQUIRED - must be last)
  urlParts.push(`tenantSlug=${encodeURIComponent(tenantSlug)}`)

  // Additional optional parameters (entityId, limit) would go after the required ones
  if (apiParams.entityId) {
    urlParts.push(`entityId=${encodeURIComponent(apiParams.entityId)}`)
  }

  if (apiParams.limit) {
    urlParts.push(`limit=${apiParams.limit}`)
  }

  const queryString = urlParts.join('&')
  return `/logs?${queryString}`
}

/**
 * Generate a unique ID for a log entry
 */
function generateLogId(log: RawLogEntry): string {
  const timestamp = typeof log.timestamp === 'object' ? log.timestamp.value : log.timestamp
  const hash = btoa(`${log.eventId || ''}_${timestamp}_${log.model}_${log.operation}`).slice(0, 8)
  return `log_${timestamp.replace(/[^\d]/g, '').slice(-10)}_${hash}`
}

/**
 * Resolve actor display name from log entry and cached user
 */
export function resolveActorDisplay(log: RawLogEntry, resolvedUser?: UserEntity): string {
  // 1. If user actor with valid ID, use resolved user name
  if (log.actorId && log.actorType === 'user' && resolvedUser) {
    if (resolvedUser.firstName && resolvedUser.lastName) {
      return `${resolvedUser.firstName} ${resolvedUser.lastName}`.trim()
    } else if (resolvedUser.name) {
      return resolvedUser.name
    } else if (resolvedUser.email) {
      return resolvedUser.email
    } else {
      return log.actorId
    }
  }

  // 2. If no actorId or actorId is "null", use actorType
  if (!log.actorId || log.actorId === 'null') {
    return log.actorType
  }

  // 3. Use context actor name if available and not "Unknown"
  try {
    const parsedContext = JSON.parse(log.context || '{}')
    if (parsedContext.actor?.name && parsedContext.actor.name !== 'Unknown') {
      return parsedContext.actor.name
    }
  } catch {
    // Ignore JSON parse errors
  }

  // 4. Fallback to actorType
  return log.actorType
}

/**
 * Resolve company display from log entry and cached companies
 */
export function resolveCompanyDisplay(
  log: RawLogEntry,
  resolvedCompanies: Map<string, CompanyEntity>
): {
  companyDisplay: string
  companyIds: string[]
  companyNames: string[]
} {
  // Handle multiple company IDs (especially for Issue model)
  if (log.companyId) {
    const companyIds = log.companyId.split(',').map(id => id.trim()).filter(Boolean)

    if (companyIds.length > 0) {
      const companyNames = companyIds.map(id => {
        const company = resolvedCompanies.get(id)
        return company ? company.name : id
      })

      // Special formatting for Issue model with multiple companies
      let displayName: string
      if (log.model === 'Issue' && companyIds.length > 1) {
        displayName = `${companyNames[0] || 'Unknown'} +${companyNames.length - 1} more`
      } else {
        displayName = companyNames[0] || 'Unknown'
      }

      return {
        companyDisplay: displayName,
        companyIds,
        companyNames
      }
    }
  }

  // Fallback to context or "Unknown"
  try {
    const parsedContext = JSON.parse(log.context || '{}')
    if (parsedContext.companyName) {
      return {
        companyDisplay: parsedContext.companyName,
        companyIds: [],
        companyNames: [parsedContext.companyName]
      }
    }
  } catch {
    // Ignore JSON parse errors
  }

  return {
    companyDisplay: 'Unknown',
    companyIds: [],
    companyNames: ['Unknown']
  }
}

/**
 * Transform raw log entry to parsed log entry
 */
export function transformLogWithResolution(
  log: RawLogEntry,
  userMap: Map<string, UserEntity>,
  companyMap: Map<string, CompanyEntity>
): ParsedLogEntry {
  const timestamp = typeof log.timestamp === 'object' ? log.timestamp.value : log.timestamp
  const resolvedUser = log.actorId && log.actorType === 'user' ? userMap.get(log.actorId) : undefined
  const companyResolution = resolveCompanyDisplay(log, companyMap)

  let parsedContext = null
  try {
    parsedContext = log.context ? JSON.parse(log.context) : null
  } catch {
    // Ignore JSON parse errors
  }

  return {
    id: generateLogId(log),
    time: timestamp,
    model: log.model,
    operation: log.operation,
    actorDisplay: resolveActorDisplay(log, resolvedUser),
    companyDisplay: companyResolution.companyDisplay,
    entityId: log.entityId || '',
    companyIds: companyResolution.companyIds,
    companyNames: companyResolution.companyNames,
    parsedContext,

    // Legacy compatibility fields
    objectType: log.model,
    actor: log.actorId || log.actorType,
    company: companyResolution.companyIds[0] || companyResolution.companyDisplay,
    action: log.operation,

    _raw: log
  }
}

/**
 * Batch resolve users by IDs
 */
export async function batchResolveUsers(userIds: string[]): Promise<Map<string, UserEntity>> {
  const userMap = new Map<string, UserEntity>()

  if (userIds.length === 0) {
    return userMap
  }

  try {
    log.debug('Batch resolving users', { count: userIds.length })

    const client = getHttpClient()

    const users = await sendValidatedRequest<UserEntity[]>(
      'get',
      `/endusers?select=firstName,lastName,name,email&_id=${userIds.join(',')}`,
      undefined,
      {
        clientType: 'http'
      },
      client
    )

    users.forEach(user => {
      userMap.set(user._id, user)
    })

    log.debug('Users resolved', { requested: userIds.length, resolved: users.length })
  } catch (error) {
    log.error('Failed to resolve users', { error, userIds })
  }

  return userMap
}

/**
 * Batch resolve companies by IDs
 */
export async function batchResolveCompanies(companyIds: string[]): Promise<Map<string, CompanyEntity>> {
  const companyMap = new Map<string, CompanyEntity>()

  if (companyIds.length === 0) {
    return companyMap
  }

  try {
    log.debug('Batch resolving companies', { count: companyIds.length })

    const client = getHttpClient()
    const tenantSlug = getTenantSlug()

    if (!tenantSlug) {
      throw new Error('Tenant slug is required for companies API')
    }

    const companies = await sendValidatedRequest<CompanyEntity[]>(
      'get',
      `/companies?select=name,_id&limit=2000&offset=0&tenantslug=${encodeURIComponent(tenantSlug)}`,
      undefined,
      {
        clientType: 'http'
      },
      client
    )

    // Filter to only include companies that were requested
    const requestedCompanyIds = new Set(companyIds)
    companies
      .filter(company => requestedCompanyIds.has(company._id))
      .forEach(company => {
        companyMap.set(company._id, company)
      })

    log.debug('Companies resolved', { requested: companyIds.length, resolved: companyMap.size })
  } catch (error) {
    log.error('Failed to resolve companies', { error, companyIds })
  }

  return companyMap
}

/**
 * Ensure tenant slug is set before making API calls
 */
async function ensureTenantSlug(): Promise<void> {
  await ensureSharedTenantSlug({
    context: 'logz API calls',
    logger: log,
    failureLogLevel: 'error'
  })
}

/**
 * Fetch logs with batch entity resolution
 */
export async function fetchLogsWithResolution(
  filters: LogsFilterState,
  pagination: PaginationState
): Promise<ParsedLogEntry[]> {
  try {
    log.info('Fetching logs with resolution', { filters, pagination })

    // Ensure tenant slug is set before making API calls
    await ensureTenantSlug()

    // Transform filters to API parameters
    const apiParams = transformFiltersToApiParams(filters, pagination)

    // Get tenant slug - REQUIRED for Planhat logs API
    const tenantSlug = getTenantSlug()
    if (!tenantSlug) {
      throw new Error('Tenant slug is required for logs API. Please ensure you are logged into Planhat.')
    }

    // 1. Build the properly ordered logs URL
    // CRITICAL: Planhat requires exact parameter order for /logs endpoint
    const logsUrl = buildLogsUrl(apiParams, tenantSlug)

    log.debug('Built logs URL with correct parameter order', {
      url: logsUrl,
      tenantSlug,
      apiParams
    })

    // 2. Fetch raw logs from API
    // CRITICAL: Using our custom URL builder that maintains exact parameter order
    // DO NOT use URLSearchParams or modify the buildLogsUrl function!
    const client = getHttpClient()

    const rawLogs = await sendValidatedRequest<RawLogEntry[]>(
      'get',
      logsUrl,
      undefined,
      {
        endpoint: 'logs',
        priority: 'normal',
        complexity: 'moderate',
        skipRequestValidation: true,
        skipResponseValidation: true,
        clientType: 'http'
      },
      client
    )

    if (!Array.isArray(rawLogs)) {
      throw new Error('Invalid response format: expected array of logs')
    }

    log.info('Raw logs fetched', { count: rawLogs.length })

    // 3. Collect unique entity IDs for batch resolution
    const companyIds = new Set<string>()
    const userIds = new Set<string>()

    rawLogs.forEach(log => {
      if (log.companyId) {
        log.companyId.split(',').forEach(id => companyIds.add(id.trim()))
      }
      if (log.actorId && log.actorType === 'user') {
        userIds.add(log.actorId)
      }
    })

    // 4. Batch resolve entities (maximum 2 API calls)
    const [companyMap, userMap] = await Promise.all([
      batchResolveCompanies(Array.from(companyIds)),
      batchResolveUsers(Array.from(userIds))
    ])

    // 5. Transform and resolve all logs
    const parsedLogs = rawLogs.map(log => transformLogWithResolution(log, userMap, companyMap))

    log.info('Logs transformed and resolved', {
      rawCount: rawLogs.length,
      parsedCount: parsedLogs.length,
      usersResolved: userMap.size,
      companiesResolved: companyMap.size
    })

    return parsedLogs
  } catch (error) {
    log.error('Failed to fetch logs with resolution', { error, filters, pagination })
    throw error
  }
}

/**
 * Logz API Service Class
 */
export class LogzService {
  /**
   * Fetch logs with filters and pagination
   */
  static async fetchLogs(
    filters: LogsFilterState,
    pagination: PaginationState
  ): Promise<ParsedLogEntry[]> {
    return fetchLogsWithResolution(filters, pagination)
  }

  /**
   * Validate filters before API call
   */
  static validateFilters(filters: LogsFilterState): LogzError | null {
    const validation = validateDateRange(filters.dateRange.startDate, filters.dateRange.endDate)

    if (!validation.isValid) {
      return {
        code: 'INVALID_DATE_RANGE',
        message: validation.error!,
        retryable: false
      }
    }

    return null
  }
}