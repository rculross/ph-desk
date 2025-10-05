/**
 * Loading and Skeleton Components for Planhat Extension
 *
 * Production-ready loading components with spinners, skeleton loaders,
 * progress bars, and loading overlays. Uses Framer Motion for smooth
 * animations and consistent timing across all loading states.
 */

import React from 'react'

import { clsx } from 'clsx'
import { motion } from 'framer-motion'
import { Loader2 } from 'lucide-react'

import { logger } from '../../utils/logger'

const log = logger.extension // Loading components used in UI contexts

/**
 * Spinner Component - Animated loading spinner
 */
export interface SpinnerProps {
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl'
  className?: string
  color?: 'default' | 'primary' | 'muted'
}

const spinnerSizes = {
  xs: 'h-3 w-3',
  sm: 'h-4 w-4',
  md: 'h-6 w-6',
  lg: 'h-8 w-8',
  xl: 'h-12 w-12'
}

const spinnerColors = {
  default: 'text-foreground',
  primary: 'text-primary',
  muted: 'text-muted-foreground'
}

const Spinner = React.forwardRef<HTMLDivElement, SpinnerProps>(
  ({ size = 'md', className, color = 'default' }, ref) => {
    // Log spinner mount
    React.useEffect(() => {
      log.debug('Spinner component mounted', { size, color })
    }, [size, color])
    
    return (
      <div
        ref={ref}
        className={clsx(
          'inline-block animate-spin rounded-full border-2 border-current border-t-transparent',
          spinnerSizes[size],
          spinnerColors[color],
          className
        )}
        role='status'
        aria-label='Loading'
      >
        <span className='sr-only'>Loading...</span>
      </div>
    )
  }
)

Spinner.displayName = 'Spinner'

/**
 * Loading Dots - Three animated dots
 */
export interface LoadingDotsProps {
  size?: 'sm' | 'md' | 'lg'
  className?: string
  color?: 'default' | 'primary' | 'muted'
}

const LoadingDots = React.forwardRef<HTMLDivElement, LoadingDotsProps>(
  ({ size = 'md', className, color = 'default' }, ref) => {
    const dotSizes = {
      sm: 'h-1 w-1',
      md: 'h-2 w-2',
      lg: 'h-3 w-3'
    }

    const dotColors = {
      default: 'bg-foreground',
      primary: 'bg-primary',
      muted: 'bg-muted-foreground'
    }

    return (
      <div
        ref={ref}
        className={clsx('flex items-center justify-center gap-1', className)}
        role='status'
        aria-label='Loading'
      >
        {[0, 1, 2].map(i => (
          <motion.div
            key={i}
            className={clsx('rounded-full', dotSizes[size], dotColors[color])}
            animate={{
              scale: [1, 1.2, 1],
              opacity: [0.7, 1, 0.7]
            }}
            transition={{
              duration: 1,
              repeat: Infinity,
              delay: i * 0.2,
              ease: 'easeInOut'
            }}
          />
        ))}
        <span className='sr-only'>Loading...</span>
      </div>
    )
  }
)

LoadingDots.displayName = 'LoadingDots'

/**
 * Progress Bar Component
 */
export interface ProgressBarProps {
  value?: number
  max?: number
  size?: 'sm' | 'md' | 'lg'
  variant?: 'default' | 'success' | 'warning' | 'error'
  className?: string
  showLabel?: boolean
  label?: string
  animated?: boolean
}

