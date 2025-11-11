/**
 * Authentication Service
 *
 * Manages Planhat authentication for Electron desktop app
 * Handles login flow, session persistence, and cookie management
 * NOTE: Only manages cookies and session - tenant management is handled by tenant store
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
   * NOTE: This only validates cookies - tenant management is handled by tenant store
   */
  async initialize(): Promise<void> {
    log.info('[Auth] Initializing authentication service...')

    try {
      // Check if we have stored auth data (cookies)
      const storedAuth = await window.electron.auth.getStoredAuth()

      if (storedAuth) {
        log.info('[Auth] Found stored authentication data')

        // Try to verify authentication with the stored tenant slug or fallback to 'planhat'
        let isAuthenticated = false
        let validTenantSlug = storedAuth.tenantSlug
        let environment = storedAuth.environment || 'production'

        // Also check the tenant storage for last known tenant (where tenant store saves it)
        try {
          if (environment === 'demo') {
            // Demo tenants: Check in-memory Zustand store (not persisted between sessions)
            const { useTenantStore } = await import('../stores/tenant.store')
            const lastDemoTenant = useTenantStore.getState().lastDemoTenant
            if (lastDemoTenant) {
              log.info(`[Auth] Found last demo tenant in memory: ${lastDemoTenant}`)
              validTenantSlug = lastDemoTenant
            }
          } else {
            // Production tenants: Check persistent storage (electron-store)
            const tenantStorage = await window.electron.tenant.getStorage()
            if (tenantStorage?.lastProdTenant) {
              log.info(`[Auth] Found last production tenant in storage: ${tenantStorage.lastProdTenant}`)
              validTenantSlug = tenantStorage.lastProdTenant
            }
          }
        } catch (error) {
          log.debug('[Auth] Could not retrieve tenant storage', { error })
        }

        // Import HTTP client and set tenant slug for verification
        const { updateHttpClient } = await import('../api/client/http-client')

        // First, try with the stored tenant slug if available
        if (validTenantSlug) {
          log.info(`[Auth] Verifying authentication with stored tenant: ${validTenantSlug}`)
          updateHttpClient({ tenantSlug: validTenantSlug })

          try {
            // Direct API call using HTTP client - avoid circular dependency
            const { getHttpClient } = await import('../api/client/http-client')
            const client = getHttpClient()
            await client.get('/myprofile')
            isAuthenticated = true
            log.info(`[Auth] Successfully verified with tenant: ${validTenantSlug}`)
          } catch (error: any) {
            const status = error?.response?.status
            if (status === 401 || status === 403) {
              log.warn(`[Auth] Stored tenant '${validTenantSlug}' failed verification (401/403)`)
            } else {
              log.warn(`[Auth] Failed to verify with stored tenant: ${error?.message || error}`)
            }
            isAuthenticated = false
            validTenantSlug = null
          }
        }

        // If no stored tenant or it failed, try 'planhat' as fallback for production
        if (!isAuthenticated && storedAuth.environment === 'production') {
          log.info("[Auth] Trying 'planhat' as fallback tenant")
          validTenantSlug = 'planhat'
          updateHttpClient({ tenantSlug: validTenantSlug })

          try {
            // Direct API call using HTTP client - avoid circular dependency
            const { getHttpClient } = await import('../api/client/http-client')
            const client = getHttpClient()
            await client.get('/myprofile')
            isAuthenticated = true
            log.info("[Auth] Successfully verified with fallback tenant 'planhat'")
          } catch (error: any) {
            const status = error?.response?.status
            if (status === 401 || status === 403) {
              log.warn("[Auth] Fallback tenant 'planhat' failed verification (401/403)")
            } else {
              log.warn(`[Auth] Failed to verify with fallback tenant: ${error?.message || error}`)
            }
            isAuthenticated = false
            validTenantSlug = null
          }
        }

        if (isAuthenticated && validTenantSlug) {
          this.authState = {
            isAuthenticated: true,
            tenantSlug: validTenantSlug,
            environment: environment,
            lastLogin: storedAuth.lastLogin
          }

          log.info('[Auth] Session verified successfully', {
            tenant: validTenantSlug,
            environment: this.authState.environment
          })

          // Update HTTP client with verified tenant slug
          updateHttpClient({ tenantSlug: validTenantSlug })

          // Save the validated tenant for next session
          try {
            if (environment === 'production') {
              // Production tenants: Save to electron-store (persistent between sessions)
              await window.electron.tenant.saveStorage(validTenantSlug)
              log.info(`[Auth] Saved validated production tenant for future sessions: ${validTenantSlug}`)
            } else {
              // Demo tenants: Save to Zustand in-memory store (cleared on app restart)
              const { useTenantStore } = await import('../stores/tenant.store')
              useTenantStore.getState().setLastDemoTenant(validTenantSlug)
              log.info(`[Auth] Saved validated demo tenant to in-memory store: ${validTenantSlug}`)
            }
          } catch (saveError) {
            log.debug('[Auth] Could not save validated tenant', { error: saveError })
          }

          // CRITICAL FIX: Directly update auth store state
          // This ensures UI components see the correct authentication state
          try {
            log.info('[Auth] Updating auth store with authenticated state...')
            const { useAuthStore } = await import('../stores/auth.store')
            useAuthStore.getState().setAuthenticated(true)
            log.info('[Auth] ✓ Auth store updated - isAuthenticated set to true')
          } catch (error) {
            log.error('[Auth] Failed to update auth store', { error })
          }

          this.notifyAuthChange()
        } else {
          log.warn('[Auth] Could not verify authentication with any tenant')
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
   * NOTE: Returns tenant info but does not manage tenant state - tenant store handles that
   */
  async login(environment: AuthEnvironment = 'production'): Promise<{tenantSlug: string | null, environment: AuthEnvironment}> {
    log.info('[Auth] Starting login flow...', { environment })

    try {
      const authResult = await window.electron.auth.openLoginWindow(environment)

      // If no tenant slug was extracted from URL, default to 'planhat' for production
      let tenantSlug = authResult.tenantSlug
      if (!tenantSlug && environment === 'production') {
        log.info("[Auth] No tenant slug from login URL, defaulting to 'planhat'")
        tenantSlug = 'planhat'
      }

      log.info('[Auth] Login successful', {
        tenantSlug: tenantSlug,
        environment: authResult.environment,
        cookieCount: authResult.cookies.length
      })

      // Import HTTP client and update with tenant slug AND base URL
      const { updateHttpClient, updateClientForCurrentEnvironment } = await import('../api/client/http-client')
      if (tenantSlug) {
        // CRITICAL: Update base URL based on environment BEFORE setting tenant slug
        // This ensures subsequent API calls go to the correct API (prod vs demo)
        const tenantDomain = environment === 'demo'
          ? `ws.planhatdemo.com/${tenantSlug}`
          : `ws.planhat.com/${tenantSlug}`
        await updateClientForCurrentEnvironment(tenantDomain)

        // Then update tenant slug for API requests
        updateHttpClient({ tenantSlug })

        // Save the tenant slug for future sessions
        try {
          if (authResult.environment === 'production') {
            // Production tenants: Save to electron-store (persistent between sessions)
            await window.electron.tenant.saveStorage(tenantSlug)
            log.info(`[Auth] Saved production tenant for future sessions: ${tenantSlug}`)
          } else {
            // Demo tenants: Save to Zustand in-memory store (cleared on app restart)
            const { useTenantStore } = await import('../stores/tenant.store')
            useTenantStore.getState().setLastDemoTenant(tenantSlug)
            log.info(`[Auth] Saved demo tenant to in-memory store: ${tenantSlug}`)
          }
        } catch (saveError) {
          log.warn('[Auth] Failed to save tenant info', { error: saveError })
        }
      }

      this.authState = {
        isAuthenticated: true,
        tenantSlug: tenantSlug,
        environment: authResult.environment,
        lastLogin: Date.now()
      }

      // CRITICAL FIX: Directly update auth store state
      try {
        log.info('[Auth] Updating auth store after login...')
        const { useAuthStore } = await import('../stores/auth.store')
        useAuthStore.getState().setAuthenticated(true)
        log.info('[Auth] ✓ Auth store updated after login - isAuthenticated set to true')
      } catch (error) {
        log.error('[Auth] Failed to update auth store', { error })
      }

      this.notifyAuthChange()

      // Return the captured/defaulted tenant slug and environment for tenant store to use
      return {
        tenantSlug: tenantSlug,
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
   * NOTE: Only clears auth state - tenant store handles its own cleanup
   */
  private async clearSession(): Promise<void> {
    this.authState = {
      isAuthenticated: false,
      tenantSlug: null,
      environment: 'production',
      lastLogin: null
    }

    // CRITICAL FIX: Directly update auth store to clear authenticated state
    try {
      log.info('[Auth] Clearing auth store state...')
      const { useAuthStore } = await import('../stores/auth.store')
      useAuthStore.getState().setAuthenticated(false)
      log.info('[Auth] ✓ Auth store cleared - isAuthenticated set to false')
    } catch (error) {
      log.error('[Auth] Failed to clear auth store', { error })
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

// NOTE: Initialization is deferred until after HTTP client is ready
// See api/index.ts utils.initialize() for initialization sequence
