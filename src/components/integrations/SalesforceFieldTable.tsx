/**
 * Salesforce Field Table Component
 *
 * Uses EnhancedDataTable for displaying field mappings with virtual scrolling
 * for large datasets (up to 10,000 fields). Provides columns for SF Field,
 * Direction, PH Field, SF Type, and PH Type with search highlighting.
 *
 * @fileVersion 3.1.2
 * @author Claude Code AI Assistant
 */

import React, { useMemo } from 'react'


import {
  ArrowRightOutlined,
  ArrowLeftOutlined,
  SwapOutlined,
  StopOutlined,
  TagOutlined,
  DatabaseOutlined
} from '@ant-design/icons'
import { createColumnHelper, type ColumnDef } from '@tanstack/react-table'
import { Tag, Badge, Tooltip, Typography } from 'antd'

const { Text } = Typography
import { clsx } from 'clsx'


import { DEFAULT_VIRTUALIZATION } from '../../config/table-virtualization'
import { useSalesforceFieldTableSettings, useSalesforceSearch } from '../../stores/salesforce-integration.store'
import type { SalesforceFieldMapping, SalesforceDirection, SalesforceFieldType } from '../../types/integrations/salesforce.types'
import { logger } from '../../utils/logger'
import { createSalesforceFieldColumnMappings } from '../../utils/table-columns'
import { Table } from '../ui/Table'

import SalesforceSearchBar from './SalesforceSearchBar'

const log = logger.content

export interface SalesforceFieldTableProps {
  /** Field mappings to display */
  fields: SalesforceFieldMapping[]
  /** Loading state */
  loading?: boolean
  /** Table title */
  title?: string
  /** Object name for context */
  objectName?: string
  /** Enable search highlighting */
  enableSearchHighlight?: boolean
  /** Additional CSS classes */
  className?: string
  /** Compact mode for smaller spaces */
  compact?: boolean
  /** Enable grouping by direction */
  enableGrouping?: boolean
  /** Tenant slug for column persistence */
  tenantSlug?: string
}

/**
 * Salesforce Field Table Component
 */
