/**
 * Entity Resolution Hook
 *
 * Custom hook for batch resolving and caching users and companies
 * from parsed log entries.
 */

import { useCallback } from 'react'

import { getHttpClient, getTenantSlug } from '../api/client/http-client'
import { sendValidatedRequest } from '../api/request'
import { useLogzActions } from '../stores/logz.store'
import type { UserEntity, CompanyEntity, ParsedLogEntry } from '../types/logz.types'
import { logger } from '../utils/logger'

const log = logger.api

/**
 * Hook for entity resolution with caching
 */
export function useEntityResolution() {
  const {
    cacheUser,
    cacheCompany,
    getCachedUser,
    getCachedCompany
  } = useLogzActions()

  // Get current tenant slug for cache keys
  const tenantSlug = getTenantSlug()

  /**
   * Batch resolve users by IDs with caching
   */
  const batchResolveUsers = useCallback(async (userIds: string[]): Promise<Map<string, UserEntity | null>> => {
    const userMap = new Map<string, UserEntity | null>()
    const uncachedUserIds: string[] = []

    if (!tenantSlug) {
      log.error('Cannot resolve users: no tenant slug available')
      return userMap
    }

    // Check cache first
    userIds.forEach(userId => {
      const cached = getCachedUser(tenantSlug, userId)
      if (cached !== undefined) {
        userMap.set(userId, cached)
      } else {
        uncachedUserIds.push(userId)
      }
    })

    // Fetch uncached users if any
    if (uncachedUserIds.length > 0) {
      try {
        log.debug('Batch resolving uncached users', { count: uncachedUserIds.length })

        const client = getHttpClient()

        const users = await sendValidatedRequest<UserEntity[]>(
          'get',
          `/endusers?select=firstName,lastName,name,email&_id=${uncachedUserIds.join(',')}`,
          undefined,
          undefined,
          client
        )

        // Cache resolved users
        const resolvedUserIds = new Set(users.map(user => user._id))

        users.forEach(user => {
          userMap.set(user._id, user)
          cacheUser(tenantSlug, user._id, user)
        })

        // Cache null for users that weren't found
        uncachedUserIds.forEach(userId => {
          if (!resolvedUserIds.has(userId)) {
            userMap.set(userId, null)
            cacheUser(tenantSlug, userId, null)
          }
        })

        log.debug('Users resolved and cached', {
          requested: uncachedUserIds.length,
          resolved: users.length,
          cached: userIds.length - uncachedUserIds.length
        })
      } catch (error) {
        log.error('Failed to resolve users', { error, userIds: uncachedUserIds })

        // Cache null for failed requests to avoid retrying
        uncachedUserIds.forEach(userId => {
          userMap.set(userId, null)
          cacheUser(tenantSlug, userId, null)
        })
      }
    }

    return userMap
  }, [tenantSlug, getCachedUser, cacheUser])

  /**
   * Batch resolve companies by IDs with caching
   */
  const batchResolveCompanies = useCallback(async (companyIds: string[]): Promise<Map<string, CompanyEntity | null>> => {
    const companyMap = new Map<string, CompanyEntity | null>()
    const uncachedCompanyIds: string[] = []

    if (!tenantSlug) {
      log.error('Cannot resolve companies: no tenant slug available')
      return companyMap
    }

    // Check cache first
    companyIds.forEach(companyId => {
      const cached = getCachedCompany(tenantSlug, companyId)
      if (cached !== undefined) {
        companyMap.set(companyId, cached)
      } else {
        uncachedCompanyIds.push(companyId)
      }
    })

    // Fetch uncached companies if any
    if (uncachedCompanyIds.length > 0) {
      try {
        log.debug('Batch resolving uncached companies', { count: uncachedCompanyIds.length })

        const client = getHttpClient()

        const companies = await sendValidatedRequest<CompanyEntity[]>(
          'get',
          `/companies?select=name&_id=${uncachedCompanyIds.join(',')}`,
          undefined,
          undefined,
          client
        )

        // Cache resolved companies
        const resolvedCompanyIds = new Set(companies.map(company => company._id))

        companies.forEach(company => {
          companyMap.set(company._id, company)
          cacheCompany(tenantSlug, company._id, company)
        })

        // Cache null for companies that weren't found
        uncachedCompanyIds.forEach(companyId => {
          if (!resolvedCompanyIds.has(companyId)) {
            companyMap.set(companyId, null)
            cacheCompany(tenantSlug, companyId, null)
          }
        })

        log.debug('Companies resolved and cached', {
          requested: uncachedCompanyIds.length,
          resolved: companies.length,
          cached: companyIds.length - uncachedCompanyIds.length
        })
      } catch (error) {
        log.error('Failed to resolve companies', { error, companyIds: uncachedCompanyIds })

        // Cache null for failed requests to avoid retrying
        uncachedCompanyIds.forEach(companyId => {
          companyMap.set(companyId, null)
          cacheCompany(tenantSlug, companyId, null)
        })
      }
    }

    return companyMap
  }, [tenantSlug, getCachedCompany, cacheCompany])

  /**
   * Extract unique entity IDs from log entries
   */
  const extractEntityIds = useCallback((logs: ParsedLogEntry[]) => {
    const companyIds = new Set<string>()
    const userIds = new Set<string>()

    logs.forEach(log => {
      // Extract company IDs
      log.companyIds.forEach(id => {
        if (id && id !== 'Unknown') {
          companyIds.add(id)
        }
      })

      // Extract user IDs from raw data
      if (log._raw.actorId && log._raw.actorType === 'user') {
        userIds.add(log._raw.actorId)
      }
    })

    return {
      companyIds: Array.from(companyIds),
      userIds: Array.from(userIds)
    }
  }, [])

  /**
   * Resolve all entities for a batch of logs
   */
  const resolveEntitiesForLogs = useCallback(async (logs: ParsedLogEntry[]) => {
    const { companyIds, userIds } = extractEntityIds(logs)

    const [companyMap, userMap] = await Promise.all([
      batchResolveCompanies(companyIds),
      batchResolveUsers(userIds)
    ])

    return { companyMap, userMap }
  }, [extractEntityIds, batchResolveCompanies, batchResolveUsers])

  return {
    batchResolveUsers,
    batchResolveCompanies,
    extractEntityIds,
    resolveEntitiesForLogs
  }
}