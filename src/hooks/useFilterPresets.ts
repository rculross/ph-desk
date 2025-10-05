/**
 * Filter Presets Hook
 *
 * React hook for managing filter presets with localStorage persistence.
 */

import { useState, useEffect, useCallback } from 'react'

import type { FilterPreset } from '../components/ui/AdvancedFilters'
import {
  loadFilterPresets,
  addFilterPreset,
  removeFilterPreset,
  updateFilterPreset
} from '../utils/filter-presets'

export interface UseFilterPresetsOptions {
  context: string
  autoLoad?: boolean
}

export interface UseFilterPresetsResult {
  presets: FilterPreset[]
  isLoading: boolean
  savePreset: (preset: FilterPreset) => Promise<void>
  deletePreset: (presetId: string) => Promise<void>
  updatePreset: (preset: FilterPreset) => Promise<void>
  loadPresets: () => Promise<void>
  clearAllPresets: () => Promise<void>
}

/**
 * Hook for managing filter presets
 */
export function useFilterPresets({
  context,
  autoLoad = true
}: UseFilterPresetsOptions): UseFilterPresetsResult {
  const [presets, setPresets] = useState<FilterPreset[]>([])
  const [isLoading, setIsLoading] = useState(false)

  // Load presets from storage
  const loadPresets = useCallback(async () => {
    setIsLoading(true)
    try {
      const loadedPresets = loadFilterPresets(context)
      setPresets(loadedPresets)
    } catch (error) {
      console.error('Failed to load filter presets:', error)
    } finally {
      setIsLoading(false)
    }
  }, [context])

  // Save a new preset
  const savePreset = useCallback(async (preset: FilterPreset) => {
    try {
      const updatedPresets = addFilterPreset(context, preset)
      setPresets(updatedPresets)
    } catch (error) {
      console.error('Failed to save filter preset:', error)
      throw error
    }
  }, [context])

  // Delete a preset
  const deletePreset = useCallback(async (presetId: string) => {
    try {
      const updatedPresets = removeFilterPreset(context, presetId)
      setPresets(updatedPresets)
    } catch (error) {
      console.error('Failed to delete filter preset:', error)
      throw error
    }
  }, [context])

  // Update an existing preset
  const updatePreset = useCallback(async (preset: FilterPreset) => {
    try {
      const updatedPresets = updateFilterPreset(context, preset)
      setPresets(updatedPresets)
    } catch (error) {
      console.error('Failed to update filter preset:', error)
      throw error
    }
  }, [context])

  // Clear all presets
  const clearAllPresets = useCallback(async () => {
    try {
      setPresets([])
      localStorage.removeItem(`ph-tools-filter-presets-${context}`)
    } catch (error) {
      console.error('Failed to clear filter presets:', error)
      throw error
    }
  }, [context])

  // Auto-load presets on mount
  useEffect(() => {
    if (autoLoad) {
      loadPresets()
    }
  }, [loadPresets, autoLoad])

  return {
    presets,
    isLoading,
    savePreset,
    deletePreset,
    updatePreset,
    loadPresets,
    clearAllPresets
  }
}