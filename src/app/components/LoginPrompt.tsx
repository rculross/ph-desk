/**
 * Login Prompt Component
 *
 * Displays simple login UI when user is not authenticated
 * Direct login button that opens Planhat auth window
 */

import { useState } from 'react'

import { APP_VERSION } from '@/config/version'
import type { AuthEnvironment } from '@/services/auth.service'
import { reinitializeTenantStore } from '@/stores/tenant.store'

import { authService } from '../../services/auth.service'
import { logger } from '../../utils/logger'

const log = logger.api

interface LoginPromptProps {
  onLoginSuccess?: () => void
}

export function LoginPrompt({ onLoginSuccess }: LoginPromptProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [environment, setEnvironment] = useState<AuthEnvironment>('production')

  // Note: Tenant store actions not needed here - reinitializeTenantStore handles everything

  const handleLogin = async () => {
    setIsLoading(true)
    setError(null)

    try {
      log.info('[LoginPrompt] Opening Planhat login window...', { environment })

      const authResult = await authService.login(environment)

      log.info('[LoginPrompt] Login successful', {
        tenantSlug: authResult.tenantSlug,
        environment: authResult.environment
      })

      // CRITICAL FIX: Reinitialize tenant store after successful login
      // This fetches tenants with the new authenticated session
      try {
        log.info('[LoginPrompt] Reinitializing tenant store after login...')
        await reinitializeTenantStore()
        log.info('[LoginPrompt] Tenant store reinitialized successfully')
      } catch (reinitError) {
        log.error('[LoginPrompt] Failed to reinitialize tenant store after login', {
          error: reinitError instanceof Error ? reinitError.message : 'Unknown error'
        })
        // Don't fail the login - user can manually select tenant from dropdown
      }

      // Notify parent component
      if (onLoginSuccess) {
        onLoginSuccess()
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Login failed'

      if (errorMessage.includes('cancelled')) {
        log.info('[LoginPrompt] Login cancelled by user')
        setError('Login cancelled. Please try again.')
      } else {
        log.error('[LoginPrompt] Login error', { error: err })
        setError(errorMessage)
      }
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 px-4">
      <div className="max-w-md w-full bg-white rounded-xl shadow-2xl p-8 space-y-6">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Welcome to Planhat Tools
          </h1>
          <p className="text-gray-600">
            Please login to your Planhat account to continue
          </p>
        </div>

        {/* Environment Selection */}
        <div className="space-y-3">
          <label className="block text-sm font-medium text-gray-700">
            Select Environment
          </label>

          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => setEnvironment('production')}
              disabled={isLoading}
              className={`
                px-4 py-3 rounded-lg border-2 transition-all
                ${environment === 'production'
                  ? 'border-blue-500 bg-blue-50 text-blue-700 font-medium'
                  : 'border-gray-200 hover:border-gray-300 text-gray-700'
                }
                ${isLoading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
              `}
            >
              <div className="text-sm">Production</div>
              <div className="text-xs text-gray-500 mt-1">
                planhat.com
              </div>
            </button>

            <button
              onClick={() => setEnvironment('demo')}
              disabled={isLoading}
              className={`
                px-4 py-3 rounded-lg border-2 transition-all
                ${environment === 'demo'
                  ? 'border-blue-500 bg-blue-50 text-blue-700 font-medium'
                  : 'border-gray-200 hover:border-gray-300 text-gray-700'
                }
                ${isLoading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
              `}
            >
              <div className="text-sm">Demo</div>
              <div className="text-xs text-gray-500 mt-1">
                planhatdemo.com
              </div>
            </button>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex items-start">
              <svg
                className="w-5 h-5 text-red-500 mt-0.5"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                  clipRule="evenodd"
                />
              </svg>
              <div className="ml-3">
                <p className="text-sm text-red-800">{error}</p>
              </div>
            </div>
          </div>
        )}

        {/* Login Button */}
        <button
          onClick={() => { void handleLogin() }}
          disabled={isLoading}
          className={`
            w-full py-3 px-4 rounded-lg font-medium text-white
            transition-all duration-200
            ${isLoading
              ? 'bg-gray-400 cursor-not-allowed'
              : 'bg-blue-600 hover:bg-blue-700 active:bg-blue-800'
            }
            focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
          `}
        >
          {isLoading ? (
            <div className="flex items-center justify-center">
              <svg
                className="animate-spin h-5 w-5 mr-2"
                viewBox="0 0 24 24"
                fill="none"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
              Opening Login Window...
            </div>
          ) : (
            'Login to Planhat'
          )}
        </button>

        {/* Info Text */}
        <div className="text-center text-sm text-gray-500 space-y-2">
          <p>
            A secure login window will open where you can enter your Planhat credentials.
          </p>
          <p className="text-xs">
            Your credentials are never stored locally.
          </p>
        </div>

        {/* Version Info */}
        <div className="text-center text-xs text-gray-400 pt-4 border-t border-gray-200">
          Planhat Tools v{APP_VERSION}
        </div>
      </div>
    </div>
  )
}
