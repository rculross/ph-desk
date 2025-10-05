/**
 * UI Component Library Export Index for Planhat Extension
 *
 * Central export file for all production-ready UI components.
 * Provides a clean, organized API for importing components throughout the application.
 */

// Modal Components
export { Modal } from './Modal'

// Button Components
export { Button } from './Button'

// Input Components
export { Input } from './Input'

// Select Components
export { Select } from './Select'

// Form Components
export { Form } from './Form'

// Loading Components
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
  PulsingDot,
  type SpinnerProps,
  type LoadingDotsProps,
  type ProgressBarProps,
  type LoadingOverlayProps,
  type SkeletonProps,
  type SkeletonTextProps,
  type SkeletonCardProps,
  type SkeletonTableProps,
  type SkeletonAvatarProps,
  type LoadingButtonContentProps,
  type PulsingDotProps
} from './Loading'

// Table Components (TanStack Table integration)
export {
  Table,
  type TableProps
} from './Table'

export {
  DataTable,
  type DataTableProps
} from './DataTable'

export {
  TableToolbar,
  type TableToolbarProps
} from './TableToolbar'

export {
  useTableCore,
  type UseTableCoreOptions,
  type UseTableCoreResult
} from '../../hooks/useTableCore'

// Tool Header Components (Simplified for pure Ant Design usage)
export {
  ToolHeader,
  ToolHeaderButton,
  type ToolHeaderProps,
  type ToolHeaderButtonProps
} from './ToolHeader'

// Multi-Sheet Export Components
export {
  MultiSheetExporter,
  type MultiSheetExporterProps
} from './MultiSheetExporter'

// Fields Dropdown Components (Centralized field management)
export {
  FieldsDropdown,
  FieldsDropdownWrapper,
  useFieldsDropdown,
  type FieldsDropdownProps,
  type FieldsDropdownWrapperProps,
  type CategorizedFields,
  type UseFieldsDropdownOptions,
  type UseFieldsDropdownResult
} from './FieldsDropdown'

// Order Columns Modal Components
export {
  OrderColumnsModal,
  useColumnReordering,
  type OrderColumnsModalProps,
  type ColumnDefinition
} from './OrderColumnsModal'

// Component Categories for organized imports
export * as ModalComponents from './Modal'
export * as ButtonComponents from './Button'
export * as InputComponents from './Input'
export * as SelectComponents from './Select'
export * as FormComponents from './Form'
export * as LoadingComponents from './Loading'
export * as TableComponents from './Table'
export * as ToolHeaderComponents from './ToolHeader'
