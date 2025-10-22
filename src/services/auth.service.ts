/**
 * Authentication Service
 *
 * Manages Planhat authentication for Electron desktop app
 * Handles login flow, session persistence, and cookie management
 */

import type { AuthResult, StoredAuthData, PlanhatCookie } from '../types/electron'
import { logger } from '../utils/logger'

const log = logger.api

export type AuthEnvironment = 'production' | 'demo'

export interface AuthState {
  isAuthenticated: boolean
  tenantSlug: string | null
  environment: AuthEnvironment
  lastLogin: number | null
}

/**
 * Authentication Service Class
 */
class AuthService {
  private authState: AuthState = {
    isAuthenticated: false,
    tenantSlug: null,
    environment: 'production',
    lastLogin: null
  }

  private authChangeListeners: Set<(state: AuthState) => void> = new Set()

  /**
   * Initialize authentication service
   * Checks for existing session and restores if valid
   */
  async initialize(): Promise<void> {
    log.info('[Auth] Initializing authentication service...')

    try {
      // Check if we have stored auth data
      const storedAuth = await window.electron.auth.getStoredAuth()

      if (storedAuth) {
        log.info('[Auth] Found stored authentication data')

        // Verify that cookies are still valid
        const isAuthenticated = await window.electron.auth.isAuthenticated()

        if (isAuthenticated) {
          this.authState = {
            isAuthenticated: true,
            tenantSlug: storedAuth.tenantSlug,
            environment: storedAuth.environment,
            lastLogin: storedAuth.lastLogin
          }

          log.info('[Auth] Session restored successfully', {
            tenantSlug: this.authState.tenantSlug,
            environment: this.authState.environment
          })

          this.notifyAuthChange()
        } else {
          log.warn('[Auth] Stored cookies are invalid or expired')
          await this.clearSession()
        }
      } else {
        log.info('[Auth] No stored authentication found')
      }
    } catch (error) {
      log.error('[Auth] Error initializing authentication', { error })
      await this.clearSession()
    }
  }

  /**
   * Open login window and authenticate
   */
  async login(environment: AuthEnvironment = 'production'): Promise<{tenantSlug: string | null, environment: AuthEnvironment}> {
    log.info('[Auth] Starting login flow...', { environment })

    try {
      const authResult = await window.electron.auth.openLoginWindow(environment)

      log.info('[Auth] Login successful', {
        tenantSlug: authResult.tenantSlug,
        environment: authResult.environment,
        cookieCount: authResult.cookies.length
      })

      this.authState = {
        isAuthenticated: true,
        tenantSlug: authResult.tenantSlug,
        environment: authResult.environment,
        lastLogin: Date.now()
      }

      this.notifyAuthChange()

      // Return the captured tenant slug and environment for immediate connection
      return {
        tenantSlug: authResult.tenantSlug,
        environment: authResult.environment
      }
    } catch (error) {
      log.error('[Auth] Login failed', { error })
      throw error
    }
  }

  /**
   * Logout and clear session
   */
  async logout(): Promise<void> {
    log.info('[Auth] Logging out...')

    try {
      await window.electron.auth.clearCookies()

      await this.clearSession()

      log.info('[Auth] Logout successful')
    } catch (error) {
      log.error('[Auth] Error during logout', { error })
      throw error
    }
  }

  /**
   * Check if user is authenticated
   */
  async checkAuthentication(): Promise<boolean> {
    try {
      const isAuthenticated = await window.electron.auth.isAuthenticated()

      if (isAuthenticated !== this.authState.isAuthenticated) {
        this.authState.isAuthenticated = isAuthenticated

        if (!isAuthenticated) {
          // Session expired
          log.warn('[Auth] Session expired, clearing state')
          await this.clearSession()
        }

        this.notifyAuthChange()
      }

      return isAuthenticated
    } catch (error) {
      log.error('[Auth] Error checking authentication', { error })
      return false
    }
  }

  /**
   * Get current authentication state
   */
  getAuthState(): AuthState {
    return { ...this.authState }
  }

  /**
   * Get current tenant slug
   */
  getTenantSlug(): string | null {
    return this.authState.tenantSlug
  }

  /**
   * Get current environment
   */
  getEnvironment(): AuthEnvironment {
    return this.authState.environment
  }

  /**
   * Check if authenticated
   */
  isAuthenticated(): boolean {
    return this.authState.isAuthenticated
  }

  /**
   * Subscribe to authentication state changes
   */
  onAuthChange(callback: (state: AuthState) => void): () => void {
    this.authChangeListeners.add(callback)

    // Return unsubscribe function
    return () => {
      this.authChangeListeners.delete(callback)
    }
  }

  /**
   * Notify all listeners of auth state change
   */
  private notifyAuthChange(): void {
    const state = this.getAuthState()
    this.authChangeListeners.forEach(listener => {
      try {
        listener(state)
      } catch (error) {
        log.error('[Auth] Error in auth change listener', { error })
      }
    })
  }

  /**
   * Clear session state
   */
  private async clearSession(): Promise<void> {
    this.authState = {
      isAuthenticated: false,
      tenantSlug: null,
      environment: 'production',
      lastLogin: null
    }

    this.notifyAuthChange()
  }

  /**
   * Handle API 401 response (session expired)
   * This should be called by the HTTP client when it receives a 401
   */
  async handleUnauthorized(): Promise<void> {
    log.warn('[Auth] Received unauthorized response, clearing session')

    await window.electron.auth.clearCookies()
    await this.clearSession()
  }

  /**
   * Get stored cookies (for debugging)
   */
  async getCookies(): Promise<PlanhatCookie[]> {
    try {
      return await window.electron.auth.getCookies()
    } catch (error) {
      log.error('[Auth] Error getting cookies', { error })
      return []
    }
  }
}

// Singleton instance
export const authService = new AuthService()

// Make authService globally available for HTTP client
if (typeof window !== 'undefined') {
  (window as any).authService = authService
}

// Auto-initialize on module load (for Electron environment)
if (typeof window !== 'undefined' && window.electron.auth) {
  authService.initialize().catch(error => {
    console.error('[Auth] Failed to initialize:', error)
  })
}
