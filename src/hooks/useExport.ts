/**
 * Export Hooks for Planhat Extension
 *
 * React hooks for managing export operations, progress tracking,
 * and data selection for export functionality.
 */

import { useState, useEffect, useCallback, useRef } from 'react'

import { useQuery } from '@tanstack/react-query'
import { toast } from 'react-hot-toast'

import {
  exportService,
  type ExportProgress,
  type ExportRequest,
  type StreamingExportRequest
} from '../services/export.service'
import type { ExportFormat, EntityType } from '../types/api'
import type { FieldMapping } from '../types/export'
import { logger } from '../utils/logger'

// Hook return types
export interface UseExportResult {
  startExport: <T>(request: ExportRequest<T>) => Promise<string>
  startStreamingExport: <T>(request: StreamingExportRequest<T>) => Promise<string>
  cancelExport: (jobId: string) => boolean
  getProgress: (jobId: string) => ExportProgress | undefined
  activeJobs: ExportProgress[]
  isExporting: boolean
}

export interface UseExportProgressResult {
  progress: ExportProgress | undefined
  isLoading: boolean
  isCompleted: boolean
  isFailed: boolean
  isCancelled: boolean
  downloadUrl: string | undefined
  error: string | undefined
  cancel: () => boolean
  download: () => void
}

export interface UseDataSelectionResult<T> {
  selectedItems: Set<string>
  isAllSelected: boolean
  isIndeterminate: boolean
  selectAll: () => void
  deselectAll: () => void
  toggleItem: (id: string) => void
  toggleAll: () => void
  getSelectedData: () => T[]
  selectedCount: number
}

export interface UseFieldMappingResult {
  fields: FieldMapping[]
  updateField: (key: string, updates: Partial<FieldMapping>) => void
  toggleFieldInclusion: (key: string) => void
  selectAllFields: () => void
  deselectAllFields: () => void
  resetToDefaults: () => void
  getIncludedFields: () => FieldMapping[]
  includedCount: number
}

/**
 * Main export hook for managing export operations
 */
export function useExport(): UseExportResult {
  const [activeJobs, setActiveJobs] = useState<ExportProgress[]>([])
  const intervalRef = useRef<NodeJS.Timeout>()
  const log = logger.extension

  useEffect(() => {
    log.debug('useExport hook initialized')
  }, [log])

  // Poll for active job updates
  useEffect(() => {
    const updateJobs = () => {
      const jobs = exportService.getActiveJobs()
      setActiveJobs(jobs)

      log.debug('Active jobs updated', {
        jobCount: jobs.length,
        jobStatuses: jobs.reduce((acc, job) => {
          acc[job.status] = (acc[job.status] || 0) + 1
          return acc
        }, {} as Record<string, number>)
      })

      // Stop polling if no jobs are actively processing
      const hasActiveJobs = jobs.some(job => job.status === 'preparing' || job.status === 'processing')
      if (!hasActiveJobs && intervalRef.current) {
        log.debug('Stopping job polling - no active processing jobs')
        clearInterval(intervalRef.current)
        intervalRef.current = undefined
      }
    }

    // Initial update
    updateJobs()

    // Start polling if there are actively processing jobs
    const hasActiveJobs = activeJobs.some(job => job.status === 'preparing' || job.status === 'processing')
    if (hasActiveJobs && !intervalRef.current) {
      log.debug('Starting job polling', { activeJobCount: activeJobs.length })
      intervalRef.current = setInterval(updateJobs, 1000)
    }

    return () => {
      if (intervalRef.current) {
        log.debug('Cleaning up job polling interval')
        clearInterval(intervalRef.current)
        intervalRef.current = undefined
      }
    }
  }, [activeJobs.length, log])

  const startExport = useCallback(async <T>(request: ExportRequest<T>): Promise<string> => {
    log.info('Starting export operation', {
      entityType: request.entityType,
      format: request.format,
      filename: request.filename,
      dataLength: request.data.length,
      includedFields: request.fields.filter(f => f.include).length
    })
    
    try {
      const jobId = await exportService.startExport(request)
      
      log.info('Export started successfully', { jobId })

      // Start polling for updates
      if (!intervalRef.current) {
        log.debug('Starting polling for export updates', { jobId })
        intervalRef.current = setInterval(() => {
          const jobs = exportService.getActiveJobs()
          setActiveJobs(jobs)
        }, 1000)
      }

      toast.success('Export started successfully')
      return jobId
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Export failed to start'
      
      log.error('Export failed to start', {
        error: message,
        entityType: request.entityType,
        format: request.format
      })
      
      toast.error(message)
      throw error
    }
  }, [log])

  const startStreamingExport = useCallback(
    async <T>(request: StreamingExportRequest<T>): Promise<string> => {
      log.info('Starting streaming export operation', {
        entityType: request.entityType,
        format: request.format,
        filename: request.filename,
        totalRecords: request.totalRecords,
        includedFields: request.fields.filter(f => f.include).length
      })
      
      try {
        const jobId = await exportService.startStreamingExport(request)
        
        log.info('Streaming export started successfully', { jobId })

        // Start polling for updates
        if (!intervalRef.current) {
          log.debug('Starting polling for streaming export updates', { jobId })
          intervalRef.current = setInterval(() => {
            const jobs = exportService.getActiveJobs()
            setActiveJobs(jobs)
          }, 1000)
        }

        toast.success('Large dataset export started')
        return jobId
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Streaming export failed to start'
        
        log.error('Streaming export failed to start', {
          error: message,
          entityType: request.entityType,
          format: request.format,
          totalRecords: request.totalRecords
        })
        
        toast.error(message)
        throw error
      }
    },
    [log]
  )

  const cancelExport = useCallback((jobId: string): boolean => {
    log.info('Cancelling export', { jobId })
    
    const success = exportService.cancelExport(jobId)
    if (success) {
      log.info('Export cancelled successfully', { jobId })
      toast.success('Export cancelled')
      setActiveJobs(prev => prev.filter(job => job.jobId !== jobId))
    } else {
      log.warn('Failed to cancel export - job not found', { jobId })
    }
    return success
  }, [log])

  const getProgress = useCallback((jobId: string): ExportProgress | undefined => {
    const progress = exportService.getProgress(jobId)
    
    if (progress) {
      log.debug('Retrieved export progress', {
        jobId,
        status: progress.status,
        progress: progress.progress
      })
    }
    
    return progress
  }, [log])

  const isExporting = activeJobs.some(
    job => job.status === 'preparing' || job.status === 'processing'
  )

  return {
    startExport,
    startStreamingExport,
    cancelExport,
    getProgress,
    activeJobs,
    isExporting
  }
}

