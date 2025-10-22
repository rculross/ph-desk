import React, { useState, useEffect, useRef, useCallback } from 'react'

import {
  Card,
  Input,
  Button,
  Select,
  Space,
  Badge,
  Tooltip,
  Drawer,
  Slider,
  InputNumber,
  Form,
  Alert,
  Progress,
  Empty
} from 'antd'
import { clsx } from 'clsx'
import {
  SendIcon,
  SettingsIcon,
  DollarSignIcon,
  ClockIcon,
  UserIcon,
  BotIcon,
  RefreshCwIcon,
  MoreHorizontalIcon,
  CopyIcon,
  TrashIcon
} from 'lucide-react'
import toast from 'react-hot-toast'

import { useTableCore } from '../../hooks/useTableCore'
import type {
  ChatMessage,
  ChatSession,
  LLMProvider,
  LLMModel,
  LLMRequestOptions,
  UsageStats,
  CostTracking
} from '../../types/llm'
import { logger } from '../../utils/logger'
import { DataTable } from '../ui/DataTable'

const { TextArea } = Input
const log = logger.content

interface ChatInterfaceProps {
  providers: Record<LLMProvider, {
    name: string
    models: LLMModel[]
    enabled: boolean
  }>
  onSendMessage: (
    message: string,
    provider: LLMProvider,
    options: LLMRequestOptions
  ) => Promise<AsyncIterableIterator<string>>
  // Required props from parent - no internal selection logic
  selectedProvider: LLMProvider
  selectedModel: string
  temperature?: number
  maxTokens?: number
  systemPrompt?: string
  // Callback to notify parent when clear chat is requested
  onClearChat?: () => void
  // Callback when model selection changes
  onModelChange?: (provider: LLMProvider, modelId: string) => void
  // Available enabled models for selection
  availableModels?: Array<{ provider: LLMProvider; model: LLMModel; isEnabled: boolean }>
  // Whether to show model selector
  showModelSelector?: boolean
  usageStats?: UsageStats[]
  costTracking?: CostTracking
  className?: string
}

interface StreamingMessage {
  id: string
  content: string
  isStreaming: boolean
}

