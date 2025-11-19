import { Tooltip } from 'antd'
import { type ReactNode, useRef, useEffect, useState } from 'react'

interface TruncatedCellProps {
  children: ReactNode
  maxLines?: number
}

/**
 * TruncatedCell - Displays text with line clamping and tooltip on hover
 *
 * Features:
 * - Limits text to specified number of lines (default: 2)
 * - Shows ellipsis (...) when text is truncated
 * - Displays full text in tooltip on hover (only if truncated)
 * - Works with any content type (strings, numbers, React nodes)
 */
export function TruncatedCell({ children, maxLines = 2 }: TruncatedCellProps) {
  const textRef = useRef<HTMLDivElement>(null)
  const [isTruncated, setIsTruncated] = useState(false)

  useEffect(() => {
    const element = textRef.current
    if (!element) return

    // Check if content is truncated by comparing scroll height to client height
    const checkTruncation = () => {
      setIsTruncated(element.scrollHeight > element.clientHeight)
    }

    checkTruncation()

    // Re-check on window resize
    const resizeObserver = new ResizeObserver(checkTruncation)
    resizeObserver.observe(element)

    return () => {
      resizeObserver.disconnect()
    }
  }, [children])

  const content = (
    <div
      ref={textRef}
      className="overflow-hidden"
      style={{
        display: '-webkit-box',
        WebkitLineClamp: maxLines,
        WebkitBoxOrient: 'vertical',
        wordBreak: 'break-word'
      }}
    >
      {children}
    </div>
  )

  // Only show tooltip if content is actually truncated
  if (!isTruncated) {
    return content
  }

  // Convert children to string for tooltip (handle React nodes, numbers, etc.)
  const tooltipContent = typeof children === 'string' || typeof children === 'number'
    ? children
    : String(children)

  return (
    <Tooltip title={tooltipContent} placement="topLeft">
      {content}
    </Tooltip>
  )
}