/**
 * Hook for tracking progress of a specific export job
 */
export function useExportProgress(jobId: string | undefined): UseExportProgressResult {
  const [progress, setProgress] = useState<ExportProgress | undefined>()
  const intervalRef = useRef<NodeJS.Timeout>()
  const log = logger.extension

  useEffect(() => {
    if (!jobId) {
      log.debug('useExportProgress cleared - no jobId')
      setProgress(undefined)
      return undefined
    }

    log.debug('useExportProgress initialized', { jobId })

    const updateProgress = () => {
      const currentProgress = exportService.getProgress(jobId)
      
      if (currentProgress && progress) {
        // Log state transitions
        if (currentProgress.status !== progress.status) {
          log.debug('Export status transition', {
            jobId,
            previousStatus: progress.status,
            newStatus: currentProgress.status,
            progress: currentProgress.progress
          })
        }
        
        // Log significant progress updates (every 10%)
        const progressDiff = currentProgress.progress - progress.progress
        if (progressDiff >= 10) {
          log.debug('Export progress update', {
            jobId,
            progress: currentProgress.progress,
            processedRecords: currentProgress.processedRecords,
            totalRecords: currentProgress.totalRecords
          })
        }
      }
      
      setProgress(currentProgress)

      // Stop polling if job is completed, failed, or cancelled
      if (
        currentProgress &&
        ['completed', 'failed', 'cancelled'].includes(currentProgress.status)
      ) {
        if (intervalRef.current) {
          log.debug('Stopping progress polling - job finished', {
            jobId,
            finalStatus: currentProgress.status
          })
          clearInterval(intervalRef.current)
          intervalRef.current = undefined
        }
      }
    }

    // Initial update
    updateProgress()

    // Start polling for updates
    intervalRef.current = setInterval(updateProgress, 1000)

    return () => {
      if (intervalRef.current) {
        log.debug('Cleaning up progress polling', { jobId })
        clearInterval(intervalRef.current)
        intervalRef.current = undefined
      }
    }
  }, [jobId, log, progress])

  const cancel = useCallback((): boolean => {
    if (!jobId) {
      log.warn('Attempted to cancel export with no jobId')
      return false
    }
    
    log.info('Cancelling export from progress hook', { jobId })
    
    const success = exportService.cancelExport(jobId)
    if (success) {
      log.info('Export cancelled successfully from progress hook', { jobId })
      toast.success('Export cancelled')
    } else {
      log.warn('Failed to cancel export from progress hook', { jobId })
    }
    return success
  }, [jobId, log])

  const download = useCallback((): void => {
    if (progress?.downloadUrl) {
      const filename = `export_${progress.jobId}.${getFileExtension(progress)}`
      
      log.info('Starting file download', {
        jobId: progress.jobId,
        filename,
        status: progress.status,
        totalRecords: progress.totalRecords
      })
      
      const link = document.createElement('a')
      link.href = progress.downloadUrl
      link.download = filename
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      
      log.info('File download initiated', {
        jobId: progress.jobId,
        filename
      })
      
      toast.success('Download started')
    } else {
      log.warn('Attempted to download but no download URL available', {
        jobId: progress?.jobId,
        status: progress?.status
      })
    }
  }, [progress, log])

  const isLoading = progress?.status === 'preparing' || progress?.status === 'processing'
  const isCompleted = progress?.status === 'completed'
  const isFailed = progress?.status === 'failed'
  const isCancelled = progress?.status === 'cancelled'

  return {
    progress,
    isLoading,
    isCompleted,
    isFailed,
    isCancelled,
    downloadUrl: progress?.downloadUrl,
    error: progress?.error,
    cancel,
    download
  }
}

