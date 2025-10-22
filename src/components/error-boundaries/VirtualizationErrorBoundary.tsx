/**
 * Virtualization Error Boundary System
 *
 * Comprehensive error handling for table virtualization components.
 * Provides graceful degradation and detailed error reporting.
 */

import React, { Component, ErrorInfo, ReactNode } from 'react'

import { AlertCircle, RefreshCw, Bug, FileText } from 'lucide-react'

import { logger } from '../../utils/logger'

const log = logger.content

// Error classification
enum ErrorSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

enum ErrorCategory {
  VIRTUALIZATION = 'virtualization',
  RENDERING = 'rendering',
  DATA_ACCESS = 'data_access',
  MEMORY = 'memory',
  PERFORMANCE = 'performance',
  UNKNOWN = 'unknown'
}

interface ClassifiedError {
  error: Error
  severity: ErrorSeverity
  category: ErrorCategory
  isRecoverable: boolean
  fallbackStrategy: 'retry' | 'degraded' | 'minimal' | 'none'
}

// Error classification logic
function classifyError(error: Error, errorInfo: ErrorInfo): ClassifiedError {
  const message = error.message.toLowerCase()
  const stack = error.stack?.toLowerCase() ?? ''

  // Virtualization-specific errors
  if (message.includes('virtual') || message.includes('scroll') || message.includes('overscan')) {
    return {
      error,
      severity: ErrorSeverity.HIGH,
      category: ErrorCategory.VIRTUALIZATION,
      isRecoverable: true,
      fallbackStrategy: 'degraded'
    }
  }

  // Rendering errors
  if (message.includes('render') || message.includes('element') || stack.includes('flexrender')) {
    return {
      error,
      severity: ErrorSeverity.MEDIUM,
      category: ErrorCategory.RENDERING,
      isRecoverable: true,
      fallbackStrategy: 'retry'
    }
  }

  // Data access errors
  if (message.includes('undefined') || message.includes('null') || message.includes('index')) {
    return {
      error,
      severity: ErrorSeverity.HIGH,
      category: ErrorCategory.DATA_ACCESS,
      isRecoverable: true,
      fallbackStrategy: 'minimal'
    }
  }

  // Memory errors
  if (message.includes('memory') || message.includes('heap') || message.includes('allocation')) {
    return {
      error,
      severity: ErrorSeverity.CRITICAL,
      category: ErrorCategory.MEMORY,
      isRecoverable: false,
      fallbackStrategy: 'none'
    }
  }

  // Performance errors
  if (message.includes('timeout') || message.includes('performance') || message.includes('slow')) {
    return {
      error,
      severity: ErrorSeverity.MEDIUM,
      category: ErrorCategory.PERFORMANCE,
      isRecoverable: true,
      fallbackStrategy: 'degraded'
    }
  }

  // Default classification
  return {
    error,
    severity: ErrorSeverity.MEDIUM,
    category: ErrorCategory.UNKNOWN,
    isRecoverable: true,
    fallbackStrategy: 'retry'
  }
}

// Error reporting interface
interface ErrorReport {
  errorId: string
  timestamp: number
  classifiedError: ClassifiedError
  errorInfo: ErrorInfo
  userAgent: string
  url: string
  additionalContext?: Record<string, unknown>
}

