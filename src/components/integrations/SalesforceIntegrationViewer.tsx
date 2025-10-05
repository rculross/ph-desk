/**
 * Salesforce Integration Viewer Component
 *
 * Main viewer component for Salesforce integration data. Shows integration
 * overview, object mappings list, and integrates search functionality.
 * Supports multiple view modes (cards, table, compact) and filtering.
 *
 * @fileVersion 3.1.2
 * @author Claude Code AI Assistant
 */

import React, { useMemo, useEffect } from 'react'

import {
  CloudSyncOutlined,
  DatabaseOutlined
} from '@ant-design/icons'
import {
  Row,
  Col,
  Card,
  Statistic,
  Space,
  Divider,
  Empty,
  Badge,
  Typography
} from 'antd'
import { clsx } from 'clsx'
import { format } from 'date-fns'

import {
  useSalesforceSearch,
  useSalesforceUIStats,
  useSalesforceViewPreferences
} from '../../stores/salesforce-integration.store'
import type {
  SalesforceIntegrationData,
  SalesforceObjectMapping,
  SalesforceSearchFilters
} from '../../types/integrations/salesforce.types'
import { logger } from '../../utils/logger'

import SalesforceErrorBoundary from './SalesforceErrorBoundary'
import SalesforceFieldTable from './SalesforceFieldTable'
import SalesforceObjectCard from './SalesforceObjectCard'

const { Title, Text } = Typography

const log = logger.content

export interface SalesforceIntegrationViewerProps {
  /** Integration data to display */
  data: SalesforceIntegrationData
  /** Loading state */
  loading?: boolean
  /** Additional CSS classes */
  className?: string
  /** Tenant slug for persistence */
  tenantSlug?: string
}


/**
 * Filter object mappings based on search results
 */
function filterObjectMappings(
  mappings: SalesforceObjectMapping[],
  searchTerm: string,
  filters: SalesforceSearchFilters
): SalesforceObjectMapping[] {
  const normalizedTerm = searchTerm.trim().toLowerCase()
  const directionFilter = new Set(filters.direction ?? [])
  const fieldTypeFilter = new Set(filters.fieldTypes ?? [])
  const objectTypeFilters = (filters.objectTypes ?? []).map(type => type.toLowerCase())
  const includeCustom = filters.includeCustomObjects !== false
  const includeStandard = filters.includeStandardObjects !== false

  return mappings.filter(mapping => {
    if (!includeCustom && mapping.isCustom) {
      return false
    }

    if (!includeStandard && !mapping.isCustom) {
      return false
    }

    if (directionFilter.size > 0) {
      const direction = mapping.direction ?? 'none'
      if (!directionFilter.has(direction)) {
        return false
      }
    }

    if (typeof filters.minFieldCount === 'number' && mapping.fieldCount < filters.minFieldCount) {
      return false
    }

    if (typeof filters.maxFieldCount === 'number' && mapping.fieldCount > filters.maxFieldCount) {
      return false
    }

    if (fieldTypeFilter.size > 0) {
      const hasAllowedFieldType = mapping.fields.some(field => fieldTypeFilter.has(field.sfType))
      if (!hasAllowedFieldType) {
        return false
      }
    }

    if (objectTypeFilters.length > 0) {
      const lowerSf = mapping.sfObject.toLowerCase()
      const lowerPh = mapping.phObject.toLowerCase()
      const matchesObjectFilter = objectTypeFilters.some(type =>
        lowerSf.includes(type) || lowerPh.includes(type)
      )

      if (!matchesObjectFilter) {
        return false
      }
    }

    if (!normalizedTerm) {
      return true
    }

    const lowerSf = mapping.sfObject.toLowerCase()
    const lowerPh = mapping.phObject.toLowerCase()

    if (lowerSf.includes(normalizedTerm) || lowerPh.includes(normalizedTerm)) {
      return true
    }

    return mapping.fields.some(field => {
      const sfField = field.sfField.toLowerCase()
      const phField = field.phField.toLowerCase()
      return sfField.includes(normalizedTerm) || phField.includes(normalizedTerm)
    })
  })
}

/**
 * Salesforce Integration Viewer Component
 */
