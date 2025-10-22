import type { AxiosInstance, AxiosRequestConfig, Method } from 'axios'
import type { z } from 'zod'

import { logger } from '../utils/logger'

import { getHttpClient } from './client/http-client'
import { validateRequest, validateResponse } from './validation'
// RequestPriority type simplified

const log = logger.api

const MAX_PAYLOAD_SIZE = 10 * 1024 * 1024 // 10MB

export interface ValidatedRequestOptions {
  requestSchema?: z.ZodSchema<any>
  responseSchema?: z.ZodSchema<any>
  endpoint?: string
  skipRequestValidation?: boolean
  skipResponseValidation?: boolean
  priority?: 'low' | 'normal' | 'high' | 'critical'
  complexity?: 'simple' | 'moderate' | 'complex' | 'heavy'
  skipRateLimit?: boolean
  /** Force use of specific client type (legacy option) */
  clientType?: 'http'
}

interface RequestMetrics {
  requestId: string
  startedAt: number
}

const CLIENT_VERSION_HEADER = '3.1.161'

function generateRequestId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }

  return `req_${Math.random().toString(36).slice(2, 10)}`
}

function getAxiosInstance(client?: any, clientType?: 'http'): AxiosInstance {
  // If specific client instance is provided, use it
  if (client) {
    if (client.axiosInstance) {
      return client.axiosInstance as AxiosInstance
    }
    if (client.api?.axiosInstance) {
      return client.api.axiosInstance as AxiosInstance
    }
    if (client.getAxiosInstance) {
      return client.getAxiosInstance() as AxiosInstance
    }
  }

  // Always use HTTP client
  const httpClient = getHttpClient()
  return httpClient.getAxiosInstance()
}

function beginRequest(method: Method, endpoint: string): RequestMetrics {
  const requestId = generateRequestId()
  const startedAt = Date.now()

  if (!endpoint.includes('/myprofile')) {
    log.debug(`Initiating API request: ${method} ${endpoint} (ID: ${requestId})`)
  }

  return { requestId, startedAt }
}

function completeRequest(
  method: Method,
  endpoint: string,
  metrics: RequestMetrics,
  status: number
): void {
  if (endpoint.includes('/myprofile')) {
    return
  }

  const duration = Date.now() - metrics.startedAt
  log.debug(`API request completed: ${method} ${endpoint} - ${status} in ${duration}ms`)
}

function handleError(method: Method, endpoint: string, metrics: RequestMetrics, error: unknown): never {
  const duration = Date.now() - metrics.startedAt
  const status = (error as any)?.response?.status

  const isConnectivityCheck =
    endpoint.includes('/myprofile') && (status === 400 || status === 401)

  if (!isConnectivityCheck) {
    log.error(
      `API request failed: ${method} ${endpoint} - ${status ?? 'Network Error'} in ${duration}ms`,
      error
    )
  }

  throw error
}

export async function sendValidatedRequest<T = any>(
  method: Method,
  endpoint: string,
  data?: any,
  options?: ValidatedRequestOptions,
  client?: any
): Promise<T> {
  const {
    requestSchema,
    responseSchema,
    skipRequestValidation = false,
    skipResponseValidation = false,
    priority = 'normal',
    complexity = 'simple',
    skipRateLimit = false,
    clientType
  } = options ?? {}

  let payload = data

  if (requestSchema && !skipRequestValidation && data !== undefined) {
    const validation = validateRequest(requestSchema, data, `${method} ${endpoint}`)

    if (!validation.success) {
      throw validation.error
    }

    payload = validation.data
  }

  if (payload && ['post', 'put', 'patch'].includes(method.toLowerCase())) {
    const payloadSize = new Blob([JSON.stringify(payload)]).size
    if (payloadSize > MAX_PAYLOAD_SIZE) {
      throw new Error(
        `Payload size (${payloadSize} bytes) exceeds maximum allowed size (${MAX_PAYLOAD_SIZE} bytes)`
      )
    }
  }

  const metrics = beginRequest(method, endpoint)

  try {
    const axiosInstance = getAxiosInstance(client, clientType)

    const headers: AxiosRequestConfig['headers'] = {
      Accept: 'application/json',
      'X-Request-ID': metrics.requestId,
      'X-Client-Version': CLIENT_VERSION_HEADER
    }

    if (payload && ['post', 'put', 'patch'].includes(method.toLowerCase())) {
      headers['Content-Type'] = 'application/json'
    }

    const axiosConfig: AxiosRequestConfig = {
      method,
      url: endpoint,
      headers
    }

    if (payload !== undefined) {
      if (method.toLowerCase() === 'get') {
        axiosConfig.params = payload
      } else {
        axiosConfig.data = payload
      }
    }

    (axiosConfig as any).metadata = {
      priority,
      complexity,
      skipRateLimit
    }

    const response = await axiosInstance.request<T>(axiosConfig)

    completeRequest(method, endpoint, metrics, response.status ?? 200)

    let responseData = response.data

    if (responseSchema && !skipResponseValidation && responseData !== undefined) {
      const validation = validateResponse(responseSchema, responseData, `${method} ${endpoint}`)

      if (!validation.success) {
        throw validation.error
      }

      responseData = validation.data as T
    }

    return responseData
  } catch (error) {
    handleError(method, endpoint, metrics, error)
  }
}

export async function sendRawRequest<T = any>(
  method: Method,
  endpoint: string,
  data?: any,
  client?: any
): Promise<T> {
  return sendValidatedRequest<T>(method, endpoint, data, {
    skipRequestValidation: true,
    skipResponseValidation: true
  }, client)
}

