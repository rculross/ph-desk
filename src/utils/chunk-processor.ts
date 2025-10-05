/**
 * Chunked Processing Utility for Non-blocking Large Dataset Operations
 *
 * Uses Bottleneck for controlled concurrency combined with requestIdleCallback()
 * for optimal performance in Chrome extension environments.
 * Provides hybrid approach with idle-time scheduling and proper queue management.
 */

import Bottleneck from 'bottleneck'

import { logger } from './logger'

const log = logger.content

// Browser compatibility: fallback for browsers without requestIdleCallback
const requestIdleCallback =
  window.requestIdleCallback ||
  ((callback: (deadline: { timeRemaining: () => number; didTimeout: boolean }) => void) => {
    const start = performance.now()
    return setTimeout(() => {
      callback({
        timeRemaining: () => Math.max(0, 50 - (performance.now() - start)),
        didTimeout: false
      })
    }, 1) as any
  }) as typeof window.requestIdleCallback

const cancelIdleCallback = window.cancelIdleCallback || ((id: any) => clearTimeout(id))

export interface ChunkProcessorOptions {
  /** Maximum processing time per chunk in milliseconds (default: 5ms) */
  maxChunkTime?: number
  /** Maximum items to process per chunk (default: 100) */
  chunkSize?: number
  /** Maximum concurrent tasks (default: 3) */
  concurrency?: number
  /** Queue size limit (default: 100) */
  queueLimit?: number
  /** Interval between chunks in milliseconds for throttling (default: 0) */
  intervalCap?: number
  /** Callback for progress updates */
  onProgress?: (processed: number, total: number) => void
  /** Callback when processing completes */
  onComplete?: () => void
  /** Callback when processing is cancelled */
  onCancel?: () => void
  /** Callback for errors during processing */
  onError?: (error: Error, item: any, index: number) => void
  /** Enable debug logging */
  debug?: boolean
  /** Enable hybrid mode using both Bottleneck and idle callbacks (default: true) */
  useHybridMode?: boolean
  /** Enable retry logic for failed items (default: true) */
  enableRetries?: number
}

export interface ChunkProcessor<T> {
  /** Start processing the dataset */
  start(): void
  /** Cancel ongoing processing */
  cancel(): void
  /** Check if currently processing */
  isProcessing(): boolean
  /** Get current progress */
  getProgress(): { processed: number; total: number; percentage: number }
  /** Get queue statistics */
  getQueueStats(): { size: number; pending: number; isPaused: boolean }
  /** Pause processing */
  pause(): void
  /** Resume processing */
  resume(): void
}

/**
 * Process large datasets in chunks without blocking the UI thread
 * Uses Bottleneck for controlled concurrency with optional hybrid idle-time scheduling
 */
