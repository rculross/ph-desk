import React, { useCallback, useLayoutEffect, useRef, useState } from 'react'

import {
  flexRender,
  type Header,
  type HeaderGroup,
  type Row,
  type Table as TanStackTable
} from '@tanstack/react-table'
import { useVirtualizer, type Virtualizer } from '@tanstack/react-virtual'
import { ConfigProvider, Empty, Spin } from 'antd'
import { clsx } from 'clsx'


import { logger } from '../../utils/logger'

// Enhanced virtualizer interfaces to handle measurement methods
interface EnhancedVirtualizer {
  measureElement?: (element: Element | null) => void
  measureItems?: () => void
  measure?: () => void
}


import {
  ColumnHeaderLabel,
  useColumnDrag
} from './table-utils'

export interface DataTableProps<TData> {
  table: TanStackTable<TData>
  loading?: boolean
  height?: number
  stickyHeader?: boolean
  className?: string
  emptyMessage?: string
  enableColumnResizing?: boolean
  enableColumnDragging?: boolean
  onColumnReorder?: (fromIndex: number, toIndex: number) => void
  debugResize?: boolean
  enableRowVirtualization?: boolean
  rowHeight?: number
  rowOverscan?: number
  enableColumnVirtualization?: boolean
  columnOverscan?: number
}


