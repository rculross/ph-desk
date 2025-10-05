/**
 * Tenant Selector Component
 * 
 * A dropdown component for selecting and switching between available tenants.
 * Displays current tenant with status indicator and provides a dropdown list
 * of all available tenants with their active/inactive status.
 * 
 * Features:
 * - Current tenant display with status dot
 * - Dropdown list with all available tenants
 * - Status indicators (green for active, grey for inactive)
 * - Highlight currently selected tenant
 * - Smooth animations and transitions
 * - Click outside to close behavior
 * - Keyboard navigation support
 * - Loading and error states
 * - Tenant switching with feedback
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import {
  useFloating,
  autoUpdate,
  offset,
  flip,
  shift,
  size as floatingSize
} from '@floating-ui/react'
import { clsx } from 'clsx'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronDown, Check, AlertCircle, Building2, RefreshCw } from 'lucide-react'

import { useTenantSelector } from '../hooks/useTenantSelector'
import type { TenantOption } from '../hooks/useTenantSelector'
import { logger } from '../utils/logger'

export interface TenantSelectorProps {
  /** Additional CSS class name */
  className?: string
  /** Size variant */
  size?: 'sm' | 'md' | 'lg'
  /** Show tenant logos if available */
  showLogo?: boolean
  /** Show subscription plan info */
  showPlan?: boolean
  /** Callback when tenant is changed */
  onTenantChange?: (tenant: TenantOption) => void
  /** Disable the selector */
  disabled?: boolean
  /** Position for the dropdown */
  placement?: 'bottom-start' | 'bottom-end' | 'top-start' | 'top-end'
}

/**
 * Status Dot Component
 */
const StatusDot: React.FC<{ isActive: boolean; size?: 'sm' | 'md' }> = ({ 
  isActive, 
  size = 'md' 
}) => {
  const dotSize = size === 'sm' ? 'h-2 w-2' : 'h-2.5 w-2.5'
  
  return (
    <div 
      className={clsx(
        'rounded-full flex-shrink-0',
        dotSize,
        isActive 
          ? 'bg-green-500 shadow-sm shadow-green-500/50' 
          : 'bg-gray-400'
      )}
      aria-hidden="true"
    />
  )
}

/**
 * Tenant Avatar Component
 */
const TenantAvatar: React.FC<{ 
  tenant: TenantOption
  size?: 'sm' | 'md' | 'lg'
}> = ({ tenant, size = 'md' }) => {
  const sizeClasses = {
    sm: 'h-5 w-5',
    md: 'h-6 w-6',
    lg: 'h-8 w-8'
  }

  if (tenant.logo) {
    return (
      <img
        src={tenant.logo}
        alt={`${tenant.slug} logo`}
        className={clsx(
          'rounded-sm object-cover flex-shrink-0',
          sizeClasses[size]
        )}
        onError={(e) => {
          // Fallback to icon if image fails to load
          const target = e.target as HTMLImageElement
          target.style.display = 'none'
        }}
      />
    )
  }

  return (
    <div className={clsx(
      'rounded-sm bg-muted flex items-center justify-center flex-shrink-0',
      sizeClasses[size]
    )}>
      <Building2 className={clsx(
        'text-muted-foreground',
        size === 'sm' ? 'h-3 w-3' : size === 'md' ? 'h-4 w-4' : 'h-5 w-5'
      )} />
    </div>
  )
}

/**
 * Main Tenant Selector Component
 */
