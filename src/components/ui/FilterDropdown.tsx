/**
 * Filter Dropdown Component
 *
 * Dropdown wrapper for column filters with proper positioning and styling.
 */

import React, { useState, useRef, useEffect } from 'react'

import type { Column } from '@tanstack/react-table'
import { Dropdown } from 'antd'

import { ColumnFilter } from './ColumnFilter'

export interface FilterDropdownProps<TData> {
  column: Column<TData, unknown>
  children: React.ReactElement
  onFilterChange?: (value: any) => void
}

/**
 * Dropdown wrapper for column filters
 */
export function FilterDropdown<TData>({
  column,
  children,
  onFilterChange
}: FilterDropdownProps<TData>) {
  const [open, setOpen] = useState(false)
  const [placement, setPlacement] = useState<'bottomLeft' | 'bottomRight'>('bottomLeft')
  const triggerRef = useRef<HTMLElement>(null)

  // Adjust dropdown placement based on position
  useEffect(() => {
    if (open && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect()
      const viewportWidth = window.innerWidth

      // If the trigger is in the right half of the screen, show dropdown on the right
      if (rect.left > viewportWidth / 2) {
        setPlacement('bottomRight')
      } else {
        setPlacement('bottomLeft')
      }
    }
  }, [open])

  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen)
  }

  const dropdownRender = () => (
    <div className="bg-white rounded-lg shadow-lg border border-gray-200 min-w-[200px] max-w-[400px]">
      <ColumnFilter
        column={column}
        onFilterChange={(value) => {
          onFilterChange?.(value)
          // Don't close dropdown automatically for better UX
        }}
      />
    </div>
  )

  return (
    <Dropdown
      open={open}
      onOpenChange={handleOpenChange}
      trigger={['click']}
      placement={placement}
      dropdownRender={dropdownRender}
      // Prevent dropdown from closing when clicking inside
      overlayStyle={{ zIndex: 1050 }}
    >
      {React.cloneElement(children, {
        ref: triggerRef,
        onClick: (e: React.MouseEvent) => {
          e.stopPropagation()
          children.props.onClick?.(e)
          setOpen(!open)
        }
      })}
    </Dropdown>
  )
}