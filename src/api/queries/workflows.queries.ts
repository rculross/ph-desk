import { useQuery, type UseQueryOptions } from '@tanstack/react-query'

import type { Workflow, WorkflowFilters } from '../../types'
import { queryKeys } from '../query-client'
import { workflowsService, type WorkflowTemplatePaginationOptions } from '../services/workflows.service'

export type WorkflowTemplatesQueryKey = [
  ...typeof queryKeys.workflowTemplates,
  WorkflowFilters | undefined,
  WorkflowTemplatePaginationOptions | undefined
]

export type UseWorkflowTemplatesQueryOptions = Omit<
  UseQueryOptions<Workflow[], Error, Workflow[], WorkflowTemplatesQueryKey>,
  'queryKey' | 'queryFn'
> & {
  filters?: WorkflowFilters
  pagination?: WorkflowTemplatePaginationOptions
}

export function useWorkflowTemplatesQuery(
  options: UseWorkflowTemplatesQueryOptions = {}
) {
  const { filters, pagination, ...queryOptions } = options

  return useQuery<Workflow[], Error, Workflow[], WorkflowTemplatesQueryKey>({
    queryKey: [...queryKeys.workflowTemplates, filters, pagination] as WorkflowTemplatesQueryKey,
    queryFn: () => workflowsService.getWorkflowTemplates(filters, pagination),
    ...queryOptions
  })
}
