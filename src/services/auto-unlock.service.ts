/**
 * Auto-Unlock Service
 *
 * Centralized service for automatic PIN unlocking using the default date-based PIN.
 * This eliminates code duplication across components that need auto-unlock functionality.
 */

import { logger } from '@/utils/logger'
import { getDefaultPin } from './default-pin.service'
import { pinProtectionService } from './pin-protection.service'

const log = logger.api

/**
 * Attempts to auto-unlock the session using the default PIN (today's date)
 *
 * This function checks if the session is already valid before attempting
 * to unlock, avoiding unnecessary PIN verification attempts.
 *
 * @returns Promise<boolean> - True if session is valid (either already or after unlock)
 */
export async function attemptAutoUnlock(): Promise<boolean> {
  try {
    // Check if session is already valid (avoid unnecessary PIN attempts)
    if (pinProtectionService.isSessionValid()) {
      log.debug('Session already valid, skipping auto-unlock')
      return true
    }

    // Attempt to unlock with default PIN
    const defaultPin = getDefaultPin()
    log.debug('Attempting auto-unlock with default PIN')

    await pinProtectionService.verifyPin(defaultPin)
    log.info('Auto-unlock successful')
    return true
  } catch (error) {
    // Auto-unlock failed (wrong PIN, session locked, etc.)
    log.debug('Auto-unlock failed', { error })
    return false
  }
}

/**
 * Checks if the session is currently valid
 *
 * This is a convenience wrapper around pinProtectionService.isSessionValid()
 * to keep all session-related logic centralized.
 *
 * @returns boolean - True if session is valid
 */
export function isSessionValid(): boolean {
  return pinProtectionService.isSessionValid()
}

/**
 * Invalidates the current session
 *
 * Forces the user to re-enter their PIN on next access.
 */
export function invalidateSession(): void {
  log.info('Invalidating session')
  pinProtectionService.invalidateSession()
}

/**
 * Auto-Unlock Service
 *
 * Exported as a singleton service for consistency with other services
 */
export const autoUnlockService = {
  attemptAutoUnlock,
  isSessionValid,
  invalidateSession
}
