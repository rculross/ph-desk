/**
 * Table Column Utilities
 *
 * Simplified column creation following TanStack Table best practices.
 * Separates column logic from hooks and complex memoization.
 */

import React from 'react'

import {
  ArrowLeftOutlined,
  ArrowRightOutlined,
  DatabaseOutlined,
  StopOutlined,
  SwapOutlined,
  TagOutlined
} from '@ant-design/icons'
import {
  createColumnHelper,
  type ColumnDef,
  type AccessorFn,
  type CellContext,
  type FilterFn
} from '@tanstack/react-table'
import { Badge, Tag, Tooltip, Typography } from 'antd'

import { useUserName } from '../api/queries/users.queries'
import type { EntityType } from '../types/api'
import type { FieldMapping } from '../types/export'
import type {
  PlanhatFieldType,
  SalesforceDirection,
  SalesforceFieldType
} from '../types/integrations/salesforce.types'

import { formatDate, formatBoolean, formatArray } from './formatters'
import { processForTableDisplay } from './text-utils'

const { Text } = Typography

/**
 * Custom filter function for date ranges
 */
const dateRangeFilter: FilterFn<any> = (row, columnId, value) => {
  if (!value || !Array.isArray(value) || value.length !== 2) {
    return true // Show all rows if no filter value
  }

  const [startDate, endDate] = value
  const cellValue = row.getValue(columnId)

  if (!cellValue) {
    return false
  }

  // Convert cell value to date
  const cellDate = new Date(cellValue)
  const start = new Date(startDate)
  const end = new Date(endDate)

  // Check if cell date is within range
  return cellDate >= start && cellDate <= end
}

// Register the custom filter function
dateRangeFilter.autoRemove = (val: any) => !val || !Array.isArray(val) || val.length === 0

// Export the custom filter function for use in column definitions
export { dateRangeFilter }

/**
 * Get appropriate TanStack filter function based on field type
 */
function getFilterFunctionForFieldType(fieldType: string, fieldKey: string): FilterFn<any> | string | undefined {
  // Date fields use custom date range filtering
  if (fieldType === 'date' || fieldKey.includes('date') || fieldKey.includes('time') || fieldKey === 'createdAt' || fieldKey === 'updatedAt') {
    return dateRangeFilter
  }

  // Number fields use range filtering
  if (fieldType === 'number' || fieldType === 'integer') {
    return 'inNumberRange'
  }

  // Array/list fields and enum fields use array includes
  if (fieldType === 'array' || fieldType === 'enum' || fieldKey === 'status' || fieldKey === 'type' || fieldKey === 'model' || fieldKey === 'operation') {
    return 'arrIncludes'
  }

  // Text fields use case-insensitive string includes
  if (fieldType === 'string' || fieldType === 'text') {
    return 'includesString'
  }

  // For everything else, let TanStack use default filtering
  return undefined
}

/**
 * Get filter type for the ColumnFilter component
 */
function getFilterTypeForField(fieldType: string, fieldKey: string): 'text' | 'select' | 'number' | 'date' {
  // Date fields
  if (fieldType === 'date' || fieldKey.includes('date') || fieldKey.includes('time') || fieldKey === 'createdAt' || fieldKey === 'updatedAt') {
    return 'date'
  }

  // Number fields
  if (fieldType === 'number' || fieldType === 'integer') {
    return 'number'
  }

  // Select/dropdown fields - limited options that benefit from dropdown
  if (fieldType === 'enum' || fieldKey === 'status' || fieldKey === 'type' || fieldKey === 'model' || fieldKey === 'operation' || fieldKey === 'actorDisplay') {
    return 'select'
  }

  // Everything else defaults to text
  return 'text'
}

/**
 * Component to display user name by looking up user ID from cached data
 */
function UserName({ userId }: { userId: string }) {
  const userName = useUserName(userId)
  return <span>{userName}</span>
}

export interface ColumnConfig {
  width?: number
  minWidth?: number
  maxWidth?: number
  enableSorting?: boolean
  enableFiltering?: boolean
  enableGrouping?: boolean
  enableResizing?: boolean
}

/**
 * Get intelligent column width based on field type and name
 */
