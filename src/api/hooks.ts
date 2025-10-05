/**
 * React Query Hooks for UI Components
 * 
 * This file exports all React hooks and UI-specific API utilities.
 * It should only be imported by React components, not by service workers.
 */

// Export all query hooks for UI components
export * from './queries'

// Note: This file should only be imported by React components
// Service workers should use the main ./api/index.ts which excludes React dependencies