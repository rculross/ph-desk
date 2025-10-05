/**
 * Salesforce Integration API Service
 *
 * Provides API access to Salesforce integration configuration data from Planhat.
 * Handles authentication via existing browser session and implements comprehensive
 * error handling with retry logic.
 *
 * @fileVersion 3.1.2
 * @author Claude Code AI Assistant
 */

import type { ApiResponse } from '../../types'
import type {
  SalesforceRawConfiguration,
  SalesforceIntegrationError,
  SalesforceErrorCode,
  SalesforceErrorContext
} from '../../types/integrations/salesforce.types'
import { logSanitizer } from '../../utils/log-sanitizer'
import { logger } from '../../utils/logger'
import { getHttpClient, type RequestOptions } from '../client/http-client'
import { sendValidatedRequest, type ValidatedRequestOptions } from '../request'

import { ensureTenantSlug as ensureSharedTenantSlug } from './tenant.service'

interface ApiRequestOptions extends RequestOptions {
  priority?: 'low' | 'normal' | 'high' | 'critical'
  complexity?: 'simple' | 'moderate' | 'complex' | 'heavy'
}

const log = logger.api

/**
 * Request options for Salesforce integration API calls
 */
export interface SalesforceIntegrationRequestOptions extends ValidatedRequestOptions {
  /** Tenant context for multi-tenant environments */
  tenantSlug?: string
  /** Timeout in milliseconds */
  timeoutMs?: number
}

/**
 * Response wrapper for Salesforce configuration data
 */
export interface SalesforceConfigurationResponse {
  /** Raw configuration data from Planhat API */
  data: SalesforceRawConfiguration | null
  /** Request metadata */
  metadata: {
    requestId: string
    timestamp: number
    cached: boolean
    processingTime: number
    tenantSlug?: string
  }
}

/**
 * Service for Salesforce integration API operations
 *
 * Provides secure access to Salesforce integration configuration data
 * from the Planhat API with comprehensive error handling and logging.
 */
class SalesforceIntegrationService {
  private readonly baseEndpoint = '/integrations/salesforce'
  private readonly requestTimeout = 30000 // 30 seconds

  private get httpClient() {
    return getHttpClient()
  }

  /**
   * Ensure tenant slug is set before making API calls
   */
  private async ensureTenantSlug(): Promise<void> {
    await ensureSharedTenantSlug({ context: 'Salesforce integration API calls', logger: log })
  }

  /**
   * Load Salesforce integration configuration for the current tenant
   *
   * @param options Request options including tenant context
   * @returns Promise resolving to configuration data or null if not found
   * @throws {SalesforceIntegrationError} When API call fails or returns invalid data
   */
  async loadConfiguration(
    options: SalesforceIntegrationRequestOptions = {}
  ): Promise<SalesforceConfigurationResponse> {
    const startTime = performance.now()
    const requestId = this.generateRequestId()

    const {
      tenantSlug,
      timeoutMs = this.requestTimeout,
      ...restOptions
    } = options

    log.info('Loading Salesforce integration configuration', logSanitizer.forApi({
      requestId,
      tenantSlug,
      timeoutMs
    }))

    // Ensure tenant slug is set before making API calls
    await this.ensureTenantSlug()

    try {
      log.debug('Loading Salesforce configuration', logSanitizer.forDebug({
        requestId,
        tenantSlug
      }))

      // Create abort controller for timeout handling
      const controller = new AbortController()
      const timeoutId = setTimeout(() => {
        controller.abort()
        log.warn('Request timeout exceeded', logSanitizer.forApi({ requestId, timeoutMs }))
      }, timeoutMs)

      try {
        // Make API request using HTTP client
        const response = await this.httpClient.get<SalesforceRawConfiguration>(
          this.baseEndpoint,
          undefined,
          {
            metadata: {
              priority: 'high',
              complexity: 'moderate'
            }
          }
        )

        clearTimeout(timeoutId)

        const processingTime = Math.round(performance.now() - startTime)

        // Validate response structure
        if (response && typeof response === 'object') {
          // The API returns the configuration directly, not wrapped in a data field
          const responseData = response

          log.info('Salesforce configuration loaded successfully', logSanitizer.forApi({
            requestId,
            processingTime,
            hasData: !!responseData,
            tenantSlug,
            configVersion: responseData.key || 'unknown'
          }))

          return {
            data: responseData || null,
            metadata: {
              requestId,
              timestamp: Date.now(),
              cached: false, // Direct API call
              processingTime,
              tenantSlug
            }
          }
        }

        // Invalid response structure
        throw this.createIntegrationError(
          'API_ERROR',
          'Invalid response structure from Salesforce integration endpoint',
          {
            operation: 'loadConfiguration',
            tenantSlug,
            configVersion: (response as any)?.key
          },
          logSanitizer.forError({ response, processingTime })
        )

      } catch (apiError) {
        clearTimeout(timeoutId)

        // Handle abort/timeout errors
        if (apiError instanceof Error && apiError.name === 'AbortError') {
          throw this.createIntegrationError(
            'NETWORK_ERROR',
            `Request timeout after ${timeoutMs}ms`,
            { operation: 'loadConfiguration', tenantSlug },
            logSanitizer.forError({ timeoutMs })
          )
        }

        throw apiError
      }

    } catch (error) {
      const processingTime = Math.round(performance.now() - startTime)
      const apiError = error instanceof Error ? error : new Error(String(error))

      log.error('Failed to load Salesforce configuration', logSanitizer.forError({
        requestId,
        error: apiError.message,
        errorCode: this.extractErrorCode(error),
        tenantSlug,
        processingTime
      }))

      // Convert error to standardized integration error
      const finalError = this.createIntegrationError(
        this.determineErrorCode(apiError),
        `Failed to load Salesforce configuration: ${apiError.message}`,
        {
          operation: 'loadConfiguration',
          tenantSlug
        },
        {
          originalError: apiError,
          processingTime
        }
      )

      throw finalError
    }
  }

