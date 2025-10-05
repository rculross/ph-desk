/**
 * Smart Pagination Component
 *
 * Intelligent pagination system that optimizes data fetching by using
 * larger chunk sizes for better performance while respecting API limits.
 */

import React, { useMemo, useCallback } from 'react'

import { DownloadOutlined, WarningOutlined, InfoCircleOutlined } from '@ant-design/icons'
import { Button, Select, Space, Tooltip, Progress, Tag } from 'antd'
import { clsx } from 'clsx'

import type { PaginationState } from '../../types/logz.types'

export interface SmartPaginationProps {
  currentOffset: number
  recordsPerPull: PaginationState['recordsPerPull']
  totalLoaded: number
  hasMore: boolean
  isLoading: boolean
  maxRecordsPerRequest: number
  onLoadMore: () => void
  onRecordsPerPullChange: (newSize: PaginationState['recordsPerPull']) => void
  onLoadAll?: () => void
  className?: string
  showProgress?: boolean
  showOptimizationHints?: boolean
}

/**
 * Smart pagination with optimization suggestions
 */
export function SmartPagination({
  currentOffset,
  recordsPerPull,
  totalLoaded,
  hasMore,
  isLoading,
  maxRecordsPerRequest = 2000,
  onLoadMore,
  onRecordsPerPullChange,
  onLoadAll,
  className,
  showProgress = true,
  showOptimizationHints = true
}: SmartPaginationProps) {

  // Available batch sizes
  const batchSizes = useMemo(() => [
    { value: 100, label: '100 (Default)', description: 'Good for quick browsing' },
    { value: 500, label: '500 (Fast)', description: 'Balanced speed and memory' },
    { value: 1000, label: '1000 (Faster)', description: 'Higher performance' },
    { value: 2000, label: '2000 (Maximum)', description: 'Maximum API limit' }
  ], [])

  // Calculate optimization metrics
  const optimizationMetrics = useMemo(() => {
    const currentBatch = recordsPerPull
    const maxBatch = maxRecordsPerRequest
    const efficiency = (currentBatch / maxBatch) * 100

    // Estimate remaining requests needed
    const avgRecordsPerRequest = totalLoaded > 0 ? totalLoaded / Math.max(1, currentOffset / currentBatch + 1) : currentBatch
    const estimatedTotalRecords = hasMore ? totalLoaded * 2 : totalLoaded // Conservative estimate
    const remainingRecords = Math.max(0, estimatedTotalRecords - totalLoaded)
    const estimatedRemainingRequests = Math.ceil(remainingRecords / currentBatch)

    // Calculate potential time savings with larger batches
    const timeWithCurrentBatch = estimatedRemainingRequests * 1.5 // Assume 1.5s per request
    const timeWithMaxBatch = Math.ceil(remainingRecords / maxBatch) * 1.5
    const timeSavingsSeconds = Math.max(0, timeWithCurrentBatch - timeWithMaxBatch)

    return {
      efficiency,
      estimatedRemainingRequests,
      timeSavingsSeconds,
      recommendLargerBatch: efficiency < 75 && estimatedRemainingRequests > 3,
      currentBatchLabel: batchSizes.find(b => b.value === currentBatch)?.label || `${currentBatch}`,
      avgRecordsPerRequest: Math.round(avgRecordsPerRequest)
    }
  }, [recordsPerPull, maxRecordsPerRequest, totalLoaded, currentOffset, hasMore, batchSizes])

  // Handle batch size change
  const handleBatchSizeChange = useCallback((newSize: PaginationState['recordsPerPull']) => {
    onRecordsPerPullChange(newSize)
  }, [onRecordsPerPullChange])

  // Handle optimized load more (uses larger batch automatically)
  const handleOptimizedLoadMore = useCallback(() => {
    // Temporarily increase batch size if it's currently small
    if (recordsPerPull < 1000 && hasMore) {
      const optimizedSize: PaginationState['recordsPerPull'] = 1000
      onRecordsPerPullChange(optimizedSize)
    }
    onLoadMore()
  }, [recordsPerPull, hasMore, maxRecordsPerRequest, onRecordsPerPullChange, onLoadMore])

  return (
    <div className={clsx('space-y-4 p-4 bg-gray-50 rounded-lg border', className)}>
      {/* Main Controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-700">Batch Size:</span>
            <Select
              value={recordsPerPull}
              onChange={handleBatchSizeChange}
              style={{ width: 180 }}
              options={batchSizes}
            />
          </div>

          {showProgress && totalLoaded > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600">
                {totalLoaded.toLocaleString()} records loaded
              </span>
              {hasMore && (
                <Tag color="blue" icon={<InfoCircleOutlined />}>
                  More available
                </Tag>
              )}
            </div>
          )}
        </div>

        <Space size="small">
          <Button
            type="primary"
            onClick={onLoadMore}
            loading={isLoading}
            disabled={!hasMore}
          >
            Load {recordsPerPull.toLocaleString()} More
          </Button>

          {optimizationMetrics.recommendLargerBatch && (
            <Tooltip title={`Load ${Math.min(1000, maxRecordsPerRequest)} records for better performance`}>
              <Button
                type="primary"
                ghost
                onClick={handleOptimizedLoadMore}
                loading={isLoading}
                disabled={!hasMore}
                icon={<DownloadOutlined />}
              >
                Load More (Optimized)
              </Button>
            </Tooltip>
          )}

          {onLoadAll && hasMore && (
            <Tooltip title="Load all remaining records (may take longer)">
              <Button
                onClick={onLoadAll}
                loading={isLoading}
                disabled={!hasMore}
                icon={<DownloadOutlined />}
              >
                Load All
              </Button>
            </Tooltip>
          )}
        </Space>
      </div>

      {/* Performance Progress Bar */}
      {showProgress && totalLoaded > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs text-gray-600">
            <span>Batch Efficiency</span>
            <span>{optimizationMetrics.efficiency.toFixed(0)}% of maximum</span>
          </div>
          <Progress
            percent={optimizationMetrics.efficiency}
            size="small"
            status={optimizationMetrics.efficiency > 75 ? 'success' : 'normal'}
            strokeColor={optimizationMetrics.efficiency > 75 ? '#52c41a' : '#1890ff'}
          />
        </div>
      )}

      {/* Optimization Hints */}
      {showOptimizationHints && optimizationMetrics.recommendLargerBatch && (
        <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
          <div className="flex items-start gap-2">
            <InfoCircleOutlined className="text-blue-600 mt-0.5" />
            <div className="flex-1">
              <div className="text-sm font-medium text-blue-900 mb-1">
                Performance Optimization Available
              </div>
              <div className="text-xs text-blue-700 space-y-1">
                <div>
                  • Current batch: {optimizationMetrics.currentBatchLabel} ({optimizationMetrics.efficiency.toFixed(0)}% efficiency)
                </div>
                <div>
                  • Estimated {optimizationMetrics.estimatedRemainingRequests} more requests needed
                </div>
                {optimizationMetrics.timeSavingsSeconds > 5 && (
                  <div>
                    • Using 2000-record batches could save ~{Math.round(optimizationMetrics.timeSavingsSeconds)}s
                  </div>
                )}
              </div>
              <Button
                type="link"
                size="small"
                onClick={() => handleBatchSizeChange(1000)}
                className="p-0 h-auto text-blue-600 font-medium"
              >
                Optimize Now →
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* API Limit Warning */}
      {recordsPerPull === maxRecordsPerRequest && (
        <div className="bg-amber-50 border border-amber-200 rounded-md p-3">
          <div className="flex items-center gap-2">
            <WarningOutlined className="text-amber-600" />
            <div className="text-sm text-amber-800">
              <span className="font-medium">Maximum batch size selected.</span>
              <span className="ml-1">
                This uses the full API limit of {maxRecordsPerRequest.toLocaleString()} records per request.
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Statistics */}
      {totalLoaded > 0 && (
        <div className="flex items-center justify-between text-xs text-gray-500 pt-2 border-t">
          <div>
            Average: {optimizationMetrics.avgRecordsPerRequest} records/request
          </div>
          <div>
            {Math.ceil(totalLoaded / recordsPerPull)} requests made
          </div>
        </div>
      )}
    </div>
  )
}