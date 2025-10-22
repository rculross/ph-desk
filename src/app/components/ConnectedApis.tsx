/**
 * Connected APIs Component for Planhat Extension
 *
 * Simple system tool for viewing user API integration statuses
 * with standard table display and export functionality.
 */

import { useState, useCallback, useEffect, useRef, useMemo } from 'react'
import type { ReactNode } from 'react'

import { ReloadOutlined, SettingOutlined } from '@ant-design/icons'
import { useQuery } from '@tanstack/react-query'
import type { CellContext } from '@tanstack/react-table'
import { clsx } from 'clsx'
import { format as formatDate } from 'date-fns'
import { LinkIcon } from 'lucide-react'

import { getTenantSlug } from '../../api/client/http-client'
import { usersService, type ConnectedApiUser, type UserFilters } from '../../api/services/users.service'
import { ExportFormatButtons, useSharedExporter } from '../../components/exporters'
import { FieldsDropdownWrapper } from '../../components/ui/FieldsDropdown'
import { OrderColumnsModal } from '../../components/ui/OrderColumnsModal'
import { Table } from '../../components/ui/Table'
import {
  ToolHeader,
  ToolHeaderButton,
  ToolHeaderControls,
  ToolHeaderDivider
} from '../../components/ui/ToolHeader'
import { DEFAULT_VIRTUALIZATION } from '../../config/table-virtualization'
import { useTableColumns } from '../../hooks/useTableColumns'
import { type FieldValueType, type FieldSource } from '../../types/export'
import { CONTROL_CATEGORIES } from '../../types/ui'
import { logger } from '../../utils/logger'

export interface ConnectedApisProps {
  className?: string
}

interface ConnectedApisExportConfiguration {
  includeHeaders: boolean
  includeCustomFields: boolean
  includeRelatedData: boolean
  includeApiSettings: boolean
  includeTeamInfo: boolean
  dateFormat: string
}

/**
 * Main ConnectedApis component
 */
