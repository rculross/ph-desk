/**
 * Planhat Browser Service
 *
 * Service for managing the Planhat browser window
 * Provides TypeScript interface for opening/closing the Planhat browser
 */

import { logger } from '../utils/logger'

const log = logger.content

/**
 * Planhat Browser Service Class
 */
class PlanhatBrowserService {
  /**
   * Open Planhat browser window
   * Opens a dedicated browser window for Planhat
   */
  async openPlanhatBrowser(): Promise<void> {
    try {
      log.info('[PlanhatBrowser] Opening Planhat browser window...')

      if (!window.electron?.planhatBrowser?.open) {
        throw new Error('Planhat browser API not available')
      }

      await window.electron.planhatBrowser.open()
      log.info('[PlanhatBrowser] Planhat browser window opened successfully')
    } catch (error) {
      log.error('[PlanhatBrowser] Error opening Planhat browser', { error })
      throw error
    }
  }

  /**
   * Close Planhat browser window
   * Closes the dedicated Planhat browser window if it's open
   */
  async closePlanhatBrowser(): Promise<void> {
    try {
      log.info('[PlanhatBrowser] Closing Planhat browser window...')

      if (!window.electron?.planhatBrowser?.close) {
        throw new Error('Planhat browser API not available')
      }

      await window.electron.planhatBrowser.close()
      log.info('[PlanhatBrowser] Planhat browser window closed successfully')
    } catch (error) {
      log.error('[PlanhatBrowser] Error closing Planhat browser', { error })
      throw error
    }
  }

  /**
   * Toggle Planhat browser window
   * Opens the window if closed, closes it if open
   */
  async togglePlanhatBrowser(): Promise<void> {
    try {
      log.info('[PlanhatBrowser] Toggling Planhat browser window...')

      if (!window.electron?.planhatBrowser?.toggle) {
        throw new Error('Planhat browser API not available')
      }

      await window.electron.planhatBrowser.toggle()
      log.info('[PlanhatBrowser] Planhat browser window toggled successfully')
    } catch (error) {
      log.error('[PlanhatBrowser] Error toggling Planhat browser', { error })
      throw error
    }
  }

  /**
   * Check if Planhat browser window is open
   * @returns {Promise<boolean>} True if window is open, false otherwise
   */
  async isPlanhatBrowserOpen(): Promise<boolean> {
    try {
      if (!window.electron?.planhatBrowser?.isOpen) {
        log.warn('[PlanhatBrowser] Planhat browser API not available')
        return false
      }

      const isOpen = await window.electron.planhatBrowser.isOpen()
      log.debug(`[PlanhatBrowser] Window status: ${isOpen ? 'open' : 'closed'}`)
      return isOpen
    } catch (error) {
      log.error('[PlanhatBrowser] Error checking Planhat browser status', { error })
      return false
    }
  }
}

// Singleton instance
export const planhatBrowserService = new PlanhatBrowserService()

// Export as default as well for convenience
export default planhatBrowserService
