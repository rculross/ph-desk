import { logger } from '../../utils/logger'

export type ExportStatus = 'preparing' | 'processing' | 'completed' | 'failed' | 'cancelled'

export interface ExportProgress {
  jobId: string
  status: ExportStatus
  progress: number
  totalRecords: number
  processedRecords: number
  estimatedTimeRemaining?: number
  error?: string
  startTime: number
  downloadUrl?: string
}

export interface InitializeJobOptions {
  totalRecords: number
  initialStatus?: ExportStatus
}

export interface InitializedJob {
  jobId: string
  progress: ExportProgress
  signal: AbortSignal
}

export class ExportJobOrchestrator {
  protected readonly activeJobs = new Map<string, ExportProgress>()
  private readonly abortControllers = new Map<string, AbortController>()

  constructor(protected readonly log = logger.api) {}

  protected initializeJob({ totalRecords, initialStatus = 'preparing' }: InitializeJobOptions): InitializedJob {
    const jobId = this.generateJobId()
    const progress: ExportProgress = {
      jobId,
      status: initialStatus,
      progress: 0,
      totalRecords,
      processedRecords: 0,
      startTime: Date.now()
    }

    this.activeJobs.set(jobId, progress)

    const abortController = new AbortController()
    this.abortControllers.set(jobId, abortController)

    this.log.debug('Export job initialized', {
      jobId,
      totalRecords,
      activeJobs: this.activeJobs.size
    })

    return { jobId, progress, signal: abortController.signal }
  }

  protected updateProgress(jobId: string, updates: Partial<ExportProgress>): void {
    const progress = this.activeJobs.get(jobId)
    if (!progress) {
      this.log.warn('Attempted to update unknown export job', { jobId })
      return
    }

    const nextProgress: ExportProgress = {
      ...progress,
      ...updates,
      progress:
        typeof updates.progress === 'number'
          ? Math.max(0, Math.min(100, updates.progress))
          : progress.progress
    }

    this.activeJobs.set(jobId, nextProgress)
  }

  protected cleanup(jobId: string): void {
    this.activeJobs.delete(jobId)
    this.abortControllers.delete(jobId)
  }

  protected handleError(jobId: string, error: unknown, context?: Record<string, unknown>): void {
    const message = error instanceof Error ? error.message : 'Unknown error'

    this.log.error('Export job failed', {
      jobId,
      message,
      context,
      stack: error instanceof Error ? error.stack : undefined
    })

    this.updateProgress(jobId, {
      status: 'failed',
      error: message
    })
  }

  protected getAbortSignal(jobId: string): AbortSignal | undefined {
    return this.abortControllers.get(jobId)?.signal
  }

  protected generateJobId(): string {
    return `export-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  }

  cancel(jobId: string): boolean {
    this.log.info('Cancelling export job', { jobId })

    const controller = this.abortControllers.get(jobId)
    if (controller) {
      controller.abort()
      this.updateProgress(jobId, { status: 'cancelled' })
      this.cleanup(jobId)

      this.log.info('Export job cancelled successfully', {
        jobId,
        remainingActiveJobs: this.activeJobs.size
      })
      return true
    }

    this.log.warn('Attempted to cancel non-existent export job', {
      jobId,
      availableJobs: Array.from(this.activeJobs.keys())
    })
    return false
  }

  getProgress(jobId: string): ExportProgress | undefined {
    return this.activeJobs.get(jobId)
  }

  getActiveJobs(): ExportProgress[] {
    return Array.from(this.activeJobs.values())
  }
}