export function SalesforceFieldTable({
  fields,
  loading = false,
  title = 'Field Mappings',
  objectName,
  enableSearchHighlight = true,
  className,
  compact = false,
  enableGrouping = false,
  tenantSlug
}: SalesforceFieldTableProps) {
  // UI settings from store
  const {
    settings,
    enableVirtualization,
    maxVisibleFields
  } = useSalesforceFieldTableSettings()

  // Search state for highlighting

  const { searchTerm, setSearchTerm } = useSalesforceSearch()

  // Column helper for type-safe column definitions
  const columnHelper = createColumnHelper<SalesforceFieldMapping>()

  // Helper function to render direction badges
  const renderDirectionBadge = (direction: SalesforceDirection | null) => {
    if (!direction || direction === 'none') {
      return <Tag icon={<StopOutlined />} color="default">Not Mapped</Tag>
    }

    const directionConfig = {
      fromSF: { icon: <ArrowRightOutlined />, color: 'blue', text: 'From SF' },
      toSF: { icon: <ArrowLeftOutlined />, color: 'green', text: 'To SF' },
      both: { icon: <SwapOutlined />, color: 'purple', text: 'Bidirectional' }
    }

    const config = directionConfig[direction]
    return config ? (
      <Tag icon={config.icon} color={config.color}>{config.text}</Tag>
    ) : null
  }

  // Helper function to render field type
  const renderFieldType = (type: string | null, isPlanhatField: boolean = false) => {
    if (!type) return <span className="text-gray-400 text-xs">Unknown</span>

    const color = isPlanhatField ? 'green' : 'blue'
    const icon = isPlanhatField ? <TagOutlined /> : <DatabaseOutlined />

    return (
      <Tag icon={icon} color={color} className="text-xs">
        {type}
      </Tag>
    )
  }

  // Function to highlight search terms
  const highlightSearchTerm = (text: string, term: string): React.ReactNode => {
    if (!term) return text

    const parts = text.split(new RegExp(`(${term})`, 'gi'))
    return (
      <>
        {parts.map((part, i) =>
          part.toLowerCase() === term.toLowerCase() ? (
            <span key={i} className="bg-yellow-200">{part}</span>
          ) : (
            part
          )
        )}
      </>
    )
  }

  // Limit fields for performance if needed
  const displayFields = useMemo(() => {
    if (fields.length <= maxVisibleFields) {
      return fields
    }

    log.warn('Field count exceeds maximum, limiting display', {
      totalFields: fields.length,
      maxFields: maxVisibleFields,
      objectName
    })

    return fields.slice(0, maxVisibleFields)
  }, [fields, maxVisibleFields, objectName])


  // Table columns
  const columns = useMemo(() => {
    const baseColumns = [
      columnHelper.accessor('sfField', {
        header: 'Salesforce Field',
        size: compact ? 150 : 200,
        minSize: 120,
        cell: ({ getValue }) => {
          const value = getValue()
          const stringValue = String(value ?? '')
          const displayValue = enableSearchHighlight && searchTerm
            ? highlightSearchTerm(stringValue, searchTerm)
            : stringValue

          return (
            <div className="flex items-center gap-2">
              <DatabaseOutlined className="text-blue-500 flex-shrink-0" />
              <span className="font-mono text-sm font-semibold">
                {displayValue}
              </span>
            </div>
          )
        }
      }),
      columnHelper.accessor('direction', {
        header: 'Direction',
        size: compact ? 80 : 120,
        minSize: 80,
        cell: ({ getValue }) => {
          const direction = getValue()
          return renderDirectionBadge(direction)
        },
        filterFn: (row, columnId, filterValue) => {
          if (!Array.isArray(filterValue) || filterValue.length === 0) {
            return true
          }

          const value = row.getValue(columnId) as SalesforceDirection | null
          return value ? filterValue.includes(value) : filterValue.includes('none')
        }
      }),
      columnHelper.accessor('phField', {
        header: 'Planhat Field',
        size: compact ? 150 : 200,
        minSize: 120,
        cell: ({ getValue }) => {
          const value = getValue()
          const stringValue = String(value ?? '')
          const displayValue = enableSearchHighlight && searchTerm
            ? highlightSearchTerm(stringValue, searchTerm)
            : stringValue

          const isCustomField = stringValue.startsWith('custom.')

          return (
            <div className="flex items-center gap-2">
              <TagOutlined className={clsx(
                'flex-shrink-0',
                isCustomField ? 'text-purple-500' : 'text-green-500'
              )} />
              <span
                className={clsx(
                  'font-mono text-sm',
                  isCustomField && settings.highlightCustomFields && 'font-semibold text-purple-700'
                )}
              >
                {displayValue}
              </span>
              {isCustomField && (
                <Badge size="small" count="C" color="purple" title="Custom Field" />
              )}
            </div>
          )
        }
      }),
      columnHelper.accessor('sfType', {
        header: 'SF Type',
        size: compact ? 90 : 120,
        minSize: 80,
        cell: ({ getValue }) => {
          const type = getValue()
          return renderFieldType(type, true)
        },
        filterFn: (row, columnId, filterValue) => {
          if (!Array.isArray(filterValue) || filterValue.length === 0) {
            return true
          }

          const value = row.getValue(columnId) as SalesforceFieldType | null
          return value ? filterValue.includes(value) : false
        }
      }),
      columnHelper.accessor('phType', {
        header: 'PH Type',
        size: compact ? 90 : 120,
        minSize: 80,
        cell: ({ getValue }) => {
          const type = getValue()
          return renderFieldType(type, false)
        }
      })
    ]

    // Add metadata columns if enabled and not in compact mode
    if (settings.showMetadata && !compact) {
      baseColumns.push(
        columnHelper.accessor('type', {
          header: 'Mapping Type',
          size: 100,
          minSize: 80,
          cell: ({ getValue }) => {
            const type = getValue()
            return (
              <Tag color={String(type) === 'custom' ? 'purple' : 'blue'}>
                {String(type)}
              </Tag>
            )
          }
        }),
        columnHelper.accessor('onlySend', {
          header: 'Send Only',
          size: 80,
          minSize: 70,
          cell: ({ getValue }) => {
            const onlySend = getValue()
            return (
              <Badge status={onlySend ? 'processing' : 'default'} text={onlySend ? 'Yes' : 'No'} />
            )
          }
        })
      )
    }

    return baseColumns
  }, [compact, settings.showMetadata, settings.highlightCustomFields, displayFields, enableSearchHighlight, searchTerm])


  // Calculate title with field count
  const fullTitle = useMemo(() => {
    const count = displayFields.length
    const totalCount = fields.length

    if (totalCount !== count) {
      return `${title} (${count.toLocaleString()} of ${totalCount.toLocaleString()} shown)`
    }

    return `${title} (${count.toLocaleString()} fields)`
  }, [title, displayFields.length, fields.length])

  // Handle performance warning
  const showPerformanceWarning = fields.length > 5000 && enableVirtualization

  const emptyMessage = useMemo(() => {
    if (searchTerm) {
      return `No fields match "${searchTerm}"`
    }
    return objectName
      ? `No field mappings configured for ${objectName}`
      : 'No field mappings available'
  }, [searchTerm, objectName])

  return (
    <div className={className}>
      {showPerformanceWarning && (
        <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-sm">
          <div className="flex items-center gap-2 text-yellow-800">
            <span className="font-medium">Performance Note:</span>
            <span>
              Large dataset ({fields.length.toLocaleString()} fields) - virtualization is enabled for optimal performance
            </span>
          </div>
        </div>
      )}

      <Table
        data={displayFields}
        customColumns={columns}
        entityType="salesforce-field"
        tenantSlug={tenantSlug}
        loading={loading}

        enableSorting={true}
        enableFiltering={true}
        enableGlobalFilter={true}
        enablePagination={true}
        enableColumnResizing={true}

        // Optimized virtualization settings for better performance
        rowOverscan={DEFAULT_VIRTUALIZATION.rowOverscan}
        columnOverscan={DEFAULT_VIRTUALIZATION.columnOverscan}
        rowHeight={DEFAULT_VIRTUALIZATION.rowHeight}
        enableRowVirtualization={DEFAULT_VIRTUALIZATION.enableRowVirtualization}
        enableColumnVirtualization={DEFAULT_VIRTUALIZATION.enableColumnVirtualization}

        persistColumnSizes={true}
        title={fullTitle}
        className="shadow-sm"
        height={compact ? 400 : 600}

        initialGlobalFilter={searchTerm}
        onGlobalFilterChange={(value) => {
          const nextValue = typeof value === 'string' ? value : ''
          setSearchTerm(nextValue)
        }}
        topContent={({ table }) => (
          <div className="px-4 pt-4">
            <SalesforceSearchBar table={table} />
          </div>
        )}

      />
    </div>
  )
}

export default SalesforceFieldTable