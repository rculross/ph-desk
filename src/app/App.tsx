import React, { useState, useEffect } from 'react'

import { QueryClientProvider } from '@tanstack/react-query'
import { ConfigProvider } from 'antd'
import { clsx } from 'clsx'
import {
  AlertCircleIcon,
  WorkflowIcon,
  SettingsIcon,
  ChevronDownIcon,
  DatabaseIcon,
  LayersIcon,
  HammerIcon,
  ServerIcon,
  BrainIcon,
  LinkIcon,
  NetworkIcon
} from 'lucide-react'
import { Toaster } from 'react-hot-toast'

import { APP_VERSION } from '@/config/version'
import { queryClient } from '@/api/query-client'
import { LLMSettings } from '@/components/llm/LLMSettings'
import { LogSettings } from '@/components/settings/LogSettings'
import { TenantSelector } from '@/components/TenantSelector'
import { useExtendedSettings } from '@/hooks/useExtendedSettings'
import { fieldDetectionService } from '@/services/field-detection.service'
import { authService } from '@/services/auth.service'
import type { ExtendedUserSettings } from '@/types/settings'
import { logger } from '@/utils/logger'

import { ConnectedApis } from './components/ConnectedApis'
import { Endpoints } from './components/Endpoints'
import { FloatingExportProgress } from './components/ExportProgress'
import { FlexExporter } from './components/FlexExporter'
import { IssueExporter } from './components/IssueExporter'
import { LLMIntegration } from './components/LLMIntegration'
import { LoginPrompt } from './components/LoginPrompt'
import { LogzExplorer } from './components/LogzExplorer'
import { SalesforceIntegration } from './components/SalesforceIntegration'
import { WorkflowTemplateExporter } from './components/WorkflowExporter'

// Navigation items
type NavItem = 'home' | 'issues' | 'workflows' | 'flex' | 'settings' | 'salesforce-integration' | 'logz-explorer' | 'llm-integration' | 'connected-apis' | 'endpoints'

interface NavigationItem {
  id: NavItem
  label: string
  icon: React.ComponentType<any>
  description?: string
}

interface NavigationCategory {
  label: string
  icon: React.ComponentType<any>
  items: NavigationItem[]
}

