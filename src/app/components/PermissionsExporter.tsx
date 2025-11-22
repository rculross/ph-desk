/**
 * Permissions Exporter Component
 *
 * Export interface for Planhat roles and permissions data.
 * Displays roles in a table and supports export to CSV, JSON, and multi-sheet Excel.
 */

import { useCallback, useRef, useMemo, useState, useEffect } from 'react'

import { SettingOutlined } from '@ant-design/icons'
import type {
  VisibilityState,
  RowSelectionState
} from '@tanstack/react-table'
import { Typography, Button, Dropdown, Checkbox, InputNumber } from 'antd'
import { format as formatDate } from 'date-fns'
import { ShieldIcon } from 'lucide-react'

import { getTenantSlug } from '../../api/client/http-client'
import { useRoles, useRolePermissions } from '../../api/queries/permissions.queries'
import type { Role } from '../../api/services/permissions.service'
import { useUsersQuery } from '../../api/queries/users.queries'
import { ExportFormatButtons, useSharedExporter } from '../../components/exporters'
import { Table, type TableRenderContext } from '../../components/ui/Table'
import {
  ToolHeader,
  ToolHeaderButton,
  ToolHeaderControls
} from '../../components/ui/ToolHeader'
import { DEFAULT_VIRTUALIZATION } from '../../config/table-virtualization'
import { useTableColumns } from '../../hooks/useTableColumns'
import { CONTROL_CATEGORIES } from '../../types/ui'
import { logger } from '../../utils/logger'
import { generatePermissionsExcel } from '../../services/permissions-export.service'

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
  const tableContextRef = useRef<TableRenderContext<Role> | null>(null)

  // Get tenant slug for tenant-aware caching
  const tenantSlug = getTenantSlug()

  // State for max records
  const [maxRecords, setMaxRecords] = useState(2000)
  const hasAutoLoaded = useRef(false)

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
    pagination: { limit: maxRecords }
  })

  const users = usersData?.data ?? []

  // Execute fetch with specified max records
  const executeLoad = useCallback(() => {
    log.info('Executing permissions load', { maxRecords })
    void refetchQuery()
  }, [refetchQuery, maxRecords])

  // Auto-load on component mount
  useEffect(() => {
    if (!hasAutoLoaded.current) {
      hasAutoLoaded.current = true
      executeLoad()
    }
  }, [executeLoad])

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
    formatControl,
    columnSizing,
    handleColumnSizingChange,
    fieldDetection,
    isExporting
  } = exporter

  // Local export state for custom Excel handler
  const [isCustomExporting, setIsCustomExporting] = useState(false)
  const effectiveIsExporting = isExporting || isCustomExporting

  // Columns dropdown state
  const [columnsDropdownOpen, setColumnsDropdownOpen] = useState(false)
  const [pendingVisibility, setPendingVisibility] = useState<VisibilityState | null>(null)

  // Generate table columns
  const tableColumns = useTableColumns<Role>({
    fieldDetection,
    entityType: 'role',
    columnSizing,
    tenantSlug
  })

  // Column visibility handlers with deferred updates
  useEffect(() => {
    if (columnsDropdownOpen && tableContextRef.current) {
      // Initialize pending visibility when dropdown opens
      const currentVisibility: VisibilityState = {}
      tableContextRef.current.table.getAllLeafColumns().forEach(column => {
        if (column.id !== 'select') {
          currentVisibility[column.id] = column.getIsVisible()
        }
      })
      setPendingVisibility(currentVisibility)
    }
  }, [columnsDropdownOpen])

  const handleDropdownOpenChange = useCallback((open: boolean) => {
    setColumnsDropdownOpen(open)

    if (!open && pendingVisibility && tableContextRef.current) {
      // Apply the pending visibility changes using setColumnVisibility from useTableCore
      tableContextRef.current.state.setColumnVisibility(pendingVisibility)
      setPendingVisibility(null)
    }
  }, [pendingVisibility])

  const handleColumnToggle = useCallback((columnId: string) => {
    if (!pendingVisibility) return

    setPendingVisibility(prev => ({
      ...prev!,
      [columnId]: !prev![columnId]
    }))
  }, [pendingVisibility])

  const handleSelectAll = useCallback(() => {
    if (!tableContextRef.current) return

    const newVisibility: VisibilityState = {}
    tableContextRef.current.table.getAllLeafColumns().forEach(column => {
      if (column.id !== 'select') {
        newVisibility[column.id] = true
      }
    })
    setPendingVisibility(newVisibility)
  }, [])

  const handleDeselectAll = useCallback(() => {
    if (!tableContextRef.current) return

    const newVisibility: VisibilityState = {}
    tableContextRef.current.table.getAllLeafColumns().forEach(column => {
      if (column.id !== 'select') {
        newVisibility[column.id] = false
      }
    })
    setPendingVisibility(newVisibility)
  }, [])

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
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({})

  return (
    <div className={className}>
      <ToolHeader title="Permissions" icon={ShieldIcon}>
        {/* Controls */}
        <ToolHeaderControls category={CONTROL_CATEGORIES.OUTPUT}>
          {/* Columns Button */}
          <Dropdown
            open={columnsDropdownOpen}
            onOpenChange={handleDropdownOpenChange}
            trigger={['click']}
            dropdownRender={() => (
              <div className="p-3 min-w-[200px] bg-white rounded-lg shadow-lg border border-gray-200">
                <div className="flex justify-between items-center mb-2">
                  <Typography.Text strong>Show Columns</Typography.Text>
                  <div className="flex gap-2">
                    <Button
                      type="text"
                      size="small"
                      onClick={handleSelectAll}
                    >
                      All
                    </Button>
                    <Button
                      type="text"
                      size="small"
                      onClick={handleDeselectAll}
                    >
                      None
                    </Button>
                  </div>
                </div>
                <div className="flex flex-col gap-1 max-h-[400px] overflow-y-auto">
                  {tableContextRef.current?.table.getAllLeafColumns()
                    .filter(col => col.id !== 'select')
                    .map(column => {
                      const isVisible = pendingVisibility
                        ? pendingVisibility[column.id] !== false
                        : column.getIsVisible()

                      return (
                        <Checkbox
                          key={column.id}
                          checked={isVisible}
                          onChange={() => handleColumnToggle(column.id)}
                        >
                          {typeof column.columnDef.header === 'string'
                            ? column.columnDef.header
                            : `Column ${column.id}`}
                        </Checkbox>
                      )
                    })}
                </div>
              </div>
            )}
          >
            <ToolHeaderButton
              category={CONTROL_CATEGORIES.OUTPUT}
              variant={columnsDropdownOpen ? 'primary' : 'secondary'}
              icon={<SettingOutlined />}
            >
              Columns
            </ToolHeaderButton>
          </Dropdown>

          {/* Max Records Input */}
          <InputNumber
            mode="spinner"
            value={maxRecords}
            onChange={(value) => setMaxRecords(value || 2000)}
            min={100}
            max={50000}
            step={2000}
            style={{ width: 120 }}
          />

          {/* Execute Button */}
          <Button
            size="small"
            type="primary"
            onClick={executeLoad}
            loading={isLoading}
          >
            Execute
          </Button>

          {/* Export Controls */}
          <span className="font-medium text-sm -mr-1 ml-2">Export:</span>
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
          onTableReady={(context) => {
            tableContextRef.current = context
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
