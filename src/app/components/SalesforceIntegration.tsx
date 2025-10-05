/**
 * Salesforce Integration Page Component
 *
 * Main page component for viewing and managing Salesforce integration
 * configuration. Uses ToolHeader like other exporters and integrates
 * with the useSalesforceIntegration hook for data management.
 *
 * @fileVersion 3.1.2
 * @author Claude Code AI Assistant
 */

import React, { useEffect, useCallback } from 'react'

import {
  CloudOutlined,
  ReloadOutlined,
  SettingOutlined,
  SearchOutlined,
  FilterOutlined,
  TableOutlined,
  AppstoreOutlined,
  MenuOutlined
} from '@ant-design/icons'
import { Radio, Button, Space, Alert, Spin, Badge, Card, Divider, Typography } from 'antd'
import { clsx } from 'clsx'
import {
  CloudIcon,
  RefreshCwIcon,
  AlertCircleIcon,
  CheckCircleIcon,
  WifiIcon,
  WifiOffIcon
} from 'lucide-react'
import { toast } from 'react-hot-toast'

import { getTenantSlug } from '../../api/client/http-client'
import { SalesforceErrorBoundary } from '../../components/integrations/SalesforceErrorBoundary'
import { useSalesforceIntegration, useSalesforceConnectivity } from '../../hooks/useSalesforceIntegration'
import {
  useSalesforceViewPreferences,
  useSalesforceUIStats,
  useSalesforceLayoutState
} from '../../stores/salesforce-integration.store'
import { logSanitizer } from '../../utils/log-sanitizer'
import { logger } from '../../utils/logger'

// Lazy load the viewer component for better performance
const SalesforceIntegrationViewer = React.lazy(() =>
  import('../../components/integrations/SalesforceIntegrationViewer').then(module => ({
    default: module.SalesforceIntegrationViewer
  }))
)

export interface SalesforceIntegrationProps {
  className?: string
}

/**
 * Main Salesforce Integration component
 */
