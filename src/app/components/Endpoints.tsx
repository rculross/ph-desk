/**
 * Endpoints Discovery Component
 *
 * Automatic endpoint discovery, pattern recognition, and management
 * for Planhat API endpoints with export functionality.
 */

import { useState, useCallback, useEffect, useMemo } from 'react'

import {
  ScanOutlined,
  DeleteOutlined,
  UploadOutlined,
  ReloadOutlined
} from '@ant-design/icons'
import { Button, Input, Select, Modal, Upload } from 'antd'
import { clsx } from 'clsx'
import { format as formatDate } from 'date-fns'
import { NetworkIcon } from 'lucide-react'
import { toast } from 'react-hot-toast'

import { getTenantSlug } from '../../api/client/http-client'
import { useSharedExporter } from '../../components/exporters'
import { Table } from '../../components/ui/Table'
import {
  ToolHeader,
  ToolHeaderButton,
  ToolHeaderControls,
  ToolHeaderDivider,
  CompactInput
} from '../../components/ui/ToolHeader'
import { DEFAULT_VIRTUALIZATION } from '../../config/table-virtualization'
import { useEndpointDiscovery } from '../../hooks/useEndpointDiscovery'
import { CONTROL_CATEGORIES } from '../../types/ui'
import { logger } from '../../utils/logger'

export interface EndpointsProps {
  className?: string
}

interface EndpointsExportConfiguration {
  includeHeaders: boolean
  includeCustomFields: boolean
  includeRelatedData: boolean
  includeMetadata: boolean
  includePatterns: boolean
  dateFormat: string
}

const { Option } = Select

