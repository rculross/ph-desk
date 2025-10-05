/**
 * Tests for text-utils.ts
 * 
 * Tests HTML stripping functionality and table display processing
 */

import { describe, it, expect, beforeEach } from 'vitest'

import { 
  stripHtml, 
  containsHtml, 
  processForTableDisplay, 
  createRichTextFormatter,
  truncateText,
  textFormatters
} from '../text-utils'

describe('text-utils', () => {
  // Create a mock DOM environment for testing
  beforeEach(() => {
    // Ensure document is available for testing
    if (!global.document) {
      const { JSDOM } = require('jsdom')
      const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>')
      global.document = dom.window.document
    }
  })

  describe('stripHtml', () => {
    it('should strip HTML tags and return plain text', () => {
      const htmlText = '<p style="text-align: left"><strong>Tenant name:</strong> <a href="http://Incident.io" title="" class="ph-editor-link" target="_blank">Incident.io</a></p>'
      const result = stripHtml(htmlText)
      expect(result).toBe('Tenant name: Incident.io')
    })

    it('should handle complex HTML with multiple paragraphs', () => {
      const htmlText = `
        <p style="text-align: left"><strong>Tenant name:</strong> <a href="http://Incident.io" title="" class="ph-editor-link" target="_blank">Incident.io</a></p>
        <p style="text-align: left"></p>
        <p style="text-align: left"><strong>Domain:</strong> <a href="https://incident.io/" title="" class="ph-editor-link" target="_blank">https://incident.io/</a></p>
        <p style="text-align: left"></p>
        <p style="text-align: left"><strong>Email Provider:</strong> Gmail</p>
      `
      const result = stripHtml(htmlText)
      expect(result).toContain('Tenant name: Incident.io')
      expect(result).toContain('Domain: https://incident.io/')
      expect(result).toContain('Email Provider: Gmail')
      expect(result).not.toContain('<p>')
      expect(result).not.toContain('<strong>')
      expect(result).not.toContain('<a href')
    })

    it('should handle empty or null inputs', () => {
      expect(stripHtml('')).toBe('')
      expect(stripHtml(null)).toBe('')
      expect(stripHtml(undefined)).toBe('')
    })

    it('should handle plain text without HTML', () => {
      const plainText = 'This is just plain text'
      const result = stripHtml(plainText)
      expect(result).toBe(plainText)
    })

    it('should normalize whitespace', () => {
      const htmlText = '<p>Text   with    multiple   spaces</p>'
      const result = stripHtml(htmlText)
      expect(result).toBe('Text with multiple spaces')
    })
  })

  describe('containsHtml', () => {
    it('should detect HTML tags', () => {
      expect(containsHtml('<p>Hello</p>')).toBe(true)
      expect(containsHtml('<strong>Bold</strong>')).toBe(true)
      expect(containsHtml('<a href="http://example.com">Link</a>')).toBe(true)
    })

    it('should return false for plain text', () => {
      expect(containsHtml('Just plain text')).toBe(false)
      expect(containsHtml('Text with < and > symbols')).toBe(false)
      expect(containsHtml('Math: 5 < 10 and 15 > 3')).toBe(false)
    })

    it('should handle empty or null inputs', () => {
      expect(containsHtml('')).toBe(false)
      expect(containsHtml(null)).toBe(false)
      expect(containsHtml(undefined)).toBe(false)
    })
  })

  describe('processForTableDisplay', () => {
    it('should strip HTML from rich text', () => {
      const richText = '<p><strong>Bold text</strong> with <em>emphasis</em></p>'
      const result = processForTableDisplay(richText)
      expect(result).toBe('Bold text with emphasis')
    })

    it('should truncate long text when maxLength is specified', () => {
      const longText = 'This is a very long piece of text that should be truncated'
      const result = processForTableDisplay(longText, 20)
      expect(result).toBe('This is a very long ...')
    })

    it('should handle non-string values', () => {
      expect(processForTableDisplay(123)).toBe('123')
      expect(processForTableDisplay(true)).toBe('true')
      expect(processForTableDisplay(null)).toBe('')
      expect(processForTableDisplay(undefined)).toBe('')
    })

    it('should process the example rich text correctly', () => {
      const exampleHtml = '<p style="text-align: left"><strong>Tenant name:</strong> <a href="http://Incident.io" title="" class="ph-editor-link" target="_blank">Incident.io</a></p><p style="text-align: left"></p><p style="text-align: left"><strong>Domain:</strong> <a href="https://incident.io/" title="" class="ph-editor-link" target="_blank">https://incident.io/</a></p><p style="text-align: left"></p><p style="text-align: left"><strong>Email Provider:</strong> Gmail</p><p style="text-align: left"></p><p style="text-align: left"><strong>Currency:</strong> USD</p><p style="text-align: left"></p><p style="text-align: left"><strong>Data Location: US<br><br>Source/Template </strong></p><p style="text-align: left"><em><strong>empty tenant</strong></em></p>'
      
      const result = processForTableDisplay(exampleHtml, 100)
      expect(result).toContain('Tenant name: Incident.io')
      expect(result).toContain('Domain: https://incident.io/')
      expect(result).toContain('Email Provider: Gmail')
      expect(result).not.toContain('<p>')
      expect(result).not.toContain('<strong>')
      expect(result.length).toBeLessThanOrEqual(103) // 100 + '...'
    })
  })

  describe('textFormatters', () => {
    it('should provide working formatters', () => {
      const richText = '<p><strong>Test</strong> content</p>'
      
      expect(textFormatters.richText(richText)).toBe('Test content')
      expect(textFormatters.richTextShort(richText)).toBe('Test content')
      expect(textFormatters.richTextFull(richText)).toBe('Test content')
    })

    it('should handle truncation in formatters', () => {
      const longRichText = `<p>${'A'.repeat(150)}</p>`
      const result = textFormatters.richText(longRichText)
      expect(result.length).toBeLessThanOrEqual(103) // 100 + '...'
      expect(result.endsWith('...')).toBe(true)
    })
  })

  describe('truncateText', () => {
    it('should truncate long text', () => {
      const text = 'This is a long text that needs truncation'
      const result = truncateText(text, 10)
      expect(result).toBe('This is a ...')
    })

    it('should not truncate short text', () => {
      const text = 'Short'
      const result = truncateText(text, 10)
      expect(result).toBe('Short')
    })

    it('should handle edge cases', () => {
      expect(truncateText('', 10)).toBe('')
      expect(truncateText('Exact', 5)).toBe('Exact')
    })
  })
})