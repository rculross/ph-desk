# Tool Header Architecture Guide

## Overview

The Tool Header architecture provides enterprise-grade, type-safe UI components for consistent header patterns across all Planhat Tools extension apps. This architecture emphasizes maintainability, accessibility, and developer experience.

## Core Components

### ToolHeader
Main container component with consistent styling and layout.

**Features:**
- Responsive flex layout with proper wrapping
- Accessibility with ARIA attributes
- Error boundary integration
- Focus management
- Optional subtitles

**Usage:**
```tsx
import { ToolHeader } from '../../shared/components/ui'
import { DatabaseIcon } from 'lucide-react'

<ToolHeader
  title="Data Exporter"
  icon={DatabaseIcon}
  subtitle="Export data in multiple formats"
>
  {/* Controls go here */}
</ToolHeader>
```

### ToolHeaderButton
Standardized button component with consistent styling and behavior.

**Features:**
- Control category semantic grouping
- Automatic accessibility attributes
- Badge support
- Multiple style variants (default, compact)
- Error states

**Usage:**
```tsx
<ToolHeaderButton
  category={CONTROL_CATEGORIES.EXPORT}
  variant="primary"
  icon={<DownloadIcon />}
  onClick={handleExport}
  loading={isExporting}
  badge={selectedCount}
>
  Export
</ToolHeaderButton>
```

### ToolHeaderControls
Wrapper component for grouped controls with semantic meaning.

**Features:**
- Semantic grouping with ARIA labels
- Consistent spacing (compact, normal, wide)
- Category-based theming
- Accessibility structure

**Usage:**
```tsx
<ToolHeaderControls
  category={CONTROL_CATEGORIES.DATA}
  spacing="normal"
  label="Data filters"
>
  <Button>Filter</Button>
  <Select options={filterOptions} />
</ToolHeaderControls>
```

## Type System

### Control Categories
Semantic categories for UI organization:

- **OUTPUT**: Field selectors, refresh actions
- **DATA**: Filters, limits, endpoints
- **EXPORT**: Format selection, export actions
- **FILTER**: Filter toggles and controls

### Button Variants
Consistent styling variants:

- **PRIMARY**: Main actions (save, execute, export)
- **SECONDARY**: Secondary actions (cancel, reset)
- **GHOST**: Subtle actions (toggle, auxiliary)

### Style Variants
Width and sizing options:

- **default**: 150px minimum width
- **compact**: 100px minimum width

## Custom Hooks

### useToggleControl
Manages toggle state with optimized re-renders.

```tsx
const { isActive, toggle, buttonProps } = useToggleControl(false, onChange)
```

### useLoadingControl
Handles loading states with accessibility.

```tsx
const { isLoading, startLoading, stopLoading, buttonProps } = useLoadingControl()
```

### useBadgeControl
Manages badge display with count formatting.

```tsx
const { badge, count, buttonProps } = useBadgeControl(selectedItems)
```

### useFormatControl
Type-safe format selection for exports.

```tsx
const { selectedFormat, radioGroupProps } = useFormatControl('csv', formats)
```

## Best Practices

### 1. Consistent Imports
Use centralized barrel exports:
```tsx
import {
  ToolHeader,
  ToolHeaderButton,
  ToolHeaderControls
} from '../../shared/components/ui'
```

### 2. Error Boundaries
Wrap headers in error boundaries for graceful degradation:
```tsx
<ToolHeaderErrorBoundary>
  <ToolHeader title="My Tool" icon={Icon}>
    {/* Controls */}
  </ToolHeader>
</ToolHeaderErrorBoundary>
```

### 3. Accessibility
- Use semantic categories for screen readers
- Provide meaningful ARIA labels
- Ensure keyboard navigation support
- Test with screen readers

### 4. Performance
- Use custom hooks for state management
- Memoize expensive computations
- Avoid inline object creation in props

### 5. Type Safety
- Use provided TypeScript interfaces
- Leverage union types for variants
- Utilize generic hooks where appropriate

## Migration Guide

### From Legacy Headers
1. Replace custom header divs with `ToolHeader`
2. Wrap button groups in `ToolHeaderControls`
3. Convert buttons to `ToolHeaderButton`
4. Add proper control categories
5. Implement error boundaries

### Example Migration
**Before:**
```tsx
<div className="header-container">
  <h2>Export Tool</h2>
  <div className="controls">
    <button onClick={export}>Export</button>
  </div>
</div>
```

**After:**
```tsx
<ToolHeaderErrorBoundary>
  <ToolHeader title="Export Tool" icon={ExportIcon}>
    <ToolHeaderControls category={CONTROL_CATEGORIES.EXPORT}>
      <ToolHeaderButton
        category={CONTROL_CATEGORIES.EXPORT}
        variant="primary"
        onClick={export}
      >
        Export
      </ToolHeaderButton>
    </ToolHeaderControls>
  </ToolHeader>
</ToolHeaderErrorBoundary>
```

## Architecture Benefits

### For Developers
- **Type Safety**: Comprehensive TypeScript support
- **Consistency**: Standardized patterns across tools
- **Productivity**: Reusable hooks and components
- **Maintainability**: Single source of truth for styling

### For Users
- **Accessibility**: WCAG 2.1 AA compliance
- **Performance**: Optimized re-renders and memory usage
- **Reliability**: Error boundaries prevent UI crashes
- **Familiarity**: Consistent UX patterns

### For the Codebase
- **Scalability**: Easy to extend and modify
- **Testing**: Isolated, testable components
- **Documentation**: Self-documenting through types
- **Bundle Size**: Tree-shaking friendly exports