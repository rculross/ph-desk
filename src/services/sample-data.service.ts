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
  { path: '/workflows/withsteps?limit=200', filename: 'workflows-withsteps.json' },
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
  { path: '/pages', filename: 'pages.json' },
  { path: '/pagepointers', filename: 'pagepointers.json' },
  { path: '/integrations', filename: 'integrations.json' },
  { path: '/integrations/salesforce', filename: 'integrations-salesforce.json' },
  { path: '/connectionconfig', filename: 'connectionconfig.json' },
  { path: '/connectiondata', filename: 'connectiondata.json' },
  { path: '/dashboards', filename: 'dashboards.json' },
  { path: '/widgets', filename: 'widgets.json' },
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
  private get httpClient() {
    return getHttpClient()
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
    const timestamp = format(new Date(), 'yyyyMMdd-HHmmss')
    const folderName = `planhat-sample-data-${tenantSlug}-${timestamp}`
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
}

// Singleton instance
export const sampleDataService = new SampleDataService()
