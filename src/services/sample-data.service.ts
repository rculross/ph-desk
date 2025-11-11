/**
 * Sample Data Service
 *
 * Fetches sample data from Planhat API endpoints and saves to local files.
 * Used for testing, development, and data analysis purposes.
 */

import { getHttpClient } from '@/api/client/http-client'
import { logger } from '@/utils/logger'
import { format } from 'date-fns'

export interface SampleDataEndpoint {
  path: string
  filename: string
}

export interface SampleDataProgress {
  currentEndpoint: string
  currentIndex: number
  totalEndpoints: number
  completed: number
  failed: number
  errors: Array<{ endpoint: string; error: string }>
  isComplete: boolean
}

export type SampleDataProgressCallback = (progress: SampleDataProgress) => void

/**
 * List of all endpoints to fetch sample data from
 */
const SAMPLE_DATA_ENDPOINTS: SampleDataEndpoint[] = [
  { path: '/issues?limit=200', filename: 'issues.json' },
  { path: '/companies?limit=200', filename: 'companies.json' },
  { path: '/workflows?limit=200', filename: 'workflows.json' },
  { path: '/workflowsteps?limit=200', filename: 'workflowsteps.json' },
  { path: '/workflowtemplates?limit=200', filename: 'workflowtemplates.json' },
  { path: '/workflowtemplatesteps?limit=200', filename: 'workflowtemplatesteps.json' },
  { path: '/automations?limit=200', filename: 'automations.json' },
  { path: '/filters?limit=200', filename: 'filters.json' },
  { path: '/customfields?limit=200', filename: 'customfields.json' },
  { path: '/comments?limit=200', filename: 'comments.json' },
  { path: '/devlogs?limit=200', filename: 'devlogs.json' },
  {
    path: '/logs?partitionDateFrom=2025-01-01T00:00:00.000Z&partitionDateTo=2025-10-25T23:59:59.999Z&offset=0&tzOffset=0&limit=200',
    filename: 'logs.json'
  },
  { path: '/roles', filename: 'roles.json' },
  { path: '/rolespermissions', filename: 'rolespermissions.json' },
  { path: '/teams', filename: 'teams.json' },
  { path: '/phworkspaces', filename: 'phworkspaces.json' },
  { path: '/phSections', filename: 'phSections.json' },
  { path: '/pagepointers', filename: 'pagepointers.json' },
  { path: '/integrations', filename: 'integrations.json' },
  { path: '/integrations/salesforce', filename: 'integrations-salesforce.json' },
  { path: '/connectionconfig', filename: 'connectionconfig.json' },
  { path: '/connectiondata', filename: 'connectiondata.json' },
  { path: '/dashboards', filename: 'dashboards.json' },
  { path: '/tableprefs', filename: 'tableprefs.json' },
  { path: '/myprofile', filename: 'myprofile.json' },
  { path: '/myprofile/tenants', filename: 'myprofile-tenants.json' },
  { path: '/data?model=Asset&limit=200', filename: 'data-Asset.json' },
  { path: '/data?model=Campaign&limit=200', filename: 'data-Campaign.json' },
  { path: '/data?model=Churn&limit=200', filename: 'data-Churn.json' },
  { path: '/data?model=Company&limit=200', filename: 'data-Company.json' },
  { path: '/data?model=Conversation&limit=200', filename: 'data-Conversation.json' },
  { path: '/data?model=EndUser&limit=200', filename: 'data-EndUser.json' },
  { path: '/data?model=Invoice&limit=200', filename: 'data-Invoice.json' },
  { path: '/data?model=Issue&limit=200', filename: 'data-Issue.json' },
  { path: '/data?model=License&limit=200', filename: 'data-License.json' },
  { path: '/data?model=Nps&limit=200', filename: 'data-Nps.json' },
  { path: '/data?model=Objective&limit=200', filename: 'data-Objective.json' },
  { path: '/data?model=Opportunity&limit=200', filename: 'data-Opportunity.json' },
  { path: '/data?model=Project&limit=200', filename: 'data-Project.json' },
  { path: '/data?model=Sale&limit=200', filename: 'data-Sale.json' },
  { path: '/data?model=Sprint&limit=200', filename: 'data-Sprint.json' },
  { path: '/data?model=Task&limit=200', filename: 'data-Task.json' },
  { path: '/data?model=TimeEntry&limit=200', filename: 'data-TimeEntry.json' },
  { path: '/data?model=User&limit=200', filename: 'data-User.json' },
  { path: '/data?model=Workspace&limit=200', filename: 'data-Workspace.json' },
  { path: '/data?model=Workflow&limit=200', filename: 'data-Workflow.json' }
]