export function createChunkProcessor<T>(
  data: T[],
  processor: (item: T, index: number) => void | Promise<void>,
  options: ChunkProcessorOptions = {}
): ChunkProcessor<T> {
  const {
    maxChunkTime = 5,
    chunkSize = 100,
    concurrency = 3,
    queueLimit: _queueLimit = 100,
    intervalCap = 0,
    onProgress,
    onComplete,
    onCancel,
    onError,
    debug = false,
    useHybridMode = true,
    enableRetries = 2
  } = options

  let currentIndex = 0
  let processedCount = 0
  let isActive = false
  let isPaused = false
  const startTime = performance.now()
  const failedItems = new Map<number, { item: T; retries: number; error: Error }>()

  let queuedJobs = 0
  let runningJobs = 0
  let limiter = createLimiter()

  const debugLog = debug ? log.debug : () => {}

  const queueLimit = _queueLimit

  function createLimiter() {
    return new Bottleneck({
      maxConcurrent: Math.max(1, concurrency),
      minTime: Math.max(0, intervalCap)
    })
  }

  const updateProgress = () => {
    if (onProgress) {
      onProgress(processedCount, data.length)
    }
  }

  const scheduleTask = <R>(task: () => Promise<R>): Promise<R> => {
    if (queuedJobs + runningJobs >= queueLimit) {
      debugLog('Queue limit threshold reached', {
        queueLimit,
        queuedJobs,
        runningJobs
      })
    }
    queuedJobs++
    return limiter.schedule(async () => {
      queuedJobs = Math.max(0, queuedJobs - 1)
      runningJobs++
      try {
        return await task()
      } finally {
        runningJobs = Math.max(0, runningJobs - 1)
      }
    })
  }

  const handleProcessingSuccess = (index: number, item: T) => {
    processedCount++
    failedItems.delete(index)

    updateProgress()

    debugLog('Item processed', {
      index,
      item: debug ? item : 'hidden',
      processedCount,
      totalItems: data.length
    })
  }

  const processItem = async (item: T, absoluteIndex: number): Promise<void> => {
    try {
      const result = processor(item, absoluteIndex)

      if (result instanceof Promise) {
        await result
      }

      handleProcessingSuccess(absoluteIndex, item)
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error))
      const failedItem = failedItems.get(absoluteIndex)
      const currentRetries = failedItem ? failedItem.retries : 0

      if (currentRetries < enableRetries) {
        failedItems.set(absoluteIndex, {
          item,
          retries: currentRetries + 1,
          error: err
        })

        debugLog('Item failed, will retry', {
          index: absoluteIndex,
          retries: currentRetries + 1,
          maxRetries: enableRetries,
          error: err.message
        })
      } else {
        log.error('Item processing failed permanently', {
          index: absoluteIndex,
          retries: currentRetries,
          error: err.message
        })

        if (onError) {
          onError(err, item, absoluteIndex)
        }
      }

      throw err
    }
  }

  // Process a chunk of items
  async function processChunk(startIndex: number, endIndex: number): Promise<void> {
    const chunkStart = performance.now()
    const chunkData = data.slice(startIndex, endIndex)

    debugLog('Processing chunk', {
      startIndex,
      endIndex,
      chunkSize: chunkData.length,
      queueSize: queuedJobs
    })

    const promises = chunkData.map((item, relativeIndex) => {
      const absoluteIndex = startIndex + relativeIndex
      return scheduleTask(() => processItem(item, absoluteIndex))
    })

    const results = await Promise.allSettled(promises)

    const successful = results.filter(r => r.status === 'fulfilled').length
    const failed = results.filter(r => r.status === 'rejected').length

    debugLog('Chunk completed', {
      startIndex,
      endIndex,
      successful,
      failed,
      chunkTime: performance.now() - chunkStart,
      totalProcessed: processedCount
    })
  }

  async function processFailedItems(): Promise<void> {
    if (failedItems.size === 0) {
      return
    }

    debugLog('Processing failed items for retry', {
      failedCount: failedItems.size
    })

    const retryPromises = Array.from(failedItems.entries()).map(([index, { item, retries }]) => {
      if (retries < enableRetries) {
        return scheduleTask(() => processItem(item, index))
      }
      return Promise.resolve()
    })

    await Promise.allSettled(retryPromises)
  }

  // Process chunks using idle callbacks for non-blocking execution
  async function processWithIdleCallback(): Promise<void> {
    return new Promise((resolve, reject) => {
      let idleCallbackId: number | null = null

      const clearIdleCallback = () => {
        if (idleCallbackId !== null) {
          cancelIdleCallback(idleCallbackId)
          idleCallbackId = null
        }
      }

      const scheduleNextChunk = () => {
        if (!isActive || isPaused) {
          clearIdleCallback()
          resolve()
          return
        }

        if (currentIndex >= data.length) {
          clearIdleCallback()

          processFailedItems()
            .then(resolve)
            .catch(reject)
          return
        }

        const runChunk = () => {
          if (!isActive || isPaused) {
            resolve()
            return
          }

          const endIndex = Math.min(currentIndex + chunkSize, data.length)

          processChunk(currentIndex, endIndex)
            .then(() => {
              currentIndex = endIndex
              scheduleNextChunk()
            })
            .catch(reject)
        }

        if (useHybridMode) {
          idleCallbackId = requestIdleCallback(() => {
            idleCallbackId = null
            runChunk()
          })
        } else {
          runChunk()
        }
      }

      scheduleNextChunk()
    })
  }

  const resetLimiter = () => {
    queuedJobs = 0
    runningJobs = 0
    if (limiter) {
      limiter.stop({ dropWaitingJobs: true }).catch(error => {
        debugLog('Limiter stop encountered error', {
          error: error instanceof Error ? error.message : error
        })
      })
    }
    limiter = createLimiter()
  }

  return {
    start() {
      if (isActive) {
        debugLog('Processor already active, ignoring start request')
        return
      }

      isActive = true
      isPaused = false
      currentIndex = 0
      processedCount = 0
      failedItems.clear()
      resetLimiter()

      debugLog('Starting Bottleneck chunked processing', {
        totalItems: data.length,
        chunkSize,
        maxChunkTime,
        concurrency,
        useHybridMode
      })

      processWithIdleCallback()
        .then(async () => {
          await limiter.done()

          isActive = false
          const totalTime = performance.now() - startTime

          debugLog('Processing completed', {
            totalItems: data.length,
            processedCount,
            failedCount: failedItems.size,
            totalTime,
            itemsPerSecond: Math.round(processedCount / (totalTime / 1000 || 1))
          })

          if (onComplete) {
            onComplete()
          }
        })
        .catch(error => {
          isActive = false
          log.error('Chunk processing failed', {
            error: error instanceof Error ? error.message : error,
            processedCount,
            currentIndex
          })

          if (onCancel) {
            onCancel()
          }
        })
    },

    cancel() {
      if (!isActive) return

      isActive = false
      isPaused = false
      resetLimiter()

      debugLog('Processing cancelled', {
        processedItems: processedCount,
        totalItems: data.length,
        queueSize: queuedJobs
      })

      if (onCancel) {
        onCancel()
      }
    },

    pause() {
      if (!isActive || isPaused) return

      isPaused = true
      limiter.stop().catch((error: any) => {
        log.debug('Limiter stop encountered error', { error: error instanceof Error ? error.message : error })
      })

      debugLog('Processing paused', {
        processedItems: processedCount,
        queueSize: queuedJobs
      })
    },

    resume() {
      if (!isActive || !isPaused) return

      isPaused = false
      // Recreate limiter since stop() terminates it
      limiter = createLimiter()

      debugLog('Processing resumed', {
        processedItems: processedCount,
        queueSize: queuedJobs
      })
    },

    isProcessing() {
      return isActive
    },

    getProgress() {
      return {
        processed: processedCount,
        total: data.length,
        percentage: data.length > 0 ? Math.round((processedCount / data.length) * 100) : 0
      }
    },

    getQueueStats() {
      return {
        size: queuedJobs,
        pending: runningJobs,
        isPaused
      }
    }
  }
}

