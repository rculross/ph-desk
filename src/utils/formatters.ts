/**
 * Shared formatters for table columns
 *
 * Centralizes common formatting logic to eliminate duplication across table components.
 * Provides simple, consistent formatting functions following TanStack Table patterns.
 */

import { format } from 'date-fns'

/**
 * Format a date value with optional time display
 *
 * @param value - Date value (string, Date, or null/undefined)
 * @param showTime - Whether to include time component
 * @returns Formatted date string or empty string if invalid
 */
export function formatDate(value: string | Date | null | undefined, showTime: boolean = false): string {
  if (!value) return ''

  try {
    const date = new Date(value)
    if (!isNaN(date.getTime())) {
      if (showTime) {
        return format(date, 'yyyy-MM-dd HH:mm:ss')
      } else {
        return format(date, 'yyyy-MM-dd')
      }
    }
    return ''
  } catch (error) {
    return ''
  }
}

/**
 * Format a date value with a custom format pattern
 *
 * @param value - Date value (string, Date, or null/undefined)
 * @param formatPattern - date-fns format pattern
 * @returns Formatted date string or original value if invalid
 */
export function formatDateCustom(value: string | Date | null | undefined, formatPattern: string): string {
  if (!value) return ''

  try {
    const date = new Date(value)
    if (!isNaN(date.getTime())) {
      return format(date, formatPattern)
    }
    return String(value)
  } catch (error) {
    return String(value)
  }
}

/**
 * Truncate text to a maximum length with optional ellipsis
 *
 * @param text - Text to truncate
 * @param maxLength - Maximum length before truncation
 * @returns Truncated text
 */
export function truncateText(text: string, maxLength: number = 100): string {
  if (!text) return ''

  const stringValue = String(text)
  if (stringValue.length <= maxLength) {
    return stringValue
  }

  return `${stringValue.substring(0, maxLength)}...`
}

/**
 * Format boolean values as Yes/blank
 *
 * @param value - Boolean value
 * @returns 'Yes' or empty string (blank for false/null/undefined)
 */
export function formatBoolean(value: boolean | null | undefined): string {
  return value === true ? 'Yes' : ''
}

/**
 * Format array values as item count
 *
 * @param value - Array value
 * @returns Formatted count string or empty string
 */
export function formatArray(value: any[] | null | undefined): string {
  if (Array.isArray(value)) {
    return `${value.length} items`
  }
  return ''
}