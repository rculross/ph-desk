import React from 'react'

import { QueryClientProvider } from '@tanstack/react-query'
import { createRoot } from 'react-dom/client'

import '../styles/globals.css'

import { api } from '../api'
import { queryClient } from '../api/query-client'
import { logger, initializeLoggerFromStorage } from '../utils/logger'
import { ensureReactInitialized } from '../utils/react-fix'

import { App } from './App'

// Initialize React safely
async function initializeDesktopApp() {
  try {
    // Initialize logger with user's saved settings
    await initializeLoggerFromStorage()

    // First, ensure React is properly initialized to prevent TDZ errors
    await ensureReactInitialized()

    // Initialize API client for desktop app
    const apiInitResult = await api.utils.initialize()
    if (apiInitResult.success) {
      logger.content.debug('API layer initialized successfully for desktop app')
    } else {
      logger.content.warn('API layer initialization had issues:', apiInitResult.error)
    }

    logger.content.debug('Desktop app initializing')

    // Render the app
    const container = document.getElementById('root')
    if (!container) {
      const error = new Error('Desktop app root element not found')
      logger.content.error('Critical initialization failure - root element missing', {
        error: error.message,
        documentReady: document.readyState,
        bodyExists: !!document.body,
        htmlExists: !!document.documentElement
      })

      // Attempt to create the root element as fallback
      const fallbackContainer = document.createElement('div')
      fallbackContainer.id = 'root'
      fallbackContainer.style.cssText = 'width: 100%; height: 100vh; margin: 0; padding: 0;'
      document.body.appendChild(fallbackContainer)

      logger.content.info('Created fallback root element for desktop app')

      const root = createRoot(fallbackContainer)
      root.render(
        <React.StrictMode>
          <QueryClientProvider client={queryClient}>
            <App />
          </QueryClientProvider>
        </React.StrictMode>
      )
      return
    }

    const root = createRoot(container)
    root.render(
      <React.StrictMode>
        <QueryClientProvider client={queryClient}>
          <App />
        </QueryClientProvider>
      </React.StrictMode>
    )

    logger.content.info('Desktop app initialized successfully')
  } catch (error) {
    logger.content.error('Failed to initialize desktop app:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      documentReady: document.readyState
    })

    // Enhanced fallback rendering with better error recovery
    try {
      let container = document.getElementById('root')

      if (!container) {
        // Try to create fallback container
        container = document.createElement('div')
        container.id = 'root'
        container.style.cssText = 'width: 100%; height: 100vh; margin: 0; padding: 0;'

        if (document.body) {
          document.body.appendChild(container)
          logger.content.info('Created emergency fallback container')
        } else {
          // Last resort: wait for body and try again
          document.addEventListener('DOMContentLoaded', () => {
            if (container && document.body) {
              document.body.appendChild(container)
              const root = createRoot(container)
              root.render(
                <QueryClientProvider client={queryClient}>
                  <App />
                </QueryClientProvider>
              )
              logger.content.info('Emergency late initialization completed')
            }
          })
          return
        }
      }

      const root = createRoot(container)
      root.render(
        <QueryClientProvider client={queryClient}>
          <App />
        </QueryClientProvider>
      )
      logger.content.info('Fallback rendering completed successfully')

    } catch (fallbackError) {
      logger.content.error('Critical failure: All fallback initialization attempts failed', {
        error: fallbackError instanceof Error ? fallbackError.message : 'Unknown error',
        stack: fallbackError instanceof Error ? fallbackError.stack : undefined,
        originalError: error instanceof Error ? error.message : 'Unknown error'
      })

      // Show user-visible error message
      const errorDiv = document.createElement('div')
      errorDiv.innerHTML = `
        <div style="padding: 20px; color: red; font-family: Arial; background: #fff; border: 1px solid #ccc;">
          <h3>Desktop App Failed to Load</h3>
          <p>The PH Tools desktop app could not initialize properly. Please try:</p>
          <ul>
            <li>Restarting the application</li>
            <li>Checking the developer console for detailed errors</li>
          </ul>
          <p><small>Error: ${error instanceof Error ? error.message : 'Unknown error'}</small></p>
        </div>
      `

      if (document.body) {
        document.body.appendChild(errorDiv)
      } else {
        document.addEventListener('DOMContentLoaded', () => {
          document.body.appendChild(errorDiv)
        })
      }
    }
  }
}

// Start initialization
initializeDesktopApp()
