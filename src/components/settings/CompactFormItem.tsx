import { ReactNode } from 'react'
import { InfoTooltip } from './InfoTooltip'

interface CompactFormItemProps {
  label?: string
  tooltip?: string
  children: ReactNode
  layout?: 'vertical' | 'horizontal'
  className?: string
}

export function CompactFormItem({
  label,
  tooltip,
  children,
  layout = 'vertical',
  className = '',
}: CompactFormItemProps) {
  if (layout === 'horizontal') {
    return (
      <div className={`flex items-center gap-4 mb-3 ${className}`}>
        <div className="flex items-center">
          {label && (
            <span className="text-sm font-medium text-gray-700">
              {label}
              {tooltip && <InfoTooltip text={tooltip} />}
            </span>
          )}
        </div>
        <div>{children}</div>
      </div>
    )
  }

  return (
    <div className={`mb-3 ${className}`}>
      {label && (
        <div className="mb-1.5 flex items-center">
          <span className="text-sm font-medium text-gray-700">
            {label}
            {tooltip && <InfoTooltip text={tooltip} />}
          </span>
        </div>
      )}
      <div>{children}</div>
    </div>
  )
}
