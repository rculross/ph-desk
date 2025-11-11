import React, { useState, useEffect } from 'react'

import { Select, Button, Badge, Drawer, Form, Slider, InputNumber, Alert, Input } from 'antd'
import { clsx } from 'clsx'
import {
  BrainIcon,
  SettingsIcon,
  LockIcon,
  UnlockIcon,
  TrashIcon
} from 'lucide-react'
import { toastService } from '@/services/toast.service'

import { ChatInterface } from '../../components/llm/ChatInterface'
import { PinEntryModal } from '../../components/llm/PinEntryModal'
import {
  ToolHeader,
  ToolHeaderControls,
  ToolHeaderButton,
  ToolHeaderDivider
} from '../../components/ui/ToolHeader'
import { apiKeyManagerService } from '../../services/api-key-manager.service'
import { getDefaultPin } from '../../services/default-pin.service'
import { llmService } from '../../services/llm.service'
import { pinProtectionService } from '../../services/pin-protection.service'
import type {
  LLMProvider,
  LLMModel,
  LLMRequestOptions,
  UsageStats,
  CostTracking,
  ChatMessage
} from '../../types/llm'
import { CONTROL_CATEGORIES } from '../../types/ui'
import { logger } from '../../utils/logger'
import { storageManager } from '../../utils/storage-manager'

const log = logger.content

// Mock data for demonstration - in a real implementation, this would come from services
const MOCK_PROVIDERS: Record<LLMProvider, {
  name: string
  baseURL: string
  models: LLMModel[]
  keyPlaceholder: string
  description: string
}> = {
  claude: {
    name: 'Anthropic Claude',
    baseURL: 'https://api.anthropic.com/v1',
    keyPlaceholder: 'sk-ant-api03-...',
    description: 'Claude API key from Anthropic Console',
    models: [
      {
        modelId: 'claude-3-opus-20240229',
        displayName: 'Claude 3 Opus',
        description: 'Most powerful model for complex tasks',
        maxTokens: 200000,
        costPer1kTokens: { input: 0.015, output: 0.075 },
        capabilities: { streaming: true, vision: true, functionCalling: false }
      },
      {
        modelId: 'claude-3-sonnet-20240229',
        displayName: 'Claude 3 Sonnet',
        description: 'Balanced performance and speed',
        maxTokens: 200000,
        costPer1kTokens: { input: 0.003, output: 0.015 },
        capabilities: { streaming: true, vision: true, functionCalling: false }
      },
      {
        modelId: 'claude-3-haiku-20240307',
        displayName: 'Claude 3 Haiku',
        description: 'Fastest model for simple tasks',
        maxTokens: 200000,
        costPer1kTokens: { input: 0.00025, output: 0.00125 },
        capabilities: { streaming: true, vision: true, functionCalling: false }
      }
    ]
  },
  openai: {
    name: 'OpenAI',
    baseURL: 'https://api.openai.com/v1',
    keyPlaceholder: 'sk-...',
    description: 'OpenAI API key from platform.openai.com',
    models: [
      {
        modelId: 'gpt-4-turbo-preview',
        displayName: 'GPT-4 Turbo',
        description: 'Latest GPT-4 model with 128K context',
        maxTokens: 128000,
        costPer1kTokens: { input: 0.01, output: 0.03 },
        capabilities: { streaming: true, vision: true, functionCalling: true }
      },
      {
        modelId: 'gpt-3.5-turbo',
        displayName: 'GPT-3.5 Turbo',
        description: 'Fast and affordable model',
        maxTokens: 16000,
        costPer1kTokens: { input: 0.0005, output: 0.0015 },
        capabilities: { streaming: true, vision: false, functionCalling: true }
      }
    ]
  },
  gemini: {
    name: 'Google Gemini',
    baseURL: 'https://generativelanguage.googleapis.com/v1beta',
    keyPlaceholder: 'AIza...',
    description: 'Google AI Studio API key',
    models: [
      {
        modelId: 'gemini-pro',
        displayName: 'Gemini Pro',
        description: 'Optimized for text generation',
        maxTokens: 32768,
        costPer1kTokens: { input: 0.00025, output: 0.0005 },
        capabilities: { streaming: true, vision: false, functionCalling: true }
      },
      {
        modelId: 'gemini-pro-vision',
        displayName: 'Gemini Pro Vision',
        description: 'Multimodal model with vision capabilities',
        maxTokens: 16384,
        costPer1kTokens: { input: 0.00025, output: 0.0005 },
        capabilities: { streaming: true, vision: true, functionCalling: false }
      }
    ]
  }
}

