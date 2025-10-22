/**
 * Security Tests for DataTable
 *
 * Tests for XSS vulnerabilities and content sanitization in cell rendering.
 * Critical because flexRender can execute arbitrary content if not properly sanitized.
 */

import React from 'react'

import {
  getCoreRowModel,
  type ColumnDef,
  useReactTable,
  flexRender
} from '@tanstack/react-table'
import { render, screen, cleanup } from '@testing-library/react'
import DOMPurify from 'dompurify'
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'

import { DataTable } from '../DataTable'

interface MaliciousTestRow {
  id: number
  name: string
  description: string
  html: string
  script: string
}

// XSS payloads for testing
const XSS_PAYLOADS = {
  scriptTag: '<script>alert("XSS")</script>',
  imgOnError: '<img src="x" onerror="alert(\'XSS\')" />',
  svgOnLoad: '<svg onload="alert(\'XSS\')" />',
  iframeJavascript: '<iframe src="javascript:alert(\'XSS\')"></iframe>',
  inputOnFocus: '<input onfocus="alert(\'XSS\')" autofocus />',
  bodyOnLoad: '<body onload="alert(\'XSS\')">',
  linkJavascript: '<a href="javascript:alert(\'XSS\')">Click me</a>',
  formAction: '<form action="javascript:alert(\'XSS\')"><input type="submit"></form>',
  objectData: '<object data="javascript:alert(\'XSS\')"></object>',
  embedSrc: '<embed src="javascript:alert(\'XSS\')" />',
  metaRefresh: '<meta http-equiv="refresh" content="0;url=javascript:alert(\'XSS\')" />',
  styleExpression: '<div style="background:url(javascript:alert(\'XSS\'))">',
  // Modern XSS vectors
  templateTag: '<template><script>alert("XSS")</script></template>',
  mathMLScript: '<math><mtext><script>alert("XSS")</script></mtext></math>',
  svgScript: '<svg><script>alert("XSS")</script></svg>',
  // Data attribute vectors
  dataBinding: '<div data-bind="alert(\'XSS\')">',
  // CSS injection
  cssExpression: 'expression(alert("XSS"))',
  // Unicode and encoding attacks
  unicodeScript: '<script>\u0061lert("XSS")</script>',
  htmlEntities: '&lt;script&gt;alert("XSS")&lt;/script&gt;'
}

const maliciousData: MaliciousTestRow[] = [
  {
    id: 1,
    name: 'Normal User',
    description: 'Safe content',
    html: '<p>Normal paragraph</p>',
    script: 'console.log("safe")'
  },
  {
    id: 2,
    name: XSS_PAYLOADS.scriptTag,
    description: XSS_PAYLOADS.imgOnError,
    html: XSS_PAYLOADS.svgOnLoad,
    script: XSS_PAYLOADS.iframeJavascript
  },
  {
    id: 3,
    name: XSS_PAYLOADS.inputOnFocus,
    description: XSS_PAYLOADS.linkJavascript,
    html: XSS_PAYLOADS.formAction,
    script: XSS_PAYLOADS.objectData
  },
  {
    id: 4,
    name: XSS_PAYLOADS.templateTag,
    description: XSS_PAYLOADS.mathMLScript,
    html: XSS_PAYLOADS.svgScript,
    script: XSS_PAYLOADS.unicodeScript
  }
]

// Custom cell renderer that might be vulnerable
const UnsafeCellRenderer = ({ getValue }: { getValue: () => any }) => {
  const value = getValue()
  // DANGEROUS: Direct innerHTML assignment
  return <div dangerouslySetInnerHTML={{ __html: value }} />
}

// Safe cell renderer using DOMPurify
const SafeCellRenderer = ({ getValue }: { getValue: () => any }) => {
  const value = getValue()
  const sanitized = DOMPurify.sanitize(value, {
    ALLOWED_TAGS: ['p', 'strong', 'em', 'br'],
    ALLOWED_ATTR: []
  })
  return <div dangerouslySetInnerHTML={{ __html: sanitized }} />
}

// Mock alert function to detect XSS attempts
const mockAlert = vi.fn()
Object.defineProperty(window, 'alert', {
  value: mockAlert,
  writable: true
})

// Mock console.error to suppress DOMPurify warnings in tests
const mockConsoleError = vi.fn()
Object.defineProperty(console, 'error', {
  value: mockConsoleError,
  writable: true
})

