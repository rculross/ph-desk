/**
 * Type definitions index for Planhat Extension
 *
 * Centralized exports for all type definitions used throughout the application.
 */

// Export all API types
export * from './api'

// Rate limiting types removed - using Bottleneck only

// Export integration types
export * from './integrations/salesforce.types'

// Common utility types
export interface Dictionary<T = any> {
  [key: string]: T
}

export type Optional<T, K extends keyof T> = {
  [P in keyof T]: P extends K ? T[P] | undefined : T[P]
}

// Extension-specific types
export interface ExtensionConfig {
  version: string
  environment: 'development' | 'production' | 'test'
  apiBaseUrl: string
  features: ExtensionFeatures
  limits: ExtensionLimits
}

export interface ExtensionFeatures {
  dataExport: boolean
  bulkOperations: boolean
  advancedFilters: boolean
  realTimeUpdates: boolean
  offlineMode: boolean
  analytics: boolean
}

export interface ExtensionLimits {
  maxExportRecords: number
  maxBulkOperations: number
  requestRateLimit: number
  cacheTtl: number
}

// Store types for Zustand
export interface AuthState {
  isAuthenticated: boolean
  user: import('./api').User | null
  session: import('./api').AuthSession | null
  loading: boolean
  error: string | null
}

export interface TenantState {
  currentTenant: import('./api').TenantContext | null
  availableTenants: import('./api').TenantContext[]
  loading: boolean
  error: string | null
}

export interface AppState {
  theme: 'light' | 'dark' | 'system'
  sidebarCollapsed: boolean
  settings: UserSettings
  lastActivity: number
}

export interface UserSettings {
  language: string
  timezone: string
  dateFormat: string
  pageSize: number
  autoSave: boolean
  notifications: {
    desktop: boolean
    email: boolean
    sound: boolean
  }
  experimental: {
    [key: string]: boolean
  }
}

// Query and mutation types for TanStack Query
export interface QueryConfig {
  staleTime?: number
  cacheTime?: number
  refetchOnWindowFocus?: boolean
  refetchOnMount?: boolean
  retry?: boolean | number
  enabled?: boolean
}

export interface MutationConfig {
  onSuccess?: (data: any) => void
  onError?: (error: any) => void
  onMutate?: (variables: any) => void
  retry?: boolean | number
}

// Component prop types
export interface BaseComponentProps {
  className?: string
  children?: React.ReactNode
  testId?: string
}

export interface LoadingState {
  loading: boolean
  error: string | null
}

export interface PaginationState {
  page: number
  pageSize: number
  total: number
  hasNextPage: boolean
  hasPreviousPage: boolean
}

export interface SortState {
  field: string
  direction: 'asc' | 'desc'
}

export interface FilterState<T = any> {
  filters: T
  activeFilters: string[]
  searchQuery: string
}

// Table and data display types
export interface TableColumn<T = any> {
  key: string
  header: string
  accessor?: keyof T | ((item: T) => any)
  sortable?: boolean
  filterable?: boolean
  width?: string | number
  minWidth?: number
  maxWidth?: number
  align?: 'left' | 'center' | 'right'
  render?: (value: any, item: T) => React.ReactNode
}

export interface TableRow<T = any> {
  id: string
  data: T
  selected?: boolean
  expanded?: boolean
}

export interface TableState<T = any> {
  data: TableRow<T>[]
  columns: TableColumn<T>[]
  loading: boolean
  error: string | null
  pagination: PaginationState
  sorting: SortState
  filtering: FilterState
  selection: string[]
}

// Form types
export interface FormField {
  name: string
  label: string
  type: FormFieldType
  required?: boolean
  disabled?: boolean
  placeholder?: string
  helpText?: string
  validation?: FormFieldValidation
  options?: FormFieldOption[]
  defaultValue?: any
}

export type FormFieldType =
  | 'text'
  | 'email'
  | 'password'
  | 'number'
  | 'textarea'
  | 'select'
  | 'multiselect'
  | 'checkbox'
  | 'radio'
  | 'date'
  | 'datetime'
  | 'file'
  | 'hidden'

export interface FormFieldValidation {
  required?: boolean
  minLength?: number
  maxLength?: number
  min?: number
  max?: number
  pattern?: string
  custom?: (value: any) => boolean | string
}

export interface FormFieldOption {
  value: any
  label: string
  disabled?: boolean
}

export interface FormErrors {
  [fieldName: string]: string | string[]
}

// Event types for Chrome extension
export interface ExtensionMessage {
  action: string
  payload?: any
  context?: 'background' | 'content' | 'popup' | 'extension-page'
  timestamp?: number
}

export interface ExtensionEvent<T = any> {
  type: string
  data: T
  source: 'extension' | 'page' | 'api'
  timestamp: number
}

// Analytics and tracking types
export interface AnalyticsEvent {
  name: string
  category: string
  action: string
  label?: string
  value?: number
  customData?: Dictionary
}

export interface PerformanceMetrics {
  loadTime: number
  apiResponseTime: number
  renderTime: number
  memoryUsage: number
  timestamp: number
}

// Error handling types
export interface AppError {
  code: string
  message: string
  details?: any
  stack?: string
  timestamp: number
  context?: Dictionary
  user?: string
  session?: string
}

export interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
  errorInfo: any
}

// Utility types for async operations
export interface AsyncOperation<T = any> {
  data: T | null
  loading: boolean
  error: string | null
  lastFetch: number | null
}

export interface AsyncOperationState<T = any> extends AsyncOperation<T> {
  refetch: () => Promise<void>
  mutate: (data: T) => void
  reset: () => void
}

// File and media types
export interface FileInfo {
  name: string
  size: number
  type: string
  lastModified: number
  url?: string
  thumbnailUrl?: string
}

export interface UploadProgress {
  loaded: number
  total: number
  percentage: number
  status: 'pending' | 'uploading' | 'completed' | 'error'
}

// Export format and data transformation types
export interface ExportColumn {
  key: string
  header: string
  formatter?: (value: any) => string
  includeInExport?: boolean
}

export interface ExportSettings {
  format: 'csv' | 'xlsx' | 'json' | 'pdf'
  columns: ExportColumn[]
  includeHeaders: boolean
  filename?: string
  filters?: Dictionary
  maxRows?: number
}

// Theme and styling types
export interface ThemeColors {
  primary: string
  secondary: string
  success: string
  warning: string
  danger: string
  info: string
  light: string
  dark: string
}

export interface ThemeConfig {
  colors: ThemeColors
  fonts: {
    primary: string
    secondary: string
    monospace: string
  }
  spacing: {
    xs: string
    sm: string
    md: string
    lg: string
    xl: string
  }
  breakpoints: {
    sm: string
    md: string
    lg: string
    xl: string
  }
}
