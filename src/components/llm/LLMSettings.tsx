/**
 * LLM Settings Component
 *
 * Simplified LLM configuration for the Settings page
 * Handles PIN setup, API key management, and basic security settings
 */

import React, { useState, useEffect } from 'react'

import { Card, Button, Form, Input, Select, Alert, Space, Divider, Tooltip, Progress, Statistic, Table, Switch, Typography } from 'antd'
import { clsx } from 'clsx'
import {
  BrainIcon,
  KeyIcon,
  ShieldIcon,
  CheckCircleIcon,
  AlertCircleIcon,
  LockIcon,
  TestTubeIcon,
  DollarSignIcon,
  ActivityIcon,
  SettingsIcon,
  ListIcon
} from 'lucide-react'
import toast from 'react-hot-toast'

import { apiKeyManagerService } from '../../services/api-key-manager.service'
import { llmService } from '../../services/llm.service'
import { pinProtectionService } from '../../services/pin-protection.service'
import type { LLMProvider, LLMModel } from '../../types/llm'
import { logger } from '../../utils/logger'
import { storageManager } from '../../utils/storage-manager'

const { Text } = Typography

const log = logger.content

interface ProviderStatus {
  provider: LLMProvider
  name: string
  hasApiKey: boolean
  status: 'active' | 'inactive' | 'error'
  isEnabled?: boolean
  lastTested?: number
  testResult?: boolean
  testedModel?: string
  usage?: {
    requests: number
    tokens: number
    cost: number
  }
}

interface ModelStatus {
  provider: LLMProvider
  model: LLMModel
  isEnabled: boolean
  isLoading?: boolean
}

