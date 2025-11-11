import { Tooltip } from 'antd'
import { InfoCircleOutlined } from '@ant-design/icons'

interface InfoTooltipProps {
  text: string
  className?: string
}

export function InfoTooltip({ text, className = '' }: InfoTooltipProps) {
  return (
    <Tooltip title={text} placement="top">
      <InfoCircleOutlined
        className={`ml-1 text-gray-400 hover:text-gray-600 cursor-help transition-colors ${className}`}
        style={{ fontSize: '14px' }}
      />
    </Tooltip>
  )
}