/**
 * Process an array of items in chunks with a simple async/await interface
 * Uses the Bottleneck-based chunk processor for optimal performance
 */
export function processInChunks<T>(
  data: T[],
  processor: (item: T, index: number) => void | Promise<void>,
  options: Omit<ChunkProcessorOptions, 'onComplete' | 'onCancel' | 'onError'> = {}
): Promise<void> {
  return new Promise((resolve, reject) => {
    const errors: { error: Error; item: T; index: number }[] = []

    const chunkProcessor = createChunkProcessor(data, processor, {
      ...options,
      onComplete: () => {
        if (errors.length > 0) {
          const errorMessage = `Processing failed for ${errors.length} items: ${errors
            .map(e => `[${e.index}] ${e.error.message}`)
            .join(', ')}`
          reject(new Error(errorMessage))
        } else {
          resolve()
        }
      },
      onCancel: () => reject(new Error('Processing was cancelled')),
      onError: (error, item, index) => {
        errors.push({ error, item, index })
      }
    })

    chunkProcessor.start()
  })
}

/**
 * Utility for processing large datasets with AG Grid in a non-blocking way
 * Uses Bottleneck-based chunk processor for optimal performance
 */
export interface GridDataProcessorOptions extends ChunkProcessorOptions {
  /** Grid API instance */
  gridApi: any
  /** Whether to auto-size columns after processing */
  autoSizeColumns?: boolean
  /** Whether to show loading overlay during processing */
  showLoadingOverlay?: boolean
  /** Update grid every N items (default: 100) */
  gridUpdateFrequency?: number
}