export function ConnectedApis({ className }: ConnectedApisProps) {
  const [filters] = useState<UserFilters>({})
  const fieldDropdownRef = useRef<HTMLDivElement>(null)
  const [isLoadingAllData, setIsLoadingAllData] = useState(false)
  const loadingRef = useRef(false)
  const log = logger.extension

  const tenantSlug = getTenantSlug()

  // Fetch users data
  const {
    data: usersData,
    isLoading,
    refetch
  } = useQuery({
    queryKey: ['connected-apis-users', filters],
    queryFn: async () => {
      if (loadingRef.current) {
        return { data: [], total: 0, limit: 0, offset: 0, hasMore: false }
      }

      loadingRef.current = true
      setIsLoadingAllData(true)

      try {
        log.debug('Fetching users for Connected APIs', { filters })

        const result = await usersService.getUsers(filters, {
          limit: 1000,
          sort: 'lastName'
        })

        log.debug('Users fetch completed', {
          totalUsers: result.data.length,
          filters
        })

        return result
      } finally {
        loadingRef.current = false
        setIsLoadingAllData(false)
      }
    },
    enabled: true
  })

  const users = usersData?.data ?? []
  const totalCount = usersData?.total ?? 0

  const exportDefaults = useMemo<ConnectedApisExportConfiguration>(
    () => ({
      includeHeaders: true,
      includeCustomFields: false,
      includeRelatedData: false,
      includeApiSettings: true,
      includeTeamInfo: true,
      dateFormat: 'yyyy-MM-dd'
    }),
    []
  )

  const exporter = useSharedExporter<ConnectedApiUser, ConnectedApisExportConfiguration>({
    entityType: 'user',
    items: users,
    totalCount,
    tenantSlug: tenantSlug ?? undefined,
    defaultExportConfig: exportDefaults,
    buildFilename: (_format) => `connected_apis_export_${formatDate(new Date(), 'yyyy-MM-dd')}`,
    fieldDetection: {
      sampleSize: 10
    }
  })

  const {
    fieldsControl,
    reorderControl,
    formatControl,
    columnSizing,
    handleColumnSizingChange,
    fieldDetection,
    fieldMapping,
    dataSelection,
    handleDirectExport,
    isExporting
  } = exporter

  // Generate table columns using centralized hook with tenant-aware caching
  const _tableColumns = useTableColumns<ConnectedApiUser>({
    fieldDetection,
    entityType: 'user',
    columnSizing,
    tenantSlug
  })

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (fieldDropdownRef.current && !fieldDropdownRef.current.contains(event.target as Node)) {
        fieldsControl.setActive(false)
      }
    }

    if (fieldsControl.isActive) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }

    return undefined
  }, [fieldsControl])

  // Badge control for selected items (unused for now)
  // const selectedBadge = useBadgeControl(
  //   dataSelection.selectedCount > 0 ? Array(dataSelection.selectedCount).fill(null) : []
  // )

  // Handle column reordering
  const handleColumnsReorder = useCallback((reorderedColumns: { key: string; label: string; include: boolean }[]) => {
    log.info('Column reorder requested for Connected APIs', {
      totalColumns: reorderedColumns.length,
      visibleColumns: reorderedColumns.filter(c => c.include).length
    })

    const newFieldMappings = reorderedColumns.map(col => {
      const originalField = fieldDetection.fieldMappings.find(f => f.key === col.key)
      return originalField ? { ...originalField, include: col.include } : {
        key: col.key,
        label: col.label,
        type: 'string' as const,
        include: col.include,
        source: 'discovered' as const
      }
    })

    fieldDetection.setFieldMappings(newFieldMappings)
    log.info('Connected APIs column order updated successfully')
  }, [log, fieldDetection])

  // Custom field mappings for Connected APIs specific display
  const connectedApisFieldMappings = useMemo(() => {
    const includedFields = fieldDetection.fieldMappings.filter(f => f.include)

    if (includedFields.length === 0 && users.length > 0) {
      // Detect which API types are present in the data
      const hasGoogleApi = users.some(user => user.googleApi)
      const hasGoogleCalendar = users.some(user => user.googleCalendar)
      const hasMsApi = users.some(user => user.msApi)
      const hasMsCalendarApi = users.some(user => user.msCalendarApi)

      // Build default fields based on what's available
      const defaultFields: Array<{
        key: string
        label: string
        type: FieldValueType
        include: boolean
        source: FieldSource
        cellRenderer?: (context: CellContext<any, any>) => ReactNode
      }> = [
        {
          key: 'fullName',
          label: 'Name',
          type: 'string' as const,
          include: true,
          source: 'standard' as const,
          cellRenderer: ({ row }: any) => {
            const user = row.original
            const firstName = user.firstName ?? ''
            const lastName = user.lastName ?? ''
            return `${lastName}, ${firstName}`.replace(/^,\s*|,\s*$/g, '') // Remove leading/trailing commas
          }
        },
        {
          key: 'email',
          label: 'Email',
          type: 'string' as const,
          include: true,
          source: 'standard' as const
        },
        {
          key: 'teamName',
          label: 'Team',
          type: 'string' as const,
          include: true,
          source: 'standard' as const
        }
      ]

      // Add Google API fields if present
      if (hasGoogleApi) {
        defaultFields.push(
          {
            key: 'googleApi.accessEnabled',
            label: 'Google API Access',
            type: 'boolean' as const,
            include: true,
            source: 'standard' as const
          },
          {
            key: 'googleApi.syncEnabled',
            label: 'Google API Sync',
            type: 'boolean' as const,
            include: true,
            source: 'standard' as const
          }
        )
      }

      if (hasGoogleCalendar) {
        defaultFields.push(
          {
            key: 'googleCalendar.accessEnabled',
            label: 'Google Calendar Access',
            type: 'boolean' as const,
            include: true,
            source: 'standard' as const
          },
          {
            key: 'googleCalendar.syncEnabled',
            label: 'Google Calendar Sync',
            type: 'boolean' as const,
            include: true,
            source: 'standard' as const
          }
        )
      }

      // Add Microsoft API fields if present
      if (hasMsApi) {
        defaultFields.push(
          {
            key: 'msApi.accessEnabled',
            label: 'Outlook API Access',
            type: 'boolean' as const,
            include: true,
            source: 'standard' as const
          },
          {
            key: 'msApi.syncEnabled',
            label: 'Outlook API Sync',
            type: 'boolean' as const,
            include: true,
            source: 'standard' as const
          },
          {
            key: 'msApi.syncState',
            label: 'Outlook API State',
            type: 'string' as const,
            include: true,
            source: 'standard' as const
          }
        )
      }

      if (hasMsCalendarApi) {
        defaultFields.push(
          {
            key: 'msCalendarApi.accessEnabled',
            label: 'Outlook Calendar Access',
            type: 'boolean' as const,
            include: true,
            source: 'standard' as const
          },
          {
            key: 'msCalendarApi.syncEnabled',
            label: 'Outlook Calendar Sync',
            type: 'boolean' as const,
            include: true,
            source: 'standard' as const
          },
          {
            key: 'msCalendarApi.syncState',
            label: 'Outlook Calendar State',
            type: 'string' as const,
            include: true,
            source: 'standard' as const
          },
          {
            key: 'msCalendarApi.calendarToSave',
            label: 'Calendar To Save',
            type: 'string' as const,
            include: true,
            source: 'standard' as const,
            cellRenderer: ({ row }: any) => {
              const user = row.original
              const calendarToSave = user.msCalendarApi?.calendarToSave
              if (!calendarToSave || typeof calendarToSave !== 'object') return ''
              return calendarToSave.name ?? ''
            }
          }
        )
      }

      // Add standard user fields
      defaultFields.push(
        {
          key: 'isActive',
          label: 'Active User',
          type: 'boolean' as const,
          include: true,
          source: 'standard' as const
        },
        {
          key: 'isExposedAsSenderOption',
          label: 'Public Email',
          type: 'boolean' as const,
          include: true,
          source: 'standard' as const
        }
      )

      log.debug('Using dynamic Connected APIs field mappings', {
        defaultFieldCount: defaultFields.length,
        hasGoogleApi,
        hasGoogleCalendar,
        hasMsApi,
        hasMsCalendarApi
      })

      return defaultFields
    }

    return includedFields.map(field => ({
      key: field.key,
      label: field.label,
      type: field.type,
      include: field.include,
      source: field.key.startsWith('custom.') ? 'custom' as const : 'standard' as const,
      customFieldConfig: field.customFieldConfig
    }))
  }, [fieldDetection.fieldMappings, users.length, users, log])

  return (
    <div className={clsx('space-y-6', className)}>
      {/* Tool Header */}
      <ToolHeader title='Connected APIs' icon={LinkIcon}>
        {/* Output Controls */}
        <ToolHeaderControls category={CONTROL_CATEGORIES.OUTPUT}>
          <div className='relative' ref={fieldDropdownRef}>
            <ToolHeaderButton
              category={CONTROL_CATEGORIES.OUTPUT}
              variant={fieldsControl.isActive ? 'primary' : 'secondary'}
              icon={<SettingOutlined />}
              onClick={fieldsControl.toggle}
            >
              Columns
            </ToolHeaderButton>

            <FieldsDropdownWrapper
              fieldsControl={fieldsControl}
              fieldDetection={fieldDetection}
              entityType="user"
              customFieldSupport={false}
              onToggleField={fieldMapping.toggleFieldInclusion}
              onSelectAll={fieldMapping.selectAllFields}
              onDeselectAll={fieldMapping.deselectAllFields}
              onManage={() => reorderControl.setActive(true)}
            />
          </div>

          <ToolHeaderButton
            category={CONTROL_CATEGORIES.OUTPUT}
            variant="secondary"
            icon={<ReloadOutlined />}
            onClick={() => refetch()}
            loading={isLoading || isLoadingAllData}
          >
            Refresh
          </ToolHeaderButton>
        </ToolHeaderControls>

        <ToolHeaderDivider />

        {/* Export Controls */}
        <ToolHeaderControls category={CONTROL_CATEGORIES.EXPORT}>
          <span className="font-medium text-sm -mr-1">Export:</span>
          <ExportFormatButtons
            selectedFormat={formatControl.selectedFormat}
            onSelect={(format) => {
              formatControl.selectFormat(format)
              handleDirectExport(format).catch((error) => {
                log.error('Export failed:', error)
              })
            }}
            disabled={users.length === 0 || isExporting}
            loading={isExporting}
          />
        </ToolHeaderControls>
      </ToolHeader>

      {/* Loading indicator overlay */}
      {isLoadingAllData && (
        <div className='fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50'>
          <div className='rounded-lg bg-white p-6 shadow-xl'>
            <div className='flex items-center gap-3'>
              <div className='h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent'></div>
              <span className='text-lg font-medium'>Loading user API data...</span>
            </div>
          </div>
        </div>
      )}

      {/* Data Table */}
      <Table
        data={users}
        fieldMappings={connectedApisFieldMappings}
        entityType="user"
        tenantSlug={tenantSlug ?? undefined}
        enablePersistence={true}
        persistColumnSizes={true}
        loading={isLoading && !isLoadingAllData}
        customColumnSizing={columnSizing}
        showToolbar={false}
        height={600}
        className="shadow-sm"
        emptyMessage="No users found. Try refreshing or check if users have API integrations configured."
        enableSorting={true}
        enableFiltering={true}
        enableSelection={true}
        enableColumnResizing={true}

        // Optimized virtualization settings for better performance
        rowOverscan={DEFAULT_VIRTUALIZATION.rowOverscan}
        columnOverscan={DEFAULT_VIRTUALIZATION.columnOverscan}
        rowHeight={DEFAULT_VIRTUALIZATION.rowHeight}
        enableRowVirtualization={DEFAULT_VIRTUALIZATION.enableRowVirtualization}
        enableColumnVirtualization={DEFAULT_VIRTUALIZATION.enableColumnVirtualization}
        onSelectionChange={(selection) => {
          dataSelection.deselectAll()
          users.forEach((user, index) => {
            if (selection[index]) {
              dataSelection.toggleItem(user._id)
            }
          })
          log.debug('Connected APIs table selection changed', { count: dataSelection.selectedCount })
        }}
        onColumnSizingChange={handleColumnSizingChange}
      />

      {/* Order Columns Modal */}
      <OrderColumnsModal
        visible={reorderControl.isActive}
        onClose={reorderControl.setActive.bind(null, false)}
        columns={fieldDetection.fieldMappings ?? []}
        onColumnsReorder={handleColumnsReorder}
        title="Reorder Connected APIs Columns"
        loading={fieldDetection.isLoading}
      />
    </div>
  )
}