export class SampleDataService {
  private cancelRequested = false

  private get httpClient() {
    return getHttpClient()
  }

  /**
   * Cancel the ongoing sample data collection
   */
  cancelCollection(): void {
    this.cancelRequested = true
    logger.api.info('Sample data collection cancellation requested')
  }

  /**
   * Collect sample data from all endpoints
   * @param baseFolderPath - Base folder path where data will be saved
   * @param tenantSlug - Current tenant slug
   * @param onProgress - Progress callback function
   */
  async collectSampleData(
    baseFolderPath: string,
    tenantSlug: string,
    onProgress?: SampleDataProgressCallback
  ): Promise<void> {
    // Reset cancellation flag at start
    this.cancelRequested = false

    const timestamp = format(new Date(), 'yyyyMMdd-HHmmss')
    const folderName = `Planhat Sample Data for ${tenantSlug} ${timestamp}`
    const fullFolderPath = `${baseFolderPath}/${folderName}`

    logger.api.info(`Starting sample data collection for tenant: ${tenantSlug}`)
    logger.api.info(`Output folder: ${fullFolderPath}`)

    const progress: SampleDataProgress = {
      currentEndpoint: '',
      currentIndex: 0,
      totalEndpoints: SAMPLE_DATA_ENDPOINTS.length,
      completed: 0,
      failed: 0,
      errors: [],
      isComplete: false
    }

    // Create the output folder via Electron IPC
    try {
      await window.electron.sampleData.writeFile(
        `${fullFolderPath}/.placeholder`,
        { created: new Date().toISOString() }
      )
      logger.api.info(`Created output folder: ${fullFolderPath}`)
    } catch (error) {
      logger.api.error('Failed to create output folder:', error)
      throw new Error(`Failed to create output folder: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }

    // Fetch data from each endpoint sequentially
    for (let i = 0; i < SAMPLE_DATA_ENDPOINTS.length; i++) {
      // Check for cancellation
      if (this.cancelRequested) {
        logger.api.info('Sample data collection cancelled by user')
        progress.currentEndpoint = 'Cancelled'
        break
      }

      const endpoint = SAMPLE_DATA_ENDPOINTS[i]
      if (!endpoint) continue // TypeScript safety check

      progress.currentEndpoint = endpoint.path
      progress.currentIndex = i + 1

      if (onProgress) {
        onProgress({ ...progress })
      }

      try {
        logger.api.info(`Fetching data from: ${endpoint.path}`)

        // Fetch data from endpoint
        const data = await this.httpClient.get(endpoint.path)

        // Write to file
        const filePath = `${fullFolderPath}/${endpoint.filename}`
        await window.electron.sampleData.writeFile(filePath, data)

        logger.api.info(`Successfully saved: ${endpoint.filename}`)
        progress.completed++

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        logger.api.error(`Failed to fetch/save ${endpoint.path}:`, errorMessage)

        progress.failed++
        progress.errors.push({
          endpoint: endpoint.path,
          error: errorMessage
        })

        // Continue to next endpoint even if this one failed
      }
    }

    // Fetch detailed workflow data with steps after main collection
    if (!this.cancelRequested) {
      try {
        logger.api.info('Starting detailed workflow data collection...')
        const workflowErrors = await this.fetchWorkflowsWithSteps(fullFolderPath, (message) => {
          progress.currentEndpoint = message
          if (onProgress) {
            onProgress({ ...progress })
          }
        })

        // Add individual workflow errors to progress
        if (workflowErrors.length > 0) {
          progress.failed += workflowErrors.length
          progress.errors.push(...workflowErrors)
        }
      } catch (error) {
        logger.api.error('Failed to fetch detailed workflow data:', error)
        progress.failed++
        progress.errors.push({
          endpoint: 'workflows-with-steps',
          error: error instanceof Error ? error.message : 'Unknown error'
        })
      }
    }

    // Fetch pages grouped by view mode after main collection
    if (!this.cancelRequested) {
      try {
        logger.api.info('Starting page data collection by view mode...')
        const pageErrors = await this.fetchPagesByViewMode(fullFolderPath, (message) => {
          progress.currentEndpoint = message
          if (onProgress) {
            onProgress({ ...progress })
          }
        })

        // Add individual page errors to progress
        if (pageErrors.length > 0) {
          progress.failed += pageErrors.length
          progress.errors.push(...pageErrors)
        }
      } catch (error) {
        logger.api.error('Failed to fetch pages by view mode:', error)
        progress.failed++
        progress.errors.push({
          endpoint: 'pages-by-viewmode',
          error: error instanceof Error ? error.message : 'Unknown error'
        })
      }
    }

    // Mark as complete
    progress.isComplete = true
    progress.currentEndpoint = ''

    if (onProgress) {
      onProgress({ ...progress })
    }

    logger.api.info(`Sample data collection complete. Completed: ${progress.completed}, Failed: ${progress.failed}`)

    // Write summary file
    try {
      const summary = {
        tenant: tenantSlug,
        timestamp,
        totalEndpoints: SAMPLE_DATA_ENDPOINTS.length,
        completed: progress.completed,
        failed: progress.failed,
        errors: progress.errors,
        endpoints: SAMPLE_DATA_ENDPOINTS.map(endpoint => ({
          path: endpoint.path,
          filename: endpoint.filename,
          status: progress.errors.find(err => err.endpoint === endpoint.path) ? 'failed' : 'success'
        }))
      }

      await window.electron.sampleData.writeFile(
        `${fullFolderPath}/_summary.json`,
        summary
      )

      logger.api.info('Summary file written successfully')
    } catch (error) {
      logger.api.warn('Failed to write summary file:', error)
    }
  }

  /**
   * Get the total number of endpoints to fetch
   */
  getTotalEndpoints(): number {
    return SAMPLE_DATA_ENDPOINTS.length
  }

  /**
   * Get all endpoint definitions
   */
  getEndpoints(): SampleDataEndpoint[] {
    return [...SAMPLE_DATA_ENDPOINTS]
  }

  /**
   * Fetch detailed workflow data with steps
   * Fetches workflowsteps, extracts 25 unique workflow IDs,
   * then fetches each workflow and its steps individually
   * @returns Array of errors encountered during fetching
   */
  private async fetchWorkflowsWithSteps(
    fullFolderPath: string,
    onProgress?: (message: string) => void
  ): Promise<Array<{ endpoint: string; error: string }>> {
    const errors: Array<{ endpoint: string; error: string }> = []

    try {
      logger.api.info('Fetching workflow steps to identify workflows...')
      if (onProgress) onProgress('Fetching workflow steps...')

      // Step 1: Fetch all workflow steps
      interface WorkflowStep {
        workflowId?: string
        description?: string
        [key: string]: unknown
      }

      const allSteps = await this.httpClient.get<WorkflowStep[]>('/workflowsteps?limit=500')

      // Step 2: Extract unique workflow IDs
      const workflowIds = new Set<string>()
      for (const step of allSteps) {
        if (step.workflowId) {
          workflowIds.add(step.workflowId)
        }
      }

      // Step 3: Take first 25 unique workflow IDs
      const selectedWorkflowIds = Array.from(workflowIds).slice(0, 25)
      logger.api.info(`Found ${workflowIds.size} unique workflows, selecting first 25`)

      // Step 4: Fetch each workflow and its steps
      const workflowsWithSteps: Array<{
        workflow: unknown
        steps: unknown[]
      }> = []

      for (let i = 0; i < selectedWorkflowIds.length; i++) {
        // Check for cancellation
        if (this.cancelRequested) {
          logger.api.info('Workflow fetching cancelled by user')
          break
        }

        const workflowId = selectedWorkflowIds[i]
        if (!workflowId) continue

        const progressMsg = `Fetching workflow ${i + 1}/${selectedWorkflowIds.length}: ${workflowId}`
        logger.api.info(progressMsg)
        if (onProgress) onProgress(progressMsg)

        try {
          // Fetch workflow details
          const workflow = await this.httpClient.get(`/workflows/${workflowId}`)

          // Fetch workflow steps (with steps embedded)
          const stepsResponse = await this.httpClient.get(`/workflows/${workflowId}/withsteps`)

          // Handle both array and object responses
          let steps: unknown[] = []
          if (Array.isArray(stepsResponse)) {
            // Response is already an array
            steps = stepsResponse
          } else if (stepsResponse && typeof stepsResponse === 'object') {
            // Response is an object, convert to array with single item
            steps = [stepsResponse]
          }

          // Remove description field from steps to save space
          const stepsWithoutDescription = steps.map((step: any) => {
            if (step && typeof step === 'object') {
              // eslint-disable-next-line @typescript-eslint/no-unused-vars
              const { description, ...stepWithoutDescription } = step
              return stepWithoutDescription
            }
            return step
          })

          workflowsWithSteps.push({
            workflow,
            steps: stepsWithoutDescription
          })
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error'
          logger.api.warn(`Failed to fetch workflow ${workflowId}:`, errorMessage)
          errors.push({
            endpoint: `/workflows/${workflowId}`,
            error: errorMessage
          })
          // Continue to next workflow even if this one fails
        }

        // Add a small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 100))
      }

      // Step 5: Write the combined data to file
      const filePath = `${fullFolderPath}/workflows-with-steps.json`
      await window.electron.sampleData.writeFile(filePath, workflowsWithSteps)

      logger.api.info(`Successfully saved ${workflowsWithSteps.length} workflows with steps`)
      if (onProgress) onProgress(`Saved ${workflowsWithSteps.length} workflows with steps`)

      return errors
    } catch (error) {
      logger.api.error('Failed to fetch workflows with steps:', error)
      throw error
    }
  }

  /**
   * Fetch pages grouped by pageViewMode
   * Analyzes pagepointers to find unique pageViewModes,
   * then fetches 5 sample pages for each view mode
   * @returns Array of errors encountered during fetching
   */
  private async fetchPagesByViewMode(
    fullFolderPath: string,
    onProgress?: (message: string) => void
  ): Promise<Array<{ endpoint: string; error: string }>> {
    const errors: Array<{ endpoint: string; error: string }> = []

    try {
      logger.api.info('Analyzing pagepointers to identify page view modes...')
      if (onProgress) onProgress('Analyzing pagepointers...')

      // Step 1: Read the pagepointers file that was already fetched
      const pagePointersPath = `${fullFolderPath}/pagepointers.json`

      // Note: We can't read from the file system in the renderer, so we'll fetch it again
      // This is simpler than passing data between methods
      interface PagePointer {
        _id?: string
        pageId?: string
        pageViewMode?: string
        pageDoesNotExist?: boolean
        [key: string]: unknown
      }

      const pagePointers = await this.httpClient.get<PagePointer[]>('/pagepointers?limit=500')
      logger.api.info(`Fetched ${pagePointers.length} pagepointers`)

      // Step 2: Group page IDs by pageViewMode and filter out pages that don't exist
      const pagesByViewMode = new Map<string, string[]>()

      for (const pointer of pagePointers) {
        // Skip if page doesn't exist or doesn't have required fields
        if (pointer.pageDoesNotExist || !pointer.pageId || !pointer.pageViewMode) {
          continue
        }

        const viewMode = pointer.pageViewMode
        if (!pagesByViewMode.has(viewMode)) {
          pagesByViewMode.set(viewMode, [])
        }
        pagesByViewMode.get(viewMode)?.push(pointer.pageId)
      }

      logger.api.info(`Found ${pagesByViewMode.size} unique page view modes:`, Array.from(pagesByViewMode.keys()))

      // Step 3: Fetch 5 pages for each view mode
      const pagesByViewModeResult: Record<string, unknown[]> = {}

      for (const [viewMode, pageIds] of pagesByViewMode.entries()) {
        // Check for cancellation
        if (this.cancelRequested) {
          logger.api.info('Page fetching cancelled by user')
          break
        }

        // Take first 5 page IDs for this view mode
        const selectedPageIds = pageIds.slice(0, 5)
        pagesByViewModeResult[viewMode] = []

        logger.api.info(`Fetching ${selectedPageIds.length} pages for view mode: ${viewMode}`)

        for (let i = 0; i < selectedPageIds.length; i++) {
          // Check for cancellation
          if (this.cancelRequested) {
            logger.api.info('Page fetching cancelled by user')
            break
          }

          const pageId = selectedPageIds[i]
          if (!pageId) continue

          const progressMsg = `Fetching ${viewMode} page ${i + 1}/${selectedPageIds.length}: ${pageId}`
          logger.api.info(progressMsg)
          if (onProgress) onProgress(progressMsg)

          try {
            // Fetch page details
            const page = await this.httpClient.get(`/pages/${pageId}`)
            pagesByViewModeResult[viewMode]?.push(page)
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error'
            logger.api.warn(`Failed to fetch page ${pageId}:`, errorMessage)
            errors.push({
              endpoint: `/pages/${pageId}`,
              error: errorMessage
            })
            // Continue to next page even if this one fails
          }

          // Add a small delay to avoid rate limiting
          await new Promise(resolve => setTimeout(resolve, 100))
        }
      }

      // Step 4: Write the pages data to file
      const pagesFilePath = `${fullFolderPath}/pages-by-viewmode.json`
      await window.electron.sampleData.writeFile(pagesFilePath, pagesByViewModeResult)

      const totalPages = Object.values(pagesByViewModeResult).reduce((sum, pages) => sum + pages.length, 0)
      logger.api.info(`Successfully saved ${totalPages} pages across ${pagesByViewMode.size} view modes`)
      if (onProgress) onProgress(`Saved ${totalPages} pages across ${pagesByViewMode.size} view modes`)

      return errors
    } catch (error) {
      logger.api.error('Failed to fetch pages by view mode:', error)
      throw error
    }
  }
}

// Singleton instance
export const sampleDataService = new SampleDataService()
