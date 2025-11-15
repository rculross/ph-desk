import { useQuery, keepPreviousData, type UseQueryOptions } from '@tanstack/react-query'

import { permissionsService, type Role } from '../services/permissions.service'
import { queryKeys, queryDefaults } from '../query-client'
import { getEntityCacheConfig } from '../config'
import type { PaginatedResponse } from '../../types'
import { logger } from '../../utils/logger'

const log = logger.api

/**
 * Permissions Query Hooks
 *
 * Custom hooks for fetching roles and permissions data
 * with caching and authentication.
 */

/**
 * Fetch all roles from Planhat
 */
export function useRoles(
  pagination?: { limit?: number; offset?: number; sort?: string },
  options?: Omit<UseQueryOptions<PaginatedResponse<Role>>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: queryKeys.list('roles', {}, pagination),
    queryFn: async () => {
      const startTime = performance.now()
      log.debug('Fetching roles', { pagination })

      try {
        const result = await permissionsService.getRoles(pagination)
        const endTime = performance.now()

        log.debug('Roles query completed', {
          duration: Math.round(endTime - startTime),
          recordCount: result.data.length,
          total: result.total
        })

        return result
      } catch (error) {
        const endTime = performance.now()
        log.error('Roles query failed', {
          duration: Math.round(endTime - startTime),
          error: error instanceof Error ? error.message : 'Unknown error'
        })
        throw error
      }
    },
    placeholderData: keepPreviousData,
    ...queryDefaults.standard,
    ...getEntityCacheConfig('roles'),
    ...options
  })
}

/**
 * Fetch a single role by ID
 */
export function useRole(
  roleId: string,
  options?: Omit<UseQueryOptions<Role | null>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: queryKeys.detail('role', roleId),
    queryFn: () => permissionsService.getRoleById(roleId),
    enabled: !!roleId,
    ...queryDefaults.standard,
    ...getEntityCacheConfig('role'),
    ...options
  })
}

/**
 * Fetch detailed role permissions from /rolespermissions
 * Used for generating detailed permission exports
 */
export function useRolePermissions(
  roleId?: string,
  options?: Omit<UseQueryOptions<any[]>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: roleId ? queryKeys.detail('rolePermissions', roleId) : queryKeys.list('rolePermissions', {}),
    queryFn: async () => {
      const startTime = performance.now()
      log.debug('Fetching role permissions', { roleId })

      try {
        const result = await permissionsService.getRolePermissions(roleId)
        const endTime = performance.now()

        log.debug('Role permissions query completed', {
          duration: Math.round(endTime - startTime),
          permissionCount: result.length
        })

        return result
      } catch (error) {
        const endTime = performance.now()
        log.error('Role permissions query failed', {
          duration: Math.round(endTime - startTime),
          error: error instanceof Error ? error.message : 'Unknown error'
        })
        throw error
      }
    },
    ...queryDefaults.standard,
    ...getEntityCacheConfig('rolePermissions'),
    ...options
  })
}