const ProgressBar = React.forwardRef<HTMLDivElement, ProgressBarProps>(
  (
    {
      value = 0,
      max = 100,
      size = 'md',
      variant = 'default',
      className,
      showLabel = false,
      label,
      animated = false
    },
    ref
  ) => {
    const percentage = Math.min((value / max) * 100, 100)
    
    // Log significant progress changes
    React.useEffect(() => {
      const roundedPercentage = Math.round(percentage)
      if (roundedPercentage % 25 === 0 || roundedPercentage === 100) {
        log.info('Progress bar milestone reached', {
          percentage: roundedPercentage,
          value,
          max,
          variant
        })
      }
    }, [percentage, value, max, variant])

    const sizeClasses = {
      sm: 'h-1',
      md: 'h-2',
      lg: 'h-3'
    }

    const variantClasses = {
      default: 'bg-primary',
      success: 'bg-green-500',
      warning: 'bg-yellow-500',
      error: 'bg-red-500'
    }

    return (
      <div ref={ref} className={clsx('w-full', className)}>
        {(showLabel || label) && (
          <div className='mb-1 flex justify-between text-sm'>
            <span className='text-muted-foreground'>{label || 'Progress'}</span>
            <span className='text-muted-foreground'>{Math.round(percentage)}%</span>
          </div>
        )}

        <div
          className={clsx('w-full overflow-hidden rounded-full bg-muted', sizeClasses[size])}
          role='progressbar'
          aria-valuenow={value}
          aria-valuemin={0}
          aria-valuemax={max}
        >
          <motion.div
            className={clsx(
              'h-full rounded-full transition-all duration-300',
              variantClasses[variant],
              animated && 'relative overflow-hidden'
            )}
            initial={{ width: 0 }}
            animate={{ width: `${percentage}%` }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
          >
            {animated && (
              <motion.div
                className='absolute inset-0 bg-white/20'
                animate={{
                  x: ['-100%', '100%']
                }}
                transition={{
                  duration: 1,
                  repeat: Infinity,
                  ease: 'linear'
                }}
              />
            )}
          </motion.div>
        </div>
      </div>
    )
  }
)

ProgressBar.displayName = 'ProgressBar'

/**
 * Loading Overlay - Covers content with loading state
 */
export interface LoadingOverlayProps {
  isLoading: boolean
  children: React.ReactNode
  loadingText?: string
  spinner?: React.ReactNode
  className?: string
  backdrop?: 'light' | 'dark' | 'blur'
}

const LoadingOverlay = React.forwardRef<HTMLDivElement, LoadingOverlayProps>(
  (
    { isLoading, children, loadingText = 'Loading...', spinner, className, backdrop = 'light' },
    ref
  ) => {
    // Log loading state changes
    React.useEffect(() => {
      log.info('Loading overlay state changed', {
        isLoading,
        backdrop,
        hasCustomSpinner: !!spinner,
        loadingText: loadingText !== 'Loading...' ? loadingText : 'default'
      })
    }, [isLoading, backdrop, spinner, loadingText])
    
    const backdropClasses = {
      light: 'bg-white/80',
      dark: 'bg-black/50',
      blur: 'bg-white/80 backdrop-blur-sm'
    }

    return (
      <div ref={ref} className={clsx('relative', className)}>
        {children}

        {isLoading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className={clsx(
              'absolute inset-0 z-50 flex flex-col items-center justify-center',
              backdropClasses[backdrop]
            )}
          >
            <div className='flex flex-col items-center gap-3'>
              {spinner || <Spinner size='lg' />}
              {loadingText && (
                <p className='text-sm font-medium text-muted-foreground'>{loadingText}</p>
              )}
            </div>
          </motion.div>
        )}
      </div>
    )
  }
)

LoadingOverlay.displayName = 'LoadingOverlay'

/**
 * Skeleton Components for content placeholders
 */
export interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  className?: string
  animated?: boolean
}

const Skeleton = React.forwardRef<HTMLDivElement, SkeletonProps>(
  ({ className, animated = true, ...props }, ref) => {
    // Log skeleton mount (only in debug to avoid spam)
    React.useEffect(() => {
      log.debug('Skeleton component mounted', { animated })
    }, [animated])
    
    return (
      <div
        ref={ref}
        className={clsx('rounded bg-muted', animated && 'animate-pulse', className)}
        role='status'
        aria-label='Loading content'
        {...props}
      >
        <span className='sr-only'>Loading...</span>
      </div>
    )
  }
)

Skeleton.displayName = 'Skeleton'

/**
 * Skeleton Text - For text content placeholders
 */
export interface SkeletonTextProps extends SkeletonProps {
  lines?: number
  lastLineWidth?: string
}

const SkeletonText = React.forwardRef<HTMLDivElement, SkeletonTextProps>(
  ({ lines = 3, lastLineWidth = '75%', className, animated = true }, ref) => {
    return (
      <div ref={ref} className={clsx('space-y-2', className)}>
        {Array.from({ length: lines }, (_, i) => (
          <Skeleton
            key={i}
            animated={animated}
            className={clsx('h-4', i === lines - 1 ? `w-${lastLineWidth}` : 'w-full')}
            style={i === lines - 1 ? { width: lastLineWidth } : undefined}
          />
        ))}
      </div>
    )
  }
)

SkeletonText.displayName = 'SkeletonText'

/**
 * Skeleton Card - For card content placeholders
 */
export interface SkeletonCardProps extends SkeletonProps {
  showImage?: boolean
  imageHeight?: string
  showHeader?: boolean
  textLines?: number
}

const SkeletonCard = React.forwardRef<HTMLDivElement, SkeletonCardProps>(
  (
    {
      showImage = true,
      imageHeight = '200px',
      showHeader = true,
      textLines = 3,
      className,
      animated = true
    },
    ref
  ) => {
    return (
      <div ref={ref} className={clsx('space-y-4 p-4', className)}>
        {showImage && (
          <Skeleton
            animated={animated}
            className='w-full rounded-md'
            style={{ height: imageHeight }}
          />
        )}

        {showHeader && (
          <div className='space-y-2'>
            <Skeleton animated={animated} className='h-6 w-3/4' />
            <Skeleton animated={animated} className='h-4 w-1/2' />
          </div>
        )}

        <SkeletonText lines={textLines} animated={animated} />
      </div>
    )
  }
)

