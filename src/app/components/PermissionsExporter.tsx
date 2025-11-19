/**
 * Permissions Exporter Component
 *
 * Export interface for Planhat roles and permissions data.
 * Displays roles in a table and supports export to CSV, JSON, and multi-sheet Excel.
 */

import { useCallback, useRef, useMemo, useState, useEffect } from 'react'

import { ReloadOutlined, SettingOutlined } from '@ant-design/icons'
import type {
  ColumnFiltersState,
  SortingState,
  VisibilityState,
  RowSelectionState,
  Table as TanStackTable
} from '@tanstack/react-table'
import { format as formatDate } from 'date-fns'
import { ShieldIcon } from 'lucide-react'

import { getTenantSlug } from '../../api/client/http-client'
import { useRoles, useRolePermissions } from '../../api/queries/permissions.queries'
import type { Role } from '../../api/services/permissions.service'
import { useUsersQuery } from '../../api/queries/users.queries'
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
import { useBadgeControl } from '../../hooks/useToolHeaderControls'
import { CONTROL_CATEGORIES } from '../../types/ui'
import { logger } from '../../utils/logger'
import {
  generatePermissionsExcel,
  generatePermissionsFlatData
} from '../../services/permissions-export.service'

const log = logger.extension

// Component Props
export interface PermissionsExporterProps {
  className?: string
}

// Export configuration interface
interface PermissionsExportConfiguration {
  includeHeaders: boolean
  includeCustomFields: boolean
  includeRelatedData: boolean
  dateFormat: string
}

/**
 * Main PermissionsExporter component
 */
