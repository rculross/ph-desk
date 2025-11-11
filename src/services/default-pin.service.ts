/**
 * Default PIN Service
 *
 * Provides centralized PIN generation logic for the application.
 * Default PIN format: MMDDYY (e.g., "110925" for November 9, 2025)
 */

import { logger } from '@/utils/logger'

const log = logger.api

/**
 * Generates the default PIN based on today's date
 *
 * Format: MMDDYY
 * Example: November 9, 2025 → "110925"
 *
 * @returns The default PIN string (6 digits)
 */
export function getDefaultPin(): string {
  return getDefaultPinForDate(new Date())
}

/**
 * Generates the default PIN for a specific date
 *
 * Format: MMDDYY
 * Example: September 25, 2025 → "092525"
 *
 * @param date - The date to generate PIN for
 * @returns The default PIN string (6 digits)
 */
export function getDefaultPinForDate(date: Date): string {
  const month = (date.getMonth() + 1).toString().padStart(2, '0')
  const day = date.getDate().toString().padStart(2, '0')
  const year = date.getFullYear().toString().slice(-2)
  const pin = `${month}${day}${year}`

  log.debug(`Generated default PIN for date ${date.toISOString()}: ${pin}`)
  return pin
}

/**
 * Validates that a PIN matches the expected format (6 digits)
 *
 * @param pin - The PIN to validate
 * @returns True if PIN is valid format (6 digits)
 */
export function isValidPinFormat(pin: string): boolean {
  return /^\d{6}$/.test(pin)
}

/**
 * Gets a human-readable explanation of the default PIN
 *
 * @returns Explanation string for users
 */
export function getDefaultPinExplanation(): string {
  const pin = getDefaultPin()
  const now = new Date()
  const month = now.toLocaleString('en-US', { month: 'long' })
  const day = now.getDate()
  const year = now.getFullYear()

  return `Today's date (${month} ${day}, ${year}) in MMDDYY format: ${pin}`
}