export function DataTable<TData>({
  table,
  loading = false,
  height = 600,
  stickyHeader = true,
  className,
  emptyMessage = 'No data available',
  enableColumnResizing = false,
  enableColumnDragging = false,
  onColumnReorder,
  debugResize = false,
  enableRowVirtualization = false,
  rowHeight = 48,
  rowOverscan = 10,
  enableColumnVirtualization = false,
  columnOverscan = 5
}: DataTableProps<TData>) {
  const scrollContainerRef = useRef<HTMLDivElement | null>(null)
  const headerGroupRef = useRef<HTMLDivElement | null>(null)

  const [headerMetrics, setHeaderMetrics] = useState({ top: 0, height: 0 })

  const rows = table.getRowModel().rows
  const columns = table.getAllLeafColumns()

  const tableState = table.getState()
  const columnSizingInfo = tableState.columnSizingInfo
  const columnSizing = tableState.columnSizing

  const {
    draggedColumnId,
    dragOverColumnId,
    dropPosition,
    handleColumnDragStart,
    handleColumnDragEnter,
    handleColumnDragOver,
    handleColumnDragLeave,
    handleColumnDrop,
    handleColumnDragEnd
  } = useColumnDrag({
    table,
    enableColumnDragging,
    onColumnReorder
  })

  const shouldVirtualizeRows = enableRowVirtualization && rows.length > 0
  const shouldVirtualizeColumns = enableColumnVirtualization && columns.length > 0

  const rowVirtualizer = useVirtualizer({
    count: shouldVirtualizeRows ? rows.length : 0,
    getScrollElement: () => scrollContainerRef.current,
    estimateSize: () => rowHeight,
    overscan: rowOverscan,
    enabled: shouldVirtualizeRows
  })

  const virtualRows = shouldVirtualizeRows ? rowVirtualizer.getVirtualItems() : []
  const totalVirtualRowSize = shouldVirtualizeRows ? rowVirtualizer.getTotalSize() : 0
  const paddingTop = shouldVirtualizeRows && virtualRows.length > 0 ? virtualRows[0]?.start ?? 0 : 0
  const paddingBottom = shouldVirtualizeRows && virtualRows.length > 0
    ? totalVirtualRowSize - (virtualRows[virtualRows.length - 1]?.end ?? 0)
    : 0

  const columnVirtualizer = useVirtualizer({
    count: shouldVirtualizeColumns ? columns.length : 0,
    getScrollElement: () => scrollContainerRef.current,
    estimateSize: (index) => columns[index]?.getSize() ?? 150,
    horizontal: true,
    overscan: columnOverscan,
    enabled: shouldVirtualizeColumns
  })

  const virtualColumns = shouldVirtualizeColumns ? columnVirtualizer.getVirtualItems() : []
  const totalColumnSize = shouldVirtualizeColumns ? columnVirtualizer.getTotalSize() : table.getTotalSize()

  const columnHeaderElementsRef = useRef<Map<number, HTMLDivElement>>(new Map())
  const headerMeasurementCallbacksRef = useRef<
    Map<number, (node: HTMLDivElement | null) => void>
  >(new Map())
  const bodyMeasurementCallbacksRef = useRef<
    Map<number, (node: HTMLDivElement | null) => void>
  >(new Map())
  const columnVirtualizerRef = useRef<EnhancedVirtualizer>(columnVirtualizer as unknown as EnhancedVirtualizer)
  const shouldVirtualizeColumnsRef = useRef(shouldVirtualizeColumns)

  useLayoutEffect(() => {
    columnVirtualizerRef.current = columnVirtualizer as unknown as EnhancedVirtualizer
  }, [columnVirtualizer])

  useLayoutEffect(() => {
    shouldVirtualizeColumnsRef.current = shouldVirtualizeColumns
    if (!shouldVirtualizeColumns) {
      columnHeaderElementsRef.current.clear()
      headerMeasurementCallbacksRef.current.clear()
      bodyMeasurementCallbacksRef.current.clear()
    }
  }, [shouldVirtualizeColumns])

  const getHeaderMeasurementRef = useCallback(
    (index: number) => {
      if (!headerMeasurementCallbacksRef.current.has(index)) {
        headerMeasurementCallbacksRef.current.set(index, (node: HTMLDivElement | null) => {
          if (!shouldVirtualizeColumnsRef.current) {
            return
          }

          const measureElement = columnVirtualizerRef.current.measureElement

          if (node) {
            columnHeaderElementsRef.current.set(index, node)
            measureElement?.(node)
          } else {
            columnHeaderElementsRef.current.delete(index)
          }
        })
      }

      return headerMeasurementCallbacksRef.current.get(index)!
    },
    []
  )

  const getBodyMeasurementRef = useCallback(
    (index: number) => {
      if (!bodyMeasurementCallbacksRef.current.has(index)) {
        bodyMeasurementCallbacksRef.current.set(index, (node: HTMLDivElement | null) => {
          if (!shouldVirtualizeColumnsRef.current || !node) {
            return
          }

          const measureElement = columnVirtualizerRef.current.measureElement

          measureElement?.(node)
        })
      }

      return bodyMeasurementCallbacksRef.current.get(index)!
    },
    []
  )

  const measureColumnVirtualizer = useCallback(() => {
    if (!shouldVirtualizeColumnsRef.current) {
      return
    }

    const measureElement = columnVirtualizerRef.current.measureElement

    columnHeaderElementsRef.current.forEach(node => {
      measureElement?.(node)
    })

    if (typeof columnVirtualizerRef.current.measure === 'function') {
      columnVirtualizerRef.current.measure()
      return
    }

    const measureItems = columnVirtualizerRef.current.measureItems
    if (typeof measureItems === 'function') {
      measureItems()
    }
  }, [])

  useLayoutEffect(() => {
    if (columnSizingInfo.isResizingColumn) {
      measureColumnVirtualizer()
    }
  }, [columnSizing, columnSizingInfo])

  useLayoutEffect(() => {
    if (!shouldVirtualizeColumns) {
      return
    }

    measureColumnVirtualizer()
  }, [shouldVirtualizeColumns])

  const baseResizeOffset = (columnSizingInfo.startOffset ?? 0) + (columnSizingInfo.deltaOffset ?? 0)
  const containerRect = scrollContainerRef.current?.getBoundingClientRect()
  const containerLeft = containerRect?.left ?? 0
  const containerScrollLeft = scrollContainerRef.current?.scrollLeft ?? 0
  const resizeIndicatorLeft = scrollContainerRef.current
    ? baseResizeOffset - containerLeft + containerScrollLeft
    : baseResizeOffset

  useLayoutEffect(() => {
    if (!enableColumnResizing || !columnSizingInfo.isResizingColumn) {
      setHeaderMetrics({ top: 0, height: 0 })
      return
    }

    const updateHeaderMetrics = () => {
      if (!scrollContainerRef.current || !headerGroupRef.current) {
        return
      }

      const containerBounds = scrollContainerRef.current.getBoundingClientRect()
      const headerBounds = headerGroupRef.current.getBoundingClientRect()

      setHeaderMetrics({
        top: headerBounds.top - containerBounds.top,
        height: headerBounds.height
      })
    }

    updateHeaderMetrics()

    const containerEl = scrollContainerRef.current
    const handleScroll = () => updateHeaderMetrics()
    const handleResize = () => updateHeaderMetrics()

    containerEl?.addEventListener('scroll', handleScroll)
    window.addEventListener('resize', handleResize)

    return () => {
      containerEl?.removeEventListener('scroll', handleScroll)
      window.removeEventListener('resize', handleResize)
    }
  }, [
    enableColumnResizing,
    columnSizingInfo.isResizingColumn,
    columnSizingInfo.startOffset ?? 0,
    columnSizingInfo.deltaOffset ?? 0
  ])

  const createResizeHandler = useCallback(
    (header: Header<TData, unknown>) => {
      return (event: React.MouseEvent<HTMLDivElement> | React.TouchEvent<HTMLDivElement>) => {
        if (debugResize) {
          logger.content.debug('🎯 RESIZE EVENT START', {
            columnId: header.column.id,
            headerId: header.id,
            eventType: event.type,
            currentSize: header.column.getSize(),
            canResize: header.column.getCanResize(),
            columnSizingInfo: table.getState().columnSizingInfo,
            columnSizing: table.getState().columnSizing,
            timestamp: Date.now()
          })
        }

        const originalHandler = header.getResizeHandler()
        if (originalHandler) {
          event.preventDefault()
          event.stopPropagation()
          originalHandler(event)

          setTimeout(() => {
            if (debugResize) {
              logger.content.debug('🎯 RESIZE HANDLER CALLED (after state update)', {
                columnId: header.column.id,
                newColumnSizingInfo: table.getState().columnSizingInfo,
                newColumnSizing: table.getState().columnSizing,
                newSize: header.column.getSize(),
                resizeMode: 'onChange',
                containerLeft: scrollContainerRef.current?.getBoundingClientRect().left ?? null,
                containerScrollLeft: scrollContainerRef.current?.scrollLeft ?? null,
                indicatorLeft:
                  ((table.getState().columnSizingInfo.startOffset ?? 0) +
                    (table.getState().columnSizingInfo.deltaOffset ?? 0)) -
                  (scrollContainerRef.current?.getBoundingClientRect().left ?? 0) +
                  (scrollContainerRef.current?.scrollLeft ?? 0)
              })
            }

            measureColumnVirtualizer()
          }, 0)
        } else {
          logger.content.error('No resize handler available', { columnId: header.column.id })
        }
      }
    }
  , [debugResize])

  const renderHeaderDragIndicators = useCallback(
    (headerId: string, _headerGroup: HeaderGroup<TData>) => {
      if (!enableColumnDragging || !draggedColumnId) {
        return null
      }

      // Show indicator on the dragged column itself (always on right border initially)
      if (draggedColumnId === headerId && !dragOverColumnId) {
        return (
          <div
            className="pointer-events-none absolute top-0 right-0 h-full w-[6px] translate-x-1/2 bg-blue-600 shadow-lg border border-blue-700 transition-all duration-200"
            style={{ zIndex: 15 }}
          />
        )
      }

      // Show indicator on the column being dragged over (with position)
      if (dragOverColumnId === headerId && dropPosition) {
        return (
          <>
            <div
              className={clsx(
                'pointer-events-none absolute top-0 left-0 h-full w-px bg-gray-300 transition-all duration-200',
                dropPosition === 'left' &&
                  'w-[6px] -translate-x-1/2 bg-blue-600 shadow-lg border border-blue-700'
              )}
              style={{ zIndex: 15 }}
            />
            <div
              className={clsx(
                'pointer-events-none absolute top-0 right-0 h-full w-px bg-gray-300 transition-all duration-200',
                dropPosition === 'right' && 'w-[6px] translate-x-1/2 bg-blue-600 shadow-lg border border-blue-700'
              )}
              style={{ zIndex: 15 }}
            />
          </>
        )
      }

      return null
    },
    [dragOverColumnId, dropPosition, draggedColumnId, enableColumnDragging]
  )

  const renderHeaderInner = useCallback(
    (header: Header<TData, unknown>) => {
      if (enableColumnDragging && header.id !== 'select') {
        const overlayRight = enableColumnResizing && header.column.getCanResize() ? '18px' : '6px'

        return (
          <div
            data-testid={`column-drag-overlay-${header.id}`}
            className="absolute inset-y-0 left-0 flex cursor-move"
            style={{
              right: overlayRight,
              pointerEvents: 'auto',
              zIndex: 30
            }}
            draggable
            onDragStart={event => {
              const target = event.target as HTMLElement | null
              if (target?.closest('[data-no-column-drag]')) {
                event.preventDefault()
                return
              }
              handleColumnDragStart(event, header.id)
            }}
            onDragEnter={event => handleColumnDragEnter(event, header.id)}
            onDragOver={event => handleColumnDragOver(event, header.id)}
            onDragLeave={handleColumnDragLeave}
            onDrop={event => handleColumnDrop(event, header.id)}
            onDragEnd={handleColumnDragEnd}
          >
            <div className="relative z-20 flex h-full w-full items-center px-4">
              <ColumnHeaderLabel header={header} />
            </div>
          </div>
        )
      }

      return (
        <div className="relative z-20 flex items-center px-4">
          <ColumnHeaderLabel header={header} />
        </div>
      )
    },
    [
      enableColumnDragging,
      enableColumnResizing,
      handleColumnDragEnd,
      handleColumnDragEnter,
      handleColumnDragLeave,
      handleColumnDragOver,
      handleColumnDragStart,
      handleColumnDrop
    ]
  )

  const renderResizeHandle = useCallback(
    (header: Header<TData, unknown>) => {
      if (!(enableColumnResizing && header.column.getCanResize())) {
        return null
      }

      return (
        <div
          onDoubleClick={() => {
            if (debugResize) {
              logger.content.debug('🎯 RESIZE DOUBLE CLICK', {
                columnId: header.column.id,
                oldSize: header.column.getSize()
              })
            }
            header.column.resetSize()
            setTimeout(() => {
              measureColumnVirtualizer()
            }, 0)
          }}
          onMouseDown={createResizeHandler(header)}
          onTouchStart={createResizeHandler(header)}
          className={clsx(
            'absolute top-0 right-0 h-full w-3 select-none touch-none cursor-col-resize',
            'transform translate-x-1/2',
            'opacity-0 group-hover:opacity-50 hover:bg-blue-500 hover:opacity-100',
            header.column.getIsResizing() && 'bg-blue-500 opacity-100'
          )}
          style={{
            zIndex: 40,
            touchAction: 'none'
          }}
          data-testid={`column-resize-handle-${header.id}`}
          title="Drag to resize column (double-click to reset)"
        >
          <div className="absolute top-0 left-1/2 h-full w-px -translate-x-1/2 bg-current" />
        </div>
      )
    },
    [createResizeHandler, debugResize, enableColumnResizing]
  )

  if (loading) {
    return (
      <div className={clsx('rounded-lg border border-gray-200 bg-white', className)}>
        <div className="p-8 text-center">
          <Spin size="large" />
          <div className="mt-4 text-gray-500">Loading data...</div>
        </div>
      </div>
    )
  }

  if (rows.length === 0) {
    return (
      <div className={clsx('rounded-lg border border-gray-200 bg-white', className)}>
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description={emptyMessage}
          className="py-8"
        />
      </div>
    )
  }

  return (
    <ConfigProvider
      theme={{
        components: {
          Table: {
            headerBg: '#fafafa',
            headerColor: '#262626',
            borderColor: '#e8e8e8'
          }
        }
      }}
    >
      <div className={clsx('overflow-hidden rounded-lg border border-gray-200 bg-white', className)}>
        <div
          className="relative overflow-auto"
          style={{ height: height === 0 ? 'auto' : height }}
          ref={scrollContainerRef}
        >
          {shouldVirtualizeColumns ? (
            <div
              className="relative"
              style={{
                width: `${totalColumnSize}px`,
                height: `${(shouldVirtualizeRows ? totalVirtualRowSize : rows.length * rowHeight) + 40}px`
              }}
            >
              <div
                className={clsx('bg-gray-50 border-b-2 border-gray-200', stickyHeader && 'sticky top-0 z-10')}
                style={{ height: '40px', width: `${totalColumnSize}px` }}
                ref={headerGroupRef}
              >
                {table.getHeaderGroups().map(headerGroup => (
                  <div key={headerGroup.id} className="relative h-full">
                    {virtualColumns.map(virtualColumn => {
                      const column = columns[virtualColumn.index]
                      const header = headerGroup.headers.find(h => h.column.id === column?.id)
                      if (!column || !header) {
                        return null
                      }

                      const columnSize = column.getSize()

                      return (
                        <div
                          key={header.id}
                          data-index={virtualColumn.index}
                          className={clsx(
                            'absolute top-0 flex h-full items-center border-r border-gray-300 bg-gray-50 text-left text-sm font-medium text-gray-700',
                            'group',
                            enableColumnResizing && 'select-none',
                            enableColumnDragging && draggedColumnId === header.id && 'opacity-50',
                            enableColumnDragging && dragOverColumnId === header.id && 'bg-blue-100 border-blue-300'
                          )}
                          ref={getHeaderMeasurementRef(virtualColumn.index)}
                          style={{
                            left: `${virtualColumn.start}px`,
                            width: `${columnSize}px`
                          }}
                        >
                          <div className="relative flex h-full w-full items-center">
                            {renderHeaderInner(header)}
                            {renderHeaderDragIndicators(header.id, headerGroup)}
                            {renderResizeHandle(header)}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                ))}
              </div>

              <div className="absolute" style={{ top: '40px', width: '100%' }}>
                {shouldVirtualizeRows ? (
                  <>
                    {paddingTop > 0 && <div style={{ height: `${paddingTop}px` }} />}
                    {virtualRows.map(virtualRow => {
                      const row = rows[virtualRow.index]
                      if (!row) {
                        return null
                      }

                      return (
                        <div
                          key={row.id}
                          data-index={virtualRow.index}
                          ref={rowVirtualizer.measureElement}
                          className="relative border-b border-gray-100 transition-colors hover:bg-gray-50"
                          style={{ height: `${rowHeight}px`, width: '100%' }}
                        >
                          {virtualColumns.map(virtualColumn => {
                            const column = columns[virtualColumn.index]
                            if (!column) {
                              return null
                            }

                            const cell = row.getAllCells().find(c => c.column.id === column.id)
                            if (!cell) {
                              return null
                            }

                            const columnSize = column.getSize()

                            return (
                              <div
                                key={cell.id}
                                data-index={virtualColumn.index}
                                className="absolute flex items-center border-r border-gray-200 px-4 py-2 text-sm text-gray-900 overflow-hidden"
                                ref={getBodyMeasurementRef(virtualColumn.index)}
                                style={{
                                  left: `${virtualColumn.start}px`,
                                  width: `${columnSize}px`,
                                  height: `${rowHeight}px`
                                }}
                              >
                                {flexRender(cell.column.columnDef.cell, cell.getContext())}
                              </div>
                            )
                          })}
                        </div>
                      )
                    })}
                    {paddingBottom > 0 && <div style={{ height: `${paddingBottom}px` }} />}
                  </>
                ) : (
                  rows.map(row => (
                    <div
                      key={row.id}
                      className="relative border-b border-gray-100 transition-colors hover:bg-gray-50"
                      style={{ height: `${rowHeight}px`, width: '100%' }}
                    >
                      {virtualColumns.map(virtualColumn => {
                        const column = columns[virtualColumn.index]
                        if (!column) {
                          return null
                        }

                        const cell = row.getAllCells().find(c => c.column.id === column.id)
                        if (!cell) {
                          return null
                        }

                        const columnSize = column.getSize()

                        return (
                          <div
                            key={cell.id}
                            data-index={virtualColumn.index}
                            className="absolute flex items-center border-r border-gray-200 px-4 py-2 text-sm text-gray-900"
                            ref={getBodyMeasurementRef(virtualColumn.index)}
                            style={{
                              left: `${virtualColumn.start}px`,
                              width: `${columnSize}px`,
                              height: `${rowHeight}px`
                            }}
                          >
                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                          </div>
                        )
                      })}
                    </div>
                  ))
                )}
              </div>
            </div>
          ) : (
            <div
              style={{
                width: `${totalColumnSize}px`
              }}
            >
              <div
                className={clsx('border-b bg-gray-50', stickyHeader && 'sticky top-0 z-10')}
                style={{ display: 'table-header-group' }}
                ref={headerGroupRef}
              >
                {table.getHeaderGroups().map(headerGroup => (
                  <div key={headerGroup.id} className="flex">
                    {headerGroup.headers.map(header => (
                      <div
                        key={header.id}
                        className={clsx(
                          'relative border-b border-gray-200 bg-gray-50 py-3 text-left text-sm font-medium text-gray-700 group',
                          enableColumnResizing && 'select-none',
                          enableColumnDragging && draggedColumnId === header.id && 'opacity-50',
                          enableColumnDragging && dragOverColumnId === header.id && 'bg-blue-100 border-blue-300',
                          headerGroup.headers[headerGroup.headers.length - 1]?.id !== header.id && 'border-r border-gray-300'
                        )}
                        style={{
                          width: `${header.getSize()}px`,
                          flex: `0 0 ${header.getSize()}px`
                        }}
                      >
                        <div className="relative flex h-full w-full items-center">
                          {renderHeaderInner(header)}
                          {renderHeaderDragIndicators(header.id, headerGroup)}
                          {renderResizeHandle(header)}
                        </div>
                      </div>
                    ))}
                  </div>
                ))}
              </div>

              <div className="divide-y divide-gray-200 bg-white" style={{ display: 'table-row-group' }}>
                {shouldVirtualizeRows ? (
                  <>
                    {paddingTop > 0 && (
                      <div style={{ height: `${paddingTop}px` }} />
                    )}
                    {virtualRows.map(virtualRow => {
                      const row = rows[virtualRow.index]
                      if (!row) {
                        return null
                      }

                      return (
                        <div
                          key={row.id}
                          data-index={virtualRow.index}
                          ref={rowVirtualizer.measureElement}
                          className="transition-colors hover:bg-gray-50"
                          style={{ display: 'table-row', height: `${rowHeight}px` }}
                        >
                          {row.getVisibleCells().map(cell => (
                            <div
                              key={cell.id}
                              className="border-b border-gray-100 px-4 py-3 text-sm text-gray-900 overflow-hidden"
                              style={{
                                display: 'table-cell',
                                width: `${cell.column.getSize()}px`
                              }}
                            >
                              {flexRender(cell.column.columnDef.cell, cell.getContext())}
                            </div>
                          ))}
                        </div>
                      )
                    })}
                    {paddingBottom > 0 && (
                      <div style={{ height: `${paddingBottom}px` }} />
                    )}
                  </>
                ) : (
                  rows.map(row => (
                    <div
                      key={row.id}
                      className="transition-colors hover:bg-gray-50"
                      style={{ display: 'table-row' }}
                    >
                      {row.getVisibleCells().map(cell => (
                        <div
                          key={cell.id}
                          className="border-b border-gray-100 px-4 py-3 text-sm text-gray-900"
                          style={{
                            display: 'table-cell',
                            width: `${cell.column.getSize()}px`
                          }}
                        >
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </div>
                      ))}
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {enableColumnResizing && columnSizingInfo.isResizingColumn && headerMetrics.height > 0 && (
            <div
              className="pointer-events-none absolute z-50 w-[4px] bg-blue-600 shadow-lg border border-blue-700"
              style={{
                left: `${resizeIndicatorLeft}px`,
                top: `${headerMetrics.top}px`,
                height: `${headerMetrics.height}px`,
                opacity: 0.8,
                boxShadow: '0 0 6px rgba(59, 130, 246, 0.8)',
                transition: 'none'
              }}
            />
          )}

          {debugResize && enableColumnResizing && (
            <div className="absolute left-0 top-0 z-50 bg-black bg-opacity-75 p-2 text-xs text-white">
              <div>Resizing: {columnSizingInfo.isResizingColumn ? 'YES' : 'NO'}</div>
              <div>Column: {columnSizingInfo.columnSizingStart[0] ?? 'None'}</div>
              <div>Start: {columnSizingInfo.startOffset}px</div>
              <div>Delta: {columnSizingInfo.deltaOffset}px</div>
              <div>Base Left: {baseResizeOffset.toFixed(2)}px</div>
              <div>Container Left: {containerLeft.toFixed(2)}px</div>
              <div>Scroll Left: {containerScrollLeft.toFixed(2)}px</div>
              <div>Indicator Left: {resizeIndicatorLeft.toFixed(2)}px</div>
              <div>Total Size: {table.getTotalSize()}px</div>
            </div>
          )}
        </div>
      </div>
    </ConfigProvider>
  )
}
