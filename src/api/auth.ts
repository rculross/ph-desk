/**
 * Simplified Authentication - No token management needed
 * The extension uses the browser's existing Planhat session
 */

import { isAxiosError } from 'axios'

import type {
  UserPreferences,
  TenantSettings,
  TenantLimits,
  TenantFeatures,
  TenantBilling
} from '../types/api'
import { logger } from '../utils/logger'

import { getHttpClient } from './client/http-client'

const log = logger.api

export interface UserInfo {
  id: string
  email: string
  firstName: string
  lastName: string
  role: string
  permissions: string[]
  preferences: UserPreferences
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export interface AuthSession {
  id: string
  userId: string
  tenantId: string
  token: string
  refreshToken?: string
  expiresAt: number
  createdAt: number
  lastActivity: number
  isAuthenticated: boolean
  user?: UserInfo | null
  tenantContext?: TenantContext | null
}

export interface TenantContext {
  id: string
  slug: string
  name: string
  domain?: string
  logo?: string
  settings: TenantSettings
  limits: TenantLimits
  billing: TenantBilling
  isActive: boolean
  features: TenantFeatures
  createdAt: string
  updatedAt: string
}

export interface AuthError {
  code: string
  message: string
  retryable: boolean
}

/**
 * Simple auth service that assumes user is already logged in via browser
 */
export class AuthService {
  /**
   * Check if user is logged in
   * ALWAYS verifies with /myprofile API call to ensure cookies are valid
   */
  async isAuthenticated(): Promise<boolean> {
    const startTime = performance.now()
    log.debug('Starting authentication check')

    try {
      // Desktop app: First check if we have stored cookies
      if (window.electron.auth) {
        const storedAuth = await window.electron.auth.getStoredAuth()
        const hasStoredAuth = storedAuth?.cookies && storedAuth.cookies.length > 0

        if (!hasStoredAuth) {
          const endTime = performance.now()
          log.debug('No stored authentication found in Electron', {
            duration: Math.round(endTime - startTime)
          })
          return false
        }

        log.debug('Found stored cookies, verifying with /myprofile API call...')
      }

      // ALWAYS verify authentication with actual API call
      const client = getHttpClient()
      await client.get('/myprofile')

      const endTime = performance.now()
      log.info('Authentication verified via /myprofile API', {
        duration: Math.round(endTime - startTime)
      })

      return true
    } catch (error) {
      const endTime = performance.now()
      if (isAxiosError(error)) {
        const status = error.response?.status
        const statusText = error.response?.statusText

        if (status === 401 || status === 403) {
          log.warn('Authentication check failed', {
            duration: Math.round(endTime - startTime),
            status,
            statusText
          })
          return false
        }

        log.error('Authentication check error', {
          duration: Math.round(endTime - startTime),
          status,
          statusText,
          error: error.message
        })
        return false
      }

      log.error('Authentication check unexpected error', {
        duration: Math.round(endTime - startTime),
        error: error instanceof Error ? error.message : String(error)
      })
      return false
    }
  }

  /**
   * Get current user info from API
   */
  async getCurrentUser(): Promise<UserInfo | null> {
    const startTime = performance.now()
    log.debug('Fetching current user profile')
    
    try {
      const client = getHttpClient()
      const userData = await client.get<UserInfo>('/myprofile')
      const endTime = performance.now()

      log.info('Current user profile fetched successfully', {
        duration: Math.round(endTime - startTime),
        userId: userData.id,
        userEmail: userData.email ? `${userData.email.substring(0, 3)}***` : undefined,
        role: userData.role
      })
      return userData
    } catch (error) {
      const endTime = performance.now()
      if (isAxiosError(error)) {
        const status = error.response?.status
        const statusText = error.response?.statusText

        if (status === 401 || status === 403) {
          log.warn('Failed to fetch current user profile', {
            duration: Math.round(endTime - startTime),
            status,
            statusText
          })
          return null
        }

        log.error('Current user profile fetch error', {
          duration: Math.round(endTime - startTime),
          status,
          statusText,
          error: error.message
        })
      } else {
        log.error('Current user profile fetch unexpected error', {
          duration: Math.round(endTime - startTime),
          error: error instanceof Error ? error.message : 'Unknown error'
        })
      }
      return null
    }
  }