export function createGridDataProcessor<T>(
  data: T[],
  options: GridDataProcessorOptions
): ChunkProcessor<T> {
  const {
    gridApi,
    autoSizeColumns = false,
    showLoadingOverlay = true,
    gridUpdateFrequency = 100,
    onComplete,
    onProgress,
    ...chunkOptions
  } = options

  if (showLoadingOverlay && gridApi) {
    gridApi.showLoadingOverlay()
  }

  const processedData: T[] = []
  let lastGridUpdate = 0

  return createChunkProcessor<T>(
    data,
    (item: T, index: number) => {
      processedData.push(item)

      const shouldUpdateGrid =
        processedData.length - lastGridUpdate >= gridUpdateFrequency ||
        index === data.length - 1

      if (shouldUpdateGrid && gridApi) {
        gridApi.setGridOption('rowData', [...processedData])
        lastGridUpdate = processedData.length
      }
    },
    {
      ...chunkOptions,
      onProgress: (processed: number, total: number) => {
        if (onProgress) {
          onProgress(processed, total)
        }

        if (gridApi && showLoadingOverlay) {
          const percentage = Math.round((processed / total) * 100)
          debugLogGridUpdate(percentage)
        }
      },
      onComplete: () => {
        if (gridApi) {
          gridApi.setGridOption('rowData', processedData)

          if (autoSizeColumns && processedData.length > 0) {
            requestAnimationFrame(() => {
              try {
                gridApi.sizeColumnsToFit()
              } catch (error) {
                log.warn('Failed to auto-size grid columns', {
                  error: error instanceof Error ? error.message : error,
                  dataLength: processedData.length
                })
              }
            })
          }

          if (showLoadingOverlay) {
            try {
              if (processedData.length === 0) {
                gridApi.showNoRowsOverlay()
              } else {
                gridApi.hideOverlay()
              }
            } catch (error) {
              log.warn('Failed to update grid overlay', {
                error: error instanceof Error ? error.message : error,
                dataLength: processedData.length
              })
            }
          }
        }

        if (onComplete) {
          onComplete()
        }
      },
      onCancel: () => {
        if (gridApi && showLoadingOverlay) {
          try {
            gridApi.hideOverlay()
          } catch (error) {
            log.warn('Failed to hide grid overlay on cancel', {
              error: error instanceof Error ? error.message : error
            })
          }
        }

        if (chunkOptions.onCancel) {
          chunkOptions.onCancel()
        }
      },
      onError: (error: Error, item: T, index: number) => {
        log.error('Grid data processing error', {
          error: error.message,
          index,
          item: chunkOptions.debug ? item : 'hidden'
        })

        if (chunkOptions.onError) {
          chunkOptions.onError(error, item, index)
        }
      }
    }
  )
}

function debugLogGridUpdate(percentage: number) {
  // Placeholder for future progress overlay integration
  if (percentage >= 100) {
    log.debug('Grid processing completed')
  }
}

/**
 * Process data with transformation in chunks using Bottleneck
 * Optimized for data transformation operations like filtering, mapping, etc.
 */
export async function processDataTransformation<TInput, TOutput>(
  data: TInput[],
  transform: (item: TInput, index: number) => TOutput | Promise<TOutput>,
  options: Omit<ChunkProcessorOptions, 'onComplete' | 'onCancel' | 'onError'> = {}
): Promise<TOutput[]> {
  const results: TOutput[] = new Array(data.length)
  const errors: { error: Error; index: number }[] = []

  return new Promise((resolve, reject) => {
    const processor = createChunkProcessor(
      data,
      async (item: TInput, index: number) => {
        try {
          const result = transform(item, index)
          results[index] = result instanceof Promise ? await result : result
        } catch (error) {
          const err = error instanceof Error ? error : new Error(String(error))
          errors.push({ error: err, index })
          throw err
        }
      },
      {
        ...options,
        onComplete: () => {
          if (errors.length > 0) {
            reject(new Error(`Transformation failed for ${errors.length} items`))
          } else {
            resolve(results.filter(item => item !== undefined))
          }
        },
        onCancel: () => reject(new Error('Data transformation was cancelled')),
        onError: () => {
          // Errors handled in processor above
        }
      }
    )

    processor.start()
  })
}

/**
 * Process batch operations with Bottleneck (e.g., API calls, file operations)
 * Optimized for operations that need controlled concurrency
 */
export interface BatchProcessorOptions<T>
  extends Omit<ChunkProcessorOptions, 'onComplete' | 'onCancel'> {
  /** Maximum number of retries per item (default: 2) */
  maxRetries?: number
  /** Delay between retries in milliseconds (default: 1000) */
  retryDelay?: number
  /** Should continue processing if individual items fail (default: true) */
  continueOnError?: boolean
}

