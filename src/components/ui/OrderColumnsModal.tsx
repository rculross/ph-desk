/**
 * Order Columns Modal Component for Planhat Extension
 *
 * Provides a modal interface for reordering visible columns using Ant Design components.
 * Integrates with TanStack Table and field detection service patterns.
 */

import React, { useCallback, useMemo } from 'react'

import {
  UpOutlined,
  DownOutlined,
  EyeOutlined,
  SortAscendingOutlined
} from '@ant-design/icons'
import { Modal, List, Button, Typography, Space, Divider } from 'antd'

import { logger } from '../../utils/logger'

const log = logger.extension

const { Title, Text } = Typography

// Types for column data structure matching field detection service
export interface ColumnDefinition {
  key: string
  label: string
  include: boolean
}

// Props interface for the OrderColumnsModal component
export interface OrderColumnsModalProps {
  /** Whether the modal is visible */
  visible: boolean
  /** Function to close the modal */
  onClose: () => void
  /** Array of column definitions with reorder capability */
  columns: ColumnDefinition[]
  /** Callback when columns are reordered */
  onColumnsReorder: (reorderedColumns: ColumnDefinition[]) => void
  /** Optional title for the modal */
  title?: string
  /** Loading state for async operations */
  loading?: boolean
  /** Width of the modal */
  width?: number
}

/**
 * OrderColumnsModal Component
 *
 * Allows users to reorder visible columns using up/down arrow buttons.
 * Only shows columns that are currently included/visible.
 */