  /**
   * Get tenant info from API
   * NOTE: Uses /myprofile endpoint since /tenant doesn't exist in Planhat API
   */
  async getTenantContext(): Promise<TenantContext | null> {
    const startTime = performance.now()
    log.debug('Fetching tenant context')

    try {
      const client = getHttpClient()
      const profileData = await client.get<any>('/myprofile')
      const endTime = performance.now()

      // Extract tenant context from user profile
      const tenantData: TenantContext = {
        id: profileData.tenant?._id || '',
        slug: profileData.tenant?.slug || '',
        name: profileData.tenant?.name || '',
        domain: profileData.tenant?.domain || '',
        isActive: true,
        createdAt: profileData.tenant?.createdAt || new Date().toISOString(),
        updatedAt: profileData.tenant?.updatedAt || new Date().toISOString()
      }

      log.info('Tenant context fetched successfully', {
        duration: Math.round(endTime - startTime),
        tenantId: tenantData.id,
        tenantSlug: tenantData.slug,
        tenantName: tenantData.name,
        isActive: tenantData.isActive
      })
      return tenantData
    } catch (error) {
      const endTime = performance.now()
      if (isAxiosError(error)) {
        const status = error.response?.status
        const statusText = error.response?.statusText

        if (status === 401 || status === 403) {
          log.warn('Failed to fetch tenant context', {
            duration: Math.round(endTime - startTime),
            status,
            statusText
          })
          return null
        }

        log.error('Tenant context fetch error', {
          duration: Math.round(endTime - startTime),
          status,
          statusText,
          error: error.message
        })
      } else {
        log.error('Tenant context fetch unexpected error', {
          duration: Math.round(endTime - startTime),
          error: error instanceof Error ? error.message : 'Unknown error'
        })
      }
      return null
    }
  }

  /**
   * Get current session with user and tenant data
   */
  async getCurrentSession(): Promise<AuthSession> {
    const startTime = performance.now()
    log.debug('Fetching current session')
    
    try {
      const [user, tenantContext, isAuth] = await Promise.all([
        this.getCurrentUser(),
        this.getTenantContext(),
        this.isAuthenticated()
      ])
      
      const endTime = performance.now()
      
      const session: AuthSession = {
        id: 'browser-session',
        userId: user?.id ?? '',
        tenantId: tenantContext?.id ?? '',
        token: 'browser-session-token',
        expiresAt: Date.now() + (24 * 60 * 60 * 1000), // 24 hours
        createdAt: Date.now(),
        lastActivity: Date.now(),
        isAuthenticated: isAuth,
        user,
        tenantContext
      }
      
      log.debug('Current session fetched successfully', {
        duration: Math.round(endTime - startTime),
        isAuthenticated: session.isAuthenticated,
        userId: session.user?.id,
        tenantId: session.tenantContext?.id
      })
      
      return session
    } catch (error) {
      const endTime = performance.now()
      log.error('Failed to fetch current session', {
        duration: Math.round(endTime - startTime),
        error: error instanceof Error ? error.message : 'Unknown error'
      })
      throw error
    }
  }

  /**
   * Authenticate (simplified - just check current auth)
   */
  async authenticate(apiKey?: string, tenantSlug?: string): Promise<AuthSession> {
    log.debug('Authentication requested', { hasApiKey: !!apiKey, tenantSlug })
    
    const isAuth = await this.isAuthenticated()
    if (!isAuth) {
      throw new Error('Please log in to Planhat first')
    }
    
    return this.getCurrentSession()
  }

  /**
   * Refresh authentication by checking current state
   */
  async refreshAuthentication(): Promise<AuthSession> {
    log.debug('Refreshing authentication')
    
    const isAuth = await this.isAuthenticated()
    if (!isAuth) {
      throw new Error('Session expired - please log in again')
    }
    
    return this.getCurrentSession()
  }

  /**
   * Clear session (simplified)
   */
  clearSession(): void {
    log.info('Clearing session')
    // In this simplified approach, we just log the action
    // The user will need to logout from the main Planhat application
  }

  /**
   * Update session activity
   */
  updateSessionActivity(): void {
    log.debug('Session activity updated')
    // In this simplified approach, we don't need to do anything
    // Activity is tracked in the store
  }

  /**
   * Switch tenant (not supported in simplified version)
   */
  switchTenant(_tenantSlug: string): Promise<TenantContext> {
    throw new Error('Tenant switching not supported in this version')
  }

  /**
   * No logout needed - user can logout from the main Planhat app
   */
  logout(): void {
    log.info('Logout requested - user will need to logout from main Planhat application')
    // In this simplified approach, we don't need to do anything
    // The user will logout from the main Planhat application
  }
}

// Export singleton instance
export const authService = new AuthService()

// Types are already exported above