export function getColumnWidth(fieldKey: string, fieldType: string): ColumnConfig {
  switch (fieldType) {
    case 'date':
      return { width: 150, minWidth: 60, maxWidth: 600 }
    case 'boolean':
      return { width: 80, minWidth: 40, maxWidth: 600 }
    case 'number':
      return { width: 100, minWidth: 50, maxWidth: 600 }
    case 'array':
      return { width: 140, minWidth: 60, maxWidth: 600 }
    case 'user':
    case 'users':
      return { width: 160, minWidth: 70, maxWidth: 600 }
    default:
      // Text fields - use intelligent sizing based on field name
      if (fieldKey === 'title' || fieldKey === 'name' || fieldKey === 'subject') {
        return { width: 300, minWidth: 110, maxWidth: 600 }
      } else if (isRichTextField(fieldKey, fieldType)) {
        // Rich text fields need more width for truncated content
        return { width: 350, minWidth: 125, maxWidth: 600 }
      } else if (fieldKey === 'status' || fieldKey === 'state' || fieldKey === 'type' || fieldKey === 'priority') {
        return { width: 120, minWidth: 50, maxWidth: 600 }
      } else if (fieldKey.includes('id') || fieldKey === '_id') {
        return { width: 100, minWidth: 50, maxWidth: 600 }
      } else {
        // Default for other text fields
        return { width: 160, minWidth: 60, maxWidth: 600 }
      }
  }
}

/**
 * Determine if a field should show time component based on field name patterns
 */
function shouldShowTime(fieldKey: string, customFieldConfig?: any): boolean {
  // Universal datetime field patterns - these ALWAYS include time
  const datetimePatterns = [
    /At$/i,              // createdAt, updatedAt, deletedAt, etc.
    /Time$/i,            // lastTime, syncTime, firstTime, etc.
    /Timestamp$/i,       // any timestamp fields
    /Login$/i,           // lastLogin, firstLogin
    /Touch$/i,           // lastTouch, firstTouch
    /Seen$/i,            // lastSeen, firstSeen
    /Sync/i,             // syncedAt, lastSync, syncTime, etc.
    /_at$/i,             // snake_case versions: created_at, updated_at
    /_time$/i,           // snake_case versions: last_time, sync_time
    /DateTime/i,         // any field containing DateTime
    /Occurred/i,         // occurredAt, lastOccurred
    /Started/i,          // startedAt, taskStarted
    /Ended/i,            // endedAt, taskEnded
    /Completed/i,        // completedAt, taskCompleted
    /Modified/i,         // modifiedAt, lastModified
    /Changed/i,          // changedAt, lastChanged
    /Processed/i,        // processedAt, lastProcessed
    /Executed/i         // executedAt, lastExecuted
  ]

  // Date-only patterns - these should NOT include time
  const dateOnlyPatterns = [
    /^date$/i,           // simple "date" field
    /Date$/i,            // birthDate, dueDate, startDate, endDate
    /Born$/i,            // dateBorn
    /Due$/i,             // dateDue
    /Start$/i,           // dateStart (but not startedAt)
    /End$/i,             // dateEnd (but not endedAt)
    /Expires?$/i,        // expires, dateExpires
    /Anniversary/i      // anniversary dates
  ]

  // First check if it explicitly should be date-only
  for (const pattern of dateOnlyPatterns) {
    if (pattern.test(fieldKey)) return false
  }

  // Then check if field name matches datetime patterns
  for (const pattern of datetimePatterns) {
    if (pattern.test(fieldKey)) return true
  }

  // Check if it's a custom field explicitly marked as datetime
  if (customFieldConfig?.type === 'datetime') return true

  // Default: if it's a date field but doesn't match datetime patterns, show date only
  return false
}


/**
 * Create accessor function for a field
 */
function createAccessor<TData>(fieldKey: string, isCustomField: boolean): AccessorFn<TData, any> {
  if (fieldKey === 'fullName') {
    // Special case for concatenated name field
    return (row: TData) => {
      const user = row as any
      const firstName = user.firstName || ''
      const lastName = user.lastName || ''
      return `${lastName}, ${firstName}`.replace(/^,\s*|,\s*$/g, '')
    }
  } else if (fieldKey === 'msCalendarApi.calendarToSave') {
    // Special case for calendar to save - extract name only
    return (row: TData) => {
      const user = row as any
      const calendarToSave = user.msCalendarApi?.calendarToSave
      if (!calendarToSave || typeof calendarToSave !== 'object') return ''
      return calendarToSave.name || ''
    }
  } else if (isCustomField) {
    // For custom fields, access the nested custom object safely
    const actualKey = fieldKey.substring(7) // Remove 'custom.' prefix
    return (row: TData) => {
      const custom = (row as any).custom || {}
      const value = custom[actualKey]
      return value ?? ''
    }
  } else if (fieldKey.includes('.')) {
    // Handle nested properties like 'company.name'
    const keys = fieldKey.split('.')
    return (row: TData) => {
      let value = row as any
      for (const key of keys) {
        value = value?.[key]
        if (value === undefined || value === null) break
      }
      return value ?? ''
    }
  } else {
    // For standard fields, access the property directly
    return (row: TData) => {
      const value = (row as any)[fieldKey]
      return value ?? ''
    }
  }
}

