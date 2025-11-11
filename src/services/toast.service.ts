import toast from 'react-hot-toast'

import { getUserFriendlyMessage } from '@/api/errors'

/**
 * Toast Service
 *
 * Centralized service for all toast notifications using react-hot-toast.
 * Provides consistent error handling, message formatting, and toast management.
 *
 * Usage:
 * ```typescript
 * import { toastService } from '@/services/toast.service'
 *
 * // Success message
 * toastService.success('Operation completed!')
 *
 * // Error handling
 * toastService.error(error)
 *
 * // Promise-based async operations
 * toastService.promise(
 *   asyncOperation(),
 *   {
 *     loading: 'Processing...',
 *     success: 'Done!',
 *     error: 'Failed to process'
 *   }
 * )
 * ```
 */

export const toastService = {
  /**
   * Show a success toast message
   * @param message - Success message to display
   * @param duration - Optional duration in milliseconds
   */
  success: (message: string, duration?: number) => {
    return toast.success(message, { duration })
  },

  /**
   * Show an error toast message
   * Automatically converts errors to user-friendly messages
   * @param error - Error object, string, or unknown error
   * @param duration - Optional duration in milliseconds
   */
  error: (error: unknown, duration?: number) => {
    const message = typeof error === 'string'
      ? error
      : getUserFriendlyMessage(error as Error)
    return toast.error(message, { duration })
  },

  /**
   * Show a loading toast message
   * Returns a toast ID that can be used to dismiss the toast
   * @param message - Loading message to display
   */
  loading: (message: string) => {
    return toast.loading(message)
  },

  /**
   * Show an info toast message
   * @param message - Info message to display
   * @param duration - Optional duration in milliseconds
   */
  info: (message: string, duration?: number) => {
    return toast(message, { duration })
  },

  /**
   * Automatically handle promise states with toast messages
   * Shows loading, success, or error toasts based on promise resolution
   * @param promise - Promise to track
   * @param messages - Messages for each state (loading, success, error)
   * @returns The original promise
   */
  promise: <T,>(
    promise: Promise<T>,
    messages: {
      loading: string
      success: string | ((data: T) => string)
      error: string | ((error: any) => string)
    }
  ) => {
    return toast.promise(promise, messages)
  },

  /**
   * Dismiss a specific toast by ID, or all toasts if no ID provided
   * @param toastId - Optional toast ID to dismiss
   */
  dismiss: (toastId?: string) => {
    return toast.dismiss(toastId)
  },

  /**
   * Remove a toast from the DOM
   * @param toastId - Toast ID to remove
   */
  remove: (toastId: string) => {
    return toast.remove(toastId)
  }
}

/**
 * Common toast messages
 * Reusable message constants for consistency across the app
 */
export const TOAST_MESSAGES = {
  // Generic
  LOADING: 'Loading...',
  SAVING: 'Saving...',
  DELETING: 'Deleting...',
  PROCESSING: 'Processing...',

  // Success
  SAVED: 'Saved successfully',
  DELETED: 'Deleted successfully',
  COPIED: 'Copied to clipboard',
  EXPORTED: 'Export completed',
  IMPORTED: 'Import completed',

  // Errors
  SAVE_FAILED: 'Failed to save',
  DELETE_FAILED: 'Failed to delete',
  LOAD_FAILED: 'Failed to load',
  EXPORT_FAILED: 'Export failed',
  IMPORT_FAILED: 'Import failed',
  NETWORK_ERROR: 'Network error. Please check your connection.',
  UNAUTHORIZED: 'Please log in to continue',

  // Validation
  REQUIRED_FIELD: 'Please fill in all required fields',
  INVALID_FORMAT: 'Invalid format',

  // Auth
  LOGIN_REQUIRED: 'Please login and select a tenant first',
  SESSION_EXPIRED: 'Your session has expired. Please log in again.'
}