export function PermissionsExporter({ className }: PermissionsExporterProps) {
  const fieldDropdownRef = useRef<HTMLDivElement>(null)
  const tableRef = useRef<TanStackTable<Role> | null>(null)

  // Get tenant slug for tenant-aware caching
  const tenantSlug = getTenantSlug()

  // Fetch roles data
  const {
    data: rolesData,
    isLoading,
    error,
    refetch: refetchQuery
  } = useRoles()

  const roles = rolesData?.data ?? []
  const totalCount = rolesData?.total ?? 0

  // Fetch role permissions for export (lazy loaded)
  const { refetch: refetchPermissions } = useRolePermissions(undefined, {
    enabled: false // Only fetch when exporting
  })

  // Fetch users data for counting users per role
  const { data: usersData } = useUsersQuery({
    filters: { isActive: true },
    pagination: { limit: 2000 }
  })

  const users = usersData?.data ?? []

  // Refresh functionality
  const refetch = useCallback(() => {
    log.info('Refreshing roles data')
    void refetchQuery()
  }, [refetchQuery])

  const exportDefaults = useMemo<PermissionsExportConfiguration>(
    () => ({
      includeHeaders: true,
      includeCustomFields: false,
      includeRelatedData: true,
      dateFormat: 'yyyy-MM-dd'
    }),
    []
  )

  const exporter = useSharedExporter<Role, PermissionsExportConfiguration>({
    entityType: 'role',
    items: roles,
    totalCount,
    tenantSlug: tenantSlug ?? undefined,
    defaultExportConfig: exportDefaults,
    buildFilename: format => {
      const now = new Date()
      const dateStr = formatDate(now, 'yyyy-MM-dd')
      const timeStr = formatDate(now, 'HH-mm')
      return `${tenantSlug || 'unknown'}_permissions_export_${dateStr}_${timeStr}`
    },
    fieldDetection: {
      sampleSize: 10,
      tenantSlug: undefined
    }
  })

  const {
    fieldsControl,
    reorderControl,
    formatControl,
    columnSizing,
    handleColumnSizingChange,
    fieldDetection,
    dataSelection,
    isExporting
  } = exporter

  // Local export state for custom Excel handler
  const [isCustomExporting, setIsCustomExporting] = useState(false)
  const effectiveIsExporting = isExporting || isCustomExporting

  // Generate table columns
  const tableColumns = useTableColumns<Role>({
    fieldDetection,
    entityType: 'role',
    columnSizing,
    tenantSlug
  })

  // Badge controls
  const rolesBadge = useBadgeControl(roles)

  // Click outside handler for fields dropdown
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
  }, [fieldsControl.isActive, fieldsControl])

  // Custom export handler for Excel multi-sheet
  const handleDirectExport = useCallback(
    async (format: 'csv' | 'json' | 'xlsx') => {
      if (roles.length === 0) {
        log.warn('No roles to export')
        return
      }

      setIsCustomExporting(true)
      log.info('Starting permissions export', { format, roleCount: roles.length })

      try {
        if (format === 'xlsx') {
          // Multi-sheet Excel export
          log.debug('Fetching role permissions for Excel export')
          const permsResult = await refetchPermissions()
          const permissions = permsResult.data ?? []

          log.debug('Generating multi-sheet Excel workbook', {
            roleCount: roles.length,
            permissionCount: permissions.length,
            userCount: users.length
          })

          const excelBuffer = await generatePermissionsExcel(roles, permissions, users)

          // Download the file
          const blob = new Blob([excelBuffer], {
            type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
          })
          const url = URL.createObjectURL(blob)
          const link = document.createElement('a')
          link.href = url
          const now = new Date()
          const dateStr = formatDate(now, 'yyyy-MM-dd')
          const timeStr = formatDate(now, 'HH-mm')
          link.download = `${tenantSlug || 'unknown'}_permissions_export_${dateStr}_${timeStr}.xlsx`
          document.body.appendChild(link)
          link.click()
          document.body.removeChild(link)
          URL.revokeObjectURL(url)

          log.info('Excel export completed successfully')
        } else {
          // CSV or JSON export - use flat data
          const flatData = roles.map(role => ({
            'Role Name': role.name ?? '',
            'Description': role.description ?? '',
            'External': role.external ? 'Yes' : null
          }))

          let content: string
          let mimeType: string
          let extension: string

          if (format === 'csv') {
            // Generate CSV
            const Papa = await import('papaparse')
            content = Papa.unparse(flatData)
            mimeType = 'text/csv'
            extension = 'csv'
          } else {
            // Generate JSON
            content = JSON.stringify(flatData, null, 2)
            mimeType = 'application/json'
            extension = 'json'
          }

          // Download the file
          const blob = new Blob([content], { type: mimeType })
          const url = URL.createObjectURL(blob)
          const link = document.createElement('a')
          link.href = url
          const now = new Date()
          const dateStr = formatDate(now, 'yyyy-MM-dd')
          const timeStr = formatDate(now, 'HH-mm')
          link.download = `${tenantSlug || 'unknown'}_permissions_export_${dateStr}_${timeStr}.${extension}`
          document.body.appendChild(link)
          link.click()
          document.body.removeChild(link)
          URL.revokeObjectURL(url)

          log.info(`${format.toUpperCase()} export completed successfully`)
        }
      } catch (error) {
        log.error('Export failed', {
          error: error instanceof Error ? error.message : 'Unknown error',
          format
        })
      } finally {
        setIsCustomExporting(false)
      }
    },
    [roles, refetchPermissions]
  )

  // Table state
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])
  const [sorting, setSorting] = useState<SortingState>([{ id: 'name', desc: false }])
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({})
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({})

  return (
    <div className={className}>
      <ToolHeader title="Permissions" icon={ShieldIcon}>
        {/* OUTPUT controls */}
        <ToolHeaderControls category={CONTROL_CATEGORIES.OUTPUT}>
          <ToolHeaderButton
            category={CONTROL_CATEGORIES.OUTPUT}
            icon={<ReloadOutlined />}
            onClick={refetch}
            disabled={isLoading}
            loading={isLoading}
          >
            Refresh
          </ToolHeaderButton>

          <div ref={fieldDropdownRef}>
            <ToolHeaderButton
              category={CONTROL_CATEGORIES.OUTPUT}
              icon={<SettingOutlined />}
              {...fieldsControl.buttonProps}
              onClick={fieldsControl.toggle}
            >
              Columns
            </ToolHeaderButton>
          </div>
        </ToolHeaderControls>

        <ToolHeaderDivider />

        {/* TABLE controls */}
        <ToolHeaderControls category={CONTROL_CATEGORIES.TABLE}>
          <ToolHeaderButton
            category={CONTROL_CATEGORIES.TABLE}
            onClick={reorderControl.toggle}
            {...reorderControl.buttonProps}
          >
            Reorder
          </ToolHeaderButton>

          <ToolHeaderButton
            category={CONTROL_CATEGORIES.TABLE}
            badge={rolesBadge.badge}
          >
            {totalCount} Roles
          </ToolHeaderButton>
        </ToolHeaderControls>

        <ToolHeaderDivider />

        {/* EXPORT controls */}
        <ToolHeaderControls category={CONTROL_CATEGORIES.EXPORT}>
          <span className="font-medium text-sm -mr-1">Export:</span>
          <ExportFormatButtons
            selectedFormat={formatControl.selectedFormat}
            onSelect={(format) => {
              formatControl.selectFormat(format)
              void handleDirectExport(format)
            }}
            disabled={roles.length === 0 || effectiveIsExporting}
            loading={effectiveIsExporting}
          />
        </ToolHeaderControls>
      </ToolHeader>

      {/* Fields dropdown */}
      <FieldsDropdownWrapper
        fieldsControl={fieldsControl}
        fieldDetection={fieldDetection}
        entityType="role"
        customFieldSupport={false}
        onToggleField={(key: string) => exporter.fieldMapping.toggleFieldInclusion(key)}
        onSelectAll={exporter.fieldMapping.selectAllFields}
        onDeselectAll={exporter.fieldMapping.deselectAllFields}
      />

      {/* Column reorder modal */}
      <OrderColumnsModal
        visible={reorderControl.isActive}
        onClose={() => reorderControl.setActive(false)}
        columns={fieldDetection.fieldMappings ?? []}
        onColumnsReorder={(reorderedColumns) => {
          exporter.fieldMapping.reorderSelectedFields(reorderedColumns)
        }}
        title="Reorder Table Columns"
        loading={fieldDetection.isLoading}
      />

      {/* Error display */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded p-4 mb-4">
          <p className="text-red-800">
            Failed to load roles: {error instanceof Error ? error.message : 'Unknown error'}
          </p>
        </div>
      )}

      {/* Data table */}
      <div className="mt-4">
        <Table
          data={roles}
          customColumns={tableColumns}
          loading={isLoading}
          showToolbar={false}
          height={600}
          emptyMessage="No roles found"
          customColumnSizing={columnSizing}
          enableSorting={true}
          enableFiltering={true}
          enableSelection={true}
          enableColumnResizing={true}
          persistColumnSizes={true}
          persistenceContext="roles"
          rowOverscan={DEFAULT_VIRTUALIZATION.rowOverscan}
          columnOverscan={DEFAULT_VIRTUALIZATION.columnOverscan}
          rowHeight={DEFAULT_VIRTUALIZATION.rowHeight}
          enableRowVirtualization={DEFAULT_VIRTUALIZATION.enableRowVirtualization}
          onSelectionChange={setRowSelection}
          onTableReady={({ table }) => {
            tableRef.current = table
          }}
          onColumnSizingChange={handleColumnSizingChange}
        />
      </div>

      {/* Stats footer */}
      <div className="mt-4 text-sm text-gray-600">
        <span className="font-medium">{totalCount}</span> role{totalCount !== 1 ? 's' : ''} loaded
        {Object.keys(rowSelection).length > 0 && (
          <span className="ml-4">
            <span className="font-medium">{Object.keys(rowSelection).length}</span> selected
          </span>
        )}
      </div>
    </div>
  )
}
