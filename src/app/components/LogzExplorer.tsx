/**
 * Logz Explorer Component
 *
 * Main interface for exploring Planhat system logs with filtering,
 * pagination, and entity resolution using standard ToolHeader layout.
 */

import { useCallback, useEffect, useMemo } from 'react'

import { ReloadOutlined } from '@ant-design/icons'
import { createColumnHelper } from '@tanstack/react-table'
import { Alert, Button, Tag, Tooltip, Typography } from 'antd'
import { format } from 'date-fns'
import { ExternalLink, MoreHorizontal, Activity } from 'lucide-react'

import { AdvancedFilters } from '../../components/ui/AdvancedFilters'
import { GlobalSearchInput } from '../../components/ui/GlobalSearchInput'
import { SmartPagination } from '../../components/ui/SmartPagination'
import { Table } from '../../components/ui/Table'
import { ToolHeader, ToolHeaderButton, ToolHeaderControls, ToolHeaderDivider } from '../../components/ui/ToolHeader'
import { DEFAULT_VIRTUALIZATION } from '../../config/table-virtualization'
import { useFilterPresets } from '../../hooks/useFilterPresets'
import { useLogzOptimization } from '../../hooks/useLogzOptimization'
import { useLogzQuery, useLogzMetadata, useLogzQueryActions } from '../../hooks/useLogzQuery'
import { useLogzActions, useLogzFilters, useLogzLogs } from '../../stores/logz.store'
import type { ParsedLogEntry } from '../../types/logz.types'
import { CONTROL_CATEGORIES } from '../../types/ui'
import { formatDateCustom } from '../../utils/formatters'
import { logger } from '../../utils/logger'
import { dateRangeFilter } from '../../utils/table-columns'

import { LogzFiltersCompact } from './logz-explorer/LogzFiltersCompact'

const { Text } = Typography
const log = logger.extension

const columnHelper = createColumnHelper<ParsedLogEntry>()

export interface LogzExplorerProps {
  className?: string
}