function generateErrorReport(
  classifiedError: ClassifiedError,
  errorInfo: ErrorInfo,
  additionalContext?: Record<string, unknown>
): ErrorReport {
  return {
    errorId: `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    timestamp: Date.now(),
    classifiedError,
    errorInfo,
    userAgent: navigator.userAgent,
    url: window.location.href,
    additionalContext
  }
}

// Fallback component interfaces
interface FallbackComponentProps {
  error: Error
  errorInfo: ErrorInfo
  retry: () => void
  severity: ErrorSeverity
  category: ErrorCategory
}

// Virtualization-specific fallback
function VirtualizationFallback({ error, retry, severity, category }: FallbackComponentProps) {
  const getSeverityColor = () => {
    switch (severity) {
      case ErrorSeverity.LOW: return 'border-yellow-200 bg-yellow-50 text-yellow-800'
      case ErrorSeverity.MEDIUM: return 'border-orange-200 bg-orange-50 text-orange-800'
      case ErrorSeverity.HIGH: return 'border-red-200 bg-red-50 text-red-800'
      case ErrorSeverity.CRITICAL: return 'border-red-500 bg-red-100 text-red-900'
      default: return 'border-gray-200 bg-gray-50 text-gray-800'
    }
  }

  const getIcon = () => {
    switch (category) {
      case ErrorCategory.VIRTUALIZATION: return <FileText className="h-5 w-5" />
      case ErrorCategory.RENDERING: return <Bug className="h-5 w-5" />
      case ErrorCategory.MEMORY: return <AlertCircle className="h-5 w-5" />
      default: return <AlertCircle className="h-5 w-5" />
    }
  }

  return (
    <div className={`p-4 border rounded-lg ${getSeverityColor()}`}>
      <div className="flex items-start space-x-3">
        <div className="flex-shrink-0">
          {getIcon()}
        </div>

        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-medium">
            Table Virtualization Error
          </h3>

          <p className="mt-1 text-sm">
            {severity === ErrorSeverity.CRITICAL
              ? 'A critical error occurred that requires a page refresh.'
              : 'The table encountered an error while rendering virtualized content.'
            }
          </p>

          {category === ErrorCategory.DATA_ACCESS && (
            <p className="mt-2 text-xs">
              This may be due to data inconsistency. The table will attempt to recover automatically.
            </p>
          )}

          {category === ErrorCategory.VIRTUALIZATION && (
            <p className="mt-2 text-xs">
              Virtualization has been temporarily disabled. Data will be displayed without virtualization.
            </p>
          )}

          <div className="mt-3 flex space-x-2">
            {severity !== ErrorSeverity.CRITICAL && (
              <button
                onClick={retry}
                className="inline-flex items-center px-3 py-1 border border-transparent text-xs font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                <RefreshCw className="h-3 w-3 mr-1" />
                Retry
              </button>
            )}

            <button
              onClick={() => window.location.reload()}
              className="inline-flex items-center px-3 py-1 border border-gray-300 text-xs font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              Refresh Page
            </button>
          </div>

          <details className="mt-3">
            <summary className="text-xs cursor-pointer hover:underline">
              Technical Details
            </summary>
            <pre className="mt-2 text-xs bg-white p-2 rounded border overflow-auto max-h-32">
              {error.message}
              {error.stack && `\n\nStack:\n${error.stack}`}
            </pre>
          </details>
        </div>
      </div>
    </div>
  )
}

// Minimal fallback for critical errors
function MinimalTableFallback({ error }: { error: Error }) {
  return (
    <div className="p-8 text-center border border-red-200 bg-red-50 rounded-lg">
      <AlertCircle className="h-8 w-8 text-red-500 mx-auto mb-4" />
      <h3 className="text-lg font-medium text-red-800 mb-2">
        Critical Table Error
      </h3>
      <p className="text-red-600 mb-4">
        The table component has encountered a critical error and cannot be displayed.
      </p>
      <button
        onClick={() => window.location.reload()}
        className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-red-600 hover:bg-red-700"
      >
        <RefreshCw className="h-4 w-4 mr-2" />
        Refresh Page
      </button>
    </div>
  )
}

// Main error boundary state interface
interface VirtualizationErrorBoundaryState {
  hasError: boolean
  classifiedError: ClassifiedError | null
  errorInfo: ErrorInfo | null
  retryCount: number
  lastErrorTime: number
}

// Error boundary props
interface VirtualizationErrorBoundaryProps {
  children: ReactNode
  fallback?: React.ComponentType<FallbackComponentProps>
  maxRetries?: number
  retryDelay?: number
  onError?: (errorReport: ErrorReport) => void
  additionalContext?: Record<string, unknown>
}

// Main virtualization error boundary
export class VirtualizationErrorBoundary extends Component<
  VirtualizationErrorBoundaryProps,
  VirtualizationErrorBoundaryState
> {
  private retryTimeoutId: NodeJS.Timeout | null = null

  constructor(props: VirtualizationErrorBoundaryProps) {
    super(props)
    this.state = {
      hasError: false,
      classifiedError: null,
      errorInfo: null,
      retryCount: 0,
      lastErrorTime: 0
    }
  }

  static getDerivedStateFromError(error: Error): Partial<VirtualizationErrorBoundaryState> {
    return {
      hasError: true,
      lastErrorTime: Date.now()
    }
  }

  override componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    const classifiedError = classifyError(error, errorInfo)

    this.setState({
      classifiedError,
      errorInfo
    })

    // Generate and report error
    const errorReport = generateErrorReport(
      classifiedError,
      errorInfo,
      this.props.additionalContext
    )

    // Log detailed error information
    log.error('Virtualization error boundary caught error', {
      errorId: errorReport.errorId,
      severity: classifiedError.severity,
      category: classifiedError.category,
      isRecoverable: classifiedError.isRecoverable,
      fallbackStrategy: classifiedError.fallbackStrategy,
      retryCount: this.state.retryCount,
      error: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack
    })

    // Call external error handler
    this.props.onError?.(errorReport)

    // Auto-retry for certain error types
    if (classifiedError.isRecoverable &&
        classifiedError.fallbackStrategy === 'retry' &&
        this.state.retryCount < (this.props.maxRetries ?? 3)) {

      this.retryTimeoutId = setTimeout(() => {
        this.handleRetry()
      }, this.props.retryDelay ?? 1000)
    }
  }

  override componentWillUnmount() {
    if (this.retryTimeoutId) {
      clearTimeout(this.retryTimeoutId)
    }
  }

  handleRetry = () => {
    this.setState(prevState => ({
      hasError: false,
      classifiedError: null,
      errorInfo: null,
      retryCount: prevState.retryCount + 1
    }))

    log.info('Retrying after virtualization error', {
      retryCount: this.state.retryCount + 1
    })
  }

  override render() {
    if (this.state.hasError && this.state.classifiedError) {
      const { classifiedError, errorInfo } = this.state
      const { fallback: CustomFallback } = this.props

      // Use custom fallback if provided
      if (CustomFallback && errorInfo) {
        return (
          <CustomFallback
            error={classifiedError.error}
            errorInfo={errorInfo}
            retry={this.handleRetry}
            severity={classifiedError.severity}
            category={classifiedError.category}
          />
        )
      }

      // Use appropriate fallback based on severity
      if (classifiedError.severity === ErrorSeverity.CRITICAL) {
        return <MinimalTableFallback error={classifiedError.error} />
      }

      if (errorInfo) {
        return (
          <VirtualizationFallback
            error={classifiedError.error}
            errorInfo={errorInfo}
            retry={this.handleRetry}
            severity={classifiedError.severity}
            category={classifiedError.category}
          />
        )
      }
    }

    return this.props.children
  }
}

// Higher-order component for easy wrapping
export function withVirtualizationErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  errorBoundaryProps?: Omit<VirtualizationErrorBoundaryProps, 'children'>
) {
  return function WrappedComponent(props: P) {
    return (
      <VirtualizationErrorBoundary {...errorBoundaryProps}>
        <Component {...props} />
      </VirtualizationErrorBoundary>
    )
  }
}

// Export types and utilities
export type {
  ClassifiedError,
  ErrorReport,
  FallbackComponentProps,
  VirtualizationErrorBoundaryProps
}

export {
  ErrorSeverity,
  ErrorCategory,
  classifyError,
  generateErrorReport
}