/**
 * Text Processing Utilities
 *
 * Utilities for processing and cleaning text content, particularly
 * for handling rich text fields from Planhat API responses.
 */

import DOMPurify from 'dompurify'

import { logger } from './logger'

const log = logger.content

/**
 * Strips HTML tags from a string and returns plain text
 * Uses multiple approaches for robust HTML stripping in Chrome extension context
 * @param html - The HTML string to strip
 * @returns Plain text with HTML tags removed
 */
export function stripHtml(html: string | null | undefined): string {
  if (!html || typeof html !== 'string') {
    return ''
  }

  try {
    // Use DOMPurify to clean the HTML
    const cleanText = DOMPurify.sanitize(html, {
      ALLOWED_TAGS: [],
      ALLOWED_ATTR: [],
      KEEP_CONTENT: true
    })

    // Clean up extra whitespace but preserve line breaks
    return cleanText
      .replace(/[ \t]+/g, ' ') // Replace multiple spaces/tabs with single space
      .replace(/\n\s*\n/g, '\n') // Replace multiple line breaks with single line break
      .replace(/[ \t]*\n[ \t]*/g, '\n') // Clean whitespace around line breaks
      .trim()
  } catch (error) {
    log.warn('DOMPurify failed, falling back to DOM parsing', { error })
  }

  try {
    // Fallback to DOM parsing if DOMPurify is not available
    if (typeof document !== 'undefined') {
      const tempDiv = document.createElement('div')
      tempDiv.innerHTML = html

      // Extract text content, which automatically strips HTML tags
      const plainText = (tempDiv.textContent || tempDiv.innerText) ?? ''

      // Clean up extra whitespace but preserve line breaks
      return plainText
        .replace(/[ \t]+/g, ' ') // Replace multiple spaces/tabs with single space
        .replace(/\n\s*\n/g, '\n') // Replace multiple line breaks with single line break
        .replace(/[ \t]*\n[ \t]*/g, '\n') // Clean whitespace around line breaks
        .trim()
    }

    // If neither DOMPurify nor DOM is available, fall through to regex approach
    throw new Error('Neither DOMPurify nor DOM available')

  } catch (error) {
    log.warn('Failed to strip HTML from text using DOM methods, falling back to regex', {
      error: error instanceof Error ? error.message : String(error),
      htmlLength: html.length,
      htmlPreview: html.substring(0, 100)
    })

    // Final fallback: use regex to strip basic HTML tags
    return html
      .replace(/<[^>]*>/g, '') // Remove HTML tags
      .replace(/&(?:[a-zA-Z][a-zA-Z0-9]{1,31}|#(?:[0-9]{1,7}|x[0-9a-fA-F]{1,6}));/g, ' ') // Remove HTML entities (enhanced)
      .replace(/[ \t]+/g, ' ') // Replace multiple spaces/tabs with single space
      .replace(/\n\s*\n/g, '\n') // Replace multiple line breaks with single line break
      .replace(/[ \t]*\n[ \t]*/g, '\n') // Clean whitespace around line breaks
      .trim()
  }
}

/**
 * Checks if a string contains HTML tags
 * @param text - The text to check
 * @returns True if the text contains HTML tags
 */
export function containsHtml(text: string | null | undefined): boolean {
  if (!text || typeof text !== 'string') {
    return false
  }
  
  // Look for HTML tag patterns - must be proper HTML tags, not just angle brackets
  const htmlTagPattern = /<\/?[a-zA-Z][a-zA-Z0-9]*[^>]*>/
  return htmlTagPattern.test(text)
}

/**
 * Processes text for table display by stripping HTML if present
 * @param value - The value to process (can be any type)
 * @param maxLength - Optional maximum length for truncation
 * @returns Processed text suitable for table display
 */
export function processForTableDisplay(value: unknown, maxLength?: number): string {
  // Handle null, undefined, or non-string values
  if (value === null || value === undefined) {
    return ''
  }

  // Convert to string if not already
  const stringValue = String(value)

  // Strip HTML if present
  const processedText = containsHtml(stringValue) ? stripHtml(stringValue) : stringValue

  // Convert line breaks to spaces for table display
  const tableText = processedText.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim()

  // Truncate if maxLength is specified
  if (maxLength && tableText.length > maxLength) {
    return `${tableText.substring(0, maxLength)}...`
  }

  return tableText
}

/**
 * Creates a formatter function for table columns that handles rich text
 * @param maxLength - Optional maximum length for truncation
 * @returns A formatter function suitable for table column definitions
 */
export function createRichTextFormatter(maxLength?: number) {
  return (value: unknown): string => {
    return processForTableDisplay(value, maxLength)
  }
}

/**
 * Truncates text to a specified length with ellipsis
 * @param text - The text to truncate
 * @param maxLength - Maximum length before truncation
 * @returns Truncated text with ellipsis if needed
 */
export function truncateText(text: string, maxLength: number): string {
  if (!text || text.length <= maxLength) {
    return text
  }
  
  return `${text.substring(0, maxLength)}...`
}

/**
 * Sanitizes a string to be safe for use in CSS custom property names
 * Converts invalid characters to valid CSS identifier characters
 * @param id - The original identifier (e.g., column ID)
 * @returns A CSS-safe identifier suitable for custom property names
 */
export function sanitizeCSSPropertyName(id: string): string {
  if (!id || typeof id !== 'string') {
    return 'col-invalid'
  }

  return id
    // Replace dots with hyphens
    .replace(/\./g, '-')
    // Replace spaces with underscores
    .replace(/\s+/g, '_')
    // Replace other invalid CSS identifier characters with hyphens
    .replace(/[^a-zA-Z0-9_-]/g, '-')
    // Ensure it doesn't start with a number or hyphen (CSS requirement)
    .replace(/^[0-9-]/, 'col-$&')
    // Remove consecutive hyphens/underscores
    .replace(/[-_]{2,}/g, '-')
    // Ensure it's not empty
    ?? 'col-fallback'
}

/**
 * Common text formatters for table display
 */
export const textFormatters = {
  /**
   * Standard rich text formatter for table cells (strips HTML, truncates at 80 chars)
   */
  richText: createRichTextFormatter(80),

  /**
   * Short rich text formatter for table cells (strips HTML, truncates at 50 chars)
   */
  richTextShort: createRichTextFormatter(50),

  /**
   * Medium rich text formatter for table cells (strips HTML, truncates at 100 chars)
   */
  richTextMedium: createRichTextFormatter(100),

  /**
   * Long rich text formatter for table cells (strips HTML, truncates at 150 chars)
   */
  richTextLong: createRichTextFormatter(150),

  /**
   * Rich text formatter without truncation (strips HTML only)
   */
  richTextFull: createRichTextFormatter(),

  /**
   * Plain text truncation formatter
   */
  plainText: (maxLength: number) => (value: unknown): string => {
    const text = String(value ?? '')
    return truncateText(text, maxLength)
  }
}