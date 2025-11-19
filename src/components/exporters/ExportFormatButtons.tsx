import { Button, Space } from 'antd'
import type { ButtonProps } from 'antd'

import { EXPORT_FORMAT_OPTIONS, type ExportFormat } from '../../types/ui'

export interface ExportFormatButtonsProps {
  onSelect: (format: ExportFormat) => void
  selectedFormat?: ExportFormat
  disabled?: boolean
  loading?: boolean
  size?: ButtonProps['size']
  className?: string
}

export function ExportFormatButtons({
  onSelect,
  selectedFormat,
  disabled = false,
  loading = false,
  size = 'small',
  className
}: ExportFormatButtonsProps) {
  return (
    <Space.Compact className={className}>
      {EXPORT_FORMAT_OPTIONS.map(option => {
        const isSelected = selectedFormat === option.value

        return (
          <Button
            key={option.value}
            size={size}
            type={isSelected ? 'primary' : 'default'}
            onClick={() => onSelect(option.value)}
            disabled={disabled}
            loading={loading && isSelected}
            title={option.description}
          >
            {option.label}
          </Button>
        )
      })}
    </Space.Compact>
  )
}

ExportFormatButtons.displayName = 'ExportFormatButtons'
