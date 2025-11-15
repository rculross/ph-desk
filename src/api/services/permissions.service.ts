import type { PaginatedResponse } from '../../types'
import { logger } from '../../utils/logger'
import { getHttpClient, type RequestOptions } from '../client/http-client'
import { ensureAuthAndTenant } from './tenant.service'

const log = logger.api

/**
 * Role type representing a Planhat role
 */
export interface Role {
  _id: string
  name: string
  description?: string
  external?: boolean
  permissions?: Record<string, any>
  createdAt?: string
  updatedAt?: string
}

/**
 * Role Permission type representing detailed permissions from /rolespermissions
 */
export interface RolePermission {
  _id: string
  roleId: string
  roleName: string
  module: string
  category?: string
  permissions: {
    create?: boolean
    read?: boolean
    view?: boolean // Legacy: maps to read
    update?: boolean
    delete?: boolean
    remove?: boolean // Legacy: maps to delete
    export?: boolean
  }
  subPermissions?: RolePermission[]
  accountAccess?: boolean
}

interface ApiRequestOptions extends RequestOptions {
  priority?: 'low' | 'normal' | 'high' | 'critical'
  complexity?: 'simple' | 'moderate' | 'complex' | 'heavy'
}

/**
 * Service for permissions and roles API operations
 *
 * Provides access to Planhat roles and permissions data for display and export.
 */
class PermissionsService {
  private get httpClient() {
    return getHttpClient()
  }

  /**
   * Ensure authentication and tenant slug are set before making API calls
   */
  private async ensureAuthAndTenantContext(): Promise<void> {
    await ensureAuthAndTenant({ context: 'permissions API calls', logger: log })
  }

  /**
   * Get all roles from Planhat
   */
  async getRoles(
    pagination?: { limit?: number; offset?: number; sort?: string },
    options?: ApiRequestOptions
  ): Promise<PaginatedResponse<Role>> {
    await this.ensureAuthAndTenantContext()

    const queryParams: Record<string, any> = {
      limit: pagination?.limit ?? 2000,
      offset: pagination?.offset ?? 0,
      sort: pagination?.sort ?? 'name'
    }

    log.debug('Fetching roles via HTTP client', queryParams)

    try {
      const data = await this.httpClient.get<Role[]>('/roles', queryParams, {
        metadata: {
          priority: options?.priority ?? 'normal',
          complexity: options?.complexity ?? 'simple'
        }
      })

      return {
        data: data ?? [],
        total: (data ?? []).length,
        limit: pagination?.limit ?? 2000,
        offset: pagination?.offset ?? 0,
        hasMore: (data ?? []).length === (pagination?.limit ?? 2000)
      }
    } catch (error) {
      log.error('Failed to fetch roles:', error)
      throw error
    }
  }

  /**
   * Get detailed role permissions from /rolespermissions endpoint
   * Used for generating detailed permission exports
   */
  async getRolePermissions(
    roleId?: string,
    options?: ApiRequestOptions
  ): Promise<RolePermission[]> {
    await this.ensureAuthAndTenantContext()

    const queryParams: Record<string, any> = {}
    if (roleId) {
      queryParams.roleId = roleId
    }

    log.debug('Fetching role permissions via HTTP client', queryParams)

    try {
      const data = await this.httpClient.get<RolePermission[]>(
        '/rolespermissions',
        queryParams,
        {
          metadata: {
            priority: options?.priority ?? 'normal',
            complexity: options?.complexity ?? 'moderate'
          }
        }
      )

      return data ?? []
    } catch (error) {
      log.error('Failed to fetch role permissions:', error)
      throw error
    }
  }

  /**
   * Get a single role by ID
   */
  async getRoleById(roleId: string, options?: ApiRequestOptions): Promise<Role | null> {
    if (!roleId || !/^[a-f\d]{24}$/i.test(roleId)) {
      throw new Error('Invalid role ID format')
    }

    await this.ensureAuthAndTenantContext()

    try {
      const response = await this.httpClient.get<Role>(`/roles/${roleId}`, undefined, {
        metadata: {
          priority: options?.priority ?? 'normal',
          complexity: options?.complexity ?? 'simple'
        }
      })

      return response ?? null
    } catch (error) {
      log.error('Failed to fetch role by ID:', error)
      throw error
    }
  }
}

// Export singleton instance
export const permissionsService = new PermissionsService()

// Export class for advanced usage
export { PermissionsService }