/**
 * Detect if a field should be treated as rich text based on field name or type
 */
function isRichTextField(fieldKey: string, fieldType: string): boolean {
  // Check field type first
  if (fieldType === 'richtext') {
    return true
  }

  // Check field name patterns for common rich text fields
  const richTextPatterns = [
    /^description$/i,
    /description$/i,
    /^notes?$/i,
    /notes?$/i,
    /^comments?$/i,
    /comments?$/i,
    /^summary$/i,
    /^details?$/i,
    /^body$/i,
    /^content$/i,
    /^message$/i,
    /^text$/i,
    /^resolution\.description$/i
  ]

  return richTextPatterns.some(pattern => pattern.test(fieldKey))
}

/**
 * Create cell renderer for a field type
 */
function createCellRenderer(fieldKey: string, fieldType: string, customFieldConfig?: any) {
  if (fieldType === 'date') {
    return ({ getValue }: { getValue: () => string | Date | null | undefined }) => {
      const value = getValue()
      const showTime = shouldShowTime(fieldKey, customFieldConfig)
      return formatDate(value, showTime)
    }
  }

  if (fieldType === 'boolean') {
    return ({ getValue }: { getValue: () => boolean | null | undefined }) => {
      const value = getValue()

      // Special handling for workflow disabled field - invert the logic and use custom text
      if (fieldKey === 'disabled') {
        // disabled: true = Inactive, disabled: false = Active
        return value === true ? 'Inactive' : value === false ? 'Active' : ''
      }

      return formatBoolean(value)
    }
  }

  if (fieldType === 'array') {
    return ({ getValue }: { getValue: () => any[] | null | undefined }) => {
      const value = getValue()
      return formatArray(value)
    }
  }

  if (fieldType === 'user') {
    return ({ getValue }: { getValue: () => string | null | undefined }) => {
      const userId = getValue()
      if (!userId) return ''

      return React.createElement(UserName, { userId: String(userId) })
    }
  }

  // Default text renderer
  return ({ getValue }: { getValue: () => unknown }) => {
    const value = getValue()

    // Handle different value types properly
    if (value === null || value === undefined) return ''
    if (Array.isArray(value)) return formatArray(value)
    if (typeof value === 'object') {
      // For objects, return empty string if they're empty, otherwise stringify
      const keys = Object.keys(value)
      if (keys.length === 0) return ''
      return JSON.stringify(value)
    }

    const stringValue = String(value)

    // For rich text fields, use better text processing with appropriate max length
    if (isRichTextField(fieldKey, fieldType)) {
      return processForTableDisplay(stringValue, 100)
    }

    return stringValue
  }
}

const SALESFORCE_DIRECTION_CONFIG: Record<SalesforceDirection, {
  icon: React.ReactElement
  label: string
  color: string
  tooltip: string
}> = {
  fromSF: {
    icon: <ArrowRightOutlined />,
    label: 'From SF',
    color: 'blue',
    tooltip: 'Data flows from Salesforce to Planhat'
  },
  toSF: {
    icon: <ArrowLeftOutlined />,
    label: 'To SF',
    color: 'orange',
    tooltip: 'Data flows from Planhat to Salesforce'
  },
  both: {
    icon: <SwapOutlined />,
    label: 'Both',
    color: 'green',
    tooltip: 'Bidirectional data flow'
  },
  none: {
    icon: <StopOutlined />,
    label: 'None',
    color: 'default',
    tooltip: 'No data synchronization'
  }
}

const SALESFORCE_TYPE_COLORS: Record<SalesforceFieldType, string> = {
  string: 'blue',
  double: 'purple',
  date: 'orange',
  datetime: 'red',
  boolean: 'green',
  picklist: 'cyan',
  multipicklist: 'geekblue',
  user: 'magenta',
  reference: 'volcano',
  email: 'lime',
  url: 'gold',
  currency: 'yellow',
  percent: 'orange'
}

const PLANHAT_TYPE_COLORS: Record<PlanhatFieldType, string> = {
  string: 'blue',
  number: 'purple',
  date: 'orange',
  datetime: 'red',
  boolean: 'green',
  text: 'cyan',
  'rich text': 'geekblue',
  list: 'magenta',
  'team member': 'volcano'
}

const escapeRegExp = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

