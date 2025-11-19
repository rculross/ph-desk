import type {
  User,
  PaginatedResponse
} from '../../types'
import { logger } from '../../utils/logger'
import { getHttpClient, type RequestOptions } from '../client/http-client'

interface ApiRequestOptions extends RequestOptions {
  priority?: 'low' | 'normal' | 'high' | 'critical'
  complexity?: 'simple' | 'moderate' | 'complex' | 'heavy'
}

import { ensureTenantSlug as ensureSharedTenantSlug } from './tenant.service'

const log = logger.api

export interface UserFilters {
  isActive?: boolean
  teamId?: string
  teamName?: string
  email?: string
  search?: string
}

export interface ConnectedApiUser extends User {
  googleApi?: {
    accessEnabled: boolean
    syncEnabled: boolean
    lastSyncDate?: string
    errorStatus?: string
  }
  googleCalendar?: {
    accessEnabled: boolean
    syncEnabled: boolean
    lastSyncDate?: string
    errorStatus?: string
  }
  msApi?: {
    userId: string
    accessEnabled: boolean
    accessMutable: boolean
    syncEnabled: boolean
    syncInitial: boolean
    syncState: string
    syncedLabels?: Array<any>
  }
  msCalendarApi?: {
    userId: string
    accessEnabled: boolean
    accessMutable: boolean
    syncEnabled: boolean
    syncInitial: boolean
    syncState: string
    syncedCalendars?: Array<any>
    calendarToSave?: any
  }
  teamName?: string
}

/**
 * Service for user-related API operations
 *
 * Provides user data management for Connected APIs feature,
 * focusing on API integration status display.
 */
class UsersService {
  private get httpClient() {
    return getHttpClient()
  }

  /**
   * Ensure tenant slug is set before making API calls
   */
  private async ensureTenantSlug(): Promise<void> {
    await ensureSharedTenantSlug({ context: 'API calls', logger: log })
  }

  /**
   * Get paginated list of users with optional filtering
   * Uses the /data endpoint for efficient field selection
   */
  async getUsers(
    filters?: UserFilters,
    pagination?: { limit?: number; offset?: number; sort?: string; sortOrder?: 'asc' | 'desc'; select?: string },
    options?: ApiRequestOptions
  ): Promise<PaginatedResponse<ConnectedApiUser>> {
    await this.ensureTenantSlug()

    try {
      const params = {
        model: 'User',
        limit: pagination?.limit ?? 500,
        offset: pagination?.offset ?? 0,
        sort: pagination?.sort ?? 'firstName',
        sortOrder: pagination?.sortOrder,
        select: pagination?.select ?? 'firstName,lastName,email,teamId,isActive,googleApi,googleCalendar,msApi,msCalendarApi,isExposedAsSenderOption,createdAt,updatedAt,lastLoginDate',
        populate: 'team',
        ...filters
      }

      log.debug('Fetching users via /data endpoint', params)

      const response = await this.httpClient.get<ConnectedApiUser[]>(
        '/data',
        params,
        {
          metadata: {
            priority: options?.priority ?? 'normal',
            complexity: options?.complexity ?? 'moderate'
          }
        }
      )

      // Transform the direct array response to paginated format
      const users = response ?? []

      // Apply client-side filtering if needed
      let filteredUsers = users
      if (filters?.search) {
        const searchTerm = filters.search.toLowerCase()
        filteredUsers = users.filter(user =>
          user.firstName.toLowerCase().includes(searchTerm) ||
          user.lastName.toLowerCase().includes(searchTerm) ||
          user.email.toLowerCase().includes(searchTerm)
        )
      }

      return {
        data: filteredUsers,
        total: filteredUsers.length,
        limit: pagination?.limit ?? 500,
        offset: pagination?.offset ?? 0,
        hasMore: filteredUsers.length >= (pagination?.limit ?? 500)
      }
    } catch (error) {
      log.error('Failed to fetch users:', error)
      throw error
    }
  }

  /**
   * Get a single user by ID
   */
  async getUserById(userId: string, options?: ApiRequestOptions): Promise<ConnectedApiUser | null> {
    await this.ensureTenantSlug()

    try {
      const response = await this.httpClient.get<{ data: ConnectedApiUser }>(
        `/users/${userId}`,
        undefined,
        {
          metadata: {
            priority: options?.priority ?? 'normal',
            complexity: options?.complexity ?? 'moderate'
          }
        }
      )
      return response.data ?? null
    } catch (error) {
      log.error('Failed to get user by ID:', error)
      return null
    }
  }

  /**
   * Search users by name or email
   */
  async searchUsers(
    query: string,
    filters?: Partial<UserFilters>,
    pagination?: { limit?: number; offset?: number },
    options?: ApiRequestOptions
  ): Promise<PaginatedResponse<ConnectedApiUser>> {
    const searchFilters: UserFilters = {
      ...filters,
      search: query
    }

    return this.getUsers(searchFilters, pagination, options)
  }