export async function processBatchOperations<T, R>(
  items: T[],
  operation: (item: T, index: number) => Promise<R>,
  options: BatchProcessorOptions<T> = {}
): Promise<{ results: R[]; errors: Array<{ item: T; index: number; error: Error }> }> {
  const {
    maxRetries = 2,
    retryDelay = 1000,
    continueOnError = true,
    concurrency = 3,
    intervalCap = 0
  } = options

  const results: R[] = []
  const errors: Array<{ item: T; index: number; error: Error }> = []

  const limiter = new Bottleneck({
    maxConcurrent: Math.max(1, concurrency),
    minTime: Math.max(0, intervalCap)
  })

  const scheduleOperation = <RResult>(task: () => Promise<RResult>) => limiter.schedule(task)

  const processWithRetry = async (item: T, index: number, retries = 0): Promise<void> => {
    try {
      const result = await operation(item, index)
      results[index] = result
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error))

      if (retries < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, retryDelay * (retries + 1)))
        return processWithRetry(item, index, retries + 1)
      }

      errors.push({ item, index, error: err })

      if (!continueOnError) {
        throw err
      }
    }
  }

  const promises = items.map((item, index) => scheduleOperation(() => processWithRetry(item, index)))

  try {
    await Promise.allSettled(promises)

    if (!continueOnError && errors.length > 0) {
      throw new Error(`Batch operation failed for ${errors.length} items`)
    }

    return {
      results: results.filter(r => r !== undefined),
      errors
    }
  } catch (error) {
    throw new Error(`Batch processing failed: ${error instanceof Error ? error.message : error}`)
  }
}

/**
 * Process streaming data with backpressure control
 * Useful for processing data streams or large API responses
 */
export class StreamProcessor<T> {
  private limiter: Bottleneck
  private isProcessing = false
  private processedCount = 0
  private errorCount = 0
  private queuedJobs = 0
  private runningJobs = 0

  constructor(
    private processor: (item: T, index: number) => void | Promise<void>,
    private options: ChunkProcessorOptions = {}
  ) {
    this.limiter = this.createLimiter()
  }

  private createLimiter() {
    const { concurrency = 3, intervalCap = 0 } = this.options

    return new Bottleneck({
      maxConcurrent: Math.max(1, concurrency),
      minTime: Math.max(0, intervalCap)
    })
  }

  private scheduleTask(task: () => Promise<void>) {
    this.queuedJobs++
    return this.limiter.schedule(async () => {
      this.queuedJobs = Math.max(0, this.queuedJobs - 1)
      this.runningJobs++
      try {
        await task()
      } finally {
        this.runningJobs = Math.max(0, this.runningJobs - 1)
      }
    })
  }

  /**
   * Add item to processing queue
   */
  push(item: T): void {
    if (!this.isProcessing) {
      this.start()
    }

    const index = this.processedCount + this.queuedJobs + this.runningJobs
    this.scheduleTask(async () => {
      try {
        const result = this.processor(item, index)
        if (result instanceof Promise) {
          await result
        }
        this.processedCount++
        if (this.options.onProgress) {
          this.options.onProgress(this.processedCount, this.processedCount)
        }
      } catch (error) {
        this.errorCount++
        const err = error instanceof Error ? error : new Error(String(error))
        if (this.options.onError) {
          this.options.onError(err, item, index)
        }
        log.error('Stream processing error', {
          error: err.message,
          processedCount: this.processedCount,
          errorCount: this.errorCount
        })
      }
    })
  }

  /**
   * Add multiple items to processing queue
   */
  pushBatch(items: T[]): void {
    items.forEach(item => this.push(item))
  }

  /**
   * Start processing
   */
  start(): void {
    this.isProcessing = true
  }

  /**
   * Stop processing and clear queue
   */
  stop(): void {
    this.isProcessing = false
    this.queuedJobs = 0
    this.runningJobs = 0
    this.limiter.stop({ dropWaitingJobs: true }).catch(error => {
      log.debug('Stream limiter stop encountered error', {
        error: error instanceof Error ? error.message : error
      })
    })
    this.limiter = this.createLimiter()
    if (this.options.onCancel) {
      this.options.onCancel()
    }
  }

  /**
   * Wait for all queued items to complete
   */
  async flush(): Promise<void> {
    await this.limiter.done()
    if (this.options.onComplete) {
      this.options.onComplete()
    }
  }

  /**
   * Get current processing statistics
   */
  getStats() {
    return {
      processed: this.processedCount,
      errors: this.errorCount,
      queued: this.queuedJobs,
      pending: this.runningJobs,
      isProcessing: this.isProcessing
    }
  }
}
