/**
 * Type definitions for xlsx-populate
 * Since @types/xlsx-populate doesn't exist, we'll define the minimum types needed
 */

declare module 'xlsx-populate' {
  interface WorkbookOptions {
    creator?: string
    title?: string
    subject?: string
    description?: string
    category?: string
    company?: string
  }

  interface CellStyle {
    bold?: boolean
    italic?: boolean
    underline?: boolean
    fontSize?: number
    fontFamily?: string
    fontColor?: string
    fill?: string
    horizontalAlignment?: 'left' | 'center' | 'right'
    verticalAlignment?: 'top' | 'center' | 'bottom'
    border?: boolean
    topBorder?: string
    bottomBorder?: string
    leftBorder?: string
    rightBorder?: string
    numberFormat?: string
    wrapText?: boolean
  }

  interface Cell {
    value(): any
    value(value: any): Cell
    style(name: string): any
    style(name: string, value: any): Cell
    style(styles: Partial<CellStyle>): Cell
    hyperlink(): string | undefined
    hyperlink(hyperlink: string): Cell
  }

  interface Column {
    width(): number
    width(width: number): Column
  }

  interface Row {
    height(): number
    height(height: number): Row
    style(styles: Partial<CellStyle>): Row
  }

  interface Worksheet {
    name(): string
    name(name: string): Worksheet
    cell(row: number, column: number): Cell
    cell(address: string): Cell
    column(columnNumber: number): Column
    row(rowNumber: number): Row
    range(address: string): any
    autoFilter(range: string): Worksheet
    freezePanes(row: number, column: number): Worksheet
    pageSetup(setting: string, value: any): Worksheet
    tabColor(color: string): Worksheet
  }

  interface Workbook {
    sheet(indexOrName: number | string): Worksheet
    addSheet(name: string): Worksheet
    property(name: string): any
    property(name: string, value: any): Workbook
    properties(props: WorkbookOptions): Workbook
    outputAsync(): Promise<ArrayBuffer>
  }

  namespace XlsxPopulate {
    function fromBlankAsync(): Promise<Workbook>
    function fromDataAsync(data: ArrayBuffer): Promise<Workbook>
    function fromFileAsync(path: string): Promise<Workbook>
  }

  export = XlsxPopulate
}