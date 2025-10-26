import React, { useState, useEffect } from 'react'

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
  NetworkIcon,
  HomeIcon,
  ExternalLinkIcon
} from 'lucide-react'
import { Toaster } from 'react-hot-toast'

import { useCurrentUser } from '@/api/queries/auth.queries'
import { LLMSettings } from '@/components/llm/LLMSettings'
import { LogSettings } from '@/components/settings/LogSettings'
import { TenantSelector } from '@/components/TenantSelector'
import { APP_VERSION } from '@/config/version'
import { useExtendedSettings } from '@/hooks/useExtendedSettings'
import { authService } from '@/services/auth.service'
import { fieldDetectionService } from '@/services/field-detection.service'
import { planhatBrowserService } from '@/services/planhat-browser.service'
import { useActiveTenant } from '@/stores/tenant.store'
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
// Preferences component removed - now using native electron-preferences dialog (File -> Preferences)
import { SalesforceIntegration } from './components/SalesforceIntegration'
import { WorkflowTemplateExporter } from './components/WorkflowExporter'
import { SampleDataProgressModal } from '../components/SampleDataProgress'
import { sampleDataService, type SampleDataProgress } from '../services/sample-data.service'
import toast from 'react-hot-toast'

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

  // Sample Data state
  const [isSampleDataModalOpen, setIsSampleDataModalOpen] = useState(false)
  const [sampleDataProgress, setSampleDataProgress] = useState<SampleDataProgress>({
    currentEndpoint: '',
    currentIndex: 0,
    totalEndpoints: sampleDataService.getTotalEndpoints(),
    completed: 0,
    failed: 0,
    errors: [],
    isComplete: false
  })

  // Move useExtendedSettings hook here to avoid conditional Hook calls
  const extendedSettings = useExtendedSettings()

  // Get current tenant from store
  const currentTenant = useActiveTenant()

  // Check connection status via user profile query
  const currentUserQuery = useCurrentUser()
  const isConnected = currentUserQuery.isSuccess && !!currentUserQuery.data

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

  // Set window title with version (Electron only)
  useEffect(() => {
    if (window.electron?.window?.setTitle) {
      window.electron.window.setTitle(`Planhat Tools ${APP_VERSION}`)
    }
  }, []) // Run once on mount, will update when APP_VERSION changes via hot reload

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
    setOpenDropdown(isOpen ? category : null)
  }

  // Handle Open Planhat button click
  const handleOpenPlanhat = async () => {
    try {
      log.info('[App] Opening Planhat browser window...')
      await planhatBrowserService.togglePlanhatBrowser()
    } catch (error) {
      log.error('[App] Error opening Planhat browser', { error })
    }
  }

  // Handle Get Sample Data menu trigger
  const handleGetSampleData = async () => {
    try {
      // Check if user is logged in
      if (!isAuthenticated || !currentTenant) {
        toast.error('Please login and select a tenant first')
        return
      }

      log.info('[App] Starting sample data collection...')

      // Open folder picker
      const folderPath = await window.electron.sampleData.selectFolder()

      if (!folderPath) {
        log.info('[App] User cancelled folder selection')
        return
      }

      log.info('[App] User selected folder:', folderPath)

      // Reset progress and open modal
      setSampleDataProgress({
        currentEndpoint: '',
        currentIndex: 0,
        totalEndpoints: sampleDataService.getTotalEndpoints(),
        completed: 0,
        failed: 0,
        errors: [],
        isComplete: false
      })
      setIsSampleDataModalOpen(true)

      // Start collection
      await sampleDataService.collectSampleData(
        folderPath,
        currentTenant.slug,
        (progress) => {
          setSampleDataProgress(progress)
        }
      )

      toast.success('Sample data collection complete!')
    } catch (error) {
      log.error('[App] Error collecting sample data', { error })
      toast.error(`Failed to collect sample data: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  // Listen for menu trigger
  useEffect(() => {
    if (!window.electron?.sampleData?.onGetSampleData) {
      return
    }

    const cleanup = window.electron.sampleData.onGetSampleData(() => {
      log.info('[App] Sample data menu item triggered')
      handleGetSampleData()
    })

    return cleanup
  }, [isAuthenticated, currentTenant, log])


  const renderContent = (): React.ReactElement => {
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
        return <Dashboard onNavigate={handleTabChange} />
      default:
        return <Dashboard onNavigate={handleTabChange} />
    }
  }

  // Don't block the UI - let the dashboard show and handle login there
  // User can login from the dashboard with prod/demo buttons

  return (
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
              <div className='flex items-center'>
                {/* Planhat Tools Branding */}
                <div className='flex items-center gap-2 px-3 py-1.5 rounded-lg bg-blue-50/40 mr-8'>
                  <button
                    onClick={() => handleTabChange('home', 'home-icon')}
                    className={clsx(
                      'flex items-center justify-center p-1 rounded-md transition-colors',
                      activeTab === 'home'
                        ? 'text-planhat-blue bg-blue-100/40'
                        : 'text-planhat-blue hover:bg-blue-100/40'
                    )}
                    title='Return to home (prod/demo selection)'
                  >
                    <HomeIcon className='h-4 w-4' />
                  </button>
                  <span className='text-sm font-semibold text-planhat-blue'>Planhat Tools</span>
                </div>

                {/* Divider */}
                <div className='h-6 w-px bg-gray-300 mr-8' />

                {/* Navigation dropdowns */}
                <div className='flex items-center space-x-4'>
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
                          if (!relatedTarget || !(relatedTarget instanceof Node) || !e.currentTarget.contains(relatedTarget)) {
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
                {/* Open Planhat button */}
                <button
                  onClick={handleOpenPlanhat}
                  className='flex items-center gap-1.5 px-2 py-1 text-sm font-medium transition-colors rounded-md text-gray-700 hover:text-gray-900 hover:bg-gray-100'
                  title='Open Planhat in a separate browser window'
                >
                  <ExternalLinkIcon className='h-4 w-4' />
                  Browse Planhat
                </button>

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

                {/* Tenant Selector */}
                <TenantSelector size="md" showLogo={false} showPlan={false} />
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

        {/* Sample Data Progress Modal */}
        <SampleDataProgressModal
          progress={sampleDataProgress}
          isOpen={isSampleDataModalOpen}
          onClose={() => setIsSampleDataModalOpen(false)}
        />

        {/* Floating Export Progress */}
        <FloatingExportProgress />

        {/* Toast Notifications */}
        <Toaster position="top-right" />
    </ConfigProvider>
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
  const [isLoggingIn, setIsLoggingIn] = useState(false)
  const [loginError, setLoginError] = useState<string | null>(null)

  useEffect(() => {
    log.debug('Dashboard component mounted')
    return () => {
      log.debug('Dashboard component unmounted')
    }
  }, [log])

  const handleEnvironmentLogin = async (environment: 'production' | 'demo') => {
    setIsLoggingIn(true)
    setLoginError(null)

    try {
      log.info(`[Dashboard] Initiating ${environment} login...`)
      const authResult = await authService.login(environment)

      log.info(`[Dashboard] Login successful to ${environment}`, {
        tenantSlug: authResult.tenantSlug
      })

      // The tenant slug was captured from OAuth redirect
      // The tenant store will auto-initialize with this tenant
      // Force reload to trigger App's authentication check
      window.location.reload()
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Login failed'

      if (errorMessage.includes('cancelled')) {
        log.info('[Dashboard] Login cancelled by user')
        setLoginError('Login cancelled. Please try again.')
      } else {
        log.error('[Dashboard] Login error', { error })
        setLoginError(errorMessage)
      }
      setIsLoggingIn(false)
    }
  }

  return (
    <div className='flex flex-col items-center justify-center min-h-[60vh] space-y-8'>
      <div className='flex h-24 w-24 items-center justify-center rounded-full bg-planhat-blue shadow-lg'>
        <span className='text-3xl font-bold text-white'>P</span>
      </div>

      <div className='text-center space-y-2'>
        <h1 className='text-3xl font-bold text-gray-900'>Welcome to Planhat Tools</h1>
      </div>

      {/* Environment Login Buttons */}
      <div className='flex flex-col items-center space-y-4 w-full max-w-sm'>
        <p className='text-sm text-gray-600 font-medium'>Select an environment to get started:</p>

        <div className='grid grid-cols-2 gap-4 w-full'>
          <button
            onClick={() => handleEnvironmentLogin('production')}
            disabled={isLoggingIn}
            className='
              px-6 py-4 rounded-lg border-2 border-blue-500 bg-blue-50
              hover:bg-blue-100 active:bg-blue-200
              text-blue-700 font-semibold
              transition-all duration-200
              disabled:opacity-50 disabled:cursor-not-allowed
              flex flex-col items-center gap-2
            '
          >
            <span className='text-base'>Production</span>
            <span className='text-xs text-blue-600'>ws.planhat.com</span>
          </button>

          <button
            onClick={() => handleEnvironmentLogin('demo')}
            disabled={isLoggingIn}
            className='
              px-6 py-4 rounded-lg border-2 border-purple-500 bg-purple-50
              hover:bg-purple-100 active:bg-purple-200
              text-purple-700 font-semibold
              transition-all duration-200
              disabled:opacity-50 disabled:cursor-not-allowed
              flex flex-col items-center gap-2
            '
          >
            <span className='text-base'>Demo</span>
            <span className='text-xs text-purple-600'>ws.planhatdemo.com</span>
          </button>
        </div>

        {isLoggingIn && (
          <div className='flex items-center gap-2 text-sm text-gray-600'>
            <div className='h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent' />
            <span>Opening login window...</span>
          </div>
        )}

        {loginError && (
          <div className='w-full bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700'>
            {loginError}
          </div>
        )}
      </div>

      <div className='text-center text-sm text-gray-500 max-w-md'>
        <p>A secure login window will open where you can sign in with your Planhat account.</p>
        <p className='text-xs mt-2'>Your credentials are never stored locally.</p>
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
        <h2 className='mb-2 text-2xl font-bold text-gray-900'>App Settings</h2>
        <p className='text-gray-600'>
          Configure app-specific settings. For general preferences, use <strong>File → Preferences</strong> (Cmd+,). Changes are saved automatically.
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

      <div className='grid grid-cols-1 gap-6 lg:grid-cols-2'>
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