export const LLMSettings: React.FC = () => {
  const [form] = Form.useForm()
  const [loading, setLoading] = useState(false)
  const [isSessionValid, setIsSessionValid] = useState(false)
  const [showApiKeyForm, setShowApiKeyForm] = useState(false)
  const [selectedProvider, setSelectedProvider] = useState<LLMProvider | null>(null)
  const [providers, setProviders] = useState<ProviderStatus[]>([])
  const [testingProvider, setTestingProvider] = useState<LLMProvider | null>(null)
  const [showChangePinForm, setShowChangePinForm] = useState(false)
  const [changePinForm] = Form.useForm()
  const [hasCustomPin, setHasCustomPin] = useState(false)
  const [models, setModels] = useState<ModelStatus[]>([])
  const [loadingModels, setLoadingModels] = useState(false)
  const [showModelManagement, setShowModelManagement] = useState(false)

  const PROVIDER_INFO = {
    claude: { name: 'Anthropic Claude', keyPlaceholder: 'sk-ant-api03-...' },
    openai: { name: 'OpenAI GPT', keyPlaceholder: 'sk-proj-...' },
    gemini: { name: 'Google Gemini', keyPlaceholder: 'AI...' }
  }

  // Generate default PIN from current date (MMDDYY)
  const getDefaultPin = (): string => {
    const now = new Date()
    const month = (now.getMonth() + 1).toString().padStart(2, '0')
    const day = now.getDate().toString().padStart(2, '0')
    const year = now.getFullYear().toString().slice(-2)
    return `${month}${day}${year}`
  }

  useEffect(() => {
    loadStatus()
  }, [])

  const loadStatus = async () => {
    try {
      // Always try to unlock session with default PIN first
      const defaultPin = getDefaultPin()
      try {
        await pinProtectionService.verifyPin(defaultPin)
        setIsSessionValid(true)
        log.debug('Auto-unlocked session with default PIN')
      } catch {
        // If default PIN fails, check if session is already valid
        setIsSessionValid(pinProtectionService.isSessionValid())
      }

      // Load provider statuses
      const providerStatuses: ProviderStatus[] = [
        {
          provider: 'claude' as LLMProvider,
          name: PROVIDER_INFO.claude.name,
          hasApiKey: await apiKeyManagerService.hasApiKey('claude' as LLMProvider),
          status: 'inactive',
          isEnabled: true,
          usage: {
            requests: 0,
            tokens: 0,
            cost: 0
          }
        },
        {
          provider: 'openai' as LLMProvider,
          name: PROVIDER_INFO.openai.name,
          hasApiKey: await apiKeyManagerService.hasApiKey('openai' as LLMProvider),
          status: 'inactive',
          isEnabled: false,
          usage: {
            requests: 0,
            tokens: 0,
            cost: 0
          }
        },
        {
          provider: 'gemini' as LLMProvider,
          name: PROVIDER_INFO.gemini.name,
          hasApiKey: await apiKeyManagerService.hasApiKey('gemini' as LLMProvider),
          status: 'inactive',
          isEnabled: true,
          usage: {
            requests: 0,
            tokens: 0,
            cost: 0
          }
        }
      ]

      setProviders(providerStatuses)
      log.debug('LLM Settings status loaded', { isSessionValid, providers: providerStatuses })

      // Load model preferences
      await loadModelPreferences()

    } catch (error) {
      log.error('Failed to load LLM settings status', { error })
    }
  }

  const loadModelPreferences = async () => {
    try {
      const savedPreferences = await window.electron.storage.get(['llm-model-preferences'])
      log.debug('Loaded model preferences', { savedPreferences })
    } catch (error) {
      log.error('Failed to load model preferences', { error })
    }
  }

  const loadAvailableModels = async () => {
    if (!isSessionValid) {
      toast.error('Please unlock your session first')
      return
    }

    setLoadingModels(true)
    const newModels: ModelStatus[] = []

    try {
      const defaultPin = getDefaultPin()

      // Load models for each provider with API key
      for (const provider of providers) {
        if (!provider.hasApiKey) continue

        try {
          const apiKey = await apiKeyManagerService.getApiKey(provider.provider, defaultPin)
          if (!apiKey) continue

          const availableModels = await llmService.fetchAvailableModels(provider.provider, apiKey)

          // Get saved preferences for this provider
          const savedPreferences = await window.electron.storage.get(['llm-model-preferences'])
          const allPreferences = savedPreferences['llm-model-preferences'] ?? {}
          const providerPreferences = allPreferences[provider.provider] ?? {}

          // Add models with enabled status
          for (const model of availableModels) {
            newModels.push({
              provider: provider.provider,
              model,
              isEnabled: providerPreferences[model.modelId] ?? model.modelId.includes('claude-3-5-sonnet') // Default enable Claude 3.5 Sonnet
            })
          }

        } catch (error) {
          log.error(`Failed to load models for ${provider.provider}`, { error })
          toast.error(`Failed to load models for ${provider.name}`)
        }
      }

      setModels(newModels)
      log.debug('Loaded available models', { models: newModels })

    } catch (error) {
      log.error('Failed to load available models', { error })
      toast.error('Failed to load available models')
    } finally {
      setLoadingModels(false)
    }
  }

  const handleToggleModel = async (provider: LLMProvider, modelId: string, enabled: boolean) => {
    try {
      // Update local state
      setModels(prev => prev.map(m =>
        m.provider === provider && m.model.modelId === modelId
          ? { ...m, isEnabled: enabled, isLoading: true }
          : m
      ))

      // Save to storage
      const currentPreferences = await window.electron.storage.get(['llm-model-preferences'])
      const allPreferences = currentPreferences['llm-model-preferences'] ?? {}
      const providerPreferences = allPreferences[provider] ?? {}
      providerPreferences[modelId] = enabled

      await window.electron.storage.set({
        'llm-model-preferences': {
          ...allPreferences,
          [provider]: providerPreferences
        }
      })

      // Update loading state
      setModels(prev => prev.map(m =>
        m.provider === provider && m.model.modelId === modelId
          ? { ...m, isLoading: false }
          : m
      ))

      const modelName = models.find(m => m.provider === provider && m.model.modelId === modelId)?.model.displayName || modelId
      toast.success(`${modelName} ${enabled ? 'enabled' : 'disabled'}`)

    } catch (error) {
      log.error('Failed to toggle model', { provider, modelId, enabled, error })
      toast.error('Failed to update model preference')

      // Revert state on error
      setModels(prev => prev.map(m =>
        m.provider === provider && m.model.modelId === modelId
          ? { ...m, isEnabled: !enabled, isLoading: false }
          : m
      ))
    }
  }

  const handleUnlock = async (values: { pin: string }) => {
    setLoading(true)
    try {
      await pinProtectionService.verifyPin(values.pin)
      setIsSessionValid(true)
      form.resetFields()
      toast.success('Session unlocked')

    } catch (error) {
      log.error('PIN verification failed', { error })
      toast.error('Incorrect PIN')
    } finally {
      setLoading(false)
    }
  }

  const handleApiKeySetup = async (values: { apiKey: string }) => {
    if (!selectedProvider) return

    setLoading(true)
    try {
      const defaultPin = getDefaultPin()
      await apiKeyManagerService.storeApiKey(selectedProvider, values.apiKey, defaultPin)

      setShowApiKeyForm(false)
      setSelectedProvider(null)
      form.resetFields()
      toast.success(`${PROVIDER_INFO[selectedProvider].name} API key saved`)

      await loadStatus()

    } catch (error) {
      log.error('API key setup failed', { error })
      toast.error('Failed to save API key. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleRemoveApiKey = async (provider: LLMProvider) => {
    if (!isSessionValid) {
      toast.error('Please unlock your session first')
      return
    }

    try {
      const defaultPin = getDefaultPin()
      await apiKeyManagerService.removeApiKey(provider, defaultPin)
      toast.success(`${PROVIDER_INFO[provider].name} API key removed`)

      await loadStatus()

    } catch (error) {
      log.error('API key removal failed', { error })
      toast.error('Failed to remove API key.')
    }
  }

  const handleTestProvider = async (provider: LLMProvider) => {
    if (!isSessionValid) {
      toast.error('Please unlock your session first')
      return
    }

    setTestingProvider(provider)
    try {
      log.debug('Starting real connection test', { provider })

      // Get the encrypted API key for this provider
      const defaultPin = getDefaultPin()
      const apiKey = await apiKeyManagerService.getApiKey(provider, defaultPin)

      if (!apiKey) {
        toast.error('No API key found. Please configure your API key first.')
        setProviders(prev => prev.map(p =>
          p.provider === provider
            ? { ...p, lastTested: Date.now(), testResult: false }
            : p
        ))
        return
      }

      // Perform real connection test using LLM service
      const testResult = await llmService.testConnection(provider, apiKey)

      // Update provider status with test result
      setProviders(prev => prev.map(p =>
        p.provider === provider
          ? {
              ...p,
              lastTested: Date.now(),
              testResult: testResult.success,
              ...(testResult.success && testResult.model && {
                // Store tested model info if successful
                testedModel: testResult.model
              })
            }
          : p
      ))

      // Show appropriate toast message
      if (testResult.success) {
        toast.success(`${PROVIDER_INFO[provider].name} connection successful${testResult.model ? ` (${testResult.model})` : ''}`)
        log.info('Provider connection test successful', {
          provider,
          model: testResult.model,
          message: testResult.message
        })
      } else {
        toast.error(`${PROVIDER_INFO[provider].name}: ${testResult.message}`)
        log.warn('Provider connection test failed', {
          provider,
          message: testResult.message
        })
      }

    } catch (error) {
      log.error('Provider test failed with exception', { provider, error })

      // Update provider status to show test failure
      setProviders(prev => prev.map(p =>
        p.provider === provider
          ? { ...p, lastTested: Date.now(), testResult: false }
          : p
      ))

      if (error instanceof Error && error.message.includes('API key')) {
        toast.error('Invalid or missing API key. Please check your configuration.')
      } else {
        toast.error('Connection test failed. Please try again.')
      }
    } finally {
      setTestingProvider(null)
    }
  }

  const handleToggleProvider = async (provider: LLMProvider, enabled: boolean) => {
    try {
      setProviders(prev => prev.map(p =>
        p.provider === provider
          ? { ...p, isEnabled: enabled }
          : p
      ))

      toast.success(`${PROVIDER_INFO[provider].name} ${enabled ? 'enabled' : 'disabled'}`)
    } catch (error) {
      log.error('Failed to toggle provider', { provider, enabled, error })
      toast.error('Failed to update provider status')
    }
  }

  const handleChangePin = async (values: { currentPin: string; newPin: string; confirmPin: string }) => {
    if (values.newPin !== values.confirmPin) {
      toast.error('New PIN and confirmation do not match')
      return
    }

    if (values.newPin.length < 4) {
      toast.error('PIN must be at least 4 characters long')
      return
    }

    setLoading(true)
    try {
      await pinProtectionService.changePin(values.currentPin, values.newPin)
      setHasCustomPin(true) // User now has a custom PIN
      setShowChangePinForm(false)
      changePinForm.resetFields()
      setIsSessionValid(false) // Force re-authentication with new PIN
      toast.success('PIN changed successfully. Please unlock with your new PIN.')
    } catch (error) {
      log.error('PIN change failed', { error })
      toast.error('Failed to change PIN. Please check your current PIN.')
    } finally {
      setLoading(false)
    }
  }

  // If session is locked, show unlock form
  if (!isSessionValid) {
    return (
      <div className="space-y-4">
        <Alert
          message="Session Locked"
          description="Enter your PIN to access LLM settings. If you haven't set a custom PIN, try today's date in MMDDYY format."
          type="warning"
          icon={<LockIcon className="h-4 w-4" />}
          showIcon
        />

        <Card title="Unlock Session" className="max-w-md">
          <Form form={form} onFinish={handleUnlock} layout="vertical">
            <Form.Item
              name="pin"
              label="Enter PIN"
              rules={[{ required: true, message: 'Please enter your PIN' }]}
              extra="Hint: If you haven't set a custom PIN, try today's date in MMDDYY format"
            >
              <Input.Password placeholder="Enter your PIN" />
            </Form.Item>

            <Form.Item>
              <Button type="primary" htmlType="submit" loading={loading} icon={<LockIcon className="h-4 w-4" />}>
                Unlock
              </Button>
            </Form.Item>
          </Form>
        </Card>
      </div>
    )
  }

  // Calculate overall stats
  const totalUsage = providers.reduce((acc, p) => ({
    requests: acc.requests + (p.usage?.requests ?? 0),
    tokens: acc.tokens + (p.usage?.tokens ?? 0),
    cost: acc.cost + (p.usage?.cost ?? 0)
  }), { requests: 0, tokens: 0, cost: 0 })

  const activeProviders = providers.filter(p => p.hasApiKey && p.isEnabled).length

  // Main LLM settings interface
  return (
    <div className="space-y-6">
      {/* Usage Overview */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card size="small">
          <Statistic
            title="Active Providers"
            value={activeProviders}
            valueStyle={{ color: '#1890ff', fontSize: '24px' }}
            prefix={<ActivityIcon className="h-5 w-5" />}
          />
        </Card>
        <Card size="small">
          <Statistic
            title="Total Requests"
            value={totalUsage.requests}
            valueStyle={{ color: '#52c41a', fontSize: '24px' }}
          />
        </Card>
        <Card size="small">
          <Statistic
            title="Total Tokens"
            value={totalUsage.tokens}
            valueStyle={{ color: '#722ed1', fontSize: '24px' }}
          />
        </Card>
        <Card size="small">
          <Statistic
            title="Total Cost"
            value={totalUsage.cost}
            precision={2}
            prefix="$"
            valueStyle={{ color: '#fa8c16', fontSize: '24px' }}
          />
        </Card>
      </div>

      {/* PIN Management Section */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <ShieldIcon className="h-5 w-5 text-blue-600" />
            <h4 className="text-sm font-medium text-gray-900">Security Settings</h4>
          </div>
          <Button
            size="small"
            icon={<SettingsIcon className="h-3 w-3" />}
            onClick={() => setShowChangePinForm(true)}
          >
            Change PIN
          </Button>
        </div>
        <p className="text-sm text-gray-600">
          PIN Status: <strong>{hasCustomPin ? 'Custom PIN configured' : 'Using default PIN'}</strong>
          <br />
          <span className="text-xs text-gray-500">
            {hasCustomPin ? 'Your API keys are protected by your custom PIN' : 'Recommendation: Set a custom PIN for better security'}
          </span>
        </p>
      </div>

      <div>
        <h4 className="text-sm font-medium text-gray-900">AI Provider Configuration</h4>
        <p className="text-sm text-gray-500">Configure API keys, test connections, and manage your AI providers</p>
      </div>

      {/* Provider Configuration Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
        {providers.map((provider) => (
          <Card
            key={provider.provider}
            className={clsx(
              'transition-all duration-200 hover:shadow-md',
              provider.hasApiKey && provider.isEnabled
                ? 'border-green-200 bg-green-50'
                : provider.hasApiKey
                ? 'border-yellow-200 bg-yellow-50'
                : 'border-gray-200'
            )}
            size="small"
          >
            {/* Header with Status */}
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-2">
                <BrainIcon className={clsx(
                  'h-5 w-5',
                  provider.hasApiKey && provider.isEnabled
                    ? 'text-green-600'
                    : provider.hasApiKey
                    ? 'text-yellow-600'
                    : 'text-gray-400'
                )} />
                <div className="font-medium text-sm">{provider.name}</div>
              </div>

              {/* Status Badge */}
              {provider.hasApiKey ? (
                <div className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-green-700 bg-green-100 rounded-full">
                  <CheckCircleIcon className="h-3 w-3" />
                  {provider.isEnabled ? 'Active' : 'Inactive'}
                </div>
              ) : (
                <div className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-gray-500 bg-gray-100 rounded-full">
                  <AlertCircleIcon className="h-3 w-3" />
                  Not Configured
                </div>
              )}
            </div>

            {/* Usage Stats */}
            {provider.hasApiKey && provider.usage && (
              provider.usage.requests > 0 || provider.usage.tokens > 0 || provider.usage.cost > 0 ? (
                <div className="grid grid-cols-3 gap-2 mb-3 p-2 bg-white rounded border">
                  <Statistic
                    title="Requests"
                    value={provider.usage.requests}
                    valueStyle={{ fontSize: '12px' }}
                  />
                  <Statistic
                    title="Tokens"
                    value={provider.usage.tokens}
                    valueStyle={{ fontSize: '12px' }}
                  />
                  <Statistic
                    title="Cost"
                    value={provider.usage.cost}
                    precision={4}
                    prefix="$"
                    valueStyle={{ fontSize: '12px' }}
                  />
                </div>
              ) : (
                <div className="mb-3 p-2 bg-gray-50 rounded border text-center text-xs text-gray-500">
                  No usage yet
                </div>
              )
            )}

            {/* Test Status */}
            {provider.hasApiKey && provider.lastTested && (
              <div className="mb-3 p-2 bg-gray-50 rounded border text-xs">
                <div className={clsx(
                  'flex items-center gap-2 mb-1',
                  provider.testResult ? 'text-green-600' : 'text-red-600'
                )}>
                  <div className={clsx(
                    'w-2 h-2 rounded-full',
                    provider.testResult ? 'bg-green-500' : 'bg-red-500'
                  )} />
                  <span className="font-medium">
                    Last test: {provider.testResult ? 'Success' : 'Failed'}
                  </span>
                </div>
                <div className="text-gray-500 ml-4">
                  {new Date(provider.lastTested).toLocaleTimeString()}
                  {provider.testResult && provider.testedModel && (
                    <span className="ml-2">• {provider.testedModel}</span>
                  )}
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="space-y-2">
              <div className="flex gap-2">
                <Button
                  size="small"
                  icon={<KeyIcon className="h-3 w-3" />}
                  onClick={() => {
                    setSelectedProvider(provider.provider)
                    setShowApiKeyForm(true)
                  }}
                  type={provider.hasApiKey ? 'default' : 'primary'}
                  className="flex-1"
                >
                  {provider.hasApiKey ? 'Update' : 'Setup'}
                </Button>

                {provider.hasApiKey && (
                  <Tooltip title="Test Connection">
                    <Button
                      size="small"
                      icon={<TestTubeIcon className="h-3 w-3" />}
                      onClick={() => handleTestProvider(provider.provider)}
                      loading={testingProvider === provider.provider}
                    />
                  </Tooltip>
                )}
              </div>

              {provider.hasApiKey && (
                <div className="flex justify-between items-center">
                  <Button
                    size="small"
                    type="text"
                    danger
                    onClick={() => handleRemoveApiKey(provider.provider)}
                  >
                    Remove
                  </Button>

                  <Button
                    size="small"
                    type={provider.isEnabled ? 'default' : 'primary'}
                    onClick={() => handleToggleProvider(provider.provider, !provider.isEnabled)}
                  >
                    {provider.isEnabled ? 'Disable' : 'Enable'}
                  </Button>
                </div>
              )}
            </div>
          </Card>
        ))}
      </div>

      {/* API Key Setup Form */}
      {showApiKeyForm && selectedProvider && (
        <Card
          title={`Configure ${PROVIDER_INFO[selectedProvider].name}`}
          className="max-w-md mx-auto"
          extra={
            <Button
              type="text"
              size="small"
              onClick={() => {
                setShowApiKeyForm(false)
                setSelectedProvider(null)
                form.resetFields()
              }}
            >
              ×
            </Button>
          }
        >
          <Form form={form} onFinish={handleApiKeySetup} layout="vertical">
            <Form.Item
              name="apiKey"
              label="API Key"
              rules={[{ required: true, message: 'Please enter your API key' }]}
              extra="Your API key will be encrypted and stored securely"
            >
              <Input.Password
                placeholder={PROVIDER_INFO[selectedProvider].keyPlaceholder}
                autoFocus
              />
            </Form.Item>

            <Form.Item>
              <Space className="w-full justify-end">
                <Button onClick={() => {
                  setShowApiKeyForm(false)
                  setSelectedProvider(null)
                  form.resetFields()
                }}>
                  Cancel
                </Button>
                <Button type="primary" htmlType="submit" loading={loading} icon={<KeyIcon className="h-4 w-4" />}>
                  Save API Key
                </Button>
              </Space>
            </Form.Item>
          </Form>
        </Card>
      )}

      {/* Change PIN Form */}
      {showChangePinForm && (
        <Card
          title="Change PIN"
          className="max-w-md mx-auto"
          extra={
            <Button
              type="text"
              size="small"
              onClick={() => {
                setShowChangePinForm(false)
                changePinForm.resetFields()
              }}
            >
              ×
            </Button>
          }
        >
          <Form
            form={changePinForm}
            onFinish={handleChangePin}
            layout="vertical"
          >
            <Alert
              message="Current PIN Information"
              description={hasCustomPin
                ? 'Enter your current custom PIN to change it to a new one.'
                : "If you haven't set a custom PIN yet, your current PIN is today's date in MMDDYY format (e.g., September 25, 2025 = 092525)"}
              type="info"
              showIcon
              className="mb-4"
            />

            <Form.Item
              name="currentPin"
              label="Current PIN"
              rules={[{ required: true, message: 'Please enter your current PIN' }]}
            >
              <Input.Password placeholder="Enter current PIN" />
            </Form.Item>

            <Form.Item
              name="newPin"
              label="New PIN"
              rules={[
                { required: true, message: 'Please enter a new PIN' },
                { min: 4, message: 'PIN must be at least 4 characters long' }
              ]}
            >
              <Input.Password placeholder="Enter new PIN (min 4 characters)" />
            </Form.Item>

            <Form.Item
              name="confirmPin"
              label="Confirm New PIN"
              rules={[{ required: true, message: 'Please confirm your new PIN' }]}
            >
              <Input.Password placeholder="Confirm new PIN" />
            </Form.Item>

            <Form.Item>
              <Space className="w-full justify-end">
                <Button onClick={() => {
                  setShowChangePinForm(false)
                  changePinForm.resetFields()
                }}>
                  Cancel
                </Button>
                <Button
                  type="primary"
                  htmlType="submit"
                  loading={loading}
                  icon={<ShieldIcon className="h-4 w-4" />}
                >
                  Change PIN
                </Button>
              </Space>
            </Form.Item>
          </Form>
        </Card>
      )}

      {/* Model Management Section */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h4 className="text-sm font-medium text-gray-900 flex items-center gap-2">
              <ListIcon className="h-4 w-4" />
              Model Management
            </h4>
            <p className="text-sm text-gray-500">Enable/disable specific models for use in chat</p>
          </div>
          <Space>
            <Button
              size="small"
              onClick={loadAvailableModels}
              loading={loadingModels}
              disabled={providers.filter(p => p.hasApiKey).length === 0}
            >
              {models.length > 0 ? 'Refresh Models' : 'Load Models'}
            </Button>
            {models.length > 0 && (
              <Button
                size="small"
                type={showModelManagement ? 'default' : 'primary'}
                onClick={() => setShowModelManagement(!showModelManagement)}
              >
                {showModelManagement ? 'Hide Models' : 'Manage Models'}
              </Button>
            )}
          </Space>
        </div>

        {providers.filter(p => p.hasApiKey).length === 0 && (
          <Alert
            message="No API Keys Configured"
            description="Configure at least one API key to manage models"
            type="info"
            showIcon
            className="mb-4"
          />
        )}

        {models.length === 0 && providers.filter(p => p.hasApiKey).length > 0 && !loadingModels && (
          <Alert
            message="No Models Loaded"
            description="Click 'Load Models' to fetch available models from your configured providers"
            type="info"
            showIcon
            className="mb-4"
          />
        )}

        {showModelManagement && models.length > 0 && (
          <Card size="small" className="mb-4">
            <Table
              dataSource={models}
              pagination={false}
              size="small"
              rowKey={(record) => `${record.provider}-${record.model.modelId}`}
              columns={[
                {
                  title: 'Provider',
                  dataIndex: 'provider',
                  key: 'provider',
                  width: 120,
                  render: (provider: LLMProvider) => (
                    <Text strong className="capitalize">
                      {PROVIDER_INFO[provider].name.split(' ')[0]}
                    </Text>
                  )
                },
                {
                  title: 'Model',
                  key: 'model',
                  render: (_, record: ModelStatus) => (
                    <div>
                      <div className="font-medium">{record.model.displayName}</div>
                      <div className="text-xs text-gray-500">{record.model.modelId}</div>
                    </div>
                  )
                },
                {
                  title: 'Context',
                  dataIndex: ['model', 'maxTokens'],
                  key: 'maxTokens',
                  width: 100,
                  render: (maxTokens: number) => (
                    <Text className="text-sm">
                      {maxTokens ? `${(maxTokens / 1000).toFixed(0)}K` : 'N/A'}
                    </Text>
                  )
                },
                {
                  title: 'Enabled',
                  key: 'enabled',
                  width: 80,
                  render: (_, record: ModelStatus) => (
                    <Switch
                      size="small"
                      checked={record.isEnabled}
                      loading={record.isLoading}
                      onChange={(checked) => handleToggleModel(record.provider, record.model.modelId, checked)}
                    />
                  )
                }
              ]}
            />

            <div className="mt-3 pt-3 border-t">
              <div className="flex justify-between items-center text-xs text-gray-500">
                <span>
                  {models.filter(m => m.isEnabled).length} of {models.length} models enabled
                </span>
                <span>
                  Only enabled models will be available in chat
                </span>
              </div>
            </div>
          </Card>
        )}
      </div>

      <Divider />

      <div className="text-xs text-gray-500">
        <p className="mb-1">
          <strong>Security:</strong> All API keys are encrypted with AES-256 and protected by your PIN.
        </p>
        <p>
          <strong>Privacy:</strong> Your API keys never leave your browser and are only decrypted when needed.
        </p>
      </div>
    </div>
  )
}