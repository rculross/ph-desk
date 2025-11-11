/**
 * Unified Settings Modal Component
 *
 * A single modal with tabbed settings replacing both electron-preferences and in-app settings page
 * Uses Ant Design components for consistent UI
 */

import React, { useState, useEffect, useCallback } from 'react'

import { Modal, Tabs, Form, Switch, Select, Slider, Input, Radio, Button, Alert, Divider } from 'antd'
import { ReloadOutlined } from '@ant-design/icons'

import { toastService } from '@/services/toast.service'
import { LLMSettings } from '@/components/llm/LLMSettings'
import { LogSettings } from '@/components/settings/LogSettings'
import { CompactFormItem } from '@/components/settings/CompactFormItem'
import { useExtendedSettings } from '@/hooks/useExtendedSettings'
import type { AppSettings } from '@/types/settings'
import { logger } from '@/utils/logger'
import { fieldDetectionService } from '@/services/field-detection.service'

const log = logger.content

interface SettingsModalProps {
  isOpen: boolean
  onClose: () => void
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose }) => {
  const { settings, loading, saving, error, updateNestedSetting, resetToDefaults } = useExtendedSettings()
  const [activeTab, setActiveTab] = useState('general')
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)

  // Generic handler for nested settings
  const handleNestedChange = useCallback(<K extends keyof AppSettings, NK extends keyof AppSettings[K]>(
    category: K,
    key: NK,
    value: AppSettings[K][NK]
  ) => {
    log.debug(`Settings changed: ${String(category)}.${String(key)} = ${value}`)
    setHasUnsavedChanges(true)
    updateNestedSetting(category, key, value)
  }, [updateNestedSetting])

  const handleResetToDefaults = async () => {
    if (window.confirm('Are you sure you want to reset all settings to defaults? This cannot be undone.')) {
      try {
        await resetToDefaults()
        toastService.success('Settings reset to defaults')
        setHasUnsavedChanges(false)
      } catch (err) {
        log.error('Failed to reset settings', { error: err })
        toastService.error('Failed to reset settings')
      }
    }
  }

  const handleResetColumnWidths = async () => {
    if (window.confirm('Reset all saved column widths? This will clear column widths for all tables and tenants.')) {
      try {
        await fieldDetectionService.clearColumnWidths()
        toastService.success('Column widths reset successfully! Refresh any open tables to see the changes.')
      } catch (err) {
        log.error('Failed to reset column widths', { error: err })
        toastService.error('Failed to reset column widths. Please try again.')
      }
    }
  }

  const handleClearTenantCache = async () => {
    if (window.confirm('Clear all tenant cache? This will:\n\n• Clear production tenant storage\n• Clear demo tenant storage (in-memory)\n• Clear Zustand persisted tenant data\n• Require re-authentication\n\nThis cannot be undone.')) {
      try {
        // Clear electron-store tenant storage
        await window.electron.tenant.clearStorage()

        // Clear Zustand persisted tenant store data
        await window.electron.storage.remove(['tenant-store'])

        // Clear in-memory demo tenant from Zustand
        const { useTenantStore } = await import('@/stores/tenant.store')
        useTenantStore.getState().setLastDemoTenant(null)

        log.info('Tenant cache cleared successfully')
        toastService.success('Tenant cache cleared! Please restart the application for changes to take effect.')
      } catch (err) {
        log.error('Failed to clear tenant cache', { error: err })
        toastService.error('Failed to clear tenant cache. Please try again.')
      }
    }
  }

  if (loading) {
    return (
      <Modal
        open={isOpen}
        onCancel={onClose}
        footer={null}
        width={900}
        centered
        title="Settings"
      >
        <div className="flex h-96 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-500 border-t-transparent" />
        </div>
      </Modal>
    )
  }

  return (
    <Modal
      open={isOpen}
      onCancel={onClose}
      footer={null}
      width={900}
      style={{ height: 700 }}
      centered
      title="Application Settings"
      closeIcon={null}
    >
      <div style={{ maxHeight: '600px', overflowY: 'auto' }}>
        {error && (
          <Alert
            message="Error"
            description={error}
            type="error"
            showIcon
            closable
            className="mb-4"
          />
        )}

        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          items={[
            {
              key: 'general',
              label: 'General',
              children: (
                <div className="p-3">
                  <CompactFormItem label="Theme">
                    <Radio.Group
                      value={settings.general.theme}
                      onChange={(e) => handleNestedChange('general', 'theme', e.target.value)}
                    >
                      <Radio value="light">Light</Radio>
                      <Radio value="dark">Dark</Radio>
                      <Radio value="system">System</Radio>
                    </Radio.Group>
                  </CompactFormItem>

                  <CompactFormItem label="Startup Behavior" tooltip="Home Screen: Opens the default dashboard view. Restore Last Session: Returns to your last open tool before closing. Blank: Starts with an empty application (fastest startup).">
                    <Select
                      value={settings.general.startupBehavior}
                      onChange={(value) => handleNestedChange('general', 'startupBehavior', value)}
                      style={{ width: '100%' }}
                    >
                      <Select.Option value="home">Home Screen</Select.Option>
                      <Select.Option value="restore">Restore Last Session</Select.Option>
                      <Select.Option value="blank">Blank</Select.Option>
                    </Select>
                  </CompactFormItem>

                  <CompactFormItem
                    label="Auto Update"
                    tooltip="Periodically checks for new versions and prompts you to install them. You can still update manually from the application menu."
                    layout="horizontal"
                  >
                    <Switch
                      checked={settings.general.autoUpdate}
                      onChange={(checked) => handleNestedChange('general', 'autoUpdate', checked)}
                    />
                  </CompactFormItem>

                  <CompactFormItem
                    label="Notifications"
                    tooltip="Displays desktop alerts for completed exports, API connection errors, authentication issues, and other critical actions requiring your attention."
                    layout="horizontal"
                  >
                    <Switch
                      checked={settings.general.notifications}
                      onChange={(checked) => handleNestedChange('general', 'notifications', checked)}
                    />
                  </CompactFormItem>
                </div>
              )
            },
            {
              key: 'export',
              label: 'Export',
              children: (
                <div className="p-3">
                  <CompactFormItem label="Default Export Format">
                    <Radio.Group
                      value={settings.export.defaultFormat}
                      onChange={(e) => handleNestedChange('export', 'defaultFormat', e.target.value)}
                    >
                      <Radio value="csv">CSV</Radio>
                      <Radio value="xlsx">Excel (.xlsx)</Radio>
                      <Radio value="json">JSON</Radio>
                    </Radio.Group>
                  </CompactFormItem>

                  <CompactFormItem
                    label="Include Headers"
                    tooltip="When enabled, the first row of exported files contains column names. Disable to exclude headers (useful when appending to existing files)."
                    layout="horizontal"
                  >
                    <Switch
                      checked={settings.export.includeHeaders}
                      onChange={(checked) => handleNestedChange('export', 'includeHeaders', checked)}
                    />
                  </CompactFormItem>

                  <CompactFormItem
                    label="Open After Export"
                    tooltip="Opens the exported file in your default application immediately after export completes. May not work for all file types on some systems."
                    layout="horizontal"
                  >
                    <Switch
                      checked={settings.export.openAfterExport}
                      onChange={(checked) => handleNestedChange('export', 'openAfterExport', checked)}
                    />
                  </CompactFormItem>

                  <CompactFormItem label="Date Format" tooltip="Choose the date format for exported data. ISO (2025-10-26) is recommended for compatibility with most systems. US and EU formats follow regional standards.">
                    <Radio.Group
                      value={settings.export.dateFormat}
                      onChange={(e) => handleNestedChange('export', 'dateFormat', e.target.value)}
                    >
                      <Radio value="ISO">ISO 8601 (2025-10-26)</Radio>
                      <Radio value="US">US (10/26/2025)</Radio>
                      <Radio value="EU">EU (26/10/2025)</Radio>
                    </Radio.Group>
                  </CompactFormItem>

                  <CompactFormItem label="File Encoding" tooltip="UTF-8: Most compatible, supports all languages (recommended). UTF-16: Required by some Windows applications. ASCII: Legacy format, use only if required by legacy systems.">
                    <Select
                      value={settings.export.encoding}
                      onChange={(value) => handleNestedChange('export', 'encoding', value)}
                      style={{ width: '100%' }}
                    >
                      <Select.Option value="utf-8">UTF-8</Select.Option>
                      <Select.Option value="utf-16">UTF-16</Select.Option>
                      <Select.Option value="ascii">ASCII</Select.Option>
                    </Select>
                  </CompactFormItem>
                </div>
              )
            },
            {
              key: 'api',
              label: 'API',
              children: (
                <div className="p-3">
                  <CompactFormItem label="Request Timeout" tooltip="Sets how long the application waits for server responses before timing out. Lower values (10-30s) detect connection problems faster. Higher values (60-300s) suit slow networks or large exports.">
                    <Slider
                      min={10}
                      max={300}
                      value={settings.api.timeout}
                      onChange={(value) => handleNestedChange('api', 'timeout', value)}
                      marks={{ 10: '10s', 30: '30s', 60: '60s', 120: '120s', 300: '300s' }}
                    />
                  </CompactFormItem>

                  <CompactFormItem label="Retry Attempts" tooltip="How many times to automatically retry failed requests. More retries (3-5) help with temporary network issues but may increase total response time. 1 attempt fails fast.">
                    <Radio.Group
                      value={settings.api.retryAttempts}
                      onChange={(e) => handleNestedChange('api', 'retryAttempts', e.target.value)}
                    >
                      <Radio value={1}>1 attempt</Radio>
                      <Radio value={3}>3 attempts</Radio>
                      <Radio value={5}>5 attempts</Radio>
                    </Radio.Group>
                  </CompactFormItem>

                  <Divider style={{ margin: '12px 0' }}>Rate Limiting</Divider>

                  <CompactFormItem
                    label="Enable Rate Limiting"
                    tooltip="Prevent API rate limit errors by throttling requests"
                    layout="horizontal"
                  >
                    <Switch
                      checked={settings.api.rateLimiting.enabled}
                      onChange={(checked) => handleNestedChange('api', 'rateLimiting', {
                        ...settings.api.rateLimiting,
                        enabled: checked
                      })}
                    />
                  </CompactFormItem>

                  {settings.api.rateLimiting.enabled && (
                    <>
                      <CompactFormItem label="Requests Per Second" tooltip="Controls request speed to prevent hitting Planhat's API rate limits. The default value is optimized for most use cases. Only adjust if experiencing rate limit errors.">
                        <Slider
                          min={1}
                          max={20}
                          value={settings.api.rateLimiting.requestsPerSecond}
                          onChange={(value) => handleNestedChange('api', 'rateLimiting', {
                            ...settings.api.rateLimiting,
                            requestsPerSecond: value
                          })}
                          marks={{ 1: '1', 5: '5', 10: '10', 15: '15', 20: '20' }}
                        />
                      </CompactFormItem>

                      <CompactFormItem label="Max Concurrent Requests" tooltip="Sets how many API calls can run at the same time. Higher values (5-10) speed up large operations but may overwhelm the server. Lower values (1-3) are more stable.">
                        <Slider
                          min={1}
                          max={10}
                          value={settings.api.rateLimiting.maxConcurrent}
                          onChange={(value) => handleNestedChange('api', 'rateLimiting', {
                            ...settings.api.rateLimiting,
                            maxConcurrent: value
                          })}
                          marks={{ 1: '1', 3: '3', 5: '5', 10: '10' }}
                        />
                      </CompactFormItem>

                      <CompactFormItem label="Retry Delay" tooltip="Time to wait before retrying a failed request (milliseconds). Higher delays (1000-5000ms) work better for temporary connection issues. Lower delays (100-500ms) fail fast.">
                        <Input
                          type="number"
                          min={100}
                          max={10000}
                          value={settings.api.rateLimiting.retryDelay}
                          onChange={(e) => handleNestedChange('api', 'rateLimiting', {
                            ...settings.api.rateLimiting,
                            retryDelay: Number(e.target.value)
                          })}
                        />
                      </CompactFormItem>
                    </>
                  )}
                </div>
              )
            },
            {
              key: 'performance',
              label: 'Performance',
              children: (
                <div className="p-3">
                  <CompactFormItem label="Export Batch Size" tooltip="Number of records processed per batch during export">
                    <Radio.Group
                      value={settings.performance.exportBatchSize}
                      onChange={(e) => handleNestedChange('performance', 'exportBatchSize', e.target.value)}
                    >
                      <Radio value={500}>500 records</Radio>
                      <Radio value={1000}>1000 records</Radio>
                      <Radio value={2000}>2000 records</Radio>
                      <Radio value={5000}>5000 records</Radio>
                    </Radio.Group>
                  </CompactFormItem>

                  <CompactFormItem
                    label="Virtual Scrolling"
                    tooltip="Improves performance for tables with thousands of rows"
                    layout="horizontal"
                  >
                    <Switch
                      checked={settings.performance.enableVirtualScrolling}
                      onChange={(checked) => handleNestedChange('performance', 'enableVirtualScrolling', checked)}
                    />
                  </CompactFormItem>

                  <Divider style={{ margin: '12px 0' }}>Caching</Divider>

                  <CompactFormItem
                    label="Enable Caching"
                    tooltip="Cache API responses for faster loading"
                    layout="horizontal"
                  >
                    <Switch
                      checked={settings.performance.caching.enabled}
                      onChange={(checked) => handleNestedChange('performance', 'caching', {
                        ...settings.performance.caching,
                        enabled: checked
                      })}
                    />
                  </CompactFormItem>

                  {settings.performance.caching.enabled && (
                    <CompactFormItem label="Cache Duration" tooltip="How long to cache API responses (minutes)">
                      <Slider
                        min={1}
                        max={60}
                        value={settings.performance.caching.duration}
                        onChange={(value) => handleNestedChange('performance', 'caching', {
                          ...settings.performance.caching,
                          duration: value
                        })}
                        marks={{ 1: '1m', 5: '5m', 15: '15m', 30: '30m', 60: '60m' }}
                      />
                    </CompactFormItem>
                  )}

                  <Divider style={{ margin: '12px 0' }}>Table Settings</Divider>

                  <CompactFormItem label="Column Width Management" tooltip="Clear all saved column widths across all tables and tenants">
                    <Button
                      icon={<ReloadOutlined />}
                      onClick={handleResetColumnWidths}
                    >
                      Reset All Column Widths
                    </Button>
                  </CompactFormItem>
                </div>
              )
            },
            {
              key: 'llm',
              label: 'LLM',
              children: (
                <div className="p-3">
                  <LLMSettings />
                </div>
              )
            },
            {
              key: 'advanced',
              label: 'Advanced',
              children: (
                <div className="p-3">
                  <Divider style={{ margin: '12px 0' }}>Logging</Divider>
                  <LogSettings />

                  <Divider style={{ margin: '12px 0' }}>Developer Options</Divider>

                  <CompactFormItem
                    label="Developer Mode"
                    tooltip="Enable developer tools and debug features"
                    layout="horizontal"
                  >
                    <Switch
                      checked={settings.advanced.developerMode}
                      onChange={(checked) => handleNestedChange('advanced', 'developerMode', checked)}
                    />
                  </CompactFormItem>

                  <CompactFormItem
                    label="Experimental Features"
                    tooltip="Enable experimental features (may be unstable)"
                    layout="horizontal"
                  >
                    <Switch
                      checked={settings.advanced.experimentalFeatures}
                      onChange={(checked) => handleNestedChange('advanced', 'experimentalFeatures', checked)}
                    />
                  </CompactFormItem>

                  <CompactFormItem label="Clear Tenant Cache" tooltip="Clear all cached tenant data including production and demo tenants. Requires app restart and re-authentication.">
                    <Button
                      danger
                      icon={<ReloadOutlined />}
                      onClick={handleClearTenantCache}
                    >
                      Clear Tenant Cache
                    </Button>
                  </CompactFormItem>

                  <Divider style={{ margin: '12px 0' }}>Reset</Divider>

                  <CompactFormItem label="Reset All Settings" tooltip="Reset all settings to their default values (cannot be undone)">
                    <Button
                      danger
                      icon={<ReloadOutlined />}
                      onClick={handleResetToDefaults}
                    >
                      Reset to Defaults
                    </Button>
                  </CompactFormItem>
                </div>
              )
            }
          ]}
        />
      </div>

      <div className="mt-4 flex justify-between items-center border-t pt-4">
        <div className="text-sm text-gray-500">
          Changes are saved automatically
        </div>
        <Button onClick={onClose}>Close</Button>
      </div>
    </Modal>
  )
}
