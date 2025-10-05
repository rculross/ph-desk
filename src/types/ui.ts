/**
 * Shared UI Types and Constants
 *
 * Enterprise-grade type definitions and constants for consistent UI component usage
 * across the Chrome extension, focusing on header standardization and type safety.
 *
 * @module SharedUITypes
 * @version 3.0.1
 * @author Claude Code Architecture Team
 */

import type { CSSProperties, ReactNode } from 'react'

import type { ButtonProps } from 'antd'
import type { LucideIcon } from 'lucide-react'

/**
 * Control Categories for semantic UI grouping
 *
 * Provides consistent categorization for UI controls across all tools.
 * Categories are ordered by priority and have associated theming.
 */
export const CONTROL_CATEGORIES = {
  /** Field selectors, refresh actions */
  OUTPUT: 'output',
  /** Filters, limits, endpoints */
  DATA: 'data',
  /** Format selection, export actions */
  EXPORT: 'export',
  /** Filter toggles and controls */
  FILTER: 'filter',
  /** Table manipulation controls (grouping, sorting, filtering) */
  TABLE: 'table',
  /** Row grouping controls */
  GROUPING: 'grouping',
  /** Column filtering controls */
  FILTERING: 'filtering',
  /** Column sorting controls */
  SORTING: 'sorting',
  /** Column visibility and display controls */
  VIEW: 'view',
  /** Selection controls (dropdowns, pickers) */
  SELECTION: 'selection',
  /** Action buttons (settings, clear, etc.) */
  ACTIONS: 'actions',
  /** Settings and configuration controls */
  SETTINGS: 'settings'
} as const

/** Type-safe control category union */
export type ControlCategory = typeof CONTROL_CATEGORIES[keyof typeof CONTROL_CATEGORIES]

/**
 * Button Variants for consistent styling
 *
 * Maps to Ant Design button types with semantic meaning.
 */
export const BUTTON_VARIANTS = {
  /** Primary actions (save, submit, execute) */
  PRIMARY: 'primary',
  /** Secondary actions (cancel, reset) */
  SECONDARY: 'secondary',
  /** Subtle actions (toggle, auxiliary) */
  GHOST: 'ghost'
} as const

/** Type-safe button variant union */
export type ButtonVariant = typeof BUTTON_VARIANTS[keyof typeof BUTTON_VARIANTS]

// UI Configuration
export const TOOL_UI_CONFIG = {
  button: {
    minWidth: '100px',
    compactWidth: '100px',
    borderRadius: '0px',
    height: '24px' // Updated from 32px
  },
  spacing: {
    controlGroup: 'middle',
    withinGroup: 'small',
    compact: 'small'
  },
  categories: {
    output: { color: 'blue', priority: 1, description: 'Field selectors, refresh actions' },
    data: { color: 'green', priority: 2, description: 'Filters, limits, endpoints' },
    export: { color: 'purple', priority: 3, description: 'Format selection, export actions' },
    filter: { color: 'gray', priority: 4, description: 'Filter toggles and controls' }
  }
} as const

/**
 * CSS-in-JS style objects for consistent Ant Design component styling
 *
 * Pre-defined style objects ensure visual consistency across all tools.
 */
export const TOOL_BUTTON_STYLE: CSSProperties = {
  minWidth: TOOL_UI_CONFIG.button.minWidth,
  borderRadius: TOOL_UI_CONFIG.button.borderRadius,
  height: TOOL_UI_CONFIG.button.height
} as const

export const COMPACT_BUTTON_STYLE: CSSProperties = {
  minWidth: TOOL_UI_CONFIG.button.compactWidth,
  borderRadius: TOOL_UI_CONFIG.button.borderRadius,
  height: TOOL_UI_CONFIG.button.height
} as const

export const EXPORT_BUTTON_STYLE: CSSProperties = {
  minWidth: '80px',
  borderRadius: TOOL_UI_CONFIG.button.borderRadius,
  height: '24px'
} as const

/** Style variant mapping */
export const BUTTON_STYLE_VARIANTS = {
  default: TOOL_BUTTON_STYLE,
  compact: COMPACT_BUTTON_STYLE
} as const

