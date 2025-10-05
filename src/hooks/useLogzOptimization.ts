/**
 * Logz Optimization Hook
 *
 * Provides intelligent optimization strategies for log data fetching,
 * including adaptive batch sizing and bulk loading capabilities.
 */

import { useState, useCallback, useEffect, useMemo } from 'react'

import { useLogzPagination, useLogzActions } from '../stores/logz.store'
import { LOGZ_CONSTRAINTS, type PaginationState } from '../types/logz.types'
import { logger } from '../utils/logger'

const log = logger.api

export interface LogzOptimizationMetrics {
  currentEfficiency: number
  recommendedBatchSize: PaginationState['recordsPerPull']
  estimatedTimeRemaining: number
  totalRequestsMade: number
  averageRecordsPerRequest: number
  apiLimitUtilization: number
}

export interface LogzOptimizationStrategy {
  type: 'conservative' | 'balanced' | 'aggressive'
  description: string
  batchSize: PaginationState['recordsPerPull']
  autoIncrease: boolean
}

export interface UseLogzOptimizationOptions {
  autoOptimize?: boolean
  maxBatchSize?: number
  strategy?: LogzOptimizationStrategy['type']
}

export interface UseLogzOptimizationResult {
  metrics: LogzOptimizationMetrics
  strategies: LogzOptimizationStrategy[]
  currentStrategy: LogzOptimizationStrategy

  // Actions
  optimizeBatchSize: () => void
  applyStrategy: (strategy: LogzOptimizationStrategy) => void
  loadAllOptimized: () => Promise<void>
  resetOptimization: () => void

  // State
  isOptimizing: boolean
  optimizationHistory: Array<{
    timestamp: string
    action: string
    oldBatchSize: number
    newBatchSize: number
    reason: string
  }>
}

/**
 * Hook for optimizing log data fetching
 */
