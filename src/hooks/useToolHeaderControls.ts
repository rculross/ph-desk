/**
 * Custom Hooks for Tool Header Controls
 *
 * Enterprise-grade reusable hooks for common button behaviors in tool headers.
 * Optimized for performance with proper memoization and type safety.
 * Ensures consistent patterns across all apps in the Chrome extension.
 *
 * @module ToolHeaderControlsHooks
 * @version 3.0.1
 * @author Claude Code Architecture Team
 */

import { useState, useCallback, useMemo } from 'react'

import type { ButtonProps } from 'antd'

import type { ControlCategory, ButtonVariant } from '../types/ui'

/**
 * Hook for toggle button behavior (show/hide, enable/disable)
 *
 * Provides consistent toggle state management with optimized re-renders.
 * Automatically manages button styling based on active state.
 *
 * @param initialState - Initial toggle state (default: false)
 * @param onChange - Optional callback when state changes
 * @returns Toggle state and control functions with memoized button props
 */
export function useToggleControl(
  initialState = false,
  onChange?: (isActive: boolean) => void
) {
  const [isActive, setIsActive] = useState(initialState)

  const toggle = useCallback(() => {
    setIsActive(prev => {
      const newState = !prev
      onChange?.(newState)
      return newState
    })
  }, [onChange])

  const setActive = useCallback((active: boolean) => {
    setIsActive(active)
    onChange?.(active)
  }, [onChange])

  // Memoize button props to prevent unnecessary re-renders
  const buttonProps = useMemo(() => ({
    type: (isActive ? 'primary' : 'default') as ButtonProps['type'],
    'data-state': isActive ? 'active' : 'inactive',
    'aria-pressed': isActive
  } as const), [isActive])

  return {
    isActive,
    toggle,
    setActive,
    buttonProps
  }
}

/**
 * Hook for loading button behavior
 *
 * Manages loading state with proper accessibility and UX patterns.
 * Automatically disables button during loading states.
 *
 * @param initialState - Initial loading state (default: false)
 * @param onLoadingChange - Optional callback when loading state changes
 * @returns Loading state and control functions with memoized button props
 */
export function useLoadingControl(
  initialState = false,
  onLoadingChange?: (isLoading: boolean) => void
) {
  const [isLoading, setIsLoading] = useState(initialState)

  const startLoading = useCallback(() => {
    setIsLoading(true)
    onLoadingChange?.(true)
  }, [onLoadingChange])

  const stopLoading = useCallback(() => {
    setIsLoading(false)
    onLoadingChange?.(false)
  }, [onLoadingChange])

  const setLoading = useCallback((loading: boolean) => {
    setIsLoading(loading)
    onLoadingChange?.(loading)
  }, [onLoadingChange])

  // Memoize button props for performance
  const buttonProps = useMemo(() => ({
    loading: isLoading,
    disabled: isLoading,
    'aria-busy': isLoading,
    'data-loading': isLoading
  } as const), [isLoading])

  return {
    isLoading,
    startLoading,
    stopLoading,
    setLoading,
    buttonProps
  }
}

/**
 * Hook for badge button behavior (counts, selections)
 *
 * Efficiently manages badge display with customizable formatting.
 * Optimized for arrays that may change frequently.
 *
 * @param items - Array of items to count
 * @param formatter - Optional custom formatter for badge text
 * @param maxDisplayCount - Maximum count to display before showing "99+" style
 * @returns Badge state and formatted display with memoized button props
 */
export function useBadgeControl<T>(
  items: readonly T[],
  formatter?: (count: number) => string,
  maxDisplayCount = 99
) {
  const count = items.length
  const hasItems = count > 0

  // Memoize the formatted badge text
  const badge = useMemo(() => {
    if (!hasItems) return undefined
    if (formatter) return formatter(count)
    return count > maxDisplayCount ? `${maxDisplayCount}+` : count.toString()
  }, [hasItems, count, formatter, maxDisplayCount])

  // Memoize button props
  const buttonProps = useMemo(() => ({
    'data-has-badge': hasItems,
    'data-badge-count': count,
    'aria-label': hasItems ? `${count} items selected` : 'No items selected'
  } as const), [hasItems, count])

  return {
    count,
    hasItems,
    badge,
    buttonProps
  }
}

/**
 * Hook for format selection behavior (Radio.Group state)
 *
 * Type-safe format selection with validation and change callbacks.
 * Optimized for Radio.Group components with consistent styling.
 *
 * @param initialFormat - Initial selected format (undefined for no selection)
 * @param availableFormats - Array of valid format options
 * @param onChange - Optional callback when format changes
 * @returns Format state and control functions with memoized radio props
 */
