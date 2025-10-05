import type { ChangeEvent } from 'react'

import dayjs, { type Dayjs } from 'dayjs'

import { validateDateRange } from '../../services/logz.service'
import type {
  PlanhatModel,
  LogOperation,
  LogActorType,
  QuickDateFilter,
  LogsFilterState
} from '../../types/logz.types'

export type UpdateFilters = (filters: Partial<LogsFilterState>) => void
export type ClearFilters = () => void
export type ApplyQuickDateFilter = (daysAgo: QuickDateFilter) => void

export const ALL_MODELS: PlanhatModel[] = [
  'Asset',
  'Automation',
  'ConnectionData',
  'ConnectionConfig',
  'Comment',
  'Company',
  'EndUser',
  'Task',
  'Conversation',
  'Churn',
  'Opportunity',
  'Project',
  'Invoice',
  'License',
  'Sale',
  'Nps',
  'Workflow',
  'WorkflowStep',
  'Notification',
  'User',
  'Issue',
  'CustomField',
  'UserRole',
  'EmailTemplate',
  'Element',
  'ServiceAccount',
  'Page',
  'Team',
  'HealthProfile',
  'WorkflowTemplate',
  'WorkflowTemplateStep',
  'Campaign',
  'Workspace',
  'Objective',
  'Snippet',
  'Sprint',
  'PhWorkspace',
  'PagePointer',
  'SectionPointer',
  'PhSection',
  'ModelDraft',
  'EmailEngagement',
  'UsageMetricDef',
  'NpsCampaign',
  'CodeSnippet',
  'Document',
  'ExternalUser',
  'ObjectTemplate',
  'PromotionCampaign',
  'PromotionContent',
  'WorkspaceTemplate',
  'Label',
  'TouchType',
  'Call',
  'Currency',
  'SharedDocumentTemplate',
  'SuccessUnit',
  'EmailDraft',
  'Email',
  'Filter',
  'ProductRecurring',
  'Profile',
  'TimeEntry',
  'ProductOneoff',
  'SalesStage',
  'Reference',
  'ModelDefinition'
]

export const ALL_OPERATIONS: LogOperation[] = [
  'created',
  'updated',
  'deleted',
  'removed from filter',
  'added to filter'
]

export const ALL_ACTOR_TYPES: LogActorType[] = [
  'user',
  'hiddenuser',
  'integration',
  'automation',
  'system',
  'trigger',
  'service account'
]

export const QUICK_DATE_FILTERS: Array<{
  label: string
  compactLabel: string
  value: QuickDateFilter
}> = [
  { label: 'Last 24 hours', compactLabel: '1d', value: 1 },
  { label: 'Last 3 days', compactLabel: '3d', value: 3 },
  { label: 'Last 7 days', compactLabel: '7d', value: 7 }
]

export const getDateRangeValue = (
  filters: LogsFilterState
): [Dayjs, Dayjs] | null => {
  const { startDate, endDate } = filters.dateRange

  if (startDate && endDate) {
    return [dayjs(startDate), dayjs(endDate)]
  }

  return null
}

export const hasActiveFilters = (filters: LogsFilterState): boolean =>
  filters.models.length > 0 ||
  filters.operations.length > 0 ||
  filters.actorTypes.length > 0 ||
  filters.entityId.trim().length > 0 ||
  filters.searchTerm.trim().length > 0

export const isDateDisabled = (
  current: Dayjs | null,
  activeRange: [Dayjs, Dayjs] | null,
  maxRangeDays: number
): boolean => {
  if (!current) {
    return false
  }

  if (current.isAfter(dayjs(), 'day')) {
    return true
  }

  if (activeRange && activeRange[0] && !activeRange[1]) {
    const start = activeRange[0]
    return Math.abs(current.diff(start, 'day')) > maxRangeDays
  }

  return false
}

export const handleDateRangeChange = (
  updateFilters: UpdateFilters,
  dates: [Dayjs | null, Dayjs | null] | null
) => {
  if (dates && dates[0] && dates[1]) {
    const [start, end] = dates
    const startDate = start.format('YYYY-MM-DD')
    const endDate = end.format('YYYY-MM-DD')

    const validation = validateDateRange(startDate, endDate)

    if (validation.isValid) {
      updateFilters({
        dateRange: { startDate, endDate }
      })
    }
  }
}

export const handleQuickDateFilter = (
  applyQuickFilter: ApplyQuickDateFilter,
  daysAgo: QuickDateFilter
) => {
  applyQuickFilter(daysAgo)
}

export const handleModelsChange = (
  updateFilters: UpdateFilters,
  models: PlanhatModel[]
) => {
  updateFilters({ models })
}

export const handleOperationsChange = (
  updateFilters: UpdateFilters,
  operations: LogOperation[]
) => {
  updateFilters({ operations })
}

export const handleActorTypesChange = (
  updateFilters: UpdateFilters,
  actorTypes: LogActorType[]
) => {
  updateFilters({ actorTypes })
}

export const handleEntityIdChange = (
  updateFilters: UpdateFilters,
  event: ChangeEvent<HTMLInputElement>
) => {
  updateFilters({ entityId: event.target.value })
}

export const handleSearchChange = (
  updateFilters: UpdateFilters,
  event: ChangeEvent<HTMLInputElement>
) => {
  updateFilters({ searchTerm: event.target.value })
}

export const handleClearAllFilters = (clearFilters: ClearFilters) => {
  clearFilters()
}