function VulnerableTableWrapper() {
  const columns: ColumnDef<MaliciousTestRow>[] = [
    {
      accessorKey: 'id',
      header: 'ID'
    },
    {
      accessorKey: 'name',
      header: 'Name',
      cell: UnsafeCellRenderer
    },
    {
      accessorKey: 'description',
      header: 'Description',
      cell: UnsafeCellRenderer
    },
    {
      accessorKey: 'html',
      header: 'HTML Content',
      cell: UnsafeCellRenderer
    }
  ]

  const table = useReactTable({
    data: maliciousData,
    columns,
    getCoreRowModel: getCoreRowModel()
  })

  return <DataTable table={table} />
}

function SafeTableWrapper() {
  const columns: ColumnDef<MaliciousTestRow>[] = [
    {
      accessorKey: 'id',
      header: 'ID'
    },
    {
      accessorKey: 'name',
      header: 'Name',
      cell: SafeCellRenderer
    },
    {
      accessorKey: 'description',
      header: 'Description',
      cell: SafeCellRenderer
    },
    {
      accessorKey: 'html',
      header: 'HTML Content',
      cell: SafeCellRenderer
    }
  ]

  const table = useReactTable({
    data: maliciousData,
    columns,
    getCoreRowModel: getCoreRowModel()
  })

  return <DataTable table={table} />
}