export function useFormatControl<T extends string>(
  initialFormat: T | undefined,
  availableFormats: readonly T[],
  onChange?: (format: T) => void
) {
  const [selectedFormat, setSelectedFormat] = useState<T | undefined>(() => {
    // If no initial format, return undefined (no selection)
    if (initialFormat === undefined) return undefined
    // Validate initial format is available
    return availableFormats.includes(initialFormat) ? initialFormat : availableFormats[0] as T
  })

  const selectFormat = useCallback((format: T) => {
    if (availableFormats.includes(format)) {
      setSelectedFormat(format)
      onChange?.(format)
    }
  }, [availableFormats, onChange])

  const handleRadioChange = useCallback((e: any) => {
    const newFormat = e.target.value as T
    selectFormat(newFormat)
  }, [selectFormat])

  // Memoize radio group props for performance
  const radioGroupProps = useMemo(() => ({
    value: selectedFormat,
    onChange: handleRadioChange,
    size: 'small' as const,
    optionType: 'button' as const,
    buttonStyle: 'solid' as const
  }), [selectedFormat, handleRadioChange])

  return {
    selectedFormat,
    selectFormat,
    setSelectedFormat,
    availableFormats,
    radioGroupProps
  }
}

/**
 * Hook for combining multiple control states (complex buttons)
 *
 * Composes multiple control behaviors into a single cohesive interface.
 * Useful for buttons that need toggle + loading + badge functionality.
 *
 * @param config - Configuration object for enabled behaviors
 * @returns Combined control interface with merged props
 */
export function useComplexControl<T>(config: {
  canToggle?: boolean
  canLoad?: boolean
  canBadge?: boolean
  initialToggle?: boolean
  initialLoading?: boolean
  badgeItems?: readonly T[]
  onToggleChange?: (isActive: boolean) => void
  onLoadingChange?: (isLoading: boolean) => void
}) {
  const toggleControl = useToggleControl(
    config.initialToggle,
    config.onToggleChange
  )
  const loadingControl = useLoadingControl(
    config.initialLoading,
    config.onLoadingChange
  )
  const badgeControl = useBadgeControl(config.badgeItems ?? [])

  // Memoize combined props for performance
  const combinedProps = useMemo(() => ({
    ...toggleControl.buttonProps,
    ...loadingControl.buttonProps,
    ...badgeControl.buttonProps
  }), [toggleControl.buttonProps, loadingControl.buttonProps, badgeControl.buttonProps])

  return {
    toggle: config.canToggle ? toggleControl : null,
    loading: config.canLoad ? loadingControl : null,
    badge: config.canBadge ? badgeControl : null,
    buttonProps: combinedProps
  }
}

/**
 * Hook for managing a group of controls with consistent categorization
 *
 * Provides centralized state management for related controls within a category.
 * Optimized for bulk operations and consistent group behavior.
 *
 * @param category - Control category for semantic grouping
 * @param initialState - Initial state for the control group
 * @returns Group state management interface with memoized props
 */
export function useControlGroup<TState extends Record<string, unknown>>(
  category: ControlCategory,
  initialState: TState = {} as TState
) {
  const [groupState, setGroupState] = useState<TState>(initialState)

  const updateControl = useCallback(<K extends keyof TState>(
    controlKey: K,
    value: TState[K]
  ) => {
    setGroupState(prev => ({
      ...prev,
      [controlKey]: value
    }))
  }, [])

  const updateMultipleControls = useCallback((updates: Partial<TState>) => {
    setGroupState(prev => ({
      ...prev,
      ...updates
    }))
  }, [])

  const resetGroup = useCallback(() => {
    setGroupState(initialState)
  }, [initialState])

  const getControlValue = useCallback(<K extends keyof TState>(
    controlKey: K
  ): TState[K] => {
    return groupState[controlKey]
  }, [groupState])

  // Memoize group props
  const groupProps = useMemo(() => ({
    'data-control-group': category,
    'data-control-count': Object.keys(groupState).length,
    role: 'group',
    'aria-label': `${category} controls`
  } as const), [category, groupState])

  return {
    category,
    state: groupState,
    updateControl,
    updateMultipleControls,
    resetGroup,
    getControlValue,
    groupProps
  } as const
}

/**
 * Hook for managing button variants based on state
 *
 * Dynamically determines button styling based on conditional logic.
 * Provides consistent mapping between semantic variants and Ant Design types.
 *
 * @param baseVariant - Default variant when no conditions are met
 * @param conditions - Object of boolean conditions for variant selection
 * @returns Current variant and memoized button props
 */
export function useButtonVariant(
  baseVariant: ButtonVariant = 'secondary',
  conditions: {
    primary?: boolean
    secondary?: boolean
    ghost?: boolean
  } = {}
) {
  // Memoize variant calculation
  const variant = useMemo((): ButtonVariant => {
    if (conditions.primary) return 'primary'
    if (conditions.ghost) return 'ghost'
    if (conditions.secondary) return 'secondary'
    return baseVariant
  }, [baseVariant, conditions.primary, conditions.secondary, conditions.ghost])

  // Memoize button props to prevent unnecessary re-renders
  const buttonProps = useMemo(() => {
    const antdType: ButtonProps['type'] = variant === 'primary' ? 'primary' :
                                       variant === 'ghost' ? 'text' : 'default'
    return {
      type: antdType,
      'data-variant': variant
    } as const
  }, [variant])

  return {
    variant,
    buttonProps
  } as const
}