export const TenantSelector: React.FC<TenantSelectorProps> = ({
  className,
  size = 'md',
  showLogo = true,
  showPlan = false,
  onTenantChange,
  disabled = false,
  placement = 'bottom-end'
}) => {
  const {
    currentTenant,
    availableTenants,
    isLoading,
    isSwitching,
    error,
    switchError,
    switchTenant,
    refreshTenants,
    clearErrors,
    isCurrentTenant
  } = useTenantSelector()

  // Component state
  const [isOpen, setIsOpen] = useState(false)
  const [focusedIndex, setFocusedIndex] = useState(0)
  const [isRefreshing, setIsRefreshing] = useState(false)

  // Refs
  const triggerRef = useRef<HTMLButtonElement | null>(null)
  const dropdownRef = useRef<HTMLDivElement | null>(null)

  // Floating UI setup
  const { refs, floatingStyles } = useFloating({
    open: isOpen,
    onOpenChange: setIsOpen,
    middleware: [
      offset(8),
      flip({ padding: 8 }),
      shift({ padding: 8 }),
      floatingSize({
        apply({ rects, elements }: any) {
          Object.assign(elements.floating.style, {
            minWidth: `${Math.max(rects.reference.width, 240)}px`,
            maxWidth: '320px'
          })
        }
      })
    ],
    whileElementsMounted: autoUpdate,
    placement
  })

  // Size classes for the trigger button
  const sizeClasses = {
    sm: 'h-8 px-3 text-xs gap-2',
    md: 'h-9 px-3 text-sm gap-2.5',
    lg: 'h-10 px-4 text-base gap-3'
  }

  // Handle tenant selection
  const handleSelectTenant = useCallback(async (tenant: TenantOption) => {
    if (tenant.slug === currentTenant?.slug) {
      logger.extension.debug('Tenant already selected, ignoring selection', { tenantSlug: tenant.slug })
      return
    }
    
    if (isSwitching) {
      logger.extension.warn('Tenant switch already in progress, ignoring selection', { tenantSlug: tenant.slug })
      return
    }

    logger.extension.info('Tenant selection initiated', {
      fromTenant: currentTenant?.slug,
      toTenant: tenant.slug,
      isActive: tenant.isActive
    })

    try {
      await switchTenant(tenant.slug)
      onTenantChange?.(tenant)
      setIsOpen(false)
      
      logger.extension.info('Tenant switch completed successfully', { tenantSlug: tenant.slug })
    } catch (error) {
      // Error handling is managed by the hook/store
      logger.extension.error('Failed to switch tenant', {
        tenantSlug: tenant.slug,
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  }, [currentTenant, isSwitching, switchTenant, onTenantChange])

  // Handle refresh
  const handleRefresh = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation()
    
    logger.extension.info('Tenant refresh initiated by user')
    setIsRefreshing(true)
    
    try {
      await refreshTenants()
      logger.extension.info('Tenant refresh completed successfully')
    } catch (error) {
      logger.extension.error('Tenant refresh failed', {
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    } finally {
      setIsRefreshing(false)
    }
  }, [refreshTenants])

  // Keyboard navigation
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (disabled) return

    switch (e.key) {
      case 'Enter':
      case ' ':
        if (!isOpen) {
          e.preventDefault()
          logger.extension.debug('Tenant selector opened via keyboard')
          setIsOpen(true)
        } else if (focusedIndex >= 0 && focusedIndex < availableTenants.length) {
          e.preventDefault()
          const focusedTenant = availableTenants[focusedIndex]
          if (focusedTenant) {
            logger.extension.debug('Tenant selected via keyboard', {
              tenantSlug: focusedTenant.slug,
              focusedIndex
            })
            handleSelectTenant(focusedTenant)
          }
        }
        break

      case 'Escape':
        if (isOpen) {
          e.preventDefault()
          logger.extension.debug('Tenant selector closed via Escape key')
          setIsOpen(false)
          triggerRef.current?.focus()
        }
        break

      case 'ArrowDown':
        e.preventDefault()
        if (!isOpen) {
          logger.extension.debug('Tenant selector opened via ArrowDown')
          setIsOpen(true)
        } else {
          const newIndex = focusedIndex < availableTenants.length - 1 ? focusedIndex + 1 : 0
          logger.extension.debug('Tenant focus moved down', { from: focusedIndex, to: newIndex })
          setFocusedIndex(newIndex)
        }
        break

      case 'ArrowUp':
        e.preventDefault()
        if (isOpen) {
          const newIndex = focusedIndex > 0 ? focusedIndex - 1 : availableTenants.length - 1
          logger.extension.debug('Tenant focus moved up', { from: focusedIndex, to: newIndex })
          setFocusedIndex(newIndex)
        }
        break
    }
  }, [disabled, isOpen, focusedIndex, availableTenants, handleSelectTenant])

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        isOpen &&
        triggerRef.current &&
        dropdownRef.current &&
        !triggerRef.current.contains(event.target as Node) &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        logger.extension.debug('Tenant selector closed via outside click')
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isOpen])

  // Reset focused index when dropdown opens
  useEffect(() => {
    if (isOpen) {
      const currentIndex = availableTenants.findIndex(tenant => 
        tenant.slug === currentTenant?.slug
      )
      setFocusedIndex(currentIndex >= 0 ? currentIndex : 0)
    }
  }, [isOpen, availableTenants, currentTenant])

  // Clear errors when dropdown closes and log component lifecycle
  useEffect(() => {
    if (!isOpen && (error || switchError)) {
      logger.extension.debug('Scheduling error cleanup after dropdown close')
      const timeout = setTimeout(() => {
        logger.extension.debug('Clearing tenant selector errors')
        clearErrors()
      }, 3000)
      return () => clearTimeout(timeout)
    }
    return undefined
  }, [isOpen, error, switchError, clearErrors])
  
  // Log component mount and configuration
  useEffect(() => {
    logger.extension.debug('TenantSelector component mounted', {
      size,
      showLogo,
      showPlan,
      disabled,
      placement,
      hasCurrentTenant: !!currentTenant,
      availableTenantsCount: availableTenants.length
    })
    
    return () => {
      logger.extension.debug('TenantSelector component unmounted')
    }
  }, [])

  // Render current tenant display
  const renderCurrentTenant = () => {
    if (isLoading) {
      return (
        <>
          <div className="animate-spin h-4 w-4 border-2 border-current border-t-transparent rounded-full" />
          <span>Loading...</span>
        </>
      )
    }

    if (!currentTenant) {
      return (
        <>
          <StatusDot isActive={false} size="sm" />
          <span className="text-muted-foreground">Select tenant</span>
        </>
      )
    }

    return (
      <>
        {showLogo && <TenantAvatar tenant={currentTenant} size="sm" />}
        <StatusDot isActive={currentTenant.isActive} size="sm" />
        <span className="truncate font-medium">{currentTenant.slug}</span>
        {showPlan && currentTenant.subscription && (
          <span className="text-xs text-muted-foreground px-1.5 py-0.5 bg-muted rounded">
            {currentTenant.subscription.plan}
          </span>
        )}
      </>
    )
  }

  // Group tenants by environment
  const groupedTenants = useMemo(() => {
    const production = availableTenants.filter(tenant => tenant.environment === 'production')
    const demo = availableTenants.filter(tenant => tenant.environment === 'demo')
    return { production, demo }
  }, [availableTenants])

  // Render tenant option
  const renderTenantOption = (tenant: TenantOption, index: number) => {
    const isCurrent = isCurrentTenant(tenant.slug)
    const isFocused = index === focusedIndex

    return (
      <motion.button
        key={tenant.id}
        type="button"
        className={clsx(
          'w-full flex items-center gap-3 px-3 py-2.5 text-left text-sm',
          'hover:bg-accent hover:text-accent-foreground',
          'focus:bg-accent focus:text-accent-foreground focus:outline-none',
          'disabled:cursor-not-allowed disabled:opacity-50',
          'transition-colors duration-150',
          isFocused && 'bg-accent text-accent-foreground',
          isCurrent && 'bg-primary/10 text-primary'
        )}
        onClick={() => handleSelectTenant(tenant)}
        disabled={isSwitching}
        title={!tenant.isActive ? 'This tenant is currently inactive' : undefined}
        onMouseEnter={() => setFocusedIndex(index)}
        role="option"
        aria-selected={isCurrent}
      >
        {showLogo && <TenantAvatar tenant={tenant} size="sm" />}
        <StatusDot isActive={tenant.isActive} size="sm" />

        <div className="flex-1 min-w-0">
          <div className="truncate font-medium">{tenant.slug}</div>
        </div>

        {showPlan && tenant.subscription && (
          <span className="text-xs text-muted-foreground px-1.5 py-0.5 bg-muted/50 rounded flex-shrink-0">
            {tenant.subscription.plan}
          </span>
        )}

        {isCurrent && (
          <Check className="h-4 w-4 text-primary flex-shrink-0" />
        )}
      </motion.button>
    )
  }

  // Render environment group
  const renderEnvironmentGroup = (title: string, tenants: TenantOption[], startIndex: number) => {
    if (tenants.length === 0) return null

    return (
      <div key={title}>
        <div className="px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider bg-muted/30 border-b">
          {title}
        </div>
        {tenants.map((tenant, index) =>
          renderTenantOption(tenant, startIndex + index)
        )}
      </div>
    )
  }

  return (
    <div className="relative">
      {/* Trigger Button */}
      <button
        ref={(node) => {
          triggerRef.current = node
          refs.setReference(node)
        }}
        type="button"
        className={clsx(
          'inline-flex items-center justify-between rounded-lg border bg-background',
          'hover:bg-accent hover:text-accent-foreground',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
          'disabled:cursor-not-allowed disabled:opacity-50',
          'transition-colors duration-200',
          sizeClasses[size],
          (error || switchError) && 'border-destructive',
          className
        )}
        onClick={() => {
          if (!disabled) {
            logger.extension.info('Tenant selector dropdown toggled', {
              wasOpen: isOpen,
              willOpen: !isOpen,
              currentTenant: currentTenant?.slug,
              availableCount: availableTenants.length
            })
            setIsOpen(!isOpen)
          }
        }}
        onKeyDown={handleKeyDown}
        disabled={disabled || isSwitching}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-label="Select tenant"
      >
        <div className="flex items-center gap-2 min-w-0 flex-1">
          {renderCurrentTenant()}
        </div>

        <div className="flex items-center gap-1 flex-shrink-0 ml-2">
          {availableTenants.length > 0 && (
            <button
              type="button"
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="p-1 hover:bg-accent/50 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              title="Refresh tenants"
              aria-label="Refresh tenants"
            >
              <RefreshCw className={clsx(
                'h-3 w-3 transition-transform duration-200',
                isRefreshing && 'animate-spin'
              )} />
            </button>
          )}
          
          {isSwitching ? (
            <div className="animate-spin h-4 w-4 border-2 border-current border-t-transparent rounded-full" />
          ) : (
            <ChevronDown 
              className={clsx(
                'h-4 w-4 text-muted-foreground transition-transform duration-200',
                isOpen && 'rotate-180'
              )}
            />
          )}
        </div>
      </button>

      {/* Error Display */}
      {(error || switchError) && (
        <div className="absolute top-full left-0 right-0 mt-1 p-2 text-xs text-destructive bg-destructive/10 border border-destructive/20 rounded-md flex items-center gap-2">
          <AlertCircle className="h-3 w-3 flex-shrink-0" />
          <span className="truncate">{error || switchError}</span>
        </div>
      )}

      {/* Dropdown */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            ref={(node) => {
              dropdownRef.current = node
              refs.setFloating(node)
            }}
            style={floatingStyles}
            initial={{ opacity: 0, scale: 0.95, y: -10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -10 }}
            transition={{ duration: 0.15 }}
            className="z-50 overflow-hidden rounded-lg border bg-popover shadow-lg"
            role="listbox"
            aria-label="Available tenants"
          >
            <div className="max-h-80 overflow-y-auto">
              {availableTenants.length === 0 ? (
                <div className="px-3 py-8 text-center text-sm text-muted-foreground">
                  {isLoading ? 'Loading tenants and status...' : error ? 'Failed to load tenants' : 'No tenants available'}
                </div>
              ) : (
                <>
                  {renderEnvironmentGroup('Production', groupedTenants.production, 0)}
                  {groupedTenants.production.length > 0 && groupedTenants.demo.length > 0 && (
                    <div className="border-t my-1" />
                  )}
                  {renderEnvironmentGroup('Demo', groupedTenants.demo, groupedTenants.production.length)}
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export default TenantSelector