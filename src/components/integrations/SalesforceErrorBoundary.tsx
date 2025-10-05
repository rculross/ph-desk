/**
 * Salesforce Error Boundary Component
 *
 * React Error Boundary specifically designed for Salesforce integration components.
 * Provides secure error handling with sanitized logging and user-friendly fallback UI.
 * Prevents sensitive data exposure in error messages and stack traces.
 *
 * @fileVersion 3.1.2
 * @author Claude Code AI Assistant
 */

import React, { Component, type ErrorInfo, type ReactNode } from 'react'

import { ReloadOutlined, BugOutlined, WarningOutlined } from '@ant-design/icons'
import { Button, Result, Card, Typography, Collapse } from 'antd'

import { logSanitizer } from '../../utils/log-sanitizer'
import { logger } from '../../utils/logger'

const { Text, Paragraph } = Typography
const { Panel } = Collapse

/**
 * Props for the Salesforce Error Boundary
 */
export interface SalesforceErrorBoundaryProps {
  /** Child components to wrap */
  children: ReactNode
  /** Custom fallback UI component */
  fallback?: (error: Error, errorInfo: ErrorInfo, reset: () => void) => ReactNode
  /** Callback when an error occurs */
  onError?: (error: Error, errorInfo: ErrorInfo) => void
  /** Context name for logging */
  context?: string
  /** Whether to show detailed error information for debugging */
  showErrorDetails?: boolean
  /** Custom error title */
  errorTitle?: string
  /** Custom error description */
  errorDescription?: string
}

/**
 * State for the Error Boundary
 */
interface SalesforceErrorBoundaryState {
  hasError: boolean
  error: Error | null
  errorInfo: ErrorInfo | null
  errorId: string | null
}

/**
 * Error types that can occur in Salesforce integration
 */
const ERROR_TYPES = {
  NETWORK_ERROR: 'Network or API connection error',
  AUTHENTICATION_ERROR: 'Authentication or permission error',
  DATA_PROCESSING_ERROR: 'Data processing or transformation error',
  SEARCH_ERROR: 'Search functionality error',
  RENDER_ERROR: 'Component rendering error',
  UNKNOWN_ERROR: 'Unknown error occurred'
} as const

/**
 * React Error Boundary for Salesforce integration components
 *
 * Catches JavaScript errors anywhere in the child component tree,
 * logs those errors securely, and displays a fallback UI instead
 * of the component tree that crashed.
 */
export class SalesforceErrorBoundary extends Component<
  SalesforceErrorBoundaryProps,
  SalesforceErrorBoundaryState
