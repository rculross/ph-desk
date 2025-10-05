/**
 * Users Query Hooks for Planhat Extension
 *
 * Provides React Query hooks for user data management with tenant-aware caching.
 */

import { useQuery, type UseQueryResult } from '@tanstack/react-query'

import type { PaginatedResponse } from '../../types/api'
import { logger } from '../../utils/logger'
import { getTenantSlug } from '../client/http-client'
import { usersService, type ConnectedApiUser, type UserFilters } from '../services/users.service'

const log = logger.api

export interface UseUsersQueryOptions {
  filters?: UserFilters
  pagination?: {
    limit?: number
    offset?: number
    sort?: string
    sortOrder?: 'asc' | 'desc'
  }
  enabled?: boolean
}

/**
 * Hook to fetch users with React Query caching
 */
export function useUsersQuery(
  options: UseUsersQueryOptions = {}
): UseQueryResult<PaginatedResponse<ConnectedApiUser>, Error> {
  const { filters = {}, pagination = {}, enabled = true } = options
  const tenantSlug = getTenantSlug()

  return useQuery({
    queryKey: ['users', tenantSlug, filters, pagination],
    queryFn: async () => {
      log.debug('Fetching users', { filters, pagination, tenantSlug })

      const result = await usersService.getUsers(filters, {
        limit: 1000,
        sort: 'firstName',
        ...pagination
      })

      log.debug('Users fetch completed', {
        totalUsers: result.data.length,
        filters,
        pagination
      })

      return result
    },
    enabled: enabled && !!tenantSlug,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000 // 10 minutes
  })
}

/**
 * Hook to get a user lookup map for efficient user name resolution
 */
export function useUserLookupMap(): Record<string, ConnectedApiUser> {
  const { data: usersData } = useUsersQuery()

  if (!usersData?.data) {
    return {}
  }

  return usersData.data.reduce((lookup, user) => {
    lookup[user._id] = user
    return lookup
  }, {} as Record<string, ConnectedApiUser>)
}

/**
 * Hook to get a specific user by ID from cached data
 */
export function useUserById(userId: string | null | undefined): ConnectedApiUser | null {
  const userLookup = useUserLookupMap()

  if (!userId || !userLookup[userId]) {
    return null
  }

  return userLookup[userId]
}

/**
 * Hook to format user name from user ID
 */
export function useUserName(userId: string | null | undefined): string {
  const user = useUserById(userId)

  if (!user) {
    return userId ? `Unknown User (${userId.substring(0, 8)}...)` : ''
  }

  if (user.firstName && user.lastName) {
    return `${user.firstName} ${user.lastName}`
  }

  if (user.firstName) {
    return user.firstName
  }

  return user.email || `User ${userId?.substring(0, 8)}...`
}