export function LogzExplorer({ className }: LogzExplorerProps) {
  const query = useLogzQuery()
  const metadata = useLogzMetadata()
  const filters = useLogzFilters()
  const logs = useLogzLogs()
  const { refresh, loadMore } = useLogzQueryActions()
  const { updatePagination } = useLogzActions()

  const {
    presets,
    savePreset,
    deletePreset
  } = useFilterPresets({
    context: 'logz-table'
  })

  const optimization = useLogzOptimization({
    autoOptimize: true,
    strategy: 'balanced'
  })

  // Log component mount
  useEffect(() => {
    log.info('LogzExplorer component mounted')
    return () => {
      log.debug('LogzExplorer component unmounted')
    }
  }, [])

  const handleRefresh = useCallback(() => {
    log.info('Manual refresh requested')
    refresh()
  }, [refresh])

  // Filter logs based on server-side API search state for consistent UX
  const filteredLogs = useMemo(() => {
    if (!filters.searchTerm.trim()) {
      return logs
    }

    const searchTerm = filters.searchTerm.toLowerCase()
    return logs.filter(logEntry => {
      const searchableText = [
        logEntry.model,
        logEntry.operation,
        logEntry.actorDisplay,
        logEntry.companyDisplay,
        logEntry.entityId,
        logEntry.parsedContext ? JSON.stringify(logEntry.parsedContext) : ''
      ]
        .join(' ')
        .toLowerCase()

      return searchableText.includes(searchTerm)
    })
  }, [logs, filters.searchTerm])

  const formatTimestamp = useCallback((timestamp: string) => {
    try {
      return formatDateCustom(timestamp, 'MMM dd, yyyy HH:mm:ss')
    } catch {
      return format(new Date(timestamp), 'MMM dd, yyyy HH:mm:ss')
    }
  }, [])

  const renderCompanyDisplay = useCallback((text: string, record: ParsedLogEntry) => {
    if (record.companyNames.length > 1) {
      return (
        <Tooltip
          title={
            <div>
              <div className="font-medium mb-1">Companies ({record.companyNames.length}):</div>
              {record.companyNames.map((name, index) => (
                <div key={index}>• {name}</div>
              ))}
            </div>
          }
        >
          <span className="cursor-help border-b border-dotted">{text}</span>
        </Tooltip>
      )
    }
    return text
  }, [])

  const renderEntityId = useCallback((entityId: string) => {
    if (!entityId) {
      return <Text type="secondary">—</Text>
    }

    if (entityId.length > 12) {
      return (
        <Tooltip title={entityId}>
          <Text className="font-mono text-xs">{entityId.substring(0, 8)}...</Text>
        </Tooltip>
      )
    }

    return <Text className="font-mono text-xs">{entityId}</Text>
  }, [])

  const renderOperation = useCallback((operation: string) => {
    const colorMap: Record<string, string> = {
      'created': 'green',
      'updated': 'blue',
      'deleted': 'red',
      'removed from filter': 'orange',
      'added to filter': 'cyan'
    }

    return (
      <Tag color={colorMap[operation] || 'default'} className="text-xs">
        {operation}
      </Tag>
    )
  }, [])

  const renderModel = useCallback((model: string) => {
    return (
      <Tag color="purple" className="text-xs">
        {model}
      </Tag>
    )
  }, [])

  // Create custom columns with TanStack helpers for consistent sizing & filtering behaviour
  const columns = useMemo(
    () => [
      columnHelper.accessor('time', {
        header: 'Time',
        size: 180,
        minSize: 140,
        enableSorting: true,
        enableColumnFilter: true,
        filterFn: dateRangeFilter,
        cell: ({ getValue }) => (
          <Text className="text-xs whitespace-nowrap">{formatTimestamp(getValue())}</Text>
        ),
        meta: {
          filterType: 'date'
        }
      }),
      columnHelper.accessor('model', {
        header: 'Object',
        size: 120,
        minSize: 80,
        enableSorting: true,
        enableColumnFilter: true,
        filterFn: 'arrIncludes',
        cell: ({ getValue }) => renderModel(getValue()),
        meta: {
          filterType: 'select'
        }
      }),
      columnHelper.accessor('operation', {
        header: 'Action',
        size: 140,
        minSize: 100,
        enableSorting: true,
        enableColumnFilter: true,
        filterFn: 'arrIncludes',
        cell: ({ getValue }) => renderOperation(getValue()),
        meta: {
          filterType: 'select'
        }
      }),
      columnHelper.accessor('actorDisplay', {
        header: 'Actor',
        size: 180,
        minSize: 120,
        enableSorting: true,
        enableColumnFilter: true,
        filterFn: 'arrIncludes',
        cell: ({ getValue, row }) => {
          const text = getValue()
          const actorType = (row.original as ParsedLogEntry & { actorType?: string }).actorType || ''
          const colorMap: Record<string, string> = {
            'user': 'blue',
            'hiddenuser': 'purple',
            'integration': 'green',
            'automation': 'orange',
            'system': 'red',
            'trigger': 'cyan',
            'service account': 'magenta'
          }

          return (
            <div className="flex items-center gap-1">
              <Tag
                color={colorMap[actorType] || 'default'}
                className="text-xs"
                style={{ border: 'none', margin: 0, padding: '2px 6px' }}
              >
                {actorType || 'unknown'}
              </Tag>
              <Tooltip title={text}>
                <span className="text-xs truncate max-w-[160px]">{text}</span>
              </Tooltip>
            </div>
          )
        },
        meta: {
          filterType: 'select'
        }
      }),
      columnHelper.accessor('companyDisplay', {
        header: 'Company',
        size: 220,
        minSize: 140,
        enableSorting: true,
        enableColumnFilter: true,
        filterFn: 'arrIncludes',
        cell: ({ getValue, row }) => renderCompanyDisplay(getValue(), row.original),
        meta: {
          filterType: 'select'
        }
      }),
      columnHelper.accessor('entityId', {
        header: 'Entity ID',
        size: 160,
        minSize: 120,
        enableSorting: true,
        enableColumnFilter: true,
        filterFn: 'includesString',
        cell: ({ getValue }) => renderEntityId(getValue()),
        meta: {
          filterType: 'text'
        }
      }),
      columnHelper.display({
        id: 'actions',
        header: 'Actions',
        size: 80,
        minSize: 60,
        enableSorting: false,
        cell: ({ row }) => (
          <Tooltip title="View raw data">
            <Button
              type="text"
              size="small"
              icon={<MoreHorizontal className="h-3 w-3" />}
              onClick={() => {
                console.log('Raw log data:', row.original._raw)
              }}
            />
          </Tooltip>
        )
      })
    ],
    [formatTimestamp, renderModel, renderOperation, renderCompanyDisplay, renderEntityId]
  )

  const handleLoadMore = useCallback(() => {
    if (query.hasMore && !query.isFetching) {
      loadMore()
    }
  }, [query.hasMore, query.isFetching, loadMore])

  return (
    <div className={`space-y-6 ${className || ''}`}>
      {/* Standard ToolHeader */}
      <ToolHeader title="Logz Explorer" icon={Activity}>
        {/* Filter Controls */}
        <ToolHeaderControls category={CONTROL_CATEGORIES.FILTER}>
          <LogzFiltersCompact />
        </ToolHeaderControls>

        <ToolHeaderDivider />

        {/* Output Controls */}
        <ToolHeaderControls category={CONTROL_CATEGORIES.OUTPUT}>
          <ToolHeaderButton
            category={CONTROL_CATEGORIES.OUTPUT}
            variant="secondary"
            icon={<ReloadOutlined />}
            onClick={handleRefresh}
            loading={query.isLoading}
          >
            Refresh
          </ToolHeaderButton>
        </ToolHeaderControls>
      </ToolHeader>

      {/* Error Display */}
      {query.filterValidation && (
        <Alert
          type="warning"
          message="Filter Validation Error"
          description={query.filterValidation.message}
          showIcon
          className="shadow-sm"
        />
      )}

      {metadata.error && (
        <Alert
          type="error"
          message="Error Loading Logs"
          description={metadata.error}
          showIcon
          className="shadow-sm"
        />
      )}

      {/* Enhanced Table Component */}
      <Table
        data={filteredLogs}
        customColumns={columns}
        entityType="issue"
        loading={query.isFetching && logs.length === 0}
        showToolbar={false}
        height={600}
        className="shadow-sm space-y-4"
        emptyMessage="No logs found. Try adjusting your filters or check if you have the proper permissions."
        enableSorting={true}
        enableFiltering={true}
        enableGlobalFilter={true}
        enableSelection={false}
        enableColumnResizing={true}
        persistColumnSizes={true}
        persistenceContext="logz-explorer"
        initialSorting={[{ id: 'time', desc: true }]}
        rowOverscan={DEFAULT_VIRTUALIZATION.rowOverscan}
        columnOverscan={DEFAULT_VIRTUALIZATION.columnOverscan}
        topContent={({ table }) => (
          <div className="space-y-4">
            <GlobalSearchInput
              table={table}
              placeholder="Search across all log fields..."
              className="mb-2"
              showFilters={true}
            />

            <AdvancedFilters
              table={table}
              presets={presets}
              onPresetSave={savePreset}
              onPresetDelete={deletePreset}
              onPresetLoad={(preset) => {
                console.log('Loaded preset:', preset.name)
              }}
              showClearAll={true}
              showSavePreset={true}
              showQuickActions={true}
            />
          </div>
        )}
        bottomContent={({ table }) => (
          <div className="flex flex-col gap-3 text-sm text-gray-600 lg:flex-row lg:items-center lg:justify-between">
            <div>
              Showing {table.getFilteredRowModel().rows.length} of {logs.length} logs
              {filters.searchTerm && (
                <span className="ml-2">(filtered by API search: "{filters.searchTerm}")</span>
              )}
            </div>

            {query.hasMore && (
              <div className="flex items-center gap-2">
                <span>More logs available</span>
                <Button
                  type="link"
                  size="small"
                  onClick={handleLoadMore}
                  loading={query.isFetching}
                  icon={<ExternalLink className="h-3 w-3" />}
                >
                  Load More
                </Button>
              </div>
            )}
          </div>
        )}
        footerContent={() => (
          <div className="space-y-4">
            {(logs.length > 0 || query.hasMore) && (
              <SmartPagination
                currentOffset={query.currentOffset || 0}
                recordsPerPull={query.recordsPerPull || 100}
                totalLoaded={logs.length}
                hasMore={query.hasMore}
                isLoading={query.isFetching}
                maxRecordsPerRequest={2000}
                onLoadMore={handleLoadMore}
                onRecordsPerPullChange={(newSize) => {
                  updatePagination({ recordsPerPull: newSize })
                }}
                onLoadAll={optimization.loadAllOptimized}
                showProgress={true}
                showOptimizationHints={true}
              />
            )}

            {!query.hasMore && logs.length > 0 && (
              <div className="text-center py-4 text-sm text-gray-500">
                No more logs to load • Total: {logs.length.toLocaleString()} records
              </div>
            )}
          </div>
        )}
      />

      {/* Summary Info */}
      {logs.length > 0 && (
        <div className="text-center text-sm text-gray-500 py-2">
          {metadata.totalLoaded} logs loaded
          {!query.hasMore && ' • No more logs to load'}
        </div>
      )}
    </div>
  )
}
