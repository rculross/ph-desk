/**
 * Salesforce Object Card Component
 *
 * Card component for each object mapping (Account→Company, etc.) using
 * Ant Design Card and Collapse components. Shows direction badges, field
 * count, last sync, and expandable field mappings table.
 *
 * @fileVersion 3.1.2
 * @author Claude Code AI Assistant
 */

import React, { useCallback, useMemo } from 'react'

import {
  ArrowRightOutlined,
  ArrowLeftOutlined,
  SwapOutlined,
  StopOutlined,
  DatabaseOutlined,
  FieldTimeOutlined,
  ExpandOutlined,
  CompressOutlined,
  SettingOutlined,
  WarningOutlined
} from '@ant-design/icons'
import { Card, Badge, Tag, Tooltip, Button, Space, Divider, Typography, Alert } from 'antd'
import { clsx } from 'clsx'
import { formatDistanceToNow } from 'date-fns'

import { useSalesforceObjectExpansion, useSalesforceObjectSelection } from '../../stores/salesforce-integration.store'
import type {
  SalesforceObjectMapping,
  SalesforceDirection
} from '../../types/integrations/salesforce.types'
import { logger } from '../../utils/logger'

import SalesforceFieldTable from './SalesforceFieldTable'

const { Text, Title } = Typography

const log = logger.content

export interface SalesforceObjectCardProps {
  /** Object mapping data */
  objectMapping: SalesforceObjectMapping
  /** Loading state */
  loading?: boolean
  /** Enable compact mode */
  compact?: boolean
  /** Show detailed field table by default */
  defaultExpanded?: boolean
  /** Additional CSS classes */
  className?: string
  /** Enable search highlighting */
  enableSearchHighlight?: boolean
  /** Show complexity indicators */
  showComplexity?: boolean
  /** Tenant slug for persistence */
  tenantSlug?: string
}

/**
 * Direction display configuration
 */
const DIRECTION_CONFIG = {
  fromSF: {
    icon: <ArrowRightOutlined />,
    label: 'From SF',
    color: 'blue',
    description: 'Salesforce → Planhat'
  },
  toSF: {
    icon: <ArrowLeftOutlined />,
    label: 'To SF',
    color: 'orange',
    description: 'Planhat → Salesforce'
  },
  both: {
    icon: <SwapOutlined />,
    label: 'Both',
    color: 'green',
    description: 'Bidirectional sync'
  },
  none: {
    icon: <StopOutlined />,
    label: 'None',
    color: 'default',
    description: 'No sync configured'
  },
  null: {
    icon: <WarningOutlined />,
    label: 'Unknown',
    color: 'red',
    description: 'Direction not specified'
  }
} as const

/**
 * Complexity level configuration
 */
const COMPLEXITY_CONFIG = {
  low: { color: 'green', label: 'Simple', icon: '○' },
  medium: { color: 'orange', label: 'Moderate', icon: '◐' },
  high: { color: 'red', label: 'Complex', icon: '●' }
} as const

/**
 * Generate object mapping ID for state management
 */
function generateObjectId(objectMapping: SalesforceObjectMapping): string {
  return `${objectMapping.sfObject}-${objectMapping.phObject}`
}

/**
 * Salesforce Object Card Component
 */