function highlightSearchTerm(text: string, searchTerm: string): React.ReactNode {
  if (!searchTerm || !text) {
    return text
  }

  const sanitizedTerm = escapeRegExp(searchTerm.trim())
  if (!sanitizedTerm) {
    return text
  }

  const regex = new RegExp(`(${sanitizedTerm})`, 'gi')
  const parts = String(text).split(regex)

  return parts.map((part, index) => {
    if (index % 2 === 1) {
      return (
        <mark key={`highlight-${index}`} className="bg-yellow-200 px-0.5">
          {part}
        </mark>
      )
    }

    return <React.Fragment key={`text-${index}`}>{part}</React.Fragment>
  })
}

function renderSalesforceDirection(direction: SalesforceDirection): React.ReactNode {
  const config = SALESFORCE_DIRECTION_CONFIG[direction] ?? SALESFORCE_DIRECTION_CONFIG.none

  return (
    <Tooltip title={config.tooltip}>
      <Tag
        icon={config.icon}
        color={config.color}
        className="flex items-center gap-1 w-fit cursor-help"
      >
        {config.label}
      </Tag>
    </Tooltip>
  )
}

function renderSalesforceFieldType(
  type: SalesforceFieldType | PlanhatFieldType,
  isSourceType: boolean
): React.ReactNode {
  const colors = isSourceType ? SALESFORCE_TYPE_COLORS : PLANHAT_TYPE_COLORS
  const color = colors[type as keyof typeof colors] || 'default'

  return (
    <Tag color={color} className="text-xs">
      {type}
    </Tag>
  )
}

export interface SalesforceFieldColumnOptions {
  compact?: boolean
  enableSearchHighlight?: boolean
  highlightCustomFields?: boolean
  searchTerm?: string
  showMetadata?: boolean
}

export function createSalesforceFieldColumnMappings(
  options: SalesforceFieldColumnOptions
): FieldMapping[] {
  const {
    compact = false,
    enableSearchHighlight = true,
    highlightCustomFields = false,
    searchTerm = '',
    showMetadata = false
  } = options

  const baseColumns: FieldMapping[] = [
    {
      key: 'sfField',
      label: 'Salesforce Field',
      type: 'string',
      include: true,
      width: compact ? 150 : 200,
      cellRenderer: ({ getValue }) => {
        const value = getValue()
        const stringValue = String(value ?? '')
        const content = enableSearchHighlight
          ? highlightSearchTerm(stringValue, searchTerm)
          : stringValue

        return (
          <div className="flex items-center gap-2">
            <DatabaseOutlined className="text-blue-500 flex-shrink-0" />
            <Text strong className="font-mono text-sm">
              {content}
            </Text>
          </div>
        )
      }
    },
    {
      key: 'direction',
      label: 'Direction',
      type: 'string',
      include: true,
      width: compact ? 80 : 120,
      cellRenderer: ({ getValue }) => {
        const direction = getValue() as SalesforceDirection
        return renderSalesforceDirection(direction)
      }
    },
    {
      key: 'phField',
      label: 'Planhat Field',
      type: 'string',
      include: true,
      width: compact ? 150 : 200,
      cellRenderer: ({ getValue }) => {
        const value = getValue()
        const stringValue = String(value ?? '')
        const content = enableSearchHighlight
          ? highlightSearchTerm(stringValue, searchTerm)
          : stringValue
        const isCustomField = stringValue.startsWith('custom.')

        const iconClass = isCustomField ? 'text-purple-500' : 'text-green-500'
        const textClasses = ['font-mono', 'text-sm']

        if (isCustomField && highlightCustomFields) {
          textClasses.push('font-semibold', 'text-purple-700')
        }

        return (
          <div className="flex items-center gap-2">
            <TagOutlined className={`flex-shrink-0 ${iconClass}`} />
            <Text className={textClasses.join(' ')}>{content}</Text>
            {isCustomField && (
              <Badge size="small" count="C" color="purple" title="Custom Field" />
            )}
          </div>
        )
      }
    },
    {
      key: 'sfType',
      label: 'SF Type',
      type: 'string',
      include: true,
      width: compact ? 90 : 120,
      cellRenderer: ({ getValue }) => {
        const type = getValue() as SalesforceFieldType
        return renderSalesforceFieldType(type, true)
      }
    },
    {
      key: 'phType',
      label: 'PH Type',
      type: 'string',
      include: true,
      width: compact ? 90 : 120,
      cellRenderer: ({ getValue }) => {
        const type = getValue() as PlanhatFieldType
        return renderSalesforceFieldType(type, false)
      }
    }
  ]

  if (showMetadata && !compact) {
    baseColumns.push(
      {
        key: 'type',
        label: 'Mapping Type',
        type: 'string',
        include: true,
        width: 100,
        cellRenderer: ({ getValue }) => {
          const mappingType = String(getValue() ?? '')
          const color = mappingType === 'custom' ? 'purple' : 'blue'

          return <Tag color={color}>{mappingType}</Tag>
        }
      },
      {
        key: 'onlySend',
        label: 'Send Only',
        type: 'boolean',
        include: true,
        width: 80,
        cellRenderer: ({ getValue }) => {
          const onlySend = Boolean(getValue())
          return (
            <Badge
              status={onlySend ? 'processing' : 'default'}
              text={onlySend ? 'Yes' : 'No'}
            />
          )
        }
      }
    )
  }

  return baseColumns
}

