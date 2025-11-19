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
    // Model permissions (m_*)
    create?: boolean
    read?: boolean
    view?: boolean // Legacy: maps to read
    update?: boolean
    delete?: boolean
    remove?: boolean // Legacy: maps to delete
    export?: boolean
    // Workflow permissions (wf_*)
    enabled?: boolean
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
      const data = await this.httpClient.get<any[]>(
        '/rolespermissions',
        queryParams,
        {
          metadata: {
            priority: options?.priority ?? 'normal',
            complexity: options?.complexity ?? 'moderate'
          }
        }
      )

      log.debug('Raw role permissions response', {
        dataLength: data?.length ?? 0,
        sampleData: data?.[0]
      })

      // Transform API response to RolePermission format
      const transformed: RolePermission[] = []

      if (!data || data.length === 0) {
        log.warn('No role permissions data received from API')
        return []
      }

      // The API returns role objects with role_permissions arrays
      for (const role of data) {
        const rolePerms = role.role_permissions || []
        const roleId = role._id
        const roleName = role.name

        for (const perm of rolePerms) {
          // Map type to human-readable category
          let category = 'Other'
          if (perm.type === 'company') {
            category = 'Account Access'
          } else if (perm.type === 'phmodel') {
            category = 'Module'
          } else if (perm.type === 'workflow') {
            category = 'Workflow'
          }

          // Transform from API format (subject, action) to our format (module, permissions)
          transformed.push({
            _id: perm._id || `${roleId}_${perm.subject}`,
            roleId: roleId,
            roleName: roleName,
            module: perm.title || perm.subject, // Use human-readable title, fallback to subject
            category: category, // Map type to category
            permissions: {
              // Model permissions
              create: perm.action?.create,
              view: perm.action?.view,
              read: perm.action?.view, // Alias
              update: perm.action?.update,
              remove: perm.action?.remove,
              delete: perm.action?.remove, // Alias
              export: perm.action?.export,
              // Workflow permissions
              enabled: perm.action?.enabled
            }
          })
        }
      }

      log.debug('Transformed role permissions', {
        transformedCount: transformed.length,
        sampleTransformed: transformed[0]
      })

      return transformed
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