  /**
   * Get users with specific API integration status
   */
  async getUsersByApiStatus(
    apiType: 'googleApi' | 'googleCalendar' | 'msApi' | 'msCalendarApi',
    status: 'enabled' | 'disabled' | 'syncing' | 'error',
    pagination?: { limit?: number; offset?: number }
  ): Promise<PaginatedResponse<ConnectedApiUser>> {
    // This would typically be done server-side, but for now we'll fetch all and filter
    const allUsers = await this.getUsers({}, pagination)

    const filteredUsers = allUsers.data.filter(user => {
      const apiConfig = user[apiType]
      if (!apiConfig) return false

      // Handle Microsoft APIs which use different structure
      if (apiType === 'msApi' || apiType === 'msCalendarApi') {
        const msConfig = apiConfig as any
        switch (status) {
          case 'enabled':
            return msConfig.accessEnabled
          case 'disabled':
            return !msConfig.accessEnabled
          case 'syncing':
            return msConfig.syncState === 'enabled' && msConfig.syncEnabled
          case 'error':
            return msConfig.syncState === 'error'
          default:
            return false
        }
      }

      // Handle Google APIs
      const googleConfig = apiConfig as any
      switch (status) {
        case 'enabled':
          return googleConfig.accessEnabled
        case 'disabled':
          return !googleConfig.accessEnabled
        case 'syncing':
          return googleConfig.syncEnabled && googleConfig.accessEnabled
        case 'error':
          return googleConfig.errorStatus
        default:
          return false
      }
    })

    return {
      data: filteredUsers,
      total: filteredUsers.length,
      limit: pagination?.limit ?? 500,
      offset: pagination?.offset ?? 0,
      hasMore: false
    }
  }

  /**
   * Get API integration statistics
   */
  async getApiStats(): Promise<{
    totalUsers: number
    googleApi: {
      enabled: number
      disabled: number
      syncing: number
      errors: number
    }
    googleCalendar: {
      enabled: number
      disabled: number
      syncing: number
      errors: number
    }
    msApi: {
      enabled: number
      disabled: number
      syncing: number
      errors: number
    }
    msCalendarApi: {
      enabled: number
      disabled: number
      syncing: number
      errors: number
    }
  }> {
    try {
      const allUsers = await this.getUsers({})
      const users = allUsers.data

      const stats = {
        totalUsers: users.length,
        googleApi: {
          enabled: 0,
          disabled: 0,
          syncing: 0,
          errors: 0
        },
        googleCalendar: {
          enabled: 0,
          disabled: 0,
          syncing: 0,
          errors: 0
        },
        msApi: {
          enabled: 0,
          disabled: 0,
          syncing: 0,
          errors: 0
        },
        msCalendarApi: {
          enabled: 0,
          disabled: 0,
          syncing: 0,
          errors: 0
        }
      }

      users.forEach(user => {
        // Google API stats
        if (user.googleApi) {
          if (user.googleApi.errorStatus) {
            stats.googleApi.errors++
          } else if (user.googleApi.syncEnabled && user.googleApi.accessEnabled) {
            stats.googleApi.syncing++
          } else if (user.googleApi.accessEnabled) {
            stats.googleApi.enabled++
          } else {
            stats.googleApi.disabled++
          }
        } else {
          stats.googleApi.disabled++
        }

        // Google Calendar stats
        if (user.googleCalendar) {
          if (user.googleCalendar.errorStatus) {
            stats.googleCalendar.errors++
          } else if (user.googleCalendar.syncEnabled && user.googleCalendar.accessEnabled) {
            stats.googleCalendar.syncing++
          } else if (user.googleCalendar.accessEnabled) {
            stats.googleCalendar.enabled++
          } else {
            stats.googleCalendar.disabled++
          }
        } else {
          stats.googleCalendar.disabled++
        }

        // Microsoft API stats
        if (user.msApi) {
          if (user.msApi.syncState === 'error') {
            stats.msApi.errors++
          } else if (user.msApi.syncState === 'enabled' && user.msApi.syncEnabled) {
            stats.msApi.syncing++
          } else if (user.msApi.accessEnabled) {
            stats.msApi.enabled++
          } else {
            stats.msApi.disabled++
          }
        } else {
          stats.msApi.disabled++
        }

        // Microsoft Calendar API stats
        if (user.msCalendarApi) {
          if (user.msCalendarApi.syncState === 'error') {
            stats.msCalendarApi.errors++
          } else if (user.msCalendarApi.syncState === 'enabled' && user.msCalendarApi.syncEnabled) {
            stats.msCalendarApi.syncing++
          } else if (user.msCalendarApi.accessEnabled) {
            stats.msCalendarApi.enabled++
          } else {
            stats.msCalendarApi.disabled++
          }
        } else {
          stats.msCalendarApi.disabled++
        }
      })

      return stats
    } catch (error) {
      log.error('Failed to get API stats:', error)
      throw error
    }
  }
}

// Export singleton instance
export const usersService = new UsersService()

// Export types and class for advanced usage
export { UsersService }