export const ChatInterface: React.FC<ChatInterfaceProps> = ({
  providers,
  onSendMessage,
  selectedProvider,
  selectedModel,
  temperature = 0.7,
  maxTokens = 1000,
  systemPrompt = '',
  onClearChat,
  onModelChange,
  availableModels = [],
  showModelSelector = true,
  usageStats = [],
  costTracking,
  className
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [streamingMessage, setStreamingMessage] = useState<StreamingMessage | null>(null)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<any>(null)


  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    scrollToBottom()
  }, [messages, streamingMessage])

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }


  const handleSendMessage = useCallback(async () => {
    if (!input.trim() || !selectedProvider || !selectedModel || loading) {
      return
    }

    const messageText = input.trim()
    const messageId = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

    // Add user message
    const userMessage: ChatMessage = {
      id: messageId,
      role: 'user',
      content: messageText,
      timestamp: Date.now()
    }

    setMessages(prev => [...prev, userMessage])
    setInput('')
    setLoading(true)

    try {
      log.debug('Sending message to LLM', {
        provider: selectedProvider,
        model: selectedModel,
        messageLength: messageText.length
      })

      const options: LLMRequestOptions = {
        model: selectedModel,
        temperature,
        maxTokens,
        stream: true,
        systemPrompt: systemPrompt ?? undefined
      }

      // Start streaming response
      const responseId = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      setStreamingMessage({
        id: responseId,
        content: '',
        isStreaming: true
      })

      const stream = await onSendMessage(messageText, selectedProvider, options)
      let fullContent = ''

      for await (const chunk of stream) {
        fullContent += chunk
        setStreamingMessage(prev => prev ? {
          ...prev,
          content: fullContent
        } : null)
      }

      // Convert streaming message to final message
      const assistantMessage: ChatMessage = {
        id: responseId,
        role: 'assistant',
        content: fullContent,
        timestamp: Date.now()
      }

      setMessages(prev => [...prev, assistantMessage])
      setStreamingMessage(null)

      log.info('Message sent successfully', {
        provider: selectedProvider,
        model: selectedModel,
        responseLength: fullContent.length
      })

    } catch (error) {
      log.error('Failed to send message', { error })
      toast.error(`Failed to send message: ${error instanceof Error ? error.message : 'Unknown error'}`)

      // Remove streaming message on error
      setStreamingMessage(null)

      // Add error message
      const errorMessage: ChatMessage = {
        id: `error_${Date.now()}`,
        role: 'assistant',
        content: `Error: ${error instanceof Error ? error.message : 'Failed to get response'}`,
        timestamp: Date.now()
      }
      setMessages(prev => [...prev, errorMessage])

    } finally {
      setLoading(false)
    }
  }, [input, selectedProvider, selectedModel, loading, temperature, maxTokens, systemPrompt, onSendMessage])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  const copyMessage = async (content: string) => {
    try {
      await navigator.clipboard.writeText(content)
      toast.success('Message copied to clipboard')
    } catch (error) {
      toast.error('Failed to copy message')
    }
  }

  const clearChat = () => {
    setMessages([])
    setStreamingMessage(null)
    onClearChat?.()
    toast.success('Chat cleared')
  }

  const getCurrentModelData = () => {
    if (!selectedProvider || !selectedModel) return null
    return providers[selectedProvider].models.find(m => m.modelId === selectedModel)
  }

  const getEstimatedCost = () => {
    const model = getCurrentModelData()
    if (!model) return null

    const totalTokens = messages.reduce((sum, msg) => sum + (msg.content.length / 4), 0) // Rough token estimate
    const estimatedInputCost = (totalTokens * model.costPer1kTokens.input) / 1000
    const estimatedOutputCost = (totalTokens * 0.5 * model.costPer1kTokens.output) / 1000 // Assume 50% output

    return estimatedInputCost + estimatedOutputCost
  }

  const renderMessage = (message: ChatMessage, index: number) => (
    <div key={message.id} className={clsx(
      'flex gap-3 p-4 rounded-lg',
      message.role === 'user' ? 'bg-blue-50 ml-8' : 'bg-gray-50 mr-8'
    )}>
      <div className="flex-shrink-0">
        {message.role === 'user' ? (
          <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center">
            <UserIcon className="w-4 h-4 text-white" />
          </div>
        ) : (
          <div className="w-8 h-8 rounded-full bg-gray-500 flex items-center justify-center">
            <BotIcon className="w-4 h-4 text-white" />
          </div>
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-2">
          <div className="font-medium text-sm text-gray-700">
            {message.role === 'user' ? 'You' : 'Assistant'}
          </div>
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <Button
              type="text"
              size="small"
              icon={<CopyIcon className="w-3 h-3" />}
              onClick={() => copyMessage(message.content)}
            />
            <div className="text-xs text-gray-500">
              {new Date(message.timestamp).toLocaleTimeString()}
            </div>
          </div>
        </div>

        <div className="prose prose-sm max-w-none text-gray-800 whitespace-pre-wrap">
          {message.content}
        </div>
      </div>
    </div>
  )

  const renderStreamingMessage = () => {
    if (!streamingMessage) return null

    return (
      <div className="flex gap-3 p-4 rounded-lg bg-gray-50 mr-8">
        <div className="flex-shrink-0">
          <div className="w-8 h-8 rounded-full bg-gray-500 flex items-center justify-center">
            <BotIcon className="w-4 h-4 text-white animate-pulse" />
          </div>
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-2">
            <div className="font-medium text-sm text-gray-700 flex items-center gap-2">
              Assistant
              <Badge status="processing" text="Typing..." />
            </div>
          </div>

          <div className="prose prose-sm max-w-none text-gray-800 whitespace-pre-wrap">
            {streamingMessage.content}
            <span className="inline-block w-2 h-4 bg-gray-400 ml-1 animate-pulse" />
          </div>
        </div>
      </div>
    )
  }


  // Get enabled models for dropdown
  const enabledModels = availableModels.filter(m => m.isEnabled)

  // Find current model details
  const currentModel = enabledModels.find(m =>
    m.provider === selectedProvider && m.model.modelId === selectedModel
  )

  // Handle model selection change
  const handleModelSelect = (value: string) => {
    const [provider, modelId] = value.split('::') as [LLMProvider, string]
    onModelChange?.(provider, modelId)
  }

  return (
    <div className={clsx('flex flex-col h-full', className)}>

      {/* Header with Model Selector */}
      {showModelSelector && enabledModels.length > 0 && (
        <div className="flex-shrink-0 p-3 bg-gray-50 border-b">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium text-gray-700">Model:</span>
              <Select
                value={`${selectedProvider}::${selectedModel}`}
                onChange={handleModelSelect}
                style={{ minWidth: 200 }}
                size="small"
                placeholder="Select a model"
              >
                {enabledModels.map(({ provider, model }) => (
                  <Select.Option
                    key={`${provider}::${model.modelId}`}
                    value={`${provider}::${model.modelId}`}
                  >
                    <div className="flex items-center justify-between w-full">
                      <span>{model.displayName}</span>
                      <span className="text-xs text-gray-500 ml-2 capitalize">
                        {providers[provider].name.split(' ')[0] || provider}
                      </span>
                    </div>
                  </Select.Option>
                ))}
              </Select>
            </div>

            <div className="flex items-center gap-3">
              {currentModel && (
                <div className="text-xs text-gray-500">
                  Context: {currentModel.model.maxTokens ? `${(currentModel.model.maxTokens / 1000).toFixed(0)}K` : 'N/A'}
                </div>
              )}

              <Tooltip title="Clear conversation">
                <Button
                  type="text"
                  size="small"
                  icon={<TrashIcon className="w-4 h-4" />}
                  onClick={clearChat}
                  disabled={messages.length === 0 && !streamingMessage}
                >
                  Clear
                </Button>
              </Tooltip>
            </div>
          </div>
        </div>
      )}

      {/* Chat Messages */}
      <div className="flex-1 overflow-auto p-4 space-y-4 bg-white">
        {messages.length === 0 && !streamingMessage ? (
          <Empty
            description="Start a conversation with your AI assistant"
            image={Empty.PRESENTED_IMAGE_SIMPLE}
          />
        ) : (
          <>
            {messages.map(renderMessage)}
            {renderStreamingMessage()}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Input Area */}
      <div className="flex-shrink-0 p-4 bg-gray-50 border-t">
        <div className="space-y-3">
          {systemPrompt && (
            <div className="text-xs text-gray-500 p-2 bg-white rounded border">
              <strong>System:</strong> {systemPrompt}
            </div>
          )}

          <div className="flex gap-2">
            <TextArea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type your message... (Ctrl/Cmd + Enter to send)"
              autoSize={{ minRows: 1, maxRows: 4 }}
              disabled={loading}
              className="flex-1"
            />
            <Button
              type="primary"
              icon={loading ? <RefreshCwIcon className="w-4 h-4 animate-spin" /> : <SendIcon className="w-4 h-4" />}
              onClick={handleSendMessage}
              disabled={!input.trim() || loading || !selectedProvider || !selectedModel}
              size="large"
            />
          </div>

          <div className="flex justify-between text-xs text-gray-500">
            <div>
              {getCurrentModelData() && (
                <span>
                  Max tokens: {getCurrentModelData()!.maxTokens.toLocaleString()} |
                  Cost: ${getCurrentModelData()!.costPer1kTokens.input}/${getCurrentModelData()!.costPer1kTokens.output} per 1K tokens
                </span>
              )}
            </div>
            <div>
              Ctrl/Cmd + Enter to send
            </div>
          </div>
        </div>
      </div>

    </div>
  )
}