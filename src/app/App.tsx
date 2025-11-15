import React, { useState, useEffect } from 'react'

import { ConfigProvider } from 'antd'
import { clsx } from 'clsx'
import {
  AlertCircleIcon,
  WorkflowIcon,
  ChevronDownIcon,
  DatabaseIcon,
  LayersIcon,
  HammerIcon,
  ServerIcon,
  BrainIcon,
  LinkIcon,
  NetworkIcon,
  HomeIcon,
  Globe,
  ShieldIcon
} from 'lucide-react'
import { Toaster } from 'react-hot-toast'

import { toastService } from '@/services/toast.service'
import { useCurrentUser } from '@/api/queries/auth.queries'
import { SettingsModal } from '@/components/settings/SettingsModal'
import { TenantSelector } from '@/components/TenantSelector'
import { APP_VERSION } from '@/config/version'
import { authService } from '@/services/auth.service'
import { planhatBrowserService } from '@/services/planhat-browser.service'
import { useActiveTenant } from '@/stores/tenant.store'
import { logger } from '@/utils/logger'

import { ConnectedApis } from './components/ConnectedApis'
import { Endpoints } from './components/Endpoints'
import { FloatingExportProgress } from './components/ExportProgress'
import { FlexExporter } from './components/FlexExporter'
import { IssueExporter } from './components/IssueExporter'
import { LLMIntegration } from './components/LLMIntegration'
import { LoginPrompt } from './components/LoginPrompt'
import { LogzExplorer } from './components/LogzExplorer'
import { PermissionsExporter } from './components/PermissionsExporter'
// Preferences component removed - now using native electron-preferences dialog (File -> Preferences)
import { SalesforceIntegration } from './components/SalesforceIntegration'
import { WorkflowTemplateExporter } from './components/WorkflowExporter'
import { SampleDataProgressModal } from '../components/SampleDataProgress'
import { sampleDataService, type SampleDataProgress } from '../services/sample-data.service'

// Navigation items
type NavItem = 'home' | 'issues' | 'workflows' | 'flex' | 'permissions' | 'salesforce-integration' | 'logz-explorer' | 'llm-integration' | 'connected-apis' | 'endpoints'

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
      },
      {
        id: 'permissions',
        label: 'Permissions',
        icon: ShieldIcon,
        description: 'Export role and permission data'
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
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false)

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
      const validTabs: NavItem[] = ['issues', 'workflows', 'flex', 'salesforce-integration', 'logz-explorer', 'llm-integration', 'connected-apis', 'endpoints']
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
        toastService.error('Please login and select a tenant first')
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

      toastService.success('Sample data collection complete!')
    } catch (error) {
      log.error('[App] Error collecting sample data', { error })
      toastService.error(`Failed to collect sample data: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  // Listen for menu triggers
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

  // Listen for menu:open-preferences IPC message
  useEffect(() => {
    if (!window.electron?.ipcRenderer) {
      return
    }

    const handleOpenPreferences = () => {
      log.info('[App] Settings modal opened from menu')
      setIsSettingsModalOpen(true)
    }

    // Subscribe to IPC message
    const cleanup = window.electron.ipcRenderer.on('menu:open-preferences', handleOpenPreferences)

    return cleanup
  }, [log])


  const renderContent = (): React.ReactElement => {
    log.debug(`Rendering content for active tab: ${activeTab}`)

    switch (activeTab) {
      case 'issues':
        return <IssueExporter />
      case 'workflows':
        return <WorkflowTemplateExporter />
      case 'flex':
        return <FlexExporter />
      case 'permissions':
        return <PermissionsExporter />
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
      case 'home':
        return <Dashboard onNavigate={handleTabChange} />
      default:
        return <Dashboard onNavigate={handleTabChange} />
    }
  }

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
                    title='Return to home'
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
                  className='flex items-center justify-center p-2 text-sm font-medium transition-colors rounded-md text-gray-700 hover:text-gray-900 hover:bg-gray-100'
                  title='Open Planhat in a separate browser window'
                >
                  <Globe className='h-4 w-4' />
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
          position='bottom-right'
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
          onCancel={() => sampleDataService.cancelCollection()}
        />

        {/* Settings Modal */}
        <SettingsModal
          isOpen={isSettingsModalOpen}
          onClose={() => setIsSettingsModalOpen(false)}
        />
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

  useEffect(() => {
    log.debug('Dashboard component mounted')
    return () => {
      log.debug('Dashboard component unmounted')
    }
  }, [log])

  return (
    <div className='flex flex-col items-center justify-center min-h-[60vh] space-y-8'>
      <div className='flex h-24 w-24 items-center justify-center rounded-full bg-planhat-blue shadow-lg'>
        <span className='text-3xl font-bold text-white'>P</span>
      </div>

      <div className='text-center space-y-2'>
        <h1 className='text-3xl font-bold text-gray-900'>Welcome to Planhat Tools</h1>
        <p className='text-lg text-gray-600'>
          Powerful tools and utilities for the Planhat platform
        </p>
      </div>

      <div className='text-center text-sm text-gray-500 max-w-md'>
        <p>Select a category from the navigation above to get started</p>
      </div>
    </div>
  )
}

