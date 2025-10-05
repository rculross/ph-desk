/**
 * Shared Hooks Index
 *
 * Central exports for all shared React hooks used across the extension.
 * Organized by category for easy discovery and tree-shaking.
 *
 * @module SharedHooks
 * @version 3.0.1
 */

// Export Hooks
export * from './useExport'

// Tenant Management Hooks
export * from './useTenantSelector'

// Data Management Hooks
export * from './useFieldDetection'

// UI Control Hooks (Enterprise-grade header architecture)
export {
  useToggleControl,
  useLoadingControl,
  useBadgeControl,
  useFormatControl,
  useComplexControl,
  useControlGroup,
  useButtonVariant
} from './useToolHeaderControls'