  /**
   * Test connectivity to Salesforce integration endpoint
   *
   * @param tenantSlug Optional tenant context
   * @returns Promise resolving to connectivity status
   */
  async testConnectivity(tenantSlug?: string): Promise<{
    success: boolean
    responseTime: number
    error?: string
  }> {
    const startTime = performance.now()
    const requestId = this.generateRequestId()

    log.debug('Testing Salesforce integration connectivity', logSanitizer.forDebug({ requestId, tenantSlug }))

    try {
      await this.loadConfiguration({
        tenantSlug,
        timeoutMs: 10000 // Shorter timeout for connectivity test
      })

      const responseTime = Math.round(performance.now() - startTime)

      log.info('Salesforce integration connectivity test successful', logSanitizer.forApi({
        requestId,
        responseTime,
        tenantSlug
      }))

      return {
        success: true,
        responseTime
      }

    } catch (error) {
      const responseTime = Math.round(performance.now() - startTime)
      const errorMessage = error instanceof Error ? error.message : 'Unknown connectivity error'

      log.warn('Salesforce integration connectivity test failed', logSanitizer.forError({
        requestId,
        responseTime,
        error: errorMessage,
        tenantSlug
      }))

      return {
        success: false,
        responseTime,
        error: errorMessage
      }
    }
  }

  /**
   * Generate unique request ID for tracing
   */
  private generateRequestId(): string {
    return `sf_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`
  }

  /**
   * Create standardized integration error
   */
  private createIntegrationError(
    code: SalesforceErrorCode,
    message: string,
    context: SalesforceErrorContext,
    details?: any
  ): SalesforceIntegrationError {
    const error: SalesforceIntegrationError = {
      code,
      message,
      details,
      timestamp: Date.now(),
      retryable: false, // Retry logic is now handled by TanStack Query
      affectedComponent: 'salesforce-integration-service',
      recoveryActions: this.getRecoveryActions(code),
      severity: this.getErrorSeverity(code),
      stackTrace: new Error().stack
    }

    // Add context information (sanitized)
    if (context.tenantSlug) {
      error.details = { ...error.details, tenantSlug: logSanitizer.forError({ tenantSlug: context.tenantSlug }).tenantSlug }
    }

    return error
  }


  /**
   * Extract error code from error object
   */
  private extractErrorCode(error: unknown): string {
    if (error && typeof error === 'object' && 'code' in error) {
      return String((error as any).code)
    }
    return 'UNKNOWN'
  }

  /**
   * Determine appropriate error code from error
   */
  private determineErrorCode(error: Error | null): SalesforceErrorCode {
    if (!error) return 'API_ERROR'

    if (error.message.includes('timeout')) return 'NETWORK_ERROR'
    if (error.message.includes('rate limit')) return 'RATE_LIMIT_ERROR'
    if (error.message.includes('authentication')) return 'AUTHENTICATION_ERROR'
    if (error.message.includes('permission')) return 'PERMISSION_ERROR'
    if (error.name === 'TypeError') return 'NETWORK_ERROR'

    return 'API_ERROR'
  }

  /**
   * Get recovery actions for error code
   */
  private getRecoveryActions(code: SalesforceErrorCode): string[] {
    const recoveryMap: Record<SalesforceErrorCode, string[]> = {
      'CONFIG_NOT_FOUND': ['Check if Salesforce integration is configured', 'Verify tenant permissions'],
      'PROCESSING_ERROR': ['Retry the operation', 'Check data format and size'],
      'API_ERROR': ['Retry after a short delay', 'Check network connectivity'],
      'VALIDATION_ERROR': ['Verify request parameters', 'Check data format'],
      'AUTHENTICATION_ERROR': ['Re-authenticate with Planhat', 'Check session validity'],
      'PERMISSION_ERROR': ['Verify user permissions', 'Contact administrator'],
      'RATE_LIMIT_ERROR': ['Wait before retrying', 'Reduce request frequency'],
      'NETWORK_ERROR': ['Check internet connection', 'Retry after delay'],
      'DATA_CORRUPTION_ERROR': ['Re-fetch the data', 'Contact support'],
      'FIELD_MAPPING_ERROR': ['Check field mapping configuration', 'Verify field types'],
      'SYNC_ERROR': ['Check integration status', 'Retry synchronization']
    }

    return recoveryMap[code] || ['Contact support for assistance']
  }

  /**
   * Get error severity level
   */
  private getErrorSeverity(code: SalesforceErrorCode): 'low' | 'medium' | 'high' | 'critical' {
    const severityMap: Record<SalesforceErrorCode, 'low' | 'medium' | 'high' | 'critical'> = {
      'CONFIG_NOT_FOUND': 'medium',
      'PROCESSING_ERROR': 'medium',
      'API_ERROR': 'medium',
      'VALIDATION_ERROR': 'low',
      'AUTHENTICATION_ERROR': 'high',
      'PERMISSION_ERROR': 'high',
      'RATE_LIMIT_ERROR': 'low',
      'NETWORK_ERROR': 'medium',
      'DATA_CORRUPTION_ERROR': 'critical',
      'FIELD_MAPPING_ERROR': 'medium',
      'SYNC_ERROR': 'high'
    }

    return severityMap[code] || 'medium'
  }

}

// Export singleton instance
export const salesforceIntegrationService = new SalesforceIntegrationService()

// Export class for advanced usage
export { SalesforceIntegrationService }