> {
  private readonly log = logger.content

  constructor(props: SalesforceErrorBoundaryProps) {
    super(props)
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: null
    }
  }

  /**
   * Static method called when an error is caught
   */
  static getDerivedStateFromError(error: Error): Partial<SalesforceErrorBoundaryState> {
    // Update state so the next render will show the fallback UI
    return {
      hasError: true,
      error,
      errorId: `sf_error_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
    }
  }

  /**
   * Lifecycle method called after an error has been thrown
   */
  override componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    const { onError, context = 'salesforce-integration' } = this.props
    const errorId = this.state.errorId ?? 'unknown'

    // Update state with error info
    this.setState({ errorInfo })

    // Determine error type
    const errorType = this.categorizeError(error)

    // Log error securely (without sensitive data)
    this.log.error('Salesforce component error boundary triggered', logSanitizer.forError({
      errorId,
      context,
      errorType,
      errorMessage: error.message,
      errorName: error.name,
      componentStack: this.sanitizeComponentStack(errorInfo.componentStack ?? ''),
      // Don't log the full stack trace as it may contain file paths
      hasStackTrace: !!error.stack
    }))

    // Call custom error handler if provided
    if (onError) {
      try {
        onError(error, errorInfo)
      } catch (handlerError) {
        // Don't let the error handler crash the error boundary
        this.log.warn('Error boundary onError handler failed', logSanitizer.forError({
          errorId,
          handlerError: handlerError instanceof Error ? handlerError.message : 'Unknown handler error'
        }))
      }
    }
  }

  /**
   * Categorizes the error type for better handling
   */
  private categorizeError(error: Error): string {
    const message = error.message.toLowerCase()
    const name = error.name.toLowerCase()

    if (message.includes('network') || message.includes('fetch') || name.includes('network')) {
      return ERROR_TYPES.NETWORK_ERROR
    }

    if (message.includes('auth') || message.includes('permission') || message.includes('401') || message.includes('403')) {
      return ERROR_TYPES.AUTHENTICATION_ERROR
    }

    if (message.includes('process') || message.includes('transform') || message.includes('parse')) {
      return ERROR_TYPES.DATA_PROCESSING_ERROR
    }

    if (message.includes('search') || message.includes('index') || message.includes('query')) {
      return ERROR_TYPES.SEARCH_ERROR
    }

    if (name.includes('render') || message.includes('render') || message.includes('component')) {
      return ERROR_TYPES.RENDER_ERROR
    }

    return ERROR_TYPES.UNKNOWN_ERROR
  }

  /**
   * Sanitizes the component stack trace to remove sensitive file paths
   */
  private sanitizeComponentStack(componentStack: string): string {
    if (!componentStack) return 'No component stack available'

    // Remove file paths but keep component names
    return componentStack
      .replace(/\s+at .+?\/([^\/\s]+\.tsx?:\d+:\d+)/g, ' at $1')
      .replace(/\s+at .+?\/([^\/\s]+)$/g, ' at $1')
      .split('\n')
      .filter(line => line.trim().length > 0)
      .slice(0, 5) // Limit to first 5 lines
      .join('\n')
  }

  /**
   * Resets the error boundary state
   */
  private resetErrorBoundary = () => {
    const errorId = this.state.errorId

    this.log.info('Resetting Salesforce error boundary', logSanitizer.forDebug({
      errorId,
      context: this.props.context
    }))

    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: null
    })
  }

  /**
   * Gets user-friendly error message based on error type
   */
  private getUserFriendlyMessage(error: Error): { title: string; description: string } {
    const errorType = this.categorizeError(error)

    switch (errorType) {
      case ERROR_TYPES.NETWORK_ERROR:
        return {
          title: 'Connection Issue',
          description: 'Unable to connect to Salesforce integration. Please check your internet connection and try again.'
        }

      case ERROR_TYPES.AUTHENTICATION_ERROR:
        return {
          title: 'Access Denied',
          description: 'You may not have permission to access this Salesforce integration feature. Please contact your administrator.'
        }

      case ERROR_TYPES.DATA_PROCESSING_ERROR:
        return {
          title: 'Data Processing Error',
          description: 'There was an issue processing the Salesforce integration data. The data may be in an unexpected format.'
        }

      case ERROR_TYPES.SEARCH_ERROR:
        return {
          title: 'Search Error',
          description: 'The search functionality encountered an issue. Please try a different search term or clear your search.'
        }

      case ERROR_TYPES.RENDER_ERROR:
        return {
          title: 'Display Error',
          description: 'There was an issue displaying the Salesforce integration interface. Please refresh the page.'
        }

      default:
        return {
          title: 'Something went wrong',
          description: 'An unexpected error occurred in the Salesforce integration. Please try refreshing the page.'
        }
    }
  }

  override render() {
    const {
      children,
      fallback,
      showErrorDetails = false,
      errorTitle,
      errorDescription
    } = this.props

    const { hasError, error, errorInfo, errorId } = this.state

    // If there's no error, render children normally
    if (!hasError) {
      return children
    }

    // If custom fallback is provided, use it
    if (fallback && error && errorInfo) {
      return fallback(error, errorInfo, this.resetErrorBoundary)
    }

    // Use user-friendly messages or custom ones
    const friendlyMessage = this.getUserFriendlyMessage(error!)
    const title = errorTitle || friendlyMessage.title
    const description = errorDescription || friendlyMessage.description

    // Default error UI
    return (
      <div className="salesforce-error-boundary">
        <Result
          status="error"
          icon={<BugOutlined className="text-red-500" />}
          title={title}
          subTitle={description}
          extra={[
            <Button
              key="retry"
              type="primary"
              icon={<ReloadOutlined />}
              onClick={this.resetErrorBoundary}
            >
              Try Again
            </Button>,
            <Button key="refresh" onClick={() => window.location.reload()}>
              Refresh Page
            </Button>
          ]}
        >
          {showErrorDetails && error && (
            <Card
              size="small"
              className="mt-4 text-left"
              title={
                <span className="flex items-center gap-2">
                  <WarningOutlined className="text-orange-500" />
                  Technical Details (for debugging)
                </span>
              }
            >
              <Collapse ghost>
                <Panel header="Error Information" key="1">
                  <div className="space-y-2">
                    <div>
                      <Text strong>Error ID:</Text>
                      <Text code className="ml-2">{errorId}</Text>
                    </div>

                    <div>
                      <Text strong>Error Type:</Text>
                      <Text className="ml-2">{this.categorizeError(error)}</Text>
                    </div>

                    <div>
                      <Text strong>Error Name:</Text>
                      <Text code className="ml-2">{error.name}</Text>
                    </div>

                    <div>
                      <Text strong>Message:</Text>
                      <Paragraph className="ml-2 mb-0">
                        <Text code>{error.message}</Text>
                      </Paragraph>
                    </div>

                    {errorInfo && (
                      <div>
                        <Text strong>Component Stack:</Text>
                        <Paragraph className="ml-2 mb-0">
                          <pre className="text-xs bg-gray-50 p-2 rounded max-h-32 overflow-y-auto">
                            {this.sanitizeComponentStack(errorInfo.componentStack ?? '')}
                          </pre>
                        </Paragraph>
                      </div>
                    )}

                    <div className="mt-4 p-2 bg-yellow-50 border border-yellow-200 rounded">
                      <Text type="warning" className="text-xs">
                        Note: Sensitive information has been removed from error details for security.
                        Full error details are available in the browser console for developers.
                      </Text>
                    </div>
                  </div>
                </Panel>
              </Collapse>
            </Card>
          )}
        </Result>
      </div>
    )
  }
}

/**
 * Hook-based wrapper for the Error Boundary
 *
 * Provides a simpler interface for using the error boundary in functional components
 */
export function withSalesforceErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  errorBoundaryProps?: Omit<SalesforceErrorBoundaryProps, 'children'>
): React.ComponentType<P> {
  const WrappedComponent = (props: P) => (
    <SalesforceErrorBoundary {...errorBoundaryProps}>
      <Component {...props} />
    </SalesforceErrorBoundary>
  )

  WrappedComponent.displayName = `withSalesforceErrorBoundary(${Component.displayName || Component.name})`

  return WrappedComponent
}

export default SalesforceErrorBoundary