export function SalesforceObjectCard({
  objectMapping,
  loading = false,
  compact = false,
  defaultExpanded = false,
  className,
  enableSearchHighlight = true,
  showComplexity = true,
  tenantSlug
}: SalesforceObjectCardProps) {
  const objectId = generateObjectId(objectMapping)

  // State hooks
  const {
    expandedObjects,
    toggleExpanded,
    expandObject,
    collapseObject
  } = useSalesforceObjectExpansion()

  const {
    selectedObjectId,
    selectObject,
    clearSelection
  } = useSalesforceObjectSelection()

  // Determine if expanded
  const isExpanded = expandedObjects.has(objectId) ||
                   expandedObjects.has('__EXPAND_ALL__') ||
                   defaultExpanded

  const isSelected = selectedObjectId === objectId

  // Handle card click for expansion
  const handleCardClick = useCallback((e: React.MouseEvent) => {
    // Don't expand if clicking on buttons or interactive elements
    if ((e.target as HTMLElement).closest('button, .ant-btn, [role="button"]')) {
      return
    }

    toggleExpanded(objectId)

    log.debug('Object card toggled', {
      objectId: objectMapping.sfObject,
      expanded: !isExpanded
    })
  }, [toggleExpanded, objectId, objectMapping.sfObject, isExpanded])

  // Handle object selection
  const handleSelectObject = useCallback(() => {
    if (isSelected) {
      clearSelection()
    } else {
      selectObject(objectId)
    }

    log.debug('Object selection changed', {
      objectId: objectMapping.sfObject,
      selected: !isSelected
    })
  }, [selectObject, clearSelection, objectId, objectMapping.sfObject, isSelected])

  // Direction configuration
  const directionKey = (objectMapping.direction ?? 'null') as keyof typeof DIRECTION_CONFIG
  const directionConfig = DIRECTION_CONFIG[directionKey]

  // Last sync formatting
  const lastSyncFormatted = useMemo(() => {
    if (!objectMapping.lastSync) return 'Never synced'

    try {
      const date = new Date(objectMapping.lastSync)
      return formatDistanceToNow(date, { addSuffix: true })
    } catch {
      return 'Invalid date'
    }
  }, [objectMapping.lastSync])

  // Complexity information
  const complexityConfig = objectMapping.complexity ? COMPLEXITY_CONFIG[objectMapping.complexity] : null

  // Field count formatting
  const fieldCountFormatted = objectMapping.fieldCount.toLocaleString()

  // Additional info for card
  const hasFilters = Boolean(objectMapping.filters)
  const isBidirectional = Boolean(objectMapping.isBidirectional)
  const syncOwner = Boolean(objectMapping.syncOwner)

  return (
    <Card
      className={clsx(
        'transition-all duration-200 hover:shadow-md cursor-pointer',
        isSelected && 'ring-2 ring-blue-500',
        isExpanded && 'shadow-lg',
        className
      )}
      size={compact ? 'small' : 'default'}
      loading={loading}
      onClick={handleCardClick}
      extra={
        <Space size="small">
          {/* Complexity indicator */}
          {showComplexity && complexityConfig && (
            <Tooltip title={`Complexity: ${complexityConfig.label}`}>
              <Tag color={complexityConfig.color} className="text-xs">
                {complexityConfig.icon} {complexityConfig.label}
              </Tag>
            </Tooltip>
          )}

          {/* Expand/collapse button */}
          <Button
            type="text"
            size="small"
            icon={isExpanded ? <CompressOutlined /> : <ExpandOutlined />}
            onClick={(e) => {
              e.stopPropagation()
              toggleExpanded(objectId)
            }}
            title={isExpanded ? 'Collapse' : 'Expand'}
          />

          {/* Select button */}
          <Button
            type={isSelected ? 'primary' : 'text'}
            size="small"
            icon={<SettingOutlined />}
            onClick={(e) => {
              e.stopPropagation()
              handleSelectObject()
            }}
            title={isSelected ? 'Deselect' : 'Select for details'}
          />
        </Space>
      }
    >
      {/* Card Header */}
      <div className="space-y-3">
        {/* Object Names */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <DatabaseOutlined className="text-blue-600" />
              <Title level={compact ? 5 : 4} className="m-0 font-mono">
                {objectMapping.sfObject}
              </Title>
            </div>

            {/* Direction Arrow */}
            <div className="flex items-center gap-2">
              <Tooltip title={directionConfig.description}>
                <Tag
                  icon={directionConfig.icon}
                  color={directionConfig.color}
                  className="flex items-center gap-1 cursor-help"
                >
                  {directionConfig.label}
                </Tag>
              </Tooltip>
            </div>

            <div className="flex items-center gap-2">
              <Text strong className="text-green-600 font-mono">
                {objectMapping.phObject}
              </Text>
            </div>
          </div>
        </div>

        {/* Stats Row */}
        <div className="flex items-center justify-between">
          <Space size="large">
            {/* Field Count */}
            <div className="flex items-center gap-2">
              <Text type="secondary">Fields:</Text>
              <Badge
                count={fieldCountFormatted}
                overflowCount={Number.MAX_SAFE_INTEGER}
                showZero
                color={objectMapping.fieldCount > 100 ? 'orange' : 'blue'}
              />
            </div>

            {/* Last Sync */}
            <div className="flex items-center gap-2">
              <FieldTimeOutlined className="text-gray-400" />
              <Text type="secondary" className="text-sm">
                {lastSyncFormatted}
              </Text>
            </div>
          </Space>

          <Space size="small">
            {/* Special indicators */}
            {hasFilters && (
              <Tooltip title="Has sync filters applied">
                <Tag color="purple" className="text-xs">Filtered</Tag>
              </Tooltip>
            )}
            {syncOwner && (
              <Tooltip title="Syncs ownership/user information">
                <Tag color="cyan" className="text-xs">+Owner</Tag>
              </Tooltip>
            )}
            {isBidirectional && (
              <Tooltip title="Bidirectional sync enabled">
                <Tag color="green" className="text-xs">Bi-dir</Tag>
              </Tooltip>
            )}
            {objectMapping.isCustom && (
              <Tooltip title="Custom object mapping">
                <Tag color="magenta" className="text-xs">Custom</Tag>
              </Tooltip>
            )}
          </Space>
        </div>

        {/* Filters info */}
        {hasFilters && !compact && (
          <Alert
            message="Sync Filters Active"
            description={objectMapping.filters}
            type="info"
            showIcon={false}
            className="text-xs"
            banner
          />
        )}
      </div>

      {/* Expanded Content - Field Table */}
      {isExpanded && (
        <>
          <Divider className="my-4" />
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Title level={5} className="m-0">Field Mappings</Title>
              <Text type="secondary" className="text-sm">
                {objectMapping.fieldCount} fields total
              </Text>
            </div>

            {objectMapping.fields.length === 0 ? (
              <Alert
                message="No field mappings available"
                description="This object has no configured field mappings to display."
                type="warning"
                showIcon
                className="text-sm"
              />
            ) : (
              <SalesforceFieldTable
                fields={objectMapping.fields}
                loading={loading}
                title=""
                objectName={`${objectMapping.sfObject} → ${objectMapping.phObject}`}
                enableSearchHighlight={enableSearchHighlight}
                compact={compact}
                className="mt-4"
                tenantSlug={tenantSlug}
              />
            )}
          </div>
        </>
      )}
    </Card>
  )
}

export default SalesforceObjectCard