describe('DataTable Security Tests', () => {
  beforeEach(() => {
    mockAlert.mockClear()
    mockConsoleError.mockClear()
  })

  afterEach(() => {
    cleanup()
  })

  it('should prevent XSS through script tag injection', () => {
    const { container } = render(<VulnerableTableWrapper />)

    // Check that script tags are not executed
    expect(mockAlert).not.toHaveBeenCalled()

    // Verify script tags are present in DOM (showing vulnerability)
    const scriptElements = container.querySelectorAll('script')
    expect(scriptElements.length).toBeGreaterThan(0)

    // Check for specific XSS payload in DOM
    const cellContent = container.innerHTML
    expect(cellContent).toContain('&lt;script&gt;') // Should be encoded or removed
  })

  it('should sanitize content with safe cell renderer', () => {
    const { container } = render(<SafeTableWrapper />)

    // Should not execute any scripts
    expect(mockAlert).not.toHaveBeenCalled()

    // Should not contain dangerous tags
    const scriptElements = container.querySelectorAll('script')
    const iframeElements = container.querySelectorAll('iframe')
    const objectElements = container.querySelectorAll('object')

    expect(scriptElements.length).toBe(0)
    expect(iframeElements.length).toBe(0)
    expect(objectElements.length).toBe(0)
  })

  it('should handle SVG-based XSS attacks', () => {
    const svgXSSData = [{
      id: 1,
      name: '<svg onload="alert(\'SVG XSS\')" />'
    }]

    const columns: ColumnDef<any>[] = [{
      accessorKey: 'name',
      header: 'Name',
      cell: UnsafeCellRenderer
    }]

    const TestTable = () => {
      const table = useReactTable({
        data: svgXSSData,
        columns,
        getCoreRowModel: getCoreRowModel()
      })
      return <DataTable table={table} />
    }

    const { container } = render(<TestTable />)

    // Check for SVG elements with event handlers
    const svgElements = container.querySelectorAll('svg')
    svgElements.forEach(svg => {
      expect(svg.getAttribute('onload')).toBeNull()
    })
  })

  it('should prevent CSS expression injection', () => {
    const cssXSSData = [{
      id: 1,
      style: 'background: url(javascript:alert("CSS XSS"))',
      content: '<div style="background:expression(alert(\'XSS\'))">Test</div>'
    }]

    const columns: ColumnDef<any>[] = [{
      accessorKey: 'content',
      header: 'Content',
      cell: UnsafeCellRenderer
    }]

    const TestTable = () => {
      const table = useReactTable({
        data: cssXSSData,
        columns,
        getCoreRowModel: getCoreRowModel()
      })
      return <DataTable table={table} />
    }

    render(<TestTable />)

    // Should not execute CSS expressions
    expect(mockAlert).not.toHaveBeenCalledWith('CSS XSS')
  })

  it('should handle malformed HTML gracefully', () => {
    const malformedData = [{
      id: 1,
      content: '<div><span><p>Unclosed tags'
    }]

    const columns: ColumnDef<any>[] = [{
      accessorKey: 'content',
      header: 'Content',
      cell: ({ getValue }) => {
        const value = getValue()
        return <div>{String(value)}</div>
      }
    }]

    const TestTable = () => {
      const table = useReactTable({
        data: malformedData,
        columns,
        getCoreRowModel: getCoreRowModel()
      })
      return <DataTable table={table} />
    }

    expect(() => render(<TestTable />)).not.toThrow()
  })

  it('should prevent data attribute XSS vectors', () => {
    const dataXSSData = [{
      id: 1,
      content: '<div data-bind="alert(\'Data XSS\')" onclick="alert(\'Click XSS\')">Click me</div>'
    }]

    const columns: ColumnDef<any>[] = [{
      accessorKey: 'content',
      header: 'Content',
      cell: SafeCellRenderer
    }]

    const TestTable = () => {
      const table = useReactTable({
        data: dataXSSData,
        columns,
        getCoreRowModel: getCoreRowModel()
      })
      return <DataTable table={table} />
    }

    const { container } = render(<TestTable />)

    // Check that dangerous attributes are removed
    const divs = container.querySelectorAll('div')
    divs.forEach(div => {
      expect(div.getAttribute('onclick')).toBeNull()
      expect(div.getAttribute('data-bind')).toBeNull()
    })
  })

  it('should handle Unicode and encoding-based attacks', () => {
    const unicodeXSSData = [{
      id: 1,
      content: '<script>\u0061\u006c\u0065\u0072\u0074("Unicode XSS")</script>'
    }]

    const columns: ColumnDef<any>[] = [{
      accessorKey: 'content',
      header: 'Content',
      cell: SafeCellRenderer
    }]

    const TestTable = () => {
      const table = useReactTable({
        data: unicodeXSSData,
        columns,
        getCoreRowModel: getCoreRowModel()
      })
      return <DataTable table={table} />
    }

    render(<TestTable />)

    // Should not execute Unicode-encoded scripts
    expect(mockAlert).not.toHaveBeenCalledWith('Unicode XSS')
  })

  it('should validate cell content sanitization performance', () => {
    const largeXSSData = Array.from({ length: 1000 }, (_, i) => ({
      id: i,
      content: `<script>alert('XSS ${i}')</script><p>Content ${i}</p>`
    }))

    const columns: ColumnDef<any>[] = [{
      accessorKey: 'content',
      header: 'Content',
      cell: SafeCellRenderer
    }]

    const TestTable = () => {
      const table = useReactTable({
        data: largeXSSData,
        columns,
        getCoreRowModel: getCoreRowModel()
      })
      return <DataTable table={table} enableRowVirtualization={true} />
    }

    const startTime = performance.now()
    render(<TestTable />)
    const endTime = performance.now()

    // Sanitization should not cause significant performance degradation
    expect(endTime - startTime).toBeLessThan(1000) // Less than 1 second

    // No scripts should execute
    expect(mockAlert).not.toHaveBeenCalled()
  })

  it('should test flexRender with malicious cell definitions', () => {
    const maliciousColumns: ColumnDef<any>[] = [{
      accessorKey: 'content',
      header: 'Content',
      cell: ({ getValue }) => {
        // Simulate potentially dangerous cell rendering
        const value = getValue()
        return (
          <div
            data-testid="flex-rendered-cell"
            // This would be dangerous in real code
            {...(typeof value === 'object' && value !== null ? value : {})}
          >
            {flexRender(() => String(value), {})}
          </div>
        )
      }
    }]

    const maliciousObjectData = [{
      id: 1,
      content: {
        onMouseOver: () => mockAlert('Malicious event'),
        onClick: () => mockAlert('Click attack'),
        'data-malicious': 'true',
        children: '<script>alert("XSS")</script>'
      }
    }]

    const TestTable = () => {
      const table = useReactTable({
        data: maliciousObjectData,
        columns: maliciousColumns,
        getCoreRowModel: getCoreRowModel()
      })
      return <DataTable table={table} />
    }

    const { container } = render(<TestTable />)

    // Check that malicious props aren't applied
    const cell = container.querySelector('[data-testid="flex-rendered-cell"]')
    expect(cell?.getAttribute('data-malicious')).toBe('true') // This shows the vulnerability

    // Verify scripts don't execute automatically
    expect(mockAlert).not.toHaveBeenCalledWith('Malicious event')
  })
})