export function useLogzOptimization({
  autoOptimize = false,
  maxBatchSize = LOGZ_CONSTRAINTS.MAX_RECORDS_PER_REQUEST,
  strategy = 'balanced'
}: UseLogzOptimizationOptions = {}): UseLogzOptimizationResult {

  const pagination = useLogzPagination()
  const { updatePagination } = useLogzActions()

  const [isOptimizing, setIsOptimizing] = useState(false)
  const [optimizationHistory, setOptimizationHistory] = useState<UseLogzOptimizationResult['optimizationHistory']>([])

  // Define optimization strategies
  const strategies: LogzOptimizationStrategy[] = useMemo(() => [
    {
      type: 'conservative',
      description: 'Small batches for memory efficiency',
      batchSize: 100,
      autoIncrease: false
    },
    {
      type: 'balanced',
      description: 'Balanced performance and memory usage',
      batchSize: 500,
      autoIncrease: true
    },
    {
      type: 'aggressive',
      description: 'Maximum performance with large batches',
      batchSize: 2000,
      autoIncrease: false
    }
  ], [maxBatchSize])

  // Get current strategy
  const currentStrategy = useMemo(() => {
    return strategies.find(s => s.type === strategy) || strategies[1]!
  }, [strategies, strategy])

  // Calculate optimization metrics
  const metrics: LogzOptimizationMetrics = useMemo(() => {
    const currentBatchSize = pagination.recordsPerPull
    const totalLoaded = pagination.totalLoaded
    const currentOffset = pagination.currentOffset

    // Calculate efficiency
    const maxPossibleBatchSize = maxBatchSize
    const currentEfficiency = (currentBatchSize / maxPossibleBatchSize) * 100

    // Calculate requests made
    const totalRequestsMade = Math.ceil((currentOffset + currentBatchSize) / currentBatchSize)
    const averageRecordsPerRequest = totalRequestsMade > 0 ? totalLoaded / totalRequestsMade : 0

    // Recommend optimal batch size based on current usage
    let recommendedBatchSize: PaginationState['recordsPerPull'] = currentBatchSize
    if (currentEfficiency < 50 && totalLoaded > 200) {
      recommendedBatchSize = 1000
    } else if (currentEfficiency < 25 && totalLoaded > 500) {
      recommendedBatchSize = 2000
    }

    // Estimate time remaining (rough calculation)
    const avgRequestTime = 1.5 // seconds per request
    const estimatedRemainingRecords = pagination.hasMore ? totalLoaded : 0
    const requestsNeeded = Math.ceil(estimatedRemainingRecords / currentBatchSize)
    const estimatedTimeRemaining = requestsNeeded * avgRequestTime

    // API limit utilization
    const rateLimit = 200 // requests per minute
    const apiLimitUtilization = (totalRequestsMade / rateLimit) * 100

    return {
      currentEfficiency,
      recommendedBatchSize,
      estimatedTimeRemaining,
      totalRequestsMade,
      averageRecordsPerRequest,
      apiLimitUtilization
    }
  }, [pagination, maxBatchSize])

  // Add optimization event to history
  const addOptimizationEvent = useCallback((
    action: string,
    oldBatchSize: number,
    newBatchSize: number,
    reason: string
  ) => {
    setOptimizationHistory(prev => [
      ...prev.slice(-9), // Keep last 10 events
      {
        timestamp: new Date().toISOString(),
        action,
        oldBatchSize,
        newBatchSize,
        reason
      }
    ])
  }, [])

  // Optimize batch size based on current metrics
  const optimizeBatchSize = useCallback(() => {
    const currentBatch = pagination.recordsPerPull
    const recommendedBatch = metrics.recommendedBatchSize

    if (recommendedBatch !== currentBatch) {
      log.info('Optimizing batch size', {
        from: currentBatch,
        to: recommendedBatch,
        efficiency: metrics.currentEfficiency
      })

      updatePagination({ recordsPerPull: recommendedBatch })

      addOptimizationEvent(
        'optimize_batch_size',
        currentBatch,
        recommendedBatch,
        `Improved efficiency from ${metrics.currentEfficiency.toFixed(1)}%`
      )
    }
  }, [pagination.recordsPerPull, metrics.recommendedBatchSize, metrics.currentEfficiency, updatePagination, addOptimizationEvent])

  // Apply a specific optimization strategy
  const applyStrategy = useCallback((strategy: LogzOptimizationStrategy) => {
    const currentBatch = pagination.recordsPerPull

    if (strategy.batchSize !== currentBatch) {
      log.info('Applying optimization strategy', {
        strategy: strategy.type,
        from: currentBatch,
        to: strategy.batchSize
      })

      updatePagination({ recordsPerPull: strategy.batchSize })

      addOptimizationEvent(
        'apply_strategy',
        currentBatch,
        strategy.batchSize,
        `Applied ${strategy.type} strategy: ${strategy.description}`
      )
    }
  }, [pagination.recordsPerPull, updatePagination, addOptimizationEvent])

  // Load all remaining data with optimized batch sizes
  const loadAllOptimized = useCallback(async () => {
    if (!pagination.hasMore) return

    setIsOptimizing(true)

    try {
      // Use maximum batch size for bulk loading
      const originalBatchSize = pagination.recordsPerPull
      const optimizedBatchSize: PaginationState['recordsPerPull'] = 2000

      if (originalBatchSize < optimizedBatchSize) {
        updatePagination({ recordsPerPull: optimizedBatchSize })

        addOptimizationEvent(
          'bulk_load_optimize',
          originalBatchSize,
          optimizedBatchSize,
          'Temporarily increased batch size for bulk loading'
        )
      }

      log.info('Starting optimized bulk load', {
        batchSize: optimizedBatchSize,
        originalBatchSize
      })

      // Note: The actual loading will be handled by the component using this hook
      // This just sets up the optimal configuration

    } catch (error) {
      log.error('Failed to optimize bulk load', { error })
      throw error
    } finally {
      setIsOptimizing(false)
    }
  }, [pagination, maxBatchSize, updatePagination, addOptimizationEvent])

  // Reset optimization to default settings
  const resetOptimization = useCallback(() => {
    const defaultBatchSize: PaginationState['recordsPerPull'] = 100
    const currentBatch = pagination.recordsPerPull

    if (currentBatch !== defaultBatchSize) {
      updatePagination({ recordsPerPull: defaultBatchSize })

      addOptimizationEvent(
        'reset_optimization',
        currentBatch,
        defaultBatchSize,
        'Reset to default batch size'
      )
    }

    setOptimizationHistory([])
  }, [pagination.recordsPerPull, updatePagination, addOptimizationEvent])

  // Auto-optimization effect
  useEffect(() => {
    if (autoOptimize && currentStrategy.autoIncrease) {
      // Auto-optimize after loading a reasonable amount of data
      if (pagination.totalLoaded > 300 && metrics.currentEfficiency < 75) {
        optimizeBatchSize()
      }
    }
  }, [autoOptimize, currentStrategy.autoIncrease, pagination.totalLoaded, metrics.currentEfficiency, optimizeBatchSize])

  return {
    metrics,
    strategies,
    currentStrategy,
    optimizeBatchSize,
    applyStrategy,
    loadAllOptimized,
    resetOptimization,
    isOptimizing,
    optimizationHistory
  }
}