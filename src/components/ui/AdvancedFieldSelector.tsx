/**
 * Advanced Field Selector Component for Planhat Extension
 * 
 * Provides field selection UI with search, filtering, and sorting capabilities.
 * Note: Drag and drop functionality temporarily removed during AG Grid migration.
 * Will be re-implemented with @dnd-kit in a future update.
 */

import { useState, useCallback, useMemo } from 'react'

import { clsx } from 'clsx'
import {
  SearchIcon,
  FilterIcon,
  SortAscIcon,
  SortDescIcon,
  EyeIcon,
  EyeOffIcon,
  CheckCircleIcon,
  CircleIcon,
  TagIcon,
  CalendarIcon,
  HashIcon,
  TypeIcon,
  ToggleLeftIcon,
  DatabaseIcon,
  ListIcon,
  StarIcon,
  FileTextIcon,
  UsersIcon,
  UserIcon
} from 'lucide-react'

import type { EnhancedFieldMapping } from '../../types/export'

// Field selection component props
export interface AdvancedFieldSelectorProps {
  fields: EnhancedFieldMapping[]
  onFieldsChange: (fields: EnhancedFieldMapping[]) => void
  className?: string
  title?: string
  maxHeight?: number
  showSearch?: boolean
  showFilters?: boolean
  showBulkActions?: boolean
  enableReordering?: boolean
}

// Filter options
type FilterType = 'all' | 'included' | 'excluded' | 'string' | 'number' | 'date' | 'boolean' | 'richtext' | 'rating' | 'user' | 'users'
type SortOption = 'label' | 'type' | 'include'
type SortDirection = 'asc' | 'desc'

/**
 * Get field type icon
 */
function getFieldTypeIcon(type: EnhancedFieldMapping['type']) {
  switch (type) {
    case 'date':
      return CalendarIcon
    case 'number':
    case 'currency':
    case 'percentage':
      return HashIcon
    case 'rating':
      return StarIcon
    case 'boolean':
      return ToggleLeftIcon
    case 'array':
    case 'object':
      return ListIcon
    case 'richtext':
      return FileTextIcon
    case 'user':
      return UserIcon
    case 'users':
      return UsersIcon
    case 'url':
      return DatabaseIcon
    default:
      return TypeIcon
  }
}

/**
 * Get field type color
 */
function getFieldTypeColor(type: EnhancedFieldMapping['type']): string {
  switch (type) {
    case 'date':
      return 'text-blue-600 bg-blue-100'
    case 'number':
    case 'currency':
    case 'percentage':
      return 'text-green-600 bg-green-100'
    case 'rating':
      return 'text-yellow-600 bg-yellow-100'
    case 'boolean':
      return 'text-purple-600 bg-purple-100'
    case 'array':
    case 'object':
      return 'text-orange-600 bg-orange-100'
    case 'richtext':
      return 'text-pink-600 bg-pink-100'
    case 'user':
    case 'users':
      return 'text-cyan-600 bg-cyan-100'
    case 'url':
      return 'text-indigo-600 bg-indigo-100'
    default:
      return 'text-gray-600 bg-gray-100'
  }
}

/**
 * Advanced Field Selector Component
 */