export type ButtonStyleVariant = keyof typeof BUTTON_STYLE_VARIANTS


/**
 * Tool Header Configuration Types
 *
 * Type-safe configuration interfaces for declarative header setup.
 */
export interface ToolHeaderConfig {
  /** Display title for the tool */
  title: string
  /** Lucide icon component */
  icon: LucideIcon
  /** Organized control groups */
  controls: ControlGroupConfig[]
  /** Optional CSS class name */
  className?: string
}

/** Configuration for a group of related controls */
export interface ControlGroupConfig {
  /** Semantic category for the control group */
  category: ControlCategory
  /** Individual controls in this group */
  controls: ControlConfig[]
  /** Spacing between controls */
  spacing?: 'compact' | 'normal' | 'wide'
  /** Optional group label */
  label?: string
}

/** Configuration for individual controls */
export interface ControlConfig<TControlType extends ControlType = ControlType> {
  /** Control type determines rendering strategy */
  type: TControlType
  /** Unique identifier within the group */
  key: string
  /** Type-safe props based on control type */
  props: ControlPropsMap[TControlType]
}

/** Supported control types */
export type ControlType = 'button' | 'select' | 'input' | 'toggle' | 'radio-group' | 'date-picker'

/** Type mapping for control-specific props */
export interface ControlPropsMap {
  button: ButtonProps & { icon?: ReactNode; badge?: string | number }
  select: { options: SelectOption[]; placeholder?: string; onChange?: (value: any) => void }
  input: { placeholder?: string; type?: string; onChange?: (value: string) => void }
  toggle: { label?: string; defaultChecked?: boolean; onChange?: (checked: boolean) => void }
  'radio-group': { options: RadioOption[]; defaultValue?: string; onChange?: (value: any) => void }
  'date-picker': { format?: string; onChange?: (date: Date | null) => void }
}

/** Select option interface */
export interface SelectOption {
  value: string | number
  label: string
  description?: string
  disabled?: boolean
}

/** Radio option interface */
export interface RadioOption {
  label: string
  value: string | number
  disabled?: boolean
}

// Standard Button Configuration Presets
export const BUTTON_PRESETS = {
  // Primary actions
  export: {
    type: 'primary' as const,
    size: 'small' as const,
    style: TOOL_BUTTON_STYLE
  },
  execute: {
    type: 'primary' as const,
    size: 'small' as const,
    style: TOOL_BUTTON_STYLE
  },

  // Secondary actions
  refresh: {
    type: 'default' as const,
    size: 'small' as const,
    style: TOOL_BUTTON_STYLE
  },

  // Toggle states
  filter: {
    type: 'default' as const,
    size: 'small' as const,
    style: TOOL_BUTTON_STYLE
  },
  fields: {
    type: 'default' as const,
    size: 'small' as const,
    style: TOOL_BUTTON_STYLE
  },

  // Compact variants
  compactDefault: {
    type: 'default' as const,
    size: 'small' as const,
    style: COMPACT_BUTTON_STYLE
  }
} as const

/**
 * Export Format Options
 *
 * Standardized format options for data export functionality.
 */
export const EXPORT_FORMAT_OPTIONS = [
  { label: 'CSV', value: 'csv', description: 'Comma-separated values' },
  { label: 'Excel', value: 'xlsx', description: 'Microsoft Excel format' },
  { label: 'JSON', value: 'json', description: 'JavaScript Object Notation' }
] as const

/** Type-safe export format union */
export type ExportFormat = typeof EXPORT_FORMAT_OPTIONS[number]['value']

/** Export format option with metadata */
export type ExportFormatOption = typeof EXPORT_FORMAT_OPTIONS[number]

// Color mapping for consistent theming
export const CATEGORY_COLORS = {
  [CONTROL_CATEGORIES.OUTPUT]: '#1890ff', // Ant Design primary blue
  [CONTROL_CATEGORIES.DATA]: '#52c41a',   // Ant Design success green
  [CONTROL_CATEGORIES.EXPORT]: '#722ed1', // Ant Design purple
  [CONTROL_CATEGORIES.FILTER]: '#8c8c8c'  // Ant Design gray
} as const

