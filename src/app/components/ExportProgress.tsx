/**
 * Export Progress Component for Planhat Extension
 *
 * Real-time progress tracking component for export operations with
 * visual indicators, time estimates, and download capabilities.
 */

import { useMemo, useEffect } from 'react'

import { clsx } from 'clsx'
import { formatDistanceToNow } from 'date-fns'
import {
  DownloadIcon,
  XIcon,
  CheckCircleIcon,
  AlertCircleIcon,
  FileIcon,
  LoaderIcon
} from 'lucide-react'

import { useExport, useExportProgress } from '../../hooks/useExport'
import { logger } from '../../utils/logger'

// Component Props
export interface ExportProgressProps {
  jobId?: string
  className?: string
  compact?: boolean
  showDetails?: boolean
}

export interface ExportProgressListProps {
  className?: string
  maxItems?: number
  showCompleted?: boolean
}

/**
 * Single export progress component
 */
export function ExportProgress({
  jobId,
  className,
  compact = false,
  showDetails = true
}: ExportProgressProps) {
  const { progress, isLoading, isCompleted, cancel, download } = useExportProgress(jobId)
  const log = logger.extension

  useEffect(() => {
    if (jobId) {
      log.debug('ExportProgress component mounted', {
        jobId,
        compact,
        showDetails
      })
    }
    
    return () => {
      if (jobId) {
        log.debug('ExportProgress component unmounted', { jobId })
      }
    }
  }, [jobId, compact, showDetails, log])

  useEffect(() => {
    if (progress) {
      log.debug('Progress updated in component', {
        jobId: progress.jobId,
        status: progress.status,
        progress: progress.progress,
        processedRecords: progress.processedRecords,
        totalRecords: progress.totalRecords
      })
    }
  }, [progress, log])

  if (!progress) {
    return null
  }

  const {
    status,
    progress: progressPercent,
    totalRecords,
    processedRecords,
    estimatedTimeRemaining,
    error,
    startTime,
    downloadUrl
  } = progress

  // Calculate elapsed time
  const elapsedTime = Date.now() - startTime
  const elapsedMinutes = Math.floor(elapsedTime / 60000)
  const elapsedSeconds = Math.floor((elapsedTime % 60000) / 1000)

  // Format estimated time remaining
  const formatTimeRemaining = (ms?: number) => {
    if (!ms) return null

    const minutes = Math.floor(ms / 60000)
    const seconds = Math.floor((ms % 60000) / 1000)

    if (minutes > 0) {
      return `${minutes}m ${seconds}s remaining`
    }
    return `${seconds}s remaining`
  }

  // Get status icon and color
  const getStatusDisplay = () => {
    switch (status) {
      case 'preparing':
        return {
          icon: LoaderIcon,
          color: 'text-blue-600',
          bgColor: 'bg-blue-50',
          borderColor: 'border-blue-200',
          text: 'Preparing export...'
        }
      case 'processing':
        return {
          icon: LoaderIcon,
          color: 'text-blue-600',
          bgColor: 'bg-blue-50',
          borderColor: 'border-blue-200',
          text: 'Processing data...'
        }
      case 'completed':
        return {
          icon: CheckCircleIcon,
          color: 'text-green-600',
          bgColor: 'bg-green-50',
          borderColor: 'border-green-200',
          text: 'Export completed'
        }
      case 'failed':
        return {
          icon: AlertCircleIcon,
          color: 'text-red-600',
          bgColor: 'bg-red-50',
          borderColor: 'border-red-200',
          text: 'Export failed'
        }
      case 'cancelled':
        return {
          icon: XIcon,
          color: 'text-gray-600',
          bgColor: 'bg-gray-50',
          borderColor: 'border-gray-200',
          text: 'Export cancelled'
        }
      default:
        return {
          icon: LoaderIcon,
          color: 'text-gray-600',
          bgColor: 'bg-gray-50',
          borderColor: 'border-gray-200',
          text: 'Unknown status'
        }
    }
  }

  const statusDisplay = getStatusDisplay()
  const StatusIcon = statusDisplay.icon

  if (compact) {
    return (
      <div
        className={clsx(
          'flex items-center gap-3 rounded-lg border p-3',
          statusDisplay.bgColor,
          statusDisplay.borderColor,
          className
        )}
      >
        <StatusIcon className={clsx('h-5 w-5', statusDisplay.color)} />
        <div className='min-w-0 flex-1'>
          <div className='truncate text-sm font-medium text-gray-900'>{statusDisplay.text}</div>
          {showDetails && (
            <div className='text-xs text-gray-600'>
              {processedRecords.toLocaleString()} / {totalRecords.toLocaleString()} records
            </div>
          )}
        </div>
        {isLoading && <div className='text-sm text-gray-600'>{progressPercent.toFixed(0)}%</div>}
        {isCompleted && downloadUrl && (
          <button
            onClick={() => {
              log.info('Download button clicked', {
                jobId: progress.jobId,
                compact: true
              })
              download()
            }}
            className='p-1 text-green-600 transition-colors hover:text-green-800'
            title='Download export'
          >
            <DownloadIcon className='h-4 w-4' />
          </button>
        )}
        {isLoading && (
          <button
            onClick={() => {
              log.info('Cancel button clicked', {
                jobId: progress.jobId,
                compact: true
              })
              cancel()
            }}
            className='p-1 text-gray-600 transition-colors hover:text-red-600'
            title='Cancel export'
          >
            <XIcon className='h-4 w-4' />
          </button>
        )}
      </div>
    )
  }

  return (
    <div
      className={clsx('overflow-hidden rounded-lg border', statusDisplay.borderColor, className)}
    >
      {/* Header */}
      <div className={clsx('border-b px-4 py-3', statusDisplay.bgColor)}>
        <div className='flex items-center justify-between'>
          <div className='flex items-center gap-3'>
            <StatusIcon className={clsx('h-5 w-5', statusDisplay.color)} />
            <div>
              <div className='font-medium text-gray-900'>{statusDisplay.text}</div>
              <div className='mt-1 text-sm text-gray-600'>Job ID: {jobId}</div>
            </div>
          </div>

          <div className='flex items-center gap-2'>
            {isCompleted && downloadUrl && (
              <button
                onClick={() => {
                  log.info('Download button clicked', {
                    jobId: progress.jobId,
                    compact: false,
                    totalRecords: progress.totalRecords
                  })
                  download()
                }}
                className='flex items-center gap-2 rounded-md bg-green-600 px-3 py-1 text-sm text-white transition-colors hover:bg-green-700'
              >
                <DownloadIcon className='h-4 w-4' />
                Download
              </button>
            )}
            {isLoading && (
              <button
                onClick={() => {
                  log.info('Cancel button clicked', {
                    jobId: progress.jobId,
                    compact: false,
                    currentProgress: progress.progress,
                    processedRecords: progress.processedRecords
                  })
                  cancel()
                }}
                className='flex items-center gap-2 rounded-md bg-red-600 px-3 py-1 text-sm text-white transition-colors hover:bg-red-700'
              >
                <XIcon className='h-4 w-4' />
                Cancel
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Progress Bar */}
      {isLoading && (
        <div className='px-4 py-3'>
          <div className='mb-2 flex items-center justify-between'>
            <div className='text-sm text-gray-600'>
              {processedRecords.toLocaleString()} of {totalRecords.toLocaleString()} records
              processed
            </div>
            <div className='text-sm font-medium text-gray-900'>{progressPercent.toFixed(1)}%</div>
          </div>

          <div className='h-2 w-full rounded-full bg-gray-200'>
            <div
              className='h-2 rounded-full bg-blue-600 transition-all duration-300 ease-out'
              style={{ width: `${Math.min(progressPercent, 100)}%` }}
            />
          </div>
        </div>
      )}

      {/* Details */}
      {showDetails && (
        <div className='space-y-2 border-t bg-gray-50 px-4 py-3'>
          <div className='grid grid-cols-2 gap-4 text-sm'>
            <div>
              <span className='text-gray-600'>Elapsed time:</span>
              <span className='ml-2 font-medium'>
                {elapsedMinutes}m {elapsedSeconds}s
              </span>
            </div>

            {estimatedTimeRemaining && (
              <div>
                <span className='text-gray-600'>Remaining:</span>
                <span className='ml-2 font-medium'>
                  {formatTimeRemaining(estimatedTimeRemaining)}
                </span>
              </div>
            )}

            <div>
              <span className='text-gray-600'>Total records:</span>
              <span className='ml-2 font-medium'>{totalRecords.toLocaleString()}</span>
            </div>

            <div>
              <span className='text-gray-600'>Started:</span>
              <span className='ml-2 font-medium'>
                {formatDistanceToNow(startTime, { addSuffix: true })}
              </span>
            </div>
          </div>

          {error && (
            <div className='mt-3 rounded-md border border-red-200 bg-red-50 p-3'>
              <div className='flex items-start gap-2'>
                <AlertCircleIcon className='mt-0.5 h-4 w-4 flex-shrink-0 text-red-600' />
                <div className='text-sm text-red-800'>
                  <div className='font-medium'>Export failed</div>
                  <div className='mt-1'>{error}</div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

/**
 * List of all export progress items
 */
export function ExportProgressList({
  className,
  maxItems = 5,
  showCompleted = true
}: ExportProgressListProps) {
  const { activeJobs } = useExport()
  const log = logger.extension

  useEffect(() => {
    log.debug('ExportProgressList component mounted', {
      maxItems,
      showCompleted
    })
  }, [maxItems, showCompleted, log])

  // Filter and sort jobs
  const displayJobs = useMemo(() => {
    let jobs = [...activeJobs]

    const originalCount = jobs.length
    
    if (!showCompleted) {
      jobs = jobs.filter(job => job.status === 'preparing' || job.status === 'processing')
    }

    // Sort by start time (newest first)
    jobs.sort((a, b) => b.startTime - a.startTime)

    // Limit number of items
    const limitedJobs = jobs.slice(0, maxItems)
    
    log.debug('Export progress list updated', {
      originalJobCount: originalCount,
      filteredJobCount: jobs.length,
      displayJobCount: limitedJobs.length,
      showCompleted,
      maxItems,
      jobStatuses: jobs.reduce((acc, job) => {
        acc[job.status] = (acc[job.status] ?? 0) + 1
        return acc
      }, {} as Record<string, number>)
    })
    
    return limitedJobs
  }, [activeJobs, showCompleted, maxItems, log])

  if (displayJobs.length === 0) {
    return (
      <div
        className={clsx('flex flex-col items-center justify-center py-8 text-gray-500', className)}
      >
        <FileIcon className='mb-3 h-12 w-12 text-gray-400' />
        <div className='text-lg font-medium'>No active exports</div>
        <div className='mt-1 max-w-sm text-center text-sm'>
          Start an export from the Issues or Workflows section to see progress here.
        </div>
      </div>
    )
  }

  return (
    <div className={clsx('space-y-4', className)}>
      <div className='flex items-center justify-between'>
        <h3 className='text-lg font-medium text-gray-900'>Export Progress</h3>
        <div className='text-sm text-gray-600'>
          {displayJobs.length} {displayJobs.length === 1 ? 'job' : 'jobs'}
        </div>
      </div>

      <div className='space-y-3'>
        {displayJobs.map(job => (
          <ExportProgress key={job.jobId} jobId={job.jobId} compact={true} showDetails={false} />
        ))}
      </div>

      {activeJobs.length > maxItems && (
        <div className='text-center'>
          <button 
            onClick={() => {
              log.info('Show more exports clicked', {
                hiddenCount: activeJobs.length - maxItems,
                totalJobs: activeJobs.length,
                currentMaxItems: maxItems
              })
            }}
            className='text-sm text-blue-600 hover:text-blue-800'
          >
            Show {activeJobs.length - maxItems} more exports
          </button>
        </div>
      )}
    </div>
  )
}

/**
 * Floating progress indicator for active exports
 */
export function FloatingExportProgress() {
  const { activeJobs } = useExport()
  const log = logger.extension

  // Only show for active processing jobs
  const activeProcessingJobs = activeJobs.filter(
    job => job.status === 'preparing' || job.status === 'processing'
  )

  useEffect(() => {
    if (activeProcessingJobs.length > 0) {
      log.debug('FloatingExportProgress showing', {
        activeProcessingJobs: activeProcessingJobs.length,
        currentJobId: activeProcessingJobs[0]?.jobId
      })
    }
  }, [activeProcessingJobs, log])

  if (activeProcessingJobs.length === 0) {
    return null
  }

  // Show the most recent job
  const currentJob = activeProcessingJobs[0]
  if (!currentJob) {
    return null
  }

  useEffect(() => {
    log.debug('FloatingExportProgress displaying job', {
      jobId: currentJob.jobId,
      status: currentJob.status,
      progress: currentJob.progress
    })
  }, [currentJob, log])

  return (
    <div className='fixed bottom-4 right-4 z-50'>
      <div className='max-w-sm rounded-lg border border-gray-300 bg-white shadow-lg'>
        <ExportProgress jobId={currentJob.jobId} compact={true} showDetails={true} />
      </div>
    </div>
  )
}