/**
 * Hook for managing data selection for exports
 */
export function useDataSelection<T extends { _id: string }>(data: T[]): UseDataSelectionResult<T> {
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set())
  const log = logger.extension

  const selectAll = useCallback(() => {
    const allIds = new Set(data.map(item => item._id))
    setSelectedItems(allIds)
    
    log.info('Selected all items for export', {
      totalItems: data.length,
      selectedCount: allIds.size
    })
  }, [data, log])

  const deselectAll = useCallback(() => {
    setSelectedItems(new Set())

    log.info('Deselected all items for export', {
      totalItems: data.length
    })
  }, [data.length, log])

  const toggleItem = useCallback((id: string) => {
    setSelectedItems(prev => {
      const newSet = new Set(prev)
      const wasSelected = newSet.has(id)
      
      if (wasSelected) {
        newSet.delete(id)
      } else {
        newSet.add(id)
      }
      
      log.debug('Toggled item selection', {
        itemId: id,
        wasSelected,
        isNowSelected: !wasSelected,
        totalSelected: newSet.size
      })
      
      return newSet
    })
  }, [log])

  const toggleAll = useCallback(() => {
    const willDeselectAll = selectedItems.size === data.length
    
    log.info('Toggling all item selection', {
      currentlySelected: selectedItems.size,
      totalItems: data.length,
      willDeselectAll
    })
    
    if (willDeselectAll) {
      deselectAll()
    } else {
      selectAll()
    }
  }, [selectedItems.size, data.length, selectAll, deselectAll, log])

  const getSelectedData = useCallback((): T[] => {
    return data.filter(item => selectedItems.has(item._id))
  }, [data, selectedItems])

  const isAllSelected = data.length > 0 && selectedItems.size === data.length
  const isIndeterminate = selectedItems.size > 0 && selectedItems.size < data.length

  return {
    selectedItems,
    isAllSelected,
    isIndeterminate,
    selectAll,
    deselectAll,
    toggleItem,
    toggleAll,
    getSelectedData,
    selectedCount: selectedItems.size
  }
}

/**
 * Hook for managing field mappings and selection
 */
export function useFieldMapping(initialFields: FieldMapping[]): UseFieldMappingResult {
  const [fields, setFields] = useState<FieldMapping[]>(initialFields)
  const log = logger.extension
  
  useEffect(() => {
    log.debug('useFieldMapping initialized', {
      totalFields: initialFields.length,
      includedFields: initialFields.filter(f => f.include).length
    })
  }, [initialFields, log])

  const updateField = useCallback((key: string, updates: Partial<FieldMapping>) => {
    setFields(prev => {
      const field = prev.find(f => f.key === key)
      
      log.debug('Updating field mapping', {
        fieldKey: key,
        fieldLabel: field?.label,
        updates
      })
      
      return prev.map(field => (field.key === key ? { ...field, ...updates } : field))
    })
  }, [log])

  const toggleFieldInclusion = useCallback((key: string) => {
    setFields(prev => {
      const field = prev.find(f => f.key === key)
      const newIncludeState = !field?.include
      
      log.debug('Toggling field inclusion', {
        fieldKey: key,
        fieldLabel: field?.label,
        wasIncluded: field?.include,
        willBeIncluded: newIncludeState
      })
      
      return prev.map(field => (field.key === key ? { ...field, include: !field.include } : field))
    })
  }, [log])

  const selectAllFields = useCallback(() => {
    setFields(prev => {
      const updatedFields = prev.map(field => ({ ...field, include: true }))
      
      log.info('Selected all fields for export', {
        totalFields: prev.length,
        previouslyIncluded: prev.filter(f => f.include).length
      })
      
      return updatedFields
    })
  }, [log])

  const deselectAllFields = useCallback(() => {
    setFields(prev => {
      const updatedFields = prev.map(field => ({ ...field, include: false }))
      
      log.info('Deselected all fields for export', {
        totalFields: prev.length,
        previouslyIncluded: prev.filter(f => f.include).length
      })
      
      return updatedFields
    })
  }, [log])

  const resetToDefaults = useCallback(() => {
    log.info('Resetting field mappings to defaults', {
      totalFields: initialFields.length,
      defaultIncluded: initialFields.filter(f => f.include).length
    })
    
    setFields(initialFields)
  }, [initialFields, log])

  const getIncludedFields = useCallback((): FieldMapping[] => {
    return fields.filter(field => field.include)
  }, [fields])

  const includedCount = fields.filter(field => field.include).length

  return {
    fields,
    updateField,
    toggleFieldInclusion,
    selectAllFields,
    deselectAllFields,
    resetToDefaults,
    getIncludedFields,
    includedCount
  }
}

/**
 * Helper function to determine file extension from export progress
 */
function getFileExtension(progress: ExportProgress): string {
  // This would need to be enhanced to track format in progress
  // For now, return a default
  return 'csv'
}