SkeletonCard.displayName = 'SkeletonCard'

/**
 * Skeleton Table - For table content placeholders
 */
export interface SkeletonTableProps extends SkeletonProps {
  rows?: number
  columns?: number
  showHeader?: boolean
}

const SkeletonTable = React.forwardRef<HTMLDivElement, SkeletonTableProps>(
  ({ rows = 5, columns = 4, showHeader = true, className, animated = true }, ref) => {
    return (
      <div ref={ref} className={clsx('w-full', className)}>
        <div className='space-y-2'>
          {/* Header */}
          {showHeader && (
            <div className='flex gap-4'>
              {Array.from({ length: columns }, (_, i) => (
                <Skeleton key={i} animated={animated} className='h-4 flex-1' />
              ))}
            </div>
          )}

          {/* Rows */}
          {Array.from({ length: rows }, (_, rowIndex) => (
            <div key={rowIndex} className='flex gap-4'>
              {Array.from({ length: columns }, (_, colIndex) => (
                <Skeleton key={colIndex} animated={animated} className='h-8 flex-1' />
              ))}
            </div>
          ))}
        </div>
      </div>
    )
  }
)

SkeletonTable.displayName = 'SkeletonTable'

/**
 * Skeleton Avatar - For user avatar placeholders
 */
export interface SkeletonAvatarProps extends SkeletonProps {
  size?: 'sm' | 'md' | 'lg' | 'xl'
}

const SkeletonAvatar = React.forwardRef<HTMLDivElement, SkeletonAvatarProps>(
  ({ size = 'md', className, animated = true }, ref) => {
    const sizeClasses = {
      sm: 'h-6 w-6',
      md: 'h-8 w-8',
      lg: 'h-12 w-12',
      xl: 'h-16 w-16'
    }

    return (
      <Skeleton
        ref={ref}
        animated={animated}
        className={clsx('rounded-full', sizeClasses[size], className)}
      />
    )
  }
)

SkeletonAvatar.displayName = 'SkeletonAvatar'

/**
 * Loading Button Content - For button loading states
 */
export interface LoadingButtonContentProps {
  loading: boolean
  loadingText?: string
  children: React.ReactNode
  spinner?: React.ReactNode
}

const LoadingButtonContent = React.forwardRef<HTMLSpanElement, LoadingButtonContentProps>(
  ({ loading, loadingText, children, spinner }, ref) => {
    // Log loading state changes
    React.useEffect(() => {
      if (loading) {
        log.debug('Button loading state activated', {
          hasCustomText: !!loadingText,
          hasCustomSpinner: !!spinner
        })
      }
    }, [loading, loadingText, spinner])
    
    if (!loading) {
      return <span ref={ref}>{children}</span>
    }

    return (
      <span ref={ref} className='flex items-center gap-2'>
        {spinner || <Spinner size='sm' />}
        {loadingText || children}
      </span>
    )
  }
)

LoadingButtonContent.displayName = 'LoadingButtonContent'

/**
 * Pulsing Dot - Simple pulsing indicator
 */
export interface PulsingDotProps {
  size?: 'sm' | 'md' | 'lg'
  color?: 'default' | 'primary' | 'success' | 'warning' | 'error'
  className?: string
}

const PulsingDot = React.forwardRef<HTMLDivElement, PulsingDotProps>(
  ({ size = 'md', color = 'default', className }, ref) => {
    const sizeClasses = {
      sm: 'h-2 w-2',
      md: 'h-3 w-3',
      lg: 'h-4 w-4'
    }

    const colorClasses = {
      default: 'bg-muted-foreground',
      primary: 'bg-primary',
      success: 'bg-green-500',
      warning: 'bg-yellow-500',
      error: 'bg-red-500'
    }

    return (
      <motion.div
        ref={ref}
        className={clsx('rounded-full', sizeClasses[size], colorClasses[color], className)}
        animate={{
          scale: [1, 1.2, 1],
          opacity: [0.7, 1, 0.7]
        }}
        transition={{
          duration: 2,
          repeat: Infinity,
          ease: 'easeInOut'
        }}
      />
    )
  }
)

PulsingDot.displayName = 'PulsingDot'

export {
  Spinner,
  LoadingDots,
  ProgressBar,
  LoadingOverlay,
  Skeleton,
  SkeletonText,
  SkeletonCard,
  SkeletonTable,
  SkeletonAvatar,
  LoadingButtonContent,
  PulsingDot
}