export function OrderColumnsModal({
  visible,
  onClose,
  columns,
  onColumnsReorder,
  title = 'Reorder Columns',
  loading = false,
  width = 500
}: OrderColumnsModalProps) {

  // Filter to only show included columns for reordering
  const visibleColumns = useMemo(() => {
    return columns.filter(column => column.include)
  }, [columns])

  // Log modal state changes
  React.useEffect(() => {
    if (visible) {
      log.info('OrderColumnsModal opened', {
        totalColumns: columns.length,
        visibleColumns: visibleColumns.length,
        title
      })
    }
  }, [visible, columns.length, visibleColumns.length, title])

  // Move column up in the order
  const moveColumnUp = useCallback((index: number) => {
    if (index <= 0) return

    const column = visibleColumns[index]
    if (!column) return

    log.debug('Moving column up', {
      columnKey: column.key,
      fromIndex: index,
      toIndex: index - 1
    })

    const newVisibleColumns = [...visibleColumns]
    const [movedColumn] = newVisibleColumns.splice(index, 1)
    if (movedColumn) {
      newVisibleColumns.splice(index - 1, 0, movedColumn)
    }

    // Reconstruct the full columns array with new order
    const reorderedColumns = [...columns]
    const visibleKeys = newVisibleColumns.map(col => col.key)

    // Sort included columns by the new order, keep excluded columns at the end
    reorderedColumns.sort((a, b) => {
      if (a.include && b.include) {
        return visibleKeys.indexOf(a.key) - visibleKeys.indexOf(b.key)
      }
      if (a.include && !b.include) return -1
      if (!a.include && b.include) return 1
      return 0
    })

    onColumnsReorder(reorderedColumns)
  }, [visibleColumns, columns, onColumnsReorder])

  // Move column down in the order
  const moveColumnDown = useCallback((index: number) => {
    if (index >= visibleColumns.length - 1) return

    const column = visibleColumns[index]
    if (!column) return

    log.debug('Moving column down', {
      columnKey: column.key,
      fromIndex: index,
      toIndex: index + 1
    })

    const newVisibleColumns = [...visibleColumns]
    const [movedColumn] = newVisibleColumns.splice(index, 1)
    if (movedColumn) {
      newVisibleColumns.splice(index + 1, 0, movedColumn)
    }

    // Reconstruct the full columns array with new order
    const reorderedColumns = [...columns]
    const visibleKeys = newVisibleColumns.map(col => col.key)

    // Sort included columns by the new order, keep excluded columns at the end
    reorderedColumns.sort((a, b) => {
      if (a.include && b.include) {
        return visibleKeys.indexOf(a.key) - visibleKeys.indexOf(b.key)
      }
      if (a.include && !b.include) return -1
      if (!a.include && b.include) return 1
      return 0
    })

    onColumnsReorder(reorderedColumns)
  }, [visibleColumns, columns, onColumnsReorder])

  // Handle modal close
  const handleClose = useCallback(() => {
    log.info('OrderColumnsModal closed', {
      totalColumns: columns.length,
      visibleColumns: visibleColumns.length
    })
    onClose()
  }, [onClose, columns.length, visibleColumns.length])

  // Render individual column item
  const renderColumnItem = useCallback((column: ColumnDefinition, index: number) => {
    const isFirst = index === 0
    const isLast = index === visibleColumns.length - 1

    return (
      <List.Item
        key={column.key}
        style={{
          padding: '8px 12px',
          border: '1px solid #f0f0f0',
          borderRadius: '4px',
          marginBottom: '4px',
          backgroundColor: '#fafafa'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%' }}>
          <Space size={4}>
            <Button
              type="text"
              size="small"
              icon={<UpOutlined />}
              disabled={isFirst || loading}
              onClick={() => moveColumnUp(index)}
              title="Move up"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                minWidth: '24px',
                height: '24px'
              }}
            />
            <Button
              type="text"
              size="small"
              icon={<DownOutlined />}
              disabled={isLast || loading}
              onClick={() => moveColumnDown(index)}
              title="Move down"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                minWidth: '24px',
                height: '24px'
              }}
            />
          </Space>

          <Text strong style={{ fontSize: '14px' }}>
            {column.label}
          </Text>
        </div>
      </List.Item>
    )
  }, [visibleColumns.length, loading, moveColumnUp, moveColumnDown])

  return (
    <Modal
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <SortAscendingOutlined />
          <span>{title}</span>
        </div>
      }
      open={visible}
      onCancel={handleClose}
      footer={[
        <Button key="close" onClick={handleClose} disabled={loading}>
          Close
        </Button>
      ]}
      width={width}
      destroyOnHidden
      maskClosable={!loading}
      closable={!loading}
      centered
    >

      {visibleColumns.length === 0 ? (
        <div style={{
          textAlign: 'center',
          padding: '40px 20px',
          color: '#bfbfbf'
        }}>
          <EyeOutlined style={{ fontSize: '48px', marginBottom: '16px' }} />
          <div>
            <Text type="secondary">No visible columns to reorder</Text>
            <br />
            <Text type="secondary" style={{ fontSize: '12px' }}>
              Select columns in the field selector first
            </Text>
          </div>
        </div>
      ) : (
        <div style={{ maxHeight: '600px', overflowY: 'auto' }}>
          <List
            dataSource={visibleColumns}
            renderItem={renderColumnItem}
            split={false}
            style={{ marginBottom: '0' }}
          />
        </div>
      )}

    </Modal>
  )
}

/**
 * Hook for managing column reordering state
 *
 * Provides utilities for integrating with the OrderColumnsModal
 */
export function useColumnReordering(initialColumns: ColumnDefinition[]) {
  const [columns, setColumns] = React.useState<ColumnDefinition[]>(initialColumns)
  const [isModalVisible, setIsModalVisible] = React.useState(false)

  // Update columns when initial columns change
  React.useEffect(() => {
    setColumns(initialColumns)
  }, [initialColumns])

  // Show modal
  const showModal = useCallback(() => {
    log.info('Column reordering modal requested')
    setIsModalVisible(true)
  }, [])

  // Hide modal
  const hideModal = useCallback(() => {
    setIsModalVisible(false)
  }, [])

  // Handle column reorder
  const handleColumnsReorder = useCallback((reorderedColumns: ColumnDefinition[]) => {
    log.info('Columns reordered', {
      totalColumns: reorderedColumns.length,
      visibleColumns: reorderedColumns.filter(c => c.include).length
    })
    setColumns(reorderedColumns)
  }, [])

  return {
    columns,
    setColumns,
    isModalVisible,
    showModal,
    hideModal,
    handleColumnsReorder
  }
}