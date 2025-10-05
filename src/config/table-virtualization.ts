/**
 * Shared Table Virtualization Configuration
 *
 * Optimized settings for TanStack Table virtualization performance
 * based on performance testing and user experience optimization.
 */

export interface VirtualizationConfig {
  /** Number of rows to render outside the visible area */
  rowOverscan: number
  /** Number of columns to render outside the visible area */
  columnOverscan: number
  /** Default row height in pixels */
  rowHeight: number
  /** Enable row virtualization */
  enableRowVirtualization: boolean
  /** Enable column virtualization */
  enableColumnVirtualization: boolean
}

/**
 * Optimized virtualization settings for table performance
 *
 * These values have been tested to provide the best balance between
 * performance and smooth scrolling experience:
 * - Lower overscan values reduce DOM elements and improve performance
 * - Values tested on tables with 1000+ rows and 20+ columns
 */
export const OPTIMIZED_VIRTUALIZATION: VirtualizationConfig = {
  rowOverscan: 5,        // Reduced from default 10 for better performance
  columnOverscan: 3,     // Reduced from default 5 for better performance
  rowHeight: 48,         // Standard row height for good readability
  enableRowVirtualization: true,
  enableColumnVirtualization: true
}

/**
 * Conservative virtualization settings for compatibility
 *
 * Use these settings when you need more buffer for complex cell content
 * or when experiencing rendering issues with the optimized settings.
 */
export const CONSERVATIVE_VIRTUALIZATION: VirtualizationConfig = {
  rowOverscan: 8,
  columnOverscan: 4,
  rowHeight: 48,
  enableRowVirtualization: true,
  enableColumnVirtualization: true
}

/**
 * High performance virtualization settings for large datasets
 *
 * Use these settings for tables with very large datasets (10k+ rows)
 * where maximum performance is critical.
 */
export const HIGH_PERFORMANCE_VIRTUALIZATION: VirtualizationConfig = {
  rowOverscan: 3,
  columnOverscan: 2,
  rowHeight: 40,         // Smaller row height for more visible rows
  enableRowVirtualization: true,
  enableColumnVirtualization: true
}

/**
 * Get virtualization config based on data size
 */
export function getVirtualizationConfig(dataSize: number): VirtualizationConfig {
  if (dataSize > 10000) {
    return HIGH_PERFORMANCE_VIRTUALIZATION
  }
  if (dataSize > 1000) {
    return OPTIMIZED_VIRTUALIZATION
  }
  return CONSERVATIVE_VIRTUALIZATION
}

/**
 * Default virtualization settings to use across the application
 */
export const DEFAULT_VIRTUALIZATION = OPTIMIZED_VIRTUALIZATION