export function AdvancedFieldSelector({
  fields,
  onFieldsChange,
  className,
  title = 'Select Fields',
  maxHeight = 400,
  showSearch = true,
  showFilters = true,
  showBulkActions = true,
  enableReordering = false // Temporarily disabled
}: AdvancedFieldSelectorProps) {
  // State
  const [searchQuery, setSearchQuery] = useState('')
  const [filterType, setFilterType] = useState<FilterType>('all')
  const [sortBy, setSortBy] = useState<SortOption>('label')
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc')

  // Field toggle handler
  const handleFieldToggle = useCallback((fieldKey: string) => {
    const updatedFields = fields.map(field =>
      field.key === fieldKey
        ? { ...field, include: !field.include }
        : field
    )
    onFieldsChange(updatedFields)
  }, [fields, onFieldsChange])

  // Handle bulk selection
  const handleSelectAll = useCallback(() => {
    const updatedFields = fields.map(field => ({ ...field, include: true }))
    onFieldsChange(updatedFields)
  }, [fields, onFieldsChange])

  const handleDeselectAll = useCallback(() => {
    const updatedFields = fields.map(field => ({ ...field, include: false }))
    onFieldsChange(updatedFields)
  }, [fields, onFieldsChange])

  // Filter and sort fields
  const filteredAndSortedFields = useMemo(() => {
    let filtered = fields

    // Apply search filter
    if (searchQuery) {
      filtered = filtered.filter(field =>
        field.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
        field.key.toLowerCase().includes(searchQuery.toLowerCase()) ||
        field.type.toLowerCase().includes(searchQuery.toLowerCase())
      )
    }

    // Apply type filter
    if (filterType !== 'all') {
      if (filterType === 'included') {
        filtered = filtered.filter(field => field.include)
      } else if (filterType === 'excluded') {
        filtered = filtered.filter(field => !field.include)
      } else {
        filtered = filtered.filter(field => field.type === filterType)
      }
    }

    // Apply sorting
    filtered.sort((a, b) => {
      let aValue: string | boolean
      let bValue: string | boolean

      switch (sortBy) {
        case 'type':
          aValue = a.type
          bValue = b.type
          break
        case 'include':
          aValue = a.include
          bValue = b.include
          break
        default:
          aValue = a.label
          bValue = b.label
          break
      }

      if (typeof aValue === 'boolean' && typeof bValue === 'boolean') {
        return sortDirection === 'asc' 
          ? (aValue === bValue ? 0 : aValue ? 1 : -1)
          : (aValue === bValue ? 0 : aValue ? -1 : 1)
      }

      const comparison = aValue.toString().localeCompare(bValue.toString())
      return sortDirection === 'asc' ? comparison : -comparison
    })

    return filtered
  }, [fields, searchQuery, filterType, sortBy, sortDirection])

  // Stats
  const stats = useMemo(() => {
    const total = fields.length
    const included = fields.filter(f => f.include).length
    const excluded = total - included
    
    return { total, included, excluded }
  }, [fields])

  return (
    <div className={clsx('flex flex-col space-y-4', className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
        <div className="text-sm text-gray-500">
          {stats.included} of {stats.total} selected
        </div>
      </div>

      {/* Search */}
      {showSearch && (
        <div className="relative">
          <SearchIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search fields..."
            className="w-full rounded-lg border border-gray-300 pl-10 pr-4 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
      )}

      {/* Filters and actions */}
      {(showFilters || showBulkActions) && (
        <div className="flex flex-wrap items-center gap-2">
          {showFilters && (
            <>
              {/* Filter dropdown */}
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value as FilterType)}
                className="rounded-md border border-gray-300 px-2 py-1 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="all">All Fields</option>
                <option value="included">Included</option>
                <option value="excluded">Excluded</option>
                <option value="string">Text</option>
                <option value="richtext">Rich Text</option>
                <option value="number">Number</option>
                <option value="rating">Rating</option>
                <option value="date">Date</option>
                <option value="boolean">Boolean</option>
                <option value="user">User</option>
                <option value="users">Users</option>
              </select>

              {/* Sort dropdown */}
              <select
                value={`${sortBy}-${sortDirection}`}
                onChange={(e) => {
                  const [newSortBy, newDirection] = e.target.value.split('-') as [SortOption, SortDirection]
                  setSortBy(newSortBy)
                  setSortDirection(newDirection)
                }}
                className="rounded-md border border-gray-300 px-2 py-1 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="label-asc">Name A-Z</option>
                <option value="label-desc">Name Z-A</option>
                <option value="type-asc">Type A-Z</option>
                <option value="type-desc">Type Z-A</option>
                <option value="include-desc">Included First</option>
                <option value="include-asc">Excluded First</option>
              </select>
            </>
          )}

          {showBulkActions && (
            <>
              {/* Bulk actions */}
              <button
                onClick={handleSelectAll}
                className="flex items-center space-x-1 rounded-md bg-blue-600 px-3 py-1 text-sm text-white hover:bg-blue-700"
              >
                <EyeIcon className="h-3 w-3" />
                <span>All</span>
              </button>
              <button
                onClick={handleDeselectAll}
                className="flex items-center space-x-1 rounded-md bg-gray-600 px-3 py-1 text-sm text-white hover:bg-gray-700"
              >
                <EyeOffIcon className="h-3 w-3" />
                <span>None</span>
              </button>
            </>
          )}
        </div>
      )}

      {/* Field list */}
      <div 
        className="overflow-y-auto rounded-lg border border-gray-200 bg-white"
        style={{ maxHeight: `${maxHeight}px` }}
      >
        <div className="space-y-1 p-2">
          {filteredAndSortedFields.map((field) => {
            if (!field) return null
            
            const isIncluded = field.include
            const FieldIcon = getFieldTypeIcon(field.type)
            const typeColors = getFieldTypeColor(field.type)
            
            return (
              <div
                key={field.key}
                className={clsx(
                  'group relative rounded-lg border p-2 transition-all duration-200',
                  isIncluded
                    ? 'border-blue-200 bg-blue-50 shadow-sm hover:shadow-md'
                    : 'border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm'
                )}
              >
                {/* Field content */}
                <div className="flex items-center justify-between">
                  {/* Left side - field info */}
                  <div className="flex items-center space-x-3 flex-1 min-w-0">
                    {/* Type icon */}
                    <div className={clsx('flex-shrink-0 rounded-md p-1.5', typeColors)}>
                      <FieldIcon className="h-4 w-4" />
                    </div>
                    
                    {/* Field details */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center">
                        <p className="truncate font-medium text-gray-900 text-base">
                          {field.label}
                        </p>
                      </div>
                      <p className="truncate text-sm text-gray-500">
                        {field.key}
                      </p>
                    </div>
                  </div>
                  
                  {/* Right side - actions */}
                  <div className="flex items-center space-x-2">
                    {/* Include toggle */}
                    <button
                      onClick={() => handleFieldToggle(field.key)}
                      className={clsx(
                        'flex items-center justify-center rounded-full p-1 transition-colors',
                        isIncluded
                          ? 'text-blue-600 hover:bg-blue-100'
                          : 'text-gray-400 hover:bg-gray-100 hover:text-gray-600'
                      )}
                      title={isIncluded ? 'Exclude field' : 'Include field'}
                    >
                      {isIncluded ? (
                        <CheckCircleIcon className="h-5 w-5" />
                      ) : (
                        <CircleIcon className="h-5 w-5" />
                      )}
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
          
          {filteredAndSortedFields.length === 0 && (
            <div className="flex flex-col items-center justify-center py-8 text-gray-500">
              <DatabaseIcon className="h-8 w-8 mb-2" />
              <p>No fields found</p>
              {searchQuery && (
                <p className="text-sm">Try adjusting your search or filter</p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Summary footer */}
      <div className="text-sm text-gray-600 bg-gray-50 rounded-lg p-3">
        <div className="flex justify-between">
          <span>Total: {stats.total}</span>
          <span>Included: {stats.included}</span>
          <span>Excluded: {stats.excluded}</span>
        </div>
      </div>
    </div>
  )
}