const navigationCategories: NavigationCategory[] = [
  {
    label: 'Export Data',
    icon: DatabaseIcon,
    items: [
      {
        id: 'issues',
        label: 'Issues',
        icon: AlertCircleIcon,
        description: 'Export and analyze issue data'
      },
      {
        id: 'workflows',
        label: 'Workflow Templates',
        icon: WorkflowIcon,
        description: 'Export workflow template configurations'
      },
      {
        id: 'flex',
        label: 'Flex Export',
        icon: DatabaseIcon,
        description: 'Universal API exporter for any endpoint'
      }
    ]
  },
  {
    label: 'Build',
    icon: HammerIcon,
    items: []
  },
  {
    label: 'GenAI',
    icon: BrainIcon,
    items: [
      {
        id: 'llm-integration',
        label: 'AI Chat',
        icon: BrainIcon,
        description: 'Chat interface and LLM integration tools'
      }
    ]
  },
  {
    label: 'Integrations',
    icon: LayersIcon,
    items: [
      {
        id: 'salesforce-integration',
        label: 'Salesforce',
        icon: DatabaseIcon,
        description: 'View Salesforce integration configuration and mappings'
      }
    ]
  },
  {
    label: 'Tools',
    icon: ServerIcon,
    items: [
      {
        id: 'logz-explorer',
        label: 'Logz Explorer',
        icon: DatabaseIcon,
        description: 'View and analyze system logs'
      },
      {
        id: 'connected-apis',
        label: 'Connected APIs',
        icon: LinkIcon,
        description: 'View user API integration statuses'
      },
      {
        id: 'endpoints',
        label: 'Endpoints',
        icon: NetworkIcon,
        description: 'Discover and manage API endpoints'
      }
    ]
  }
]

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<NavItem>('home')
  const [openDropdown, setOpenDropdown] = useState<string | null>(null)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [isCheckingAuth, setIsCheckingAuth] = useState(true)

  // Move useExtendedSettings hook here to avoid conditional Hook calls
  const extendedSettings = useExtendedSettings()

  const log = logger.content // Using content logger for extension page

  // Check authentication status on mount
  useEffect(() => {
    const checkAuth = async () => {
      setIsCheckingAuth(true)
      try {
        const authState = authService.getAuthState()
        setIsAuthenticated(authState.isAuthenticated)

        // Also verify with a fresh check
        const isAuth = await authService.checkAuthentication()
        setIsAuthenticated(isAuth)
      } catch (error) {
        log.error('[App] Error checking authentication', { error })
        setIsAuthenticated(false)
      } finally {
        setIsCheckingAuth(false)
      }
    }

    checkAuth()

    // Subscribe to auth changes
    const unsubscribe = authService.onAuthChange((state) => {
      log.info('[App] Auth state changed', { isAuthenticated: state.isAuthenticated })
      setIsAuthenticated(state.isAuthenticated)
    })

    return () => {
      unsubscribe()
    }
  }, [log])

  // Handle successful login
  const handleLoginSuccess = () => {
    setIsAuthenticated(true)
    log.info('[App] User successfully authenticated')
  }

  // Handle URL hash navigation
  useEffect(() => {
    const hash = window.location.hash.slice(1) // Remove the #
    if (hash && hash !== 'home') {
      const validTabs: NavItem[] = ['issues', 'workflows', 'flex', 'settings', 'salesforce-integration', 'logz-explorer', 'llm-integration', 'connected-apis', 'endpoints']
      if (validTabs.includes(hash as NavItem)) {
        log.info(`Setting initial tab from URL hash: ${hash}`)
        setActiveTab(hash as NavItem)
      }
    }
  }, [log])

  // Log application initialization
  useEffect(() => {
    log.info(`Extension page application initialized - version ${APP_VERSION}`)
    log.debug('Shared query client connected for extension page')
    
    return () => {
      log.debug('Extension page application unmounted')
    }
  }, [log])

  // Log tab changes
  useEffect(() => {
    log.info(`Active tab changed to: ${activeTab}`)
  }, [activeTab, log])

  // Enhanced navigation handler with logging
  const handleTabChange = (tab: NavItem, source: string = 'navigation') => {
    log.info(`User navigated from ${activeTab} to ${tab} (${source})`)
    setActiveTab(tab)
  }

  // Enhanced dropdown handler with logging
  const handleDropdownToggle = (category: string, isOpen: boolean) => {
    // log.debug(`Navigation dropdown toggled: ${category} ${isOpen ? 'opened' : 'closed'}`) // Removed verbose logging
    setOpenDropdown(isOpen ? category : null)
  }

  const renderContent = () => {
    log.debug(`Rendering content for active tab: ${activeTab}`)

    switch (activeTab) {
      case 'issues':
        return <IssueExporter />
      case 'workflows':
        return <WorkflowTemplateExporter />
      case 'flex':
        return <FlexExporter />
      case 'salesforce-integration':
        return <SalesforceIntegration />
      case 'logz-explorer':
        return <LogzExplorer />
      case 'llm-integration':
        return <LLMIntegration />
      case 'connected-apis':
        return <ConnectedApis />
      case 'endpoints':
        return <Endpoints />
      case 'settings':
        return <SettingsPanel extendedSettings={extendedSettings} />
      case 'home':
      default:
        return <Dashboard onNavigate={handleTabChange} />
    }
  }

  // Show loading state while checking auth
  if (isCheckingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-blue-500 border-t-transparent mx-auto mb-4" />
          <p className="text-gray-600">Checking authentication...</p>
        </div>
      </div>
    )
  }

  // Show login prompt if not authenticated
  if (!isAuthenticated) {
    return <LoginPrompt onLoginSuccess={handleLoginSuccess} />
  }

  return (
    <QueryClientProvider client={queryClient}>
      <ConfigProvider
        theme={{
          components: {
            Button: {
              // Use consistent button styling with our design system
              borderRadius: 6,
              controlHeight: 24,
              fontSize: 12,
              paddingInline: 12
            },
            Table: {
              headerBg: '#fafafa',
              headerColor: '#262626',
              borderColor: '#e8e8e8'
            }
          }
        }}
      >
        <div className='extension-page min-h-screen bg-gray-50'>
          {/* Header */}
          <header className='sticky top-0 z-40 border-b border-gray-200 bg-white'>
          <div className='px-4 sm:px-6 lg:px-8'>
            <div className='flex h-12 items-center justify-between'>
              <div className='flex items-center gap-4'>
                <div className='flex h-8 w-8 items-center justify-center rounded-lg bg-planhat-blue'>
                  <span className='text-base font-bold text-white'>P</span>
                </div>
                <h1 className='text-lg font-bold text-gray-900'>Planhat Tools</h1>
                <span className='text-sm text-gray-500'>v{APP_VERSION}</span>

                {/* Navigation dropdowns moved to header */}
                <div className='flex items-center space-x-4 ml-8'>
                  {navigationCategories.map(category => {
                    const CategoryIcon = category.icon
                    const hasItems = category.items.length > 0
                    const isOpen = openDropdown === category.label

                    return (
                      <div
                        key={category.label}
                        className='relative group'
                        onMouseEnter={() => hasItems && handleDropdownToggle(category.label, true)}
                        onMouseLeave={(e) => {
                          const relatedTarget = e.relatedTarget as HTMLElement | null
                          if (!relatedTarget || !e.currentTarget.contains(relatedTarget)) {
                            handleDropdownToggle(category.label, false)
                          }
                        }}
                      >
                        <button
                          className={clsx(
                            'flex items-center gap-1.5 px-2 py-1 text-sm font-medium transition-colors rounded-md',
                            hasItems
                              ? 'text-gray-700 hover:text-gray-900 hover:bg-gray-100'
                              : 'cursor-default text-gray-400'
                          )}
                          disabled={!hasItems}
                        >
                          <CategoryIcon className='h-4 w-4' />
                          {category.label}
                          {hasItems && <ChevronDownIcon className='h-3 w-3' />}
                        </button>

                        {hasItems && isOpen && (
                          <div
                            className='absolute left-0 top-full z-50 pt-1'
                            onMouseEnter={() => handleDropdownToggle(category.label, true)}
                            onMouseLeave={() => handleDropdownToggle(category.label, false)}
                          >
                            <div className='w-56 rounded-lg border border-gray-200 bg-white shadow-lg'>
                            {category.items.map(item => {
                              const ItemIcon = item.icon
                              return (
                                <button
                                  key={item.id}
                                  onClick={() => {
                                    handleTabChange(item.id, 'dropdown-menu')
                                    handleDropdownToggle(category.label, false)
                                  }}
                                  className='flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm hover:bg-gray-50'
                                >
                                  <ItemIcon className='h-4 w-4 text-gray-500' />
                                  <div className='font-medium text-gray-900'>{item.label}</div>
                                </button>
                              )
                            })}
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
              <div className='flex items-center gap-3'>
                {/* Settings moved to right side */}
                <button
                  onClick={() => handleTabChange('settings', 'direct-nav')}
                  className={clsx(
                    'flex items-center gap-1.5 px-2 py-1 text-sm font-medium transition-colors rounded-md',
                    activeTab === 'settings'
                      ? 'text-planhat-blue bg-blue-50'
                      : 'text-gray-700 hover:text-gray-900 hover:bg-gray-100'
                  )}
                >
                  <SettingsIcon className='h-4 w-4' />
                  Settings
                </button>

                <TenantSelector
                  size="sm"
                  showLogo={true}
                  className="min-w-0"
                />
              </div>
            </div>
          </div>
        </header>


        {/* Main Content */}
        <main className='flex-1'>
          <div className='px-4 py-4 sm:px-6 lg:px-8'>{renderContent()}</div>
        </main>

        {/* Floating Progress Indicator */}
        <FloatingExportProgress />

        {/* Toast Notifications */}
        <Toaster
          position='top-right'
          toastOptions={{
            duration: 4000,
            style: {
              background: '#363636',
              color: '#fff'
            },
            success: {
              duration: 3000,
              iconTheme: {
                primary: '#10b981',
                secondary: '#fff'
              }
            },
            error: {
              duration: 5000,
              iconTheme: {
                primary: '#ef4444',
                secondary: '#fff'
              }
            }
          }}
        />
        </div>
      </ConfigProvider>
    </QueryClientProvider>
  )
}

/**
 * Landing Page component
 */
function _LandingPage() {
  return (
    <div className='flex min-h-[60vh] items-center justify-center'>
      <div className='text-center'>
        <div className='mb-8 flex justify-center'>
          <div className='flex h-24 w-24 items-center justify-center rounded-2xl bg-planhat-blue shadow-lg'>
            <span className='text-5xl font-bold text-white'>P</span>
          </div>
        </div>
        <h1 className='mb-3 text-3xl font-bold text-gray-900'>Welcome to Planhat Tools</h1>
        <p className='mb-8 text-lg text-gray-600'>
          Powerful tools and utilities for the Planhat platform
        </p>
        <p className='text-sm text-gray-500'>
          Select a category from the navigation above to get started
        </p>
      </div>
    </div>
  )
}

/**
 * Dashboard component
 */
function Dashboard({ onNavigate: _onNavigate }: { onNavigate: (tab: NavItem) => void }) {
  const log = logger.content

  useEffect(() => {
    log.debug('Dashboard component mounted')
    return () => {
      log.debug('Dashboard component unmounted')
    }
  }, [log])

  return (
    <div className='flex flex-col items-center justify-center min-h-[60vh] space-y-6'>
      <div className='flex h-24 w-24 items-center justify-center rounded-full bg-planhat-blue shadow-lg'>
        <span className='text-3xl font-bold text-white'>P</span>
      </div>
      <div className='text-center space-y-2'>
        <h1 className='text-3xl font-bold text-gray-900'>Welcome to Planhat Tools</h1>
        <p className='text-lg text-gray-600 max-w-md'>
          Advanced data export and automation tools for the Planhat platform
        </p>
      </div>
      <div className='text-center text-sm text-gray-500'>
        Use the navigation above to access export tools and features
      </div>
    </div>
  )
}

/**
 * Settings panel component with instant save functionality
 */
function SettingsPanel({
  extendedSettings
}: {
  extendedSettings: ReturnType<typeof useExtendedSettings>
}) {
  const {
    settings,
    loading,
    saving,
    error,
    updateNestedSetting
  } = extendedSettings
  
  const log = logger.content

  useEffect(() => {
    log.debug('Settings panel component mounted')
    return () => {
      log.debug('Settings panel component unmounted')
    }
  }, [log])

  // Log settings loading states
  useEffect(() => {
    if (loading) {
      log.debug('Settings loading started')
    } else {
      log.info('Settings loading completed')
    }
  }, [loading, log])

  useEffect(() => {
    if (saving) {
      log.debug('Settings save started')
    } else {
      log.debug('Settings save completed')
    }
  }, [saving, log])

  useEffect(() => {
    if (error) {
      log.error(`Settings error occurred: ${error}`)
    }
  }, [error, log])

  // Enhanced setting update handler with logging
  const handleSettingUpdate = <K extends keyof ExtendedUserSettings, NK extends keyof ExtendedUserSettings[K]>(
    section: K,
    key: NK,
    value: ExtendedUserSettings[K][NK],
    friendlyName?: string
  ) => {
    log.info(`User updated setting: ${String(section)}.${String(key)} = ${value}`)
    void updateNestedSetting(section, key, value)
  }

  if (loading) {
    return (
      <div className='flex h-64 items-center justify-center'>
        <div className='h-8 w-8 animate-spin rounded-full border-4 border-planhat-blue border-t-transparent' />
      </div>
    )
  }

  return (
    <div className='max-w-4xl space-y-8'>
      <div>
        <h2 className='mb-2 text-2xl font-bold text-gray-900'>Settings</h2>
        <p className='text-gray-600'>
          Configure your extension preferences and options. Changes are saved automatically.
        </p>
      </div>

      {/* Save status indicator */}
      {saving && (
        <div className='flex items-center gap-2 rounded-lg bg-blue-50 p-3 text-sm text-blue-700'>
          <div className='h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent' />
          <span>Saving settings...</span>
        </div>
      )}

      {error && (
        <div className='rounded-lg bg-red-50 p-3 text-sm text-red-700'>
          {error}
        </div>
      )}

      <div className='grid grid-cols-1 gap-6 lg:grid-cols-3'>
        {/* Export Settings */}
        <div className='rounded-lg border bg-white p-6 shadow-sm'>
          <h3 className='mb-4 text-lg font-semibold'>Export Settings</h3>
          <div className='space-y-4'>
            <label className='flex items-center justify-between'>
              <span className='text-sm font-medium'>Default export format</span>
              <select 
                value={settings.export.defaultFormat}
                onChange={(e) => handleSettingUpdate('export', 'defaultFormat', e.target.value as 'csv' | 'xlsx' | 'json', 'Default Export Format')}
                className='rounded border border-gray-300 px-3 py-1 text-sm'
                disabled={saving}
              >
                <option value='csv'>CSV</option>
                <option value='xlsx'>Excel</option>
                <option value='json'>JSON</option>
              </select>
            </label>

            <label className='flex items-center justify-between'>
              <span className='text-sm font-medium'>Include headers by default</span>
              <input
                type='checkbox'
                checked={settings.export.includeHeaders}
                onChange={(e) => handleSettingUpdate('export', 'includeHeaders', e.target.checked, 'Include Headers by Default')}
                className='rounded border-gray-300 text-planhat-blue focus:ring-planhat-blue'
                disabled={saving}
              />
            </label>

            <label className='flex items-center justify-between'>
              <span className='text-sm font-medium'>Auto-download completed exports</span>
              <input
                type='checkbox'
                checked={settings.export.autoDownload}
                onChange={(e) => handleSettingUpdate('export', 'autoDownload', e.target.checked, 'Auto-download Completed Exports')}
                className='rounded border-gray-300 text-planhat-blue focus:ring-planhat-blue'
                disabled={saving}
              />
            </label>
          </div>
        </div>

        {/* UI Enhancements */}
        <div className='rounded-lg border bg-white p-6 shadow-sm'>
          <h3 className='mb-4 text-lg font-semibold'>UI Enhancements</h3>
          <div className='space-y-4'>
            <label className='flex items-center justify-between'>
              <span className='text-sm font-medium'>Enhanced Logs</span>
              <input
                type='checkbox'
                checked={settings.ui.enhancedLogs}
                onChange={(e) => handleSettingUpdate('ui', 'enhancedLogs', e.target.checked, 'Enhanced Logs')}
                className='rounded border-gray-300 text-planhat-blue focus:ring-planhat-blue'
                disabled={saving}
              />
            </label>

            <label className='flex items-center justify-between'>
              <span className='text-sm font-medium'>Wide Modal Dropdowns</span>
              <input
                type='checkbox'
                checked={settings.ui.wideModalDropdowns}
                onChange={(e) => handleSettingUpdate('ui', 'wideModalDropdowns', e.target.checked, 'Wide Modal Dropdowns')}
                className='rounded border-gray-300 text-planhat-blue focus:ring-planhat-blue'
                disabled={saving}
              />
            </label>

            <label className='flex items-center justify-between'>
              <span className='text-sm font-medium'>Diff Highlighting</span>
              <input
                type='checkbox'
                checked={settings.ui.diffHighlighting}
                onChange={(e) => handleSettingUpdate('ui', 'diffHighlighting', e.target.checked, 'Diff Highlighting')}
                className='rounded border-gray-300 text-planhat-blue focus:ring-planhat-blue'
                disabled={saving}
              />
            </label>
          </div>
        </div>

        {/* Logging Settings */}
        <div className='rounded-lg border bg-white p-6 shadow-sm'>
          <h3 className='mb-4 text-lg font-semibold'>Logging</h3>
          <LogSettings />
        </div>

        {/* Performance Settings */}
        <div className='rounded-lg border bg-white p-6 shadow-sm'>
          <h3 className='mb-4 text-lg font-semibold'>Performance</h3>
          <div className='space-y-4'>
            <div>
              <label className='mb-1 block text-sm font-medium'>Export batch size</label>
              <select
                value={settings.performance.exportBatchSize}
                onChange={(e) => handleSettingUpdate('performance', 'exportBatchSize', Number(e.target.value) as 500 | 1000 | 2000 | 5000, 'Export Batch Size')}
                className='w-full rounded border border-gray-300 px-3 py-2 text-sm'
                disabled={saving}
              >
                <option value='500'>500 records</option>
                <option value='1000'>1000 records</option>
                <option value='2000'>2000 records</option>
                <option value='5000'>5000 records</option>
              </select>
            </div>

            <label className='flex items-center justify-between'>
              <span className='text-sm font-medium'>Enable virtual scrolling</span>
              <input
                type='checkbox'
                checked={settings.performance.enableVirtualScrolling}
                onChange={(e) => handleSettingUpdate('performance', 'enableVirtualScrolling', e.target.checked, 'Enable Virtual Scrolling')}
                className='rounded border-gray-300 text-planhat-blue focus:ring-planhat-blue'
                disabled={saving}
              />
            </label>

            <div className='border-t pt-4'>
              <label className='mb-2 block text-sm font-medium'>Table Settings</label>
              <button
                onClick={async () => {
                  if (confirm('Reset all saved column widths? This will clear column widths for all tables and tenants.')) {
                    try {
                      await fieldDetectionService.clearColumnWidths()
                      alert('Column widths reset successfully! Refresh any open tables to see the changes.')
                    } catch (error) {
                      alert('Failed to reset column widths. Please try again.')
                      console.error('Reset column widths error:', error)
                    }
                  }
                }}
                className='rounded bg-gray-100 px-3 py-2 text-sm text-gray-700 hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 disabled:opacity-50'
                disabled={saving}
              >
                Reset All Column Widths
              </button>
              <p className='mt-1 text-xs text-gray-500'>
                Clear all saved column widths across all tables and tenants
              </p>
            </div>
          </div>
        </div>

        {/* API Settings */}
        <div className='rounded-lg border bg-white p-6 shadow-sm'>
          <h3 className='mb-4 text-lg font-semibold'>API Configuration</h3>
          <div className='space-y-4'>
            <div>
              <label className='mb-1 block text-sm font-medium'>API timeout (seconds)</label>
              <input
                type='number'
                value={settings.api.timeout}
                onChange={(e) => {
                  const value = Math.max(10, Math.min(300, Number(e.target.value)))
                  handleSettingUpdate('api', 'timeout', value, 'API Timeout')
                }}
                min='10'
                max='300'
                className='w-full rounded border border-gray-300 px-3 py-2 text-sm'
                disabled={saving}
              />
            </div>

            <div>
              <label className='mb-1 block text-sm font-medium'>Retry attempts</label>
              <select 
                value={settings.api.retryAttempts}
                onChange={(e) => handleSettingUpdate('api', 'retryAttempts', Number(e.target.value) as 1 | 3 | 5, 'Retry Attempts')}
                className='w-full rounded border border-gray-300 px-3 py-2 text-sm'
                disabled={saving}
              >
                <option value='1'>1 attempt</option>
                <option value='3'>3 attempts</option>
                <option value='5'>5 attempts</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* LLM Settings - Full Width */}
      <div className='col-span-full rounded-lg border bg-white p-6 shadow-sm'>
        <h3 className='mb-4 text-lg font-semibold'>LLM Settings</h3>
        <LLMSettings />
      </div>
    </div>
  )
}
