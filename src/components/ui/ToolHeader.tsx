/**
 * ToolHeader Component
 *
 * Standardized header component for all extension tools.
 * Provides consistent styling, spacing, and layout patterns.
 * Now includes ToolHeaderButton for Ant Design standardization.
 */

import React, { forwardRef } from 'react'

import { Button, Space, Divider } from 'antd'
import type { ButtonProps, SpaceProps } from 'antd'
import { clsx } from 'clsx'
import type { LucideIcon } from 'lucide-react'

import {
  TOOL_BUTTON_STYLE,
  COMPACT_BUTTON_STYLE,
  BUTTON_STYLE_VARIANTS,
  type ControlCategory,
  type ButtonStyleVariant
} from '../../types/ui'

export interface ToolHeaderProps {
  /** Tool title */
  title: string
  /** Icon component (from lucide-react) */
  icon: LucideIcon
  /** Additional CSS classes */
  className?: string
  /** Child components (controls, buttons, etc.) */
  children?: React.ReactNode
}

/**
 * Standardized tool header component
 *
 * Design specifications:
 * - Card container: bg-gray-50, rounded-lg, px-4 py-3
 * - Title: text-lg font-semibold text-gray-800
 * - Icon: h-5 w-5 text-gray-500
 * - Controls: Use Ant Design Space for consistent spacing
 * - Dividers: Ant Design Divider with vertical type
 */
export function ToolHeader({ title, icon: Icon, className, children }: ToolHeaderProps) {
  return (
    <div className={clsx('bg-gray-50 border border-gray-200 rounded-lg px-4 py-3', className)}>
      <div className="flex items-center gap-3 flex-wrap">
        {/* Title Section */}
        <div className="flex items-center gap-2">
          <Icon className="h-5 w-5 text-gray-500" />
          <h2 className="text-lg font-semibold text-gray-800">{title}</h2>
        </div>

        {/* Divider and Controls (only show if there are children) */}
        {children && (
          <>
            <Divider type="vertical" style={{ height: '32px', margin: '0 8px' }} />
            <div className="flex items-center gap-3 flex-wrap flex-1">
              {children}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

/**
 * Utility component for creating dividers between control sections
 */
export function ToolHeaderDivider() {
  return <div className="ant-divider css-1cdsxhx ant-divider-vertical" role="separator" style={{height: '32px', margin: '0px 8px'}} />
}

/**
 * ToolHeaderButton - Standardized button wrapper using Ant Design
 */
export interface ToolHeaderButtonProps extends Omit<ButtonProps, 'size' | 'style' | 'variant'> {
  /** Control category for semantic grouping */
  category: ControlCategory
  /** Button variant for consistent styling */
  variant?: 'primary' | 'secondary' | 'ghost'
  /** Badge text/number to display */
  badge?: string | number
  /** Use compact styling (100px vs 150px width) */
  compact?: boolean
  /** Custom icon component */
  icon?: React.ReactNode
}

export function ToolHeaderButton({
  category,
  variant = 'secondary',
  badge,
  compact = false,
  icon,
  children,
  type,
  ...props
}: ToolHeaderButtonProps) {
  // Determine Ant Design button type based on variant
  const antdType = variant === 'primary' ? 'primary' : 'default'

  // Use appropriate styling
  const buttonStyle = compact ? COMPACT_BUTTON_STYLE : TOOL_BUTTON_STYLE

  return (
    <Button
      type={antdType}
      size="small"
      icon={icon}
      style={buttonStyle}
      data-category={category}
      {...props}
    >
      {children}
      {badge && <span className="ml-1">({badge})</span>}
    </Button>
  )
}

/**
 * ToolHeaderControls - Wrapper for grouped controls with consistent spacing
 */
export interface ToolHeaderControlsProps {
  /** Control category for semantic grouping */
  category: ControlCategory
  /** Child components */
  children: React.ReactNode
  /** Spacing between controls */
  spacing?: 'compact' | 'normal' | 'wide'
}

export function ToolHeaderControls({
  category,
  children,
  spacing = 'normal'
}: ToolHeaderControlsProps) {
  const spacingSize = spacing === 'compact' ? 'small' : spacing === 'wide' ? 'large' : 'middle'

  return (
    <Space size={spacingSize} data-control-category={category}>
      {children}
    </Space>
  )
}

/**
 * Utility component for creating compact input controls
 *
 * Provides consistent styling and accessibility for inline form inputs.
 * Optimized for tool header usage with proper focus management.
 */
export interface CompactInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  /** Input width class (e.g., 'w-24', 'w-32', 'flex-1') */
  width?: string
  /** Error state styling */
  error?: boolean
  /** Test ID for automated testing */
  testId?: string
}

export const CompactInput = forwardRef<HTMLInputElement, CompactInputProps>(
  (
    {
      width = 'flex-1',
      className,
      error,
      testId,
      'aria-label': ariaLabel,
      placeholder,
      ...props
    },
    ref
  ) => {
    return (
      <input
        ref={ref}
        className={clsx(
          'h-9 rounded-md border px-3 text-sm placeholder-gray-500',
          'transition-colors duration-200',
          'focus:outline-none focus:ring-1',
          error ? [
            'border-red-300 bg-red-50',
            'focus:border-red-500 focus:ring-red-500'
          ] : [
            'border-gray-300 bg-white',
            'focus:border-blue-500 focus:ring-blue-500'
          ],
          width,
          className
        )}
        data-testid={testId}
        aria-label={ariaLabel || placeholder}
        placeholder={placeholder}
        {...props}
      />
    )
  }
)

CompactInput.displayName = 'CompactInput'

/**
 * Error Boundary for ToolHeader components
 *
 * Provides graceful error handling for tool headers to prevent
 * complete UI failures when individual components error.
 */
interface ToolHeaderErrorBoundaryState {
  hasError: boolean
  error?: Error
}

export class ToolHeaderErrorBoundary extends React.Component<
  { children: React.ReactNode; fallback?: React.ReactNode },
  ToolHeaderErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode; fallback?: React.ReactNode }) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(error: Error): ToolHeaderErrorBoundaryState {
    return { hasError: true, error }
  }

  override componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('ToolHeader component error:', error, errorInfo)
  }

  override render() {
    if (this.state.hasError) {
      return (
        this.props.fallback || (
          <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3">
            <div className="text-red-800 text-sm">
              Tool header error - please refresh the page
            </div>
          </div>
        )
      )
    }

    return this.props.children
  }
}