# Dropdown Menu UX Components - Porting Guide

This guide explains the dropdown menu components from PH-Tools and how to port them to another application. All Planhat-specific logic has been removed from this guide - you'll only find the UI/UX components you need.

---

## Table of Contents

1. [Overview](#overview)
2. [Visual Components](#visual-components)
3. [NPM Dependencies](#npm-dependencies)
4. [Component 1: TenantSelector (Sophisticated Dropdown)](#component-1-tenantselector-sophisticated-dropdown)
5. [Component 2: Navigation Category Dropdowns](#component-2-navigation-category-dropdowns)
6. [Styling Requirements](#styling-requirements)
7. [Integration Checklist](#integration-checklist)

---

## Overview

There are **TWO** distinct dropdown menu systems in the app:

### 1. **TenantSelector** - Advanced Dropdown in Top Right
- Click to open/close
- Sophisticated positioning that adapts to screen edges
- Smooth animations
- Keyboard navigation support
- Shows current selection with status indicators
- Grouped options (Production/Demo)
- Search-ready structure

### 2. **Navigation Category Dropdowns** - Header Menu System
- Hover to open (simpler interaction)
- Multiple category dropdowns in a row
- Only one opens at a time
- Icon + label for each menu item
- Simpler positioning (absolute)

---

## Visual Components

### TenantSelector Features

**Trigger Button:**
- Shows current selection
- Optional logo/avatar on left
- Status dot (green = active, gray = inactive)
- Text label
- Chevron icon that rotates 180° when open
- Optional refresh button
- Loading spinner when switching

**Dropdown Panel:**
- Smooth slide-in animation (fade + scale + translate)
- Max height with scroll if needed
- Grouped sections with headers
- Each option shows:
  - Logo/avatar (optional)
  - Status dot
  - Name/label
  - Checkmark if selected
  - Optional subscription badge
- Hover states
- Keyboard focus states
- Error messages below trigger

**Interactions:**
- Click trigger to toggle
- Click outside to close
- Keyboard navigation (Arrow keys, Enter, Escape)
- Auto-closes on selection

### Navigation Dropdown Features

**Category Buttons:**
- Icon on left
- Category label
- Small chevron down icon
- Hover effect (background change)
- Disabled state for empty categories

**Dropdown Panels:**
- Opens on hover (mouse enter)
- Closes when mouse leaves
- Positioned below the button
- Border + shadow for depth
- Each menu item:
  - Icon on left
  - Label text
  - Hover effect

---

## NPM Dependencies

Install these packages to get the same UX:

```json
{
  "dependencies": {
    // Core UI libraries
    "react": "^18.x",
    "react-dom": "^18.x",

    // Dropdown positioning
    "@floating-ui/react": "^0.26.x",

    // Animations
    "framer-motion": "^11.x",

    // Icons
    "lucide-react": "^0.400.x",

    // Utilities
    "clsx": "^2.1.x",

    // Styling
    "tailwindcss": "^3.x"
  }
}
```

**What each does:**

- **@floating-ui/react** - Handles smart dropdown positioning (prevents going off-screen)
- **framer-motion** - Smooth enter/exit animations for dropdowns
- **lucide-react** - Icon library (ChevronDown, Check, Building2, etc.)
- **clsx** - Utility for conditional CSS classes
- **tailwindcss** - Utility-first CSS framework (you can use regular CSS instead)

---

## Component 1: TenantSelector (Sophisticated Dropdown)

### Data Structure Required

Your dropdown needs a list of options with this shape:

```typescript
interface DropdownOption {
  id: string                    // Unique identifier
  slug: string                  // URL-friendly identifier
  name: string                  // Display name
  isActive: boolean             // Active/inactive status
  logo?: string                 // Optional logo URL
  environment?: 'production' | 'demo' | string  // Optional grouping
  badge?: {                     // Optional badge (like subscription plan)
    label: string
    variant: 'default' | 'primary' | 'success'
  }
}
```

### Core Component Structure

The TenantSelector component has three main parts:

#### 1. **State Management**

```typescript
const [isOpen, setIsOpen] = useState(false)
const [focusedIndex, setFocusedIndex] = useState(0)
const [currentSelection, setCurrentSelection] = useState<DropdownOption | null>(null)
```

#### 2. **Floating UI Setup** (Smart Positioning)

```typescript
import { useFloating, autoUpdate, offset, flip, shift, size } from '@floating-ui/react'

const { refs, floatingStyles } = useFloating({
  open: isOpen,
  onOpenChange: setIsOpen,
  middleware: [
    offset(8),              // 8px gap between trigger and dropdown
    flip({ padding: 8 }),   // Flip to opposite side if no room
    shift({ padding: 8 }),  // Shift to stay in viewport
    size({                  // Dynamic sizing
      apply({ rects, elements }) {
        Object.assign(elements.floating.style, {
          minWidth: `${Math.max(rects.reference.width, 240)}px`,
          maxWidth: '320px'
        })
      }
    })
  ],
  whileElementsMounted: autoUpdate,
  placement: 'bottom-end'  // Start bottom-right, adapt as needed
})
```

#### 3. **Animation Setup** (Framer Motion)

```typescript
import { motion, AnimatePresence } from 'framer-motion'

// In JSX:
<AnimatePresence>
  {isOpen && (
    <motion.div
      initial={{ opacity: 0, scale: 0.95, y: -10 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95, y: -10 }}
      transition={{ duration: 0.15 }}
    >
      {/* Dropdown content */}
    </motion.div>
  )}
</AnimatePresence>
```

### Visual Components to Copy

#### **Status Dot Component**

```tsx
const StatusDot = ({ isActive, size = 'md' }) => {
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
    />
  )
}
```

#### **Avatar/Logo Component**

```tsx
import { Building2 } from 'lucide-react'

const Avatar = ({ option, size = 'md' }) => {
  const sizeClasses = {
    sm: 'h-5 w-5',
    md: 'h-6 w-6',
    lg: 'h-8 w-8'
  }

  if (option.logo) {
    return (
      <img
        src={option.logo}
        alt={`${option.name} logo`}
        className={clsx('rounded-sm object-cover flex-shrink-0', sizeClasses[size])}
      />
    )
  }

  return (
    <div className={clsx('rounded-sm bg-gray-100 flex items-center justify-center', sizeClasses[size])}>
      <Building2 className="h-4 w-4 text-gray-500" />
    </div>
  )
}
```

#### **Trigger Button**

```tsx
import { ChevronDown, RefreshCw } from 'lucide-react'

<button
  ref={refs.setReference}
  onClick={() => setIsOpen(!isOpen)}
  className="inline-flex items-center justify-between rounded-lg border bg-white px-3 h-9 text-sm gap-2.5 hover:bg-gray-50 transition-colors"
>
  {/* Left side - current selection */}
  <div className="flex items-center gap-2 min-w-0 flex-1">
    <Avatar option={currentSelection} size="sm" />
    <StatusDot isActive={currentSelection?.isActive} size="sm" />
    <span className="truncate font-medium">{currentSelection?.name || 'Select...'}</span>
  </div>

  {/* Right side - controls */}
  <div className="flex items-center gap-1 flex-shrink-0 ml-2">
    <button
      onClick={(e) => {
        e.stopPropagation()
        handleRefresh()
      }}
      className="p-1 hover:bg-gray-100 rounded transition-colors"
    >
      <RefreshCw className="h-3 w-3" />
    </button>

    <ChevronDown
      className={clsx(
        'h-4 w-4 text-gray-500 transition-transform duration-200',
        isOpen && 'rotate-180'
      )}
    />
  </div>
</button>
```

#### **Dropdown Panel**

```tsx
import { Check } from 'lucide-react'

<AnimatePresence>
  {isOpen && (
    <motion.div
      ref={refs.setFloating}
      style={floatingStyles}
      initial={{ opacity: 0, scale: 0.95, y: -10 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95, y: -10 }}
      transition={{ duration: 0.15 }}
      className="z-50 overflow-hidden rounded-lg border bg-white shadow-lg"
    >
      <div className="max-h-80 overflow-y-auto">
        {options.length === 0 ? (
          <div className="px-3 py-8 text-center text-sm text-gray-500">
            No options available
          </div>
        ) : (
          options.map((option) => (
            <button
              key={option.id}
              onClick={() => handleSelect(option)}
              className={clsx(
                'w-full flex items-center gap-3 px-3 py-2.5 text-left text-sm',
                'hover:bg-gray-50 transition-colors',
                option.id === currentSelection?.id && 'bg-blue-50 text-blue-600'
              )}
            >
              <Avatar option={option} size="sm" />
              <StatusDot isActive={option.isActive} size="sm" />

              <div className="flex-1 min-w-0">
                <div className="truncate font-medium">{option.name}</div>
              </div>

              {option.badge && (
                <span className="text-xs text-gray-500 px-1.5 py-0.5 bg-gray-100 rounded">
                  {option.badge.label}
                </span>
              )}

              {option.id === currentSelection?.id && (
                <Check className="h-4 w-4 text-blue-600 flex-shrink-0" />
              )}
            </button>
          ))
        )}
      </div>
    </motion.div>
  )}
</AnimatePresence>
```

### Keyboard Navigation

Add this to the trigger button:

```tsx
const handleKeyDown = (e) => {
  switch (e.key) {
    case 'Enter':
    case ' ':
      e.preventDefault()
      if (!isOpen) {
        setIsOpen(true)
      } else if (focusedIndex >= 0) {
        handleSelect(options[focusedIndex])
      }
      break

    case 'Escape':
      e.preventDefault()
      setIsOpen(false)
      break

    case 'ArrowDown':
      e.preventDefault()
      if (!isOpen) {
        setIsOpen(true)
      } else {
        setFocusedIndex((focusedIndex + 1) % options.length)
      }
      break

    case 'ArrowUp':
      e.preventDefault()
      if (isOpen) {
        setFocusedIndex((focusedIndex - 1 + options.length) % options.length)
      }
      break
  }
}

// Add to trigger button
<button onKeyDown={handleKeyDown} ... >
```

### Click Outside to Close

```tsx
useEffect(() => {
  const handleClickOutside = (event) => {
    if (
      isOpen &&
      triggerRef.current &&
      dropdownRef.current &&
      !triggerRef.current.contains(event.target) &&
      !dropdownRef.current.contains(event.target)
    ) {
      setIsOpen(false)
    }
  }

  document.addEventListener('mousedown', handleClickOutside)
  return () => document.removeEventListener('mousedown', handleClickOutside)
}, [isOpen])
```

---

## Component 2: Navigation Category Dropdowns

This is a simpler hover-based dropdown system for navigation menus.

### Data Structure

```typescript
interface MenuItem {
  id: string
  label: string
  icon: React.ComponentType  // Icon component from lucide-react
  description?: string
}

interface MenuCategory {
  label: string
  icon: React.ComponentType
  items: MenuItem[]
}

const categories = [
  {
    label: 'Export Data',
    icon: DatabaseIcon,
    items: [
      { id: 'issues', label: 'Issues', icon: AlertCircleIcon, description: 'Export issue data' },
      { id: 'workflows', label: 'Workflows', icon: WorkflowIcon, description: 'Export workflows' }
    ]
  },
  {
    label: 'Tools',
    icon: ServerIcon,
    items: [
      { id: 'logs', label: 'Logs', icon: DatabaseIcon, description: 'View system logs' }
    ]
  }
]
```

### Component Code

```tsx
import { ChevronDownIcon } from 'lucide-react'
import { useState } from 'react'

const NavigationDropdowns = ({ categories, onNavigate }) => {
  const [openDropdown, setOpenDropdown] = useState(null)

  return (
    <div className="flex items-center space-x-4">
      {categories.map(category => {
        const CategoryIcon = category.icon
        const hasItems = category.items.length > 0
        const isOpen = openDropdown === category.label

        return (
          <div
            key={category.label}
            className="relative group"
            onMouseEnter={() => hasItems && setOpenDropdown(category.label)}
            onMouseLeave={(e) => {
              const relatedTarget = e.relatedTarget
              if (!relatedTarget || !e.currentTarget.contains(relatedTarget)) {
                setOpenDropdown(null)
              }
            }}
          >
            {/* Category Button */}
            <button
              className={clsx(
                'flex items-center gap-1.5 px-2 py-1 text-sm font-medium transition-colors rounded-md',
                hasItems
                  ? 'text-gray-700 hover:text-gray-900 hover:bg-gray-100'
                  : 'cursor-default text-gray-400'
              )}
              disabled={!hasItems}
            >
              <CategoryIcon className="h-4 w-4" />
              {category.label}
              {hasItems && <ChevronDownIcon className="h-3 w-3" />}
            </button>

            {/* Dropdown Panel */}
            {hasItems && isOpen && (
              <div
                className="absolute left-0 top-full z-50 pt-1"
                onMouseEnter={() => setOpenDropdown(category.label)}
                onMouseLeave={() => setOpenDropdown(null)}
              >
                <div className="w-56 rounded-lg border border-gray-200 bg-white shadow-lg">
                  {category.items.map(item => {
                    const ItemIcon = item.icon
                    return (
                      <button
                        key={item.id}
                        onClick={() => {
                          onNavigate(item.id)
                          setOpenDropdown(null)
                        }}
                        className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm hover:bg-gray-50"
                      >
                        <ItemIcon className="h-4 w-4 text-gray-500" />
                        <div className="font-medium text-gray-900">{item.label}</div>
                      </button>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
```

### Usage

```tsx
const handleNavigation = (itemId) => {
  console.log('Navigate to:', itemId)
  // Your navigation logic here
}

<NavigationDropdowns
  categories={categories}
  onNavigate={handleNavigation}
/>
```

---

## Styling Requirements

### Tailwind CSS Configuration

If using Tailwind, ensure your `tailwind.config.js` includes:

```js
module.exports = {
  content: ['./src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Custom colors used in components
        'planhat-blue': '#0066cc',  // Or your brand color
      }
    }
  }
}
```

### Key Tailwind Classes Used

**Spacing & Layout:**
- `px-3`, `py-2` - Padding
- `gap-2`, `gap-3` - Gap between flex items
- `h-8`, `h-9`, `h-10` - Heights
- `w-full`, `min-w-0` - Widths

**Colors:**
- `bg-white`, `bg-gray-50`, `bg-gray-100` - Backgrounds
- `text-gray-700`, `text-gray-900` - Text colors
- `border-gray-200` - Borders
- `bg-green-500`, `bg-blue-600` - Status colors

**Effects:**
- `rounded-lg`, `rounded-md` - Border radius
- `shadow-lg` - Box shadow
- `hover:bg-gray-50` - Hover states
- `transition-colors`, `duration-200` - Smooth transitions

**Utilities:**
- `flex`, `items-center`, `justify-between` - Flexbox
- `truncate` - Text overflow ellipsis
- `flex-shrink-0` - Prevent shrinking

### If Not Using Tailwind

Convert classes to regular CSS:

```css
.dropdown-trigger {
  display: inline-flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.5rem 0.75rem;
  border-radius: 0.5rem;
  border: 1px solid #e5e7eb;
  background: white;
  transition: background-color 200ms;
}

.dropdown-trigger:hover {
  background: #f9fafb;
}

.status-dot {
  width: 0.625rem;
  height: 0.625rem;
  border-radius: 9999px;
  flex-shrink: 0;
}

.status-dot.active {
  background-color: #10b981;
  box-shadow: 0 0 0 2px rgba(16, 185, 129, 0.2);
}

.status-dot.inactive {
  background-color: #9ca3af;
}
```

---

## Integration Checklist

### Step 1: Install Dependencies

```bash
npm install @floating-ui/react framer-motion lucide-react clsx
```

If not using Tailwind:
```bash
npm install tailwindcss
npx tailwindcss init
```

### Step 2: Copy Component Files

Create these files in your project:

1. **components/AdvancedDropdown.tsx** - Copy the TenantSelector component structure
2. **components/NavigationDropdowns.tsx** - Copy the navigation dropdown code
3. **components/StatusDot.tsx** - Copy the status dot component
4. **components/Avatar.tsx** - Copy the avatar component

### Step 3: Customize for Your Data

Replace the placeholder data structure with your actual data:

```typescript
// Instead of "tenant", use your domain concept (e.g., "workspace", "organization", "project")
interface YourOption {
  id: string
  name: string
  isActive: boolean
  logo?: string
  // ... your custom fields
}
```

### Step 4: Wire Up Your Logic

Remove references to:
- Tenant-specific stores (useTenantStore, useAuthStore)
- Planhat API calls
- Chrome extension storage

Replace with:
- Your state management (Redux, Context, Zustand, etc.)
- Your API calls
- Your storage solution

### Step 5: Test Interactions

- [ ] Click trigger opens/closes dropdown
- [ ] Click outside closes dropdown
- [ ] Keyboard navigation works (arrows, enter, escape)
- [ ] Hover on navigation categories opens dropdown
- [ ] Dropdown positions correctly near screen edges
- [ ] Animations are smooth
- [ ] Loading states display correctly
- [ ] Error states display correctly

---

## Files to Reference

In the PH-Tools codebase:

1. **src/shared/components/TenantSelector.tsx** - Full TenantSelector component (570 lines)
2. **src/extension-page/App.tsx** - Lines 246-307 for navigation dropdowns
3. **src/shared/hooks/useTenantSelector.ts** - Data structure and state management patterns

---

## Questions?

This guide covers the UI/UX components without any Planhat-specific business logic. You have:

- ✅ Visual component structures
- ✅ Animation setup
- ✅ Positioning logic
- ✅ Keyboard navigation
- ✅ Styling patterns
- ✅ Integration steps

Everything is ready to copy into a new application with your own data and business logic!