/**
 * Create columns from field mappings using TanStack's columnHelper patterns
 */
export function createColumnsFromFields<TData>(
  fieldMappings: FieldMapping[],
  entityType: EntityType,
  customColumnSizing: Record<string, number> = {}
): ColumnDef<TData>[] {
  // Create column helper for type safety
  const columnHelper = createColumnHelper<TData>()

  // Filter to only included fields and map to columns using columnHelper
  const columns = fieldMappings
    .filter(field => field.include)
    .map(field => {
      const isCustomField = field.key.startsWith('custom.')
      const columnConfig = getColumnWidth(field.key, field.type)

      if (field.width && field.width > 0) {
        columnConfig.width = field.width
      }

      // Use saved width if available
      const savedWidth = customColumnSizing[field.key]
      if (savedWidth && savedWidth > 0) {
        columnConfig.width = savedWidth
      }

      // Create the column definition using columnHelper.accessor with accessorFn
      const defaultCellRenderer = createCellRenderer(field.key, field.type, field.customFieldConfig)

      return columnHelper.accessor(createAccessor<TData>(field.key, isCustomField), {
        id: field.key,
        header: field.label,
        size: columnConfig.width,
        minSize: columnConfig.minWidth,
        maxSize: columnConfig.maxWidth,
        cell: field.cellRenderer
          ? (context) => field.cellRenderer!(context as unknown as CellContext<TData, any>)
          : defaultCellRenderer,
        enableSorting: true,
        enableColumnFilter: field.key !== 'description', // Disable filtering for description fields
        enableGrouping: field.key !== 'description' && field.type !== 'array',
        enableResizing: true,
        // Use TanStack's built-in filter functions based on data type
        filterFn: getFilterFunctionForFieldType(field.type, field.key),
        meta: {
          fieldType: field.type,
          customFieldConfig: field.customFieldConfig,
          tooltip: isCustomField ? `Custom field: ${field.label}` : `Standard field: ${field.label}`,
          filterType: getFilterTypeForField(field.type, field.key)
        }
      })
    })

  return columns
}

/**
 * Add selection column to the beginning of columns array
 */
export function addSelectionColumn<TData>(columns: ColumnDef<TData>[]): ColumnDef<TData>[] {
  const columnHelper = createColumnHelper<TData>()

  const selectionColumn = columnHelper.display({
    id: 'select',
    header: ({ table }) => React.createElement('input', {
      type: 'checkbox',
      checked: table.getIsAllPageRowsSelected(),
      indeterminate: table.getIsSomePageRowsSelected(),
      onChange: table.getToggleAllPageRowsSelectedHandler()
    }),
    cell: ({ row }) => React.createElement('input', {
      type: 'checkbox',
      checked: row.getIsSelected(),
      disabled: !row.getCanSelect(),
      onChange: row.getToggleSelectedHandler()
    }),
    size: 50,
    minSize: 50,
    maxSize: 50,
    enableSorting: false,
    enableColumnFilter: false,
    enableResizing: false,
    enableGrouping: false
  })

  return [selectionColumn, ...columns]
}

/**
 * Simple column creation utility
 */
export function createColumn<TData>(config: {
  id: string
  accessorKey?: string
  header: string
  size?: number
  minSize?: number
  maxSize?: number
  cell?: (context: { getValue: () => unknown }) => React.ReactNode
  enableSorting?: boolean
  enableFiltering?: boolean
  enableResizing?: boolean
}): ColumnDef<TData> {
  return {
    id: config.id,
    accessorKey: config.accessorKey,
    header: config.header,
    size: config.size,
    minSize: config.minSize,
    maxSize: config.maxSize,
    cell: config.cell,
    enableSorting: config.enableSorting ?? true,
    enableColumnFilter: config.enableFiltering ?? true,
    enableResizing: config.enableResizing ?? true
  } as ColumnDef<TData>
}