interface LLMIntegrationProps {
  className?: string
}

export const LLMIntegration: React.FC<LLMIntegrationProps> = ({ className }) => {
  const [isSessionValid, setIsSessionValid] = useState(false)
  const [showPinModal, setShowPinModal] = useState(false)
  const [showSettingsDrawer, setShowSettingsDrawer] = useState(false)
  const [selectedProvider, setSelectedProvider] = useState<LLMProvider>()
  const [selectedModel, setSelectedModel] = useState<string>('')
  const [configuredProviders, setConfiguredProviders] = useState<any[]>([])
  const [usageStats, setUsageStats] = useState<UsageStats[]>([])
  const [costTracking, setCostTracking] = useState<CostTracking>()
  const [availableModels, setAvailableModels] = useState<Array<{ provider: LLMProvider; model: LLMModel; isEnabled: boolean }>>([])
  const [loadingModels, setLoadingModels] = useState(false)

  // Chat settings state
  const [temperature, setTemperature] = useState(0.7)
  const [maxTokens, setMaxTokens] = useState(1000)
  const [systemPrompt, setSystemPrompt] = useState('')

  const [settingsForm] = Form.useForm()

  useEffect(() => {
    checkSessionStatus()
    loadConfiguredProviders()
    loadUsageStats()
  }, [])

  // Load models when session becomes valid
  useEffect(() => {
    if (isSessionValid) {
      loadAvailableModels()
    }
  }, [isSessionValid])

  const checkSessionStatus = () => {
    const isValid = pinProtectionService.isSessionValid()
    setIsSessionValid(isValid)
  }

  const loadConfiguredProviders = async () => {
    // Mock implementation - replace with actual service calls
    try {
      // This would normally load from the LLM service
      setConfiguredProviders([
        {
          provider: 'claude' as LLMProvider,
          name: MOCK_PROVIDERS.claude.name,
          hasApiKey: false,
          selectedModel: undefined,
          models: MOCK_PROVIDERS.claude.models,
          status: 'inactive' as const,
          lastUsed: undefined,
          usage: { requests: 0, tokens: 0, cost: 0 }
        }
      ])
    } catch (error) {
      log.error('Failed to load configured providers', { error })
    }
  }

  const loadUsageStats = async () => {
    // Mock implementation - replace with actual service calls
    try {
      setUsageStats([])
      setCostTracking({
        daily: {},
        monthly: {},
        byProvider: { claude: 0, openai: 0, gemini: 0 },
        byModel: {},
        total: 0
      })
    } catch (error) {
      log.error('Failed to load usage stats', { error })
    }
  }

  const loadAvailableModels = async () => {
    if (!isSessionValid) {
      log.debug('Session not valid, skipping model load')
      return
    }

    setLoadingModels(true)
    const newModels: Array<{ provider: LLMProvider; model: LLMModel; isEnabled: boolean }> = []

    try {
      const defaultPin = getDefaultPin()
      const providers: LLMProvider[] = ['claude', 'openai', 'gemini']

      // Load models for each provider that has an API key
      for (const provider of providers) {
        try {
          const hasApiKey = await apiKeyManagerService.hasApiKey(provider)
          if (!hasApiKey) continue

          const apiKey = await apiKeyManagerService.getApiKey(provider, defaultPin)
          if (!apiKey) continue

          const models = await llmService.fetchAvailableModels(provider, apiKey)

          // Get saved preferences for this provider
          const savedPreferences = await window.electron.storage.get(['llm-model-preferences'])
          const allPreferences = savedPreferences['llm-model-preferences'] ?? {}
          const providerPreferences = allPreferences[provider] ?? {}

          // Add models with enabled status
          for (const model of models) {
            newModels.push({
              provider,
              model,
              isEnabled: providerPreferences[model.modelId] ?? model.modelId.includes('claude-3-5-sonnet') // Default enable Claude 3.5 Sonnet
            })
          }

        } catch (error) {
          log.error(`Failed to load models for ${provider}`, { error })
        }
      }

      setAvailableModels(newModels)
      log.debug('Loaded available models', { models: newModels })

      // Auto-select first enabled model if none selected
      if (newModels.length > 0 && (!selectedProvider || !selectedModel)) {
        const firstEnabledModel = newModels.find(m => m.isEnabled)
        if (firstEnabledModel) {
          setSelectedProvider(firstEnabledModel.provider)
          setSelectedModel(firstEnabledModel.model.modelId)
          log.debug('Auto-selected first enabled model', {
            provider: firstEnabledModel.provider,
            model: firstEnabledModel.model.modelId
          })
        }
      }

    } catch (error) {
      log.error('Failed to load available models', { error })
    } finally {
      setLoadingModels(false)
    }
  }

  const handleSessionExpired = () => {
    setIsSessionValid(false)
    toastService.error('Session expired. Please authenticate to continue.')
  }

  const handleSessionUnlocked = () => {
    setIsSessionValid(true)
    setShowPinModal(false)
    toastService.success('Session unlocked successfully')
    loadAvailableModels() // Reload models when session is unlocked
  }

  const handleModelChange = (provider: LLMProvider, modelId: string) => {
    setSelectedProvider(provider)
    setSelectedModel(modelId)
    log.debug('Model selection changed', { provider, model: modelId })
  }

  const handleUnlockClick = () => {
    setShowPinModal(true)
  }

  const handleClearChat = () => {
    // The ChatInterface component will handle the actual clearing
    // This is just a placeholder for any parent-level logic if needed
  }

  // LLM service handlers - using actual implementations
  const handleSendMessage = async (
    message: string,
    provider: LLMProvider,
    options: LLMRequestOptions
  ): Promise<AsyncIterableIterator<string>> => {
    log.debug('Sending message to LLM', { provider, message: message.slice(0, 100) })

    try {
      const defaultPin = getDefaultPin()
      const apiKey = await apiKeyManagerService.getApiKey(provider, defaultPin)

      if (!apiKey) {
        throw new Error(`No API key found for ${provider}`)
      }

      // Convert message to ChatMessage format expected by LLM service
      const chatMessage: ChatMessage = {
        id: `msg_${Date.now()}`,
        role: 'user',
        content: message,
        timestamp: Date.now()
      }

      const response = await llmService.chat(provider, [chatMessage], apiKey, options)

      // Convert LLMResponse to streaming format
      async function* streamResponse() {
        const words = response.content.split(' ')
        for (const word of words) {
          await new Promise(resolve => setTimeout(resolve, 20))
          yield `${word} `
        }
      }

      return streamResponse()

    } catch (error) {
      log.error('Failed to send message to LLM', { provider, error })

      // Return error stream
      async function* errorStream() {
        yield `Error: ${error instanceof Error ? error.message : 'Failed to send message'}`
      }

      return errorStream()
    }
  }

  const handleSaveApiKey = async (
    provider: LLMProvider,
    apiKey: string,
    selectedModel: string,
    pin: string
  ) => {
    try {
      log.info('Saving API key', { provider, model: selectedModel })

      // Mock implementation - replace with actual encryption and storage
      await new Promise(resolve => setTimeout(resolve, 1000))

      // Update configured providers
      setConfiguredProviders(prev =>
        prev.map(p =>
          p.provider === provider
            ? { ...p, hasApiKey: true, selectedModel, status: 'active' }
            : p
        )
      )

      log.info('API key saved successfully', { provider })
    } catch (error) {
      log.error('Failed to save API key', { provider, error })
      throw error
    }
  }

  const handleTestApiKey = async (
    provider: LLMProvider,
    apiKey: string,
    model: string
  ): Promise<boolean> => {
    try {
      log.debug('Testing API key', { provider, model })

      // Mock implementation - replace with actual API test
      await new Promise(resolve => setTimeout(resolve, 2000))

      // Random success/failure for demo
      const isValid = Math.random() > 0.3

      log.debug('API key test result', { provider, model, isValid })
      return isValid
    } catch (error) {
      log.error('API key test failed', { provider, model, error })
      return false
    }
  }

  const handleRemoveProvider = async (provider: LLMProvider, pin: string) => {
    try {
      log.info('Removing provider', { provider })

      // Mock implementation
      await new Promise(resolve => setTimeout(resolve, 1000))

      setConfiguredProviders(prev => prev.filter(p => p.provider !== provider))
      log.info('Provider removed successfully', { provider })
    } catch (error) {
      log.error('Failed to remove provider', { provider, error })
      throw error
    }
  }

  const handleTestProvider = async (provider: LLMProvider): Promise<boolean> => {
    try {
      log.debug('Testing provider connection', { provider })
      await new Promise(resolve => setTimeout(resolve, 1500))
      return Math.random() > 0.2
    } catch (error) {
      log.error('Provider test failed', { provider, error })
      return false
    }
  }

  const handleToggleProvider = async (provider: LLMProvider, enabled: boolean) => {
    try {
      log.info('Toggling provider status', { provider, enabled })

      await new Promise(resolve => setTimeout(resolve, 500))

      setConfiguredProviders(prev =>
        prev.map(p =>
          p.provider === provider
            ? { ...p, status: enabled ? 'active' : 'inactive' }
            : p
        )
      )
    } catch (error) {
      log.error('Failed to toggle provider', { provider, enabled, error })
      throw error
    }
  }

  const getEnabledProviders = () => {
    const enabled = configuredProviders
      .filter(p => p.status === 'active' && p.hasApiKey)
      .reduce((acc, p) => {
        acc[p.provider] = {
          name: p.name,
          models: p.models,
          enabled: true
        }
        return acc
      }, {} as Record<LLMProvider, { name: string; models: LLMModel[]; enabled: boolean }>)

    return enabled
  }

  const getAvailableProviders = () => {
    return configuredProviders
      .filter(p => p.status === 'active' && p.hasApiKey)
      .map(p => ({
        value: p.provider,
        label: p.name,
        models: p.models
      }))
  }

  const getAvailableModels = () => {
    if (!selectedProvider) return []

    const provider = configuredProviders.find(p => p.provider === selectedProvider)
    return provider?.models.map((m: any) => ({
      value: m.modelId,
      label: m.displayName,
      description: m.description
    })) ?? []
  }

  // Initialize with first available provider
  useEffect(() => {
    const availableProviders = getAvailableProviders()
    if (availableProviders.length > 0 && !selectedProvider) {
      const firstProvider = availableProviders[0]
      if (firstProvider) {
        setSelectedProvider(firstProvider.value)

        if (firstProvider.models && firstProvider.models.length > 0) {
          setSelectedModel(firstProvider.models[0].modelId)
        }
      }
    }
  }, [configuredProviders, selectedProvider])

  const availableProviders = getAvailableProviders()
  const availableModelsForSelection = getAvailableModels()

  return (
    <div className={clsx('space-y-4', className)}>
      {/* Security Status Banner */}
      {!isSessionValid && (
        <Alert
          message="Authentication Required"
          description="Please unlock your session to access LLM features. Your API keys are encrypted and require PIN verification."
          type="warning"
          showIcon
          action={
            <Button
              type="primary"
              size="small"
              onClick={handleUnlockClick}
            >
              Unlock Session
            </Button>
          }
        />
      )}

      {/* Toolbar */}
      <ToolHeader title="AI Chat" icon={BrainIcon}>
        <ToolHeaderControls category={CONTROL_CATEGORIES.SELECTION}>
          <Select
            placeholder="Select Provider"
            value={selectedProvider}
            onChange={setSelectedProvider}
            disabled={!isSessionValid || availableProviders.length === 0}
            style={{ minWidth: 150 }}
            options={availableProviders}
          />
          <Select
            placeholder="Select Model"
            value={selectedModel}
            onChange={setSelectedModel}
            disabled={!isSessionValid || !selectedProvider || availableModelsForSelection.length === 0}
            style={{ minWidth: 180 }}
            options={availableModelsForSelection}
          />
        </ToolHeaderControls>

        <ToolHeaderDivider />

        <ToolHeaderControls category={CONTROL_CATEGORIES.ACTIONS}>
          <ToolHeaderButton
            category={CONTROL_CATEGORIES.SETTINGS}
            icon={<SettingsIcon className="h-4 w-4" />}
            onClick={() => setShowSettingsDrawer(true)}
            disabled={!isSessionValid}
          >
            Settings
          </ToolHeaderButton>

          <ToolHeaderButton
            category={CONTROL_CATEGORIES.ACTIONS}
            icon={<TrashIcon className="h-4 w-4" />}
            onClick={handleClearChat}
            disabled={!isSessionValid}
          >
            Clear Chat
          </ToolHeaderButton>

          <Badge
            count={isSessionValid ? null : '!'}
            status={isSessionValid ? 'success' : 'error'}
          >
            <Button
              size="small"
              icon={isSessionValid ? <UnlockIcon className="h-4 w-4" /> : <LockIcon className="h-4 w-4" />}
              onClick={isSessionValid ? undefined : handleUnlockClick}
              type={isSessionValid ? 'default' : 'primary'}
            >
              {isSessionValid ? 'Unlocked' : 'Locked'}
            </Button>
          </Badge>
        </ToolHeaderControls>
      </ToolHeader>

      {/* Chat Interface */}
      {isSessionValid && selectedProvider && selectedModel ? (
        <div className="bg-white rounded-lg border shadow-sm" style={{ height: 'calc(100vh - 280px)' }}>
          <ChatInterface
            providers={getEnabledProviders()}
            onSendMessage={handleSendMessage}
            selectedProvider={selectedProvider}
            selectedModel={selectedModel}
            temperature={temperature}
            maxTokens={maxTokens}
            systemPrompt={systemPrompt}
            onClearChat={handleClearChat}
            onModelChange={handleModelChange}
            availableModels={availableModels}
            showModelSelector={true}
            usageStats={usageStats}
            costTracking={costTracking}
          />
        </div>
      ) : (
        <div className="bg-white rounded-lg border shadow-sm p-8 text-center text-gray-500">
          {!isSessionValid ? (
            <div>
              <LockIcon className="h-12 w-12 mx-auto mb-4 text-gray-300" />
              <p>Please unlock your session to start chatting</p>
            </div>
          ) : availableProviders.length === 0 ? (
            <div>
              <BrainIcon className="h-12 w-12 mx-auto mb-4 text-gray-300" />
              <p>No AI providers configured</p>
              <p className="text-sm mt-1">Configure your API keys in Settings</p>
            </div>
          ) : (
            <div>
              <BrainIcon className="h-12 w-12 mx-auto mb-4 text-gray-300" />
              <p>Select a provider and model to start chatting</p>
            </div>
          )}
        </div>
      )}

      {/* Settings Drawer */}
      <Drawer
        title="Chat Settings"
        placement="right"
        open={showSettingsDrawer}
        onClose={() => setShowSettingsDrawer(false)}
        width={400}
      >
        <Form
          form={settingsForm}
          layout="vertical"
          initialValues={{
            temperature,
            maxTokens,
            systemPrompt
          }}
        >
          <Form.Item
            label="Temperature"
            name="temperature"
            help="Higher values make responses more creative, lower values more focused"
          >
            <Slider
              min={0}
              max={1}
              step={0.1}
              value={temperature}
              onChange={setTemperature}
              marks={{
                0: '0',
                0.5: '0.5',
                1: '1'
              }}
            />
          </Form.Item>

          <Form.Item
            label="Max Tokens"
            name="maxTokens"
            help="Maximum length of the response"
          >
            <InputNumber
              min={100}
              max={4000}
              value={maxTokens}
              onChange={(value) => setMaxTokens(value ?? 1000)}
              style={{ width: '100%' }}
            />
          </Form.Item>

          <Form.Item
            label="System Prompt"
            name="systemPrompt"
            help="Instructions for how the AI should behave"
          >
            <Input.TextArea
              rows={4}
              placeholder="You are a helpful assistant..."
              value={systemPrompt}
              onChange={(e) => setSystemPrompt(e.target.value)}
            />
          </Form.Item>
        </Form>
      </Drawer>

      {/* PIN Entry Modal */}
      <PinEntryModal
        open={showPinModal}
        onSuccess={handleSessionUnlocked}
        onCancel={() => setShowPinModal(false)}
        title="Unlock Session"
        description="Enter your PIN to unlock LLM features."
      />
    </div>
  )
}