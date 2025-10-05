import type { ReactNode } from 'react'

import type { CellContext } from '@tanstack/react-table'

import type { CustomField } from './api'

export type FieldValueType =
  | 'string'
  | 'number'
  | 'boolean'
  | 'date'
  | 'object'
  | 'array'
  | 'richtext'
  | 'rating'
  | 'user'
  | 'users'
  | 'currency'
  | 'percentage'
  | 'url'
  | 'duration'
  | 'status'
  | 'category'
  | 'tag'
  | 'json'
  | 'unknown'

export type FieldSource = 'standard' | 'custom' | 'computed' | 'discovered'

export interface FieldMapping {
  /** Unique identifier for the field */
  key: string
  /** Human readable label */
  label: string
  /** Data type */
  type: FieldValueType
  /** Whether the field should be included in exports/tables */
  include: boolean
  /** Optional formatter for export rendering */
  formatter?: (value: unknown) => string
  /** Optional custom cell renderer for table display */
  cellRenderer?: (context: CellContext<any, any>) => ReactNode
  /** Origin of the field used by detection & tables */
  source?: FieldSource
  /** Custom field metadata */
  customFieldConfig?: CustomField
  /** Preferred column width hints */
  width?: number
}

export interface BorderStyle {
  top?: string
  bottom?: string
  left?: string
  right?: string
  color?: string
}

export interface CellStyle {
  bold?: boolean
  italic?: boolean
  underline?: boolean
  fontSize?: number
  fontFamily?: string
  fontColor?: string
  fill?: string
  horizontalAlignment?: 'left' | 'center' | 'right'
  verticalAlignment?: 'top' | 'center' | 'bottom'
  border?: boolean | BorderStyle
  numberFormat?: string
  wrapText?: boolean
}

export interface ConditionalFormattingRule {
  condition: 'equal' | 'not_equal' | 'greater_than' | 'less_than' | 'contains' | 'between'
  value: unknown
  value2?: unknown
  style: CellStyle
}

export interface EnhancedFieldMapping extends FieldMapping {
  headerStyle?: CellStyle
  cellStyle?: CellStyle
  conditionalFormatting?: ConditionalFormattingRule[]
}