export function SalesforceIntegration({ className }: SalesforceIntegrationProps) {
  const log = logger.extension

  // Get tenant slug for API calls
  const tenantSlug = getTenantSlug()

  // Hook for integration data
  const {
    data: integrationData,
    overview,
    isLoading,
    isInitialLoading,
    isFetching,
    error,
    isStale,
    refetch,
    invalidate
  } = useSalesforceIntegration({
    tenantSlug,
    enableBackgroundRefetch: true,
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: true
  })

  // Hook for connectivity testing
  const connectivityMutation = useSalesforceConnectivity(tenantSlug)

  // UI state hooks
  const {
    viewMode,
    setViewMode,
    sortBy,
    sortDirection,
    toggleSortDirection
  } = useSalesforceViewPreferences()

  const {
    showFilters,
    toggleFilters
  } = useSalesforceLayoutState()

  const {
    expandedCount,
    hasActiveSearch,
    hasActiveFilters
  } = useSalesforceUIStats()

  // Log component mount and data changes
  useEffect(() => {
    log.info('SalesforceIntegration component mounted', logSanitizer.forDebug({
      tenantSlug: tenantSlug || 'none',
      hasData: !!integrationData
    }))
  }, [log, tenantSlug, integrationData])

  useEffect(() => {
    if (error) {
      log.error('Salesforce integration error', logSanitizer.forError({
        error: error.message,
        tenantSlug
      }))
    }
  }, [error, log, tenantSlug])

  // Handle manual refresh
  const handleRefresh = useCallback(async () => {
    log.info('Manual refresh triggered', logSanitizer.forDebug({ tenantSlug }))

    try {
      await refetch()
      toast.success('Integration data refreshed')
    } catch (refreshError) {
      const errorMessage = refreshError instanceof Error ? refreshError.message : 'Refresh failed'
      log.error('Manual refresh failed', logSanitizer.forError({ error: errorMessage, tenantSlug }))
      toast.error(`Refresh failed: ${errorMessage}`)
    }
  }, [refetch, log, tenantSlug])

  // Handle connectivity test
  const handleTestConnectivity = useCallback(async () => {
    log.info('Testing Salesforce connectivity', logSanitizer.forDebug({ tenantSlug }))

    try {
      const result = await connectivityMutation.mutateAsync()

      if (result.success) {
        toast.success(`Connection successful (${result.responseTime}ms)`)
      } else {
        toast.error(`Connection failed: ${result.error || 'Unknown error'}`)
      }
    } catch (connectError) {
      const errorMessage = connectError instanceof Error ? connectError.message : 'Connectivity test failed'
      log.error('Connectivity test failed', logSanitizer.forError({ error: errorMessage, tenantSlug }))
      toast.error(`Connectivity test failed: ${errorMessage}`)
    }
  }, [connectivityMutation, log, tenantSlug])

  // Handle cache invalidation
  const handleInvalidateCache = useCallback(async () => {
    log.info('Invalidating integration cache', logSanitizer.forDebug({ tenantSlug }))

    try {
      await invalidate()
      toast.success('Cache invalidated - data will refresh')
    } catch (invalidateError) {
      const errorMessage = invalidateError instanceof Error ? invalidateError.message : 'Cache invalidation failed'
      log.error('Cache invalidation failed', logSanitizer.forError({ error: errorMessage, tenantSlug }))
      toast.error(`Cache invalidation failed: ${errorMessage}`)
    }
  }, [invalidate, log, tenantSlug])

  // Determine connection status for UI
  const isConnected = overview?.authStatus === 'authenticated'
  const isActive = overview?.isActive ?? false

  // Calculate stats for display
  const objectCount = integrationData?.objectMappings.length ?? 0
  const totalFields = integrationData?.objectMappings.reduce((sum, obj) => sum + obj.fieldCount, 0) ?? 0

  // Render loading state
  if (isInitialLoading) {
    return (
      <div className={clsx('space-y-6', className)}>
        <Card
          title={
            <Space>
              <CloudIcon className="h-5 w-5" />
              <span>Salesforce Integration</span>
            </Space>
          }
          size="small"
        >
          <div className="flex items-center gap-2 text-gray-500">
            <Spin size="small" />
            <span>Loading integration data...</span>
          </div>
        </Card>

        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <Spin size="large" />
            <div className="mt-4 text-lg font-medium text-gray-700">Loading Salesforce Integration</div>
            <div className="mt-2 text-gray-500">Fetching configuration and field mappings...</div>
          </div>
        </div>
      </div>
    )
  }

  // Render error state
  if (error && !integrationData) {
    return (
      <div className={clsx('space-y-6', className)}>
        <Card
          title={
            <Space>
              <CloudIcon className="h-5 w-5" />
              <span>Salesforce Integration</span>
            </Space>
          }
          size="small"
        >
          <Space>
            <Button
              size="small"
              icon={<ReloadOutlined />}
              onClick={handleRefresh}
              loading={isFetching}
            >
              Retry
            </Button>
          </Space>
        </Card>

        <Alert
          message="Failed to Load Integration Data"
          description={error.message}
          type="error"
          showIcon
          icon={<AlertCircleIcon className="h-4 w-4" />}
          action={
            <Space>
              <Button
                size="small"
                onClick={handleRefresh}
                loading={isFetching}
              >
                Retry
              </Button>
              <Button
                size="small"
                type="primary"
                onClick={handleTestConnectivity}
                loading={connectivityMutation.isPending}
              >
                Test Connection
              </Button>
            </Space>
          }
        />
      </div>
    )
  }

  return (
    <div className={clsx('space-y-6', className)}>
      {/* Tool Header */}
      <Card
        title={
          <Space>
            <CloudIcon className="h-5 w-5" />
            <span>Salesforce Integration</span>
          </Space>
        }
        size="small"
      >
        <Space split={<Divider type="vertical" />} wrap>
          {/* Data Controls */}
          <Space>
            <div className="flex items-center gap-2">
              {isConnected ? (
                <Badge status="success" text={<span className="text-green-600 font-medium">Connected</span>} />
              ) : (
                <Badge status="error" text={<span className="text-red-600 font-medium">Not Connected</span>} />
              )}

              {isActive ? (
                <Badge status="processing" text="Active" />
              ) : (
                <Badge status="default" text="Inactive" />
              )}
            </div>

            <Button
              size="small"
              icon={<ReloadOutlined />}
              onClick={handleRefresh}
              loading={isFetching}
              disabled={isLoading}
            >
              Refresh
            </Button>
          </Space>

          {/* View Controls */}
          <Space>
            <Radio.Group
              value={viewMode}
              onChange={(e) => setViewMode(e.target.value)}
              size="small"
              optionType="button"
              buttonStyle="solid"
            >
              <Radio.Button value="cards">
                <AppstoreOutlined /> Cards
              </Radio.Button>
              <Radio.Button value="table">
                <TableOutlined /> Table
              </Radio.Button>
              <Radio.Button value="compact">
                <MenuOutlined /> Compact
              </Radio.Button>
            </Radio.Group>

            <Button
              size="small"
              type={hasActiveSearch ? 'primary' : 'default'}
              icon={<SearchOutlined />}
            >
              Search {hasActiveSearch && <span className="ml-1">●</span>}
            </Button>

            <Button
              size="small"
              type={showFilters ? 'primary' : 'default'}
              icon={<FilterOutlined />}
              onClick={toggleFilters}
            >
              Filters {hasActiveFilters && <span className="ml-1">●</span>}
            </Button>
          </Space>

          {/* Stats Display */}
          <Space>
            <div className="flex items-center gap-4 text-sm text-gray-600">
              <span>
                <strong>{objectCount}</strong> objects
              </span>
              <span>
                <strong>{totalFields.toLocaleString()}</strong> fields
              </span>
              {expandedCount > 0 && (
                <span>
                  <strong>{expandedCount}</strong> expanded
                </span>
              )}
              {isStale && (
                <Badge status="warning" text="Stale data" />
              )}
            </div>
          </Space>
        </Space>
      </Card>


      {/* Integration not active warning */}
      {overview && !overview.isActive && (
        <Alert
          message="Integration is not active"
          description="This Salesforce integration is currently disabled. Some data may be incomplete or outdated."
          type="info"
          showIcon
          closable
        />
      )}

      {/* Main Content */}
      <SalesforceErrorBoundary
        context="salesforce-integration-main"
        onError={(error, errorInfo) => {
          log.error('Salesforce integration component error', logSanitizer.forError({
            errorName: error.name,
            errorMessage: error.message,
            tenantSlug,
            componentStack: errorInfo.componentStack?.substring(0, 500)
          }))
        }}
        showErrorDetails={process.env.NODE_ENV === 'development'}
      >
        <React.Suspense
          fallback={
            <div className="flex items-center justify-center py-8">
              <Spin size="large" />
            </div>
          }
        >
          {integrationData ? (
            <SalesforceIntegrationViewer
              data={integrationData}
              loading={isLoading}
              tenantSlug={tenantSlug}
            />
          ) : (
            <div className="text-center py-8">
              <div className="text-gray-500">No integration data available</div>
            </div>
          )}
        </React.Suspense>
      </SalesforceErrorBoundary>
    </div>
  )
}

export default SalesforceIntegration