export function SalesforceIntegrationViewer({
  data,
  loading = false,
  className,
  tenantSlug
}: SalesforceIntegrationViewerProps) {
  // UI state hooks
  const { searchTerm, searchFilters } = useSalesforceSearch()

  const {
    hasActiveSearch,
    hasActiveFilters
  } = useSalesforceUIStats()

  const {
    viewMode
  } = useSalesforceViewPreferences()

  // Log component activity
  useEffect(() => {
    log.info('SalesforceIntegrationViewer rendered', {
      objectCount: data.objectMappings.length,
      hasActiveSearch
    })
  }, [data.objectMappings.length, hasActiveSearch])

  // Process and filter data
  const processedMappings = useMemo(() => {
    return filterObjectMappings(data.objectMappings, searchTerm, searchFilters)
  }, [data.objectMappings, searchTerm, searchFilters])

  // Calculate overview stats
  const overviewStats = useMemo(() => {
    const totalObjects = data.objectMappings.length
    const totalFields = data.objectMappings.reduce((sum, obj) => sum + obj.fieldCount, 0)
    const activeObjects = data.objectMappings.filter(obj => obj.direction && obj.direction !== 'none').length
    const customObjects = data.objectMappings.filter(obj => obj.isCustom).length
    const bidirectionalObjects = data.objectMappings.filter(obj => obj.isBidirectional).length

    return {
      totalObjects,
      totalFields,
      activeObjects,
      customObjects,
      bidirectionalObjects,
      displayedObjects: processedMappings.length
    }
  }, [data.objectMappings, processedMappings.length])


  // All fields for table view
  const allFields = useMemo(() => {
    return processedMappings.flatMap(mapping =>
      mapping.fields.map(field => ({
        ...field,
        objectName: `${mapping.sfObject} → ${mapping.phObject}`,
        sfObject: mapping.sfObject,
        phObject: mapping.phObject
      }))
    )
  }, [processedMappings])

  // Render overview section
  const renderOverview = () => (
    <Card
      title="Integration Overview"
      className="mb-4"
      size="small"
      extra={
        <Text type="secondary" className="text-sm">
          <Text strong>Last Sync: </Text>
          {data.overview.lastSync
            ? format(new Date(data.overview.lastSync), 'yyyy-MM-dd HH:mm:ss')
            : 'Never'}
        </Text>
      }
    >
      <Row gutter={[12, 12]}>
        <Col xs={24} sm={12} md={6} lg={6}>
          <Statistic
            title="Total Objects"
            value={overviewStats.totalObjects}
            prefix={<DatabaseOutlined />}
          />
        </Col>
        <Col xs={24} sm={12} md={6} lg={6}>
          <Statistic
            title="Total Fields"
            value={overviewStats.totalFields}
            prefix={<CloudSyncOutlined />}
          />
        </Col>
        <Col xs={24} sm={12} md={6} lg={6}>
          <Statistic
            title="Active Objects"
            value={overviewStats.activeObjects}
            suffix={`/ ${overviewStats.totalObjects}`}
            valueStyle={{ color: overviewStats.activeObjects > 0 ? '#3f8600' : '#cf1322' }}
          />
        </Col>
        <Col xs={24} sm={12} md={6} lg={6}>
          <Statistic
            title="Custom Objects"
            value={overviewStats.customObjects}
            prefix={<Badge status="processing" />}
          />
        </Col>
      </Row>
    </Card>
  )


  // Render content based on view mode
  const renderContent = () => {
    if (processedMappings.length === 0) {
      const hasSearchOrFilters = hasActiveSearch || hasActiveFilters
      let message: string
      if (!hasSearchOrFilters) {
        message = 'No object mappings found'
      } else if (hasActiveSearch && hasActiveFilters) {
        message = 'No objects match your search and filters'
      } else if (hasActiveSearch) {
        message = `No objects match your search "${searchTerm}"`
      } else {
        message = 'No objects match your filters'
      }

      const description = hasSearchOrFilters
        ? 'Try adjusting your search terms or filters'
        : 'This integration has no configured object mappings'

      return (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description={
            <div>
              <div className="text-lg font-medium text-gray-700">{message}</div>
              <div className="text-sm text-gray-500 mt-1">{description}</div>
            </div>
          }
        />
      )
    }

    switch (viewMode) {
      case 'table':
        return (
          <SalesforceFieldTable
            fields={allFields}
            loading={loading}
            title="All Field Mappings"
            enableSearchHighlight={hasActiveSearch}
            className="shadow-sm"
            tenantSlug={tenantSlug}
          />
        )

      case 'compact':
        return (
          <div className="space-y-2">
            {processedMappings.map((mapping, index) => (
              <SalesforceObjectCard
                key={`${mapping.sfObject}-${mapping.phObject}-${index}`}
                objectMapping={mapping}
                loading={loading}
                compact={true}
                enableSearchHighlight={hasActiveSearch}
                showComplexity={false}
                className="hover:shadow-sm transition-shadow duration-200"
                tenantSlug={tenantSlug}
              />
            ))}
          </div>
        )

      case 'cards':
      default:
        return (
          <div className="space-y-4">
            {processedMappings.map((mapping, index) => (
              <SalesforceObjectCard
                key={`${mapping.sfObject}-${mapping.phObject}-${index}`}
                objectMapping={mapping}
                loading={loading}
                enableSearchHighlight={hasActiveSearch}
                showComplexity={true}
                className="transition-all duration-200"
                tenantSlug={tenantSlug}
              />
            ))}
          </div>
        )
    }
  }

  return (
    <SalesforceErrorBoundary
      context="salesforce-integration-viewer"
      onError={(error, errorInfo) => {
        log.error('Salesforce integration viewer error', {
          errorName: error.name,
          errorMessage: error.message,
          componentStack: errorInfo.componentStack?.substring(0, 500)
        })
      }}
      showErrorDetails={process.env.NODE_ENV === 'development'}
    >
      <div className={clsx('space-y-6', className)}>
        {/* Overview */}
        <SalesforceErrorBoundary context="salesforce-overview" showErrorDetails={false}>
          {renderOverview()}
        </SalesforceErrorBoundary>


        {/* Main Content */}
        <SalesforceErrorBoundary
          context="salesforce-content"
          showErrorDetails={process.env.NODE_ENV === 'development'}
          errorTitle="Content Display Error"
          errorDescription="There was an issue displaying the Salesforce integration content. The data may be in an unexpected format."
        >
          {renderContent()}
        </SalesforceErrorBoundary>

        {/* Debug info in development */}
        {process.env.NODE_ENV === 'development' && (
          <SalesforceErrorBoundary context="salesforce-debug" showErrorDetails={false}>
            <Card title="Debug Info" size="small" className="mt-8">
              <pre className="text-xs text-gray-600 overflow-auto">
                {JSON.stringify({
                  totalMappings: data.objectMappings.length,
                  displayedMappings: processedMappings.length,
                  hasActiveSearch,
                  searchTerm: searchTerm.substring(0, 50)
                }, null, 2)}
              </pre>
            </Card>
          </SalesforceErrorBoundary>
        )}
      </div>
    </SalesforceErrorBoundary>
  )
}

export default SalesforceIntegrationViewer