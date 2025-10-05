/**
 * Filter Presets Storage Utility
 *
 * Manages storage and retrieval of filter presets in localStorage.
 */

import type { FilterPreset } from '../components/ui/AdvancedFilters'

const STORAGE_KEY_PREFIX = 'ph-tools-filter-presets'

/**
 * Get storage key for a specific table/context
 */
function getStorageKey(context: string): string {
  return `${STORAGE_KEY_PREFIX}-${context}`
}

/**
 * Load filter presets from localStorage
 */
export function loadFilterPresets(context: string): FilterPreset[] {
  try {
    const stored = localStorage.getItem(getStorageKey(context))
    if (!stored) return []

    const presets = JSON.parse(stored)
    return Array.isArray(presets) ? presets : []
  } catch (error) {
    console.error('Failed to load filter presets:', error)
    return []
  }
}

/**
 * Save filter presets to localStorage
 */
export function saveFilterPresets(context: string, presets: FilterPreset[]): void {
  try {
    localStorage.setItem(getStorageKey(context), JSON.stringify(presets))
  } catch (error) {
    console.error('Failed to save filter presets:', error)
  }
}

/**
 * Add a new filter preset
 */
export function addFilterPreset(context: string, preset: FilterPreset): FilterPreset[] {
  const presets = loadFilterPresets(context)

  // Check for duplicate names
  const existingIndex = presets.findIndex(p => p.name === preset.name)
  if (existingIndex >= 0) {
    // Replace existing preset with same name
    presets[existingIndex] = preset
  } else {
    // Add new preset
    presets.push(preset)
  }

  // Sort presets by name
  presets.sort((a, b) => a.name.localeCompare(b.name))

  saveFilterPresets(context, presets)
  return presets
}

/**
 * Remove a filter preset
 */
export function removeFilterPreset(context: string, presetId: string): FilterPreset[] {
  const presets = loadFilterPresets(context)
  const filtered = presets.filter(p => p.id !== presetId)
  saveFilterPresets(context, filtered)
  return filtered
}

/**
 * Update an existing filter preset
 */
export function updateFilterPreset(context: string, updatedPreset: FilterPreset): FilterPreset[] {
  const presets = loadFilterPresets(context)
  const index = presets.findIndex(p => p.id === updatedPreset.id)

  if (index >= 0) {
    presets[index] = updatedPreset
    saveFilterPresets(context, presets)
  }

  return presets
}

/**
 * Clear all filter presets for a context
 */
export function clearFilterPresets(context: string): void {
  localStorage.removeItem(getStorageKey(context))
}

/**
 * Export filter presets as JSON
 */
export function exportFilterPresets(context: string): string {
  const presets = loadFilterPresets(context)
  return JSON.stringify(presets, null, 2)
}

/**
 * Import filter presets from JSON
 */
export function importFilterPresets(context: string, jsonData: string): FilterPreset[] {
  try {
    const presets = JSON.parse(jsonData)
    if (!Array.isArray(presets)) {
      throw new Error('Invalid format: expected array of presets')
    }

    // Validate preset structure
    const validPresets = presets.filter(preset =>
      preset &&
      typeof preset === 'object' &&
      typeof preset.id === 'string' &&
      typeof preset.name === 'string' &&
      Array.isArray(preset.columnFilters)
    )

    saveFilterPresets(context, validPresets)
    return validPresets
  } catch (error) {
    console.error('Failed to import filter presets:', error)
    throw error
  }
}