export function Endpoints({ className }: EndpointsProps) {
  const [isImportModalVisible, setIsImportModalVisible] = useState(false)
  const [importData, setImportData] = useState('')
  const log = logger.extension

  const tenantSlug = getTenantSlug()

  // Endpoint discovery hook
  const {
    endpoints,
    patterns,
    isLoading,
    isScanning,
    isAnalyzing,
    filters,
    filterOptions,
    addEndpoint,
    removeEndpoint,
    scanTabs,
    scanHistory,
    analyzeEndpoint,
    clearEndpoints,
    exportEndpoints,
    importEndpoints,
    setFilters,
    updateFilter,
    clearFilters,
    reloadData
  } = useEndpointDiscovery()

  // Export configuration
  const exportDefaults = useMemo<EndpointsExportConfiguration>(
    () => ({
      includeHeaders: true,
      includeCustomFields: false,
      includeRelatedData: false,
      includeMetadata: true,
      includePatterns: true,
      dateFormat: 'yyyy-MM-dd'
    }),
    []
  )

  const exporter = useSharedExporter<any, EndpointsExportConfiguration>({
    entityType: 'custom',
    items: endpoints.map(ep => ({
      url: ep.url,
      method: ep.method,
      pattern: ep.pattern,
      resourceType: ep.resourceType,
      firstSeen: new Date(ep.firstSeen).toISOString(),
      lastUsed: new Date(ep.lastUsed).toISOString(),
      usageCount: ep.usageCount,
      hasSchema: !!ep.responseSchema,
      source: ep.metadata?.source || 'manual'
    })),
    totalCount: endpoints.length,
    tenantSlug: tenantSlug ?? undefined,
    defaultExportConfig: exportDefaults,
    buildFilename: (format) => `endpoints_export_${formatDate(new Date(), 'yyyy-MM-dd')}`
  })

  const {
    dataSelection,
    handleDirectExport,
    isExporting
  } = exporter


  // Handle bulk import
  const handleImport = useCallback(async () => {
    if (!importData.trim()) {
      toast.error('Please enter JSON data to import')
      return
    }

    try {
      await importEndpoints(importData)
      toast.success('Endpoints imported successfully')
      setIsImportModalVisible(false)
      setImportData('')
    } catch (error) {
      toast.error(`Failed to import endpoints: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }, [importData, importEndpoints])

  // Handle file upload
  const handleFileUpload = useCallback((file: File) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const content = e.target?.result as string
      setImportData(content)
    }
    reader.readAsText(file)
    return false // Prevent upload
  }, [])

  // Handle discover button click - scan both tabs and history
  const handleDiscover = useCallback(async () => {
    try {
      // Scan active tabs first
      await scanTabs()
      // Then scan entire browser history
      await scanHistory(365) // Scan full year of history
      toast.success('Discovery completed! Check the table for new endpoints.')
    } catch (error) {
      log.error('Discovery failed', { error })
      toast.error('Discovery failed. Please try again.')
    }
  }, [scanTabs, scanHistory, log])


  // Simple field mappings for endpoints display
  const endpointsFieldMappings = useMemo(() => [
    {
      key: 'url',
      label: 'URL',
      type: 'string' as const,
      include: true,
      source: 'standard' as const
    },
    {
      key: 'method',
      label: 'Method',
      type: 'string' as const,
      include: true,
      source: 'standard' as const
    },
    {
      key: 'usageCount',
      label: 'Usage Count',
      type: 'number' as const,
      include: true,
      source: 'standard' as const
    },
    {
      key: 'lastUsed',
      label: 'Last Used',
      type: 'date' as const,
      include: true,
      source: 'standard' as const
    },
    {
      key: 'source',
      label: 'Source',
      type: 'string' as const,
      include: true,
      source: 'standard' as const
    }
  ], [])

  return (
    <div className={clsx('space-y-6', className)}>
      {/* Tool Header */}
      <ToolHeader title='Endpoints' icon={NetworkIcon}>
        {/* Discovery Controls */}
        <ToolHeaderControls category={CONTROL_CATEGORIES.FILTER}>
          <ToolHeaderButton
            category={CONTROL_CATEGORIES.FILTER}
            variant="secondary"
            icon={<ScanOutlined />}
            loading={isScanning}
            onClick={handleDiscover}
          >
            Discover
          </ToolHeaderButton>

          <CompactInput
            placeholder="Search endpoints..."
            value={filters.searchTerm}
            onChange={(e) => updateFilter('searchTerm', e.target.value)}
          />
        </ToolHeaderControls>

        <ToolHeaderDivider />

        {/* Output Controls */}
        <ToolHeaderControls category={CONTROL_CATEGORIES.OUTPUT}>
          <ToolHeaderButton
            category={CONTROL_CATEGORIES.OUTPUT}
            variant="secondary"
            icon={<ReloadOutlined />}
            onClick={() => reloadData()}
            loading={isLoading}
          >
            Refresh
          </ToolHeaderButton>

          <ToolHeaderButton
            category={CONTROL_CATEGORIES.OUTPUT}
            variant="secondary"
            icon={<DeleteOutlined />}
            onClick={() => {
              Modal.confirm({
                title: 'Clear All Endpoints',
                content: 'Are you sure you want to clear all discovered endpoints? This action cannot be undone.',
                okText: 'Clear',
                okType: 'danger',
                onOk: () => clearEndpoints()
              })
            }}
          >
            Clear
          </ToolHeaderButton>
        </ToolHeaderControls>

        <ToolHeaderDivider />

        {/* Import/Export Controls */}
        <ToolHeaderControls category={CONTROL_CATEGORIES.EXPORT}>
          <ToolHeaderButton
            category={CONTROL_CATEGORIES.EXPORT}
            variant="secondary"
            icon={<UploadOutlined />}
            onClick={() => setIsImportModalVisible(true)}
          >
            Import
          </ToolHeaderButton>

          <ToolHeaderButton
            category={CONTROL_CATEGORIES.EXPORT}
            variant="primary"
            onClick={() => {
              handleDirectExport('json').catch((error) => {
                log.error('Export failed:', error)
              })
            }}
            disabled={endpoints.length === 0 || isExporting}
            loading={isExporting}
          >
            Export JSON
          </ToolHeaderButton>
        </ToolHeaderControls>
      </ToolHeader>

      {/* Filters Section */}
      {(filters.method || filters.resourceType || filters.pattern) && (
        <div className="flex flex-wrap gap-2 items-center">
          <span className="text-sm font-medium text-gray-600">Filters:</span>

          {filters.method && (
            <Select
              value={filters.method}
              onChange={(value) => updateFilter('method', value)}
              style={{ width: 100 }}
              size="small"
              allowClear
            >
              {filterOptions.methods.map(method => (
                <Option key={method} value={method}>{method}</Option>
              ))}
            </Select>
          )}

          {filters.resourceType && (
            <Select
              value={filters.resourceType}
              onChange={(value) => updateFilter('resourceType', value)}
              style={{ width: 150 }}
              size="small"
              allowClear
              placeholder="Resource Type"
            >
              {filterOptions.resourceTypes.map(type => (
                <Option key={type} value={type}>{type}</Option>
              ))}
            </Select>
          )}

          <Button size="small" onClick={clearFilters}>
            Clear Filters
          </Button>
        </div>
      )}


      {/* Data Table */}
      <Table
        data={endpoints.map(ep => ({
          ...ep,
          lastUsed: new Date(ep.lastUsed).toISOString(),
          firstSeen: new Date(ep.firstSeen).toISOString(),
          source: ep.metadata?.source || 'manual'
        }))}
        fieldMappings={endpointsFieldMappings}
        entityType="custom"
        tenantSlug={tenantSlug ?? undefined}
        enablePersistence={true}
        persistColumnSizes={true}
        loading={isLoading}
        showToolbar={false}
        height={600}
        className="shadow-sm"
        emptyMessage="No endpoints discovered. Click 'Discover' to scan browser tabs and history."
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
          endpoints.forEach((endpoint, index) => {
            if (selection[index]) {
              dataSelection.toggleItem(endpoint.url + endpoint.method)
            }
          })
          log.debug('Endpoints table selection changed', { count: dataSelection.selectedCount })
        }}
      />

      {/* Import Modal */}
      <Modal
        title="Import Endpoints"
        open={isImportModalVisible}
        onOk={handleImport}
        onCancel={() => {
          setIsImportModalVisible(false)
          setImportData('')
        }}
        width={800}
        okText="Import"
        cancelText="Cancel"
        okButtonProps={{ disabled: !importData.trim() }}
      >
        <div className="space-y-4">
          <div>
            <p className="text-sm text-gray-600 mb-2">
              Upload a JSON file or paste JSON data containing endpoint definitions.
            </p>
            <Upload
              beforeUpload={handleFileUpload}
              showUploadList={false}
              accept=".json,.txt"
            >
              <Button icon={<UploadOutlined />}>Select File</Button>
            </Upload>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              JSON Data:
            </label>
            <TextArea
              value={importData}
              onChange={(e) => setImportData(e.target.value)}
              placeholder="Paste JSON endpoint data here..."
              rows={12}
              className="font-mono text-sm"
            />
          </div>
        </div>
      </Modal>

    </div>
  )
}