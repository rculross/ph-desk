import React, { useState, useEffect } from 'react'

import {
  Card,
  Table,
  Button,
  Space,
  Badge,
  Tooltip,
  Modal,
  Alert,
  Progress,
  Dropdown,
  Typography
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { clsx } from 'clsx'
import {
  PlusIcon,
  KeyIcon,
  EditIcon,
  TrashIcon,
  MoreVerticalIcon,
  CheckCircleIcon,
  XCircleIcon,
  DollarSignIcon,
  ActivityIcon,
  ClockIcon
} from 'lucide-react'
import toast from 'react-hot-toast'

import type { LLMProvider, LLMModel, UsageStats } from '../../types/llm'
import { logger } from '../../utils/logger'

import { ApiKeySetupForm } from './ApiKeySetupForm'
import { PinEntryModal } from './PinEntryModal'

const { Text } = Typography
const log = logger.content

interface ProviderData {
  provider: LLMProvider
  name: string
  hasApiKey: boolean
  selectedModel?: string
  models: LLMModel[]
  status: 'active' | 'inactive' | 'error'
  lastUsed?: number
  usage?: {
    requests: number
    tokens: number
    cost: number
  }
}

interface ProviderManagementPanelProps {
  providers: Record<LLMProvider, {
    name: string
    baseURL: string
    models: LLMModel[]
    keyPlaceholder: string
    description: string
  }>
  configuredProviders: ProviderData[]
  usageStats?: UsageStats[]
  onAddProvider: () => void
  onEditProvider: (provider: LLMProvider) => void
  onRemoveProvider: (provider: LLMProvider, pin: string) => Promise<void>
  onTestProvider: (provider: LLMProvider) => Promise<boolean>
  onToggleProvider: (provider: LLMProvider, enabled: boolean) => Promise<void>
  className?: string
}

export const ProviderManagementPanel: React.FC<ProviderManagementPanelProps> = ({
  providers,
  configuredProviders,
  usageStats = [],
  onAddProvider,
  onEditProvider,
  onRemoveProvider,
  onTestProvider,
  onToggleProvider,
  className
}) => {
  const [showRemoveModal, setShowRemoveModal] = useState<LLMProvider | null>(null)
  const [showPinModal, setShowPinModal] = useState(false)
  const [loading, setLoading] = useState<Record<string, boolean>>({})
  const [testingProvider, setTestingProvider] = useState<LLMProvider | null>(null)

  const handleTestProvider = async (provider: LLMProvider) => {
    setTestingProvider(provider)
    setLoading(prev => ({ ...prev, [`test_${provider}`]: true }))

    try {
      log.debug('Testing provider connection', { provider })

      const isValid = await onTestProvider(provider)

      if (isValid) {
        toast.success(`${providers[provider].name} connection successful`)
      } else {
        toast.error(`${providers[provider].name} connection failed`)
      }

    } catch (error) {
      log.error('Provider test failed', { provider, error })
      toast.error(`Test failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setTestingProvider(null)
      setLoading(prev => ({ ...prev, [`test_${provider}`]: false }))
    }
  }

  const handleToggleProvider = async (provider: LLMProvider, enabled: boolean) => {
    setLoading(prev => ({ ...prev, [`toggle_${provider}`]: true }))

    try {
      await onToggleProvider(provider, enabled)
      toast.success(`${providers[provider].name} ${enabled ? 'enabled' : 'disabled'}`)
    } catch (error) {
      log.error('Failed to toggle provider', { provider, enabled, error })
      toast.error(`Failed to ${enabled ? 'enable' : 'disable'} provider`)
    } finally {
      setLoading(prev => ({ ...prev, [`toggle_${provider}`]: false }))
    }
  }

  const handleRemoveProvider = (provider: LLMProvider) => {
    setShowRemoveModal(provider)
  }

  const handleConfirmRemove = () => {
    if (showRemoveModal) {
      setShowPinModal(true)
    }
  }

  const handlePinSuccess = async () => {
    if (!showRemoveModal) return

    setShowPinModal(false)
    setLoading(prev => ({ ...prev, [`remove_${showRemoveModal}`]: true }))

    try {
      // PIN is verified, so we can proceed with removal
      // We need to pass the PIN to the removal function
      await onRemoveProvider(showRemoveModal, 'verified')

      toast.success(`${providers[showRemoveModal].name} removed successfully`)
      setShowRemoveModal(null)

    } catch (error) {
      log.error('Failed to remove provider', { provider: showRemoveModal, error })
      toast.error(`Failed to remove provider: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setLoading(prev => ({ ...prev, [`remove_${showRemoveModal}`]: false }))
    }
  }

  const getUsageForProvider = (provider: LLMProvider) => {
    return usageStats.find(stat => stat.provider === provider)
  }

  const formatLastUsed = (timestamp?: number) => {
    if (!timestamp) return 'Never'

    const diff = Date.now() - timestamp
    const hours = Math.floor(diff / (1000 * 60 * 60))
    const days = Math.floor(hours / 24)

    if (days > 0) return `${days} day${days > 1 ? 's' : ''} ago`
    if (hours > 0) return `${hours} hour${hours > 1 ? 's' : ''} ago`
    return 'Recently'
  }

  const getStatusBadge = (status: ProviderData['status']) => {
    switch (status) {
      case 'active':
        return <Badge status="success" text="Active" />
      case 'inactive':
        return <Badge status="default" text="Inactive" />
      case 'error':
        return <Badge status="error" text="Error" />
      default:
        return <Badge status="default" text="Unknown" />
    }
  }

  const columns: ColumnsType<ProviderData> = [
    {
      title: 'Provider',
      dataIndex: 'name',
      key: 'name',
      render: (name: string, record: ProviderData) => (
        <div className="flex items-center gap-2">
          <div>
            <div className="font-medium">{name}</div>
            <div className="text-xs text-gray-500">
              {record.selectedModel ?? 'No model selected'}
            </div>
          </div>
        </div>
      )
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 120,
      render: (status: ProviderData['status']) => getStatusBadge(status)
    },
    {
      title: 'API Key',
      dataIndex: 'hasApiKey',
      key: 'hasApiKey',
      width: 100,
      render: (hasApiKey: boolean) => (
        <div className="flex items-center">
          {hasApiKey ? (
            <CheckCircleIcon className="h-4 w-4 text-green-500" />
          ) : (
            <XCircleIcon className="h-4 w-4 text-gray-400" />
          )}
          <span className="ml-1 text-xs">
            {hasApiKey ? 'Set' : 'Missing'}
          </span>
        </div>
      )
    },
    {
      title: 'Usage',
      key: 'usage',
      width: 150,
      render: (_, record: ProviderData) => {
        const usage = getUsageForProvider(record.provider)
        if (!usage) {
          return <Text type="secondary">No usage</Text>
        }

        return (
          <div className="space-y-1">
            <div className="flex items-center gap-1 text-xs">
              <ActivityIcon className="h-3 w-3" />
              <span>{usage.requestCount} requests</span>
            </div>
            <div className="flex items-center gap-1 text-xs">
              <DollarSignIcon className="h-3 w-3" />
              <span>${usage.estimatedCost.toFixed(4)}</span>
            </div>
          </div>
        )
      }
    },
    {
      title: 'Last Used',
      dataIndex: 'lastUsed',
      key: 'lastUsed',
      width: 120,
      render: (lastUsed: number) => (
        <div className="flex items-center gap-1 text-xs text-gray-500">
          <ClockIcon className="h-3 w-3" />
          <span>{formatLastUsed(lastUsed)}</span>
        </div>
      )
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 120,
      render: (_, record: ProviderData) => {
        const menuItems = [
          {
            key: 'edit',
            label: 'Edit Configuration',
            icon: <EditIcon className="h-4 w-4" />,
            onClick: () => onEditProvider(record.provider)
          },
          {
            key: 'test',
            label: 'Test Connection',
            icon: <KeyIcon className="h-4 w-4" />,
            onClick: () => handleTestProvider(record.provider),
            disabled: !record.hasApiKey || loading[`test_${record.provider}`]
          },
          {
            key: 'toggle',
            label: record.status === 'active' ? 'Disable' : 'Enable',
            onClick: () => handleToggleProvider(record.provider, record.status !== 'active'),
            disabled: loading[`toggle_${record.provider}`]
          },
          {
            type: 'divider' as const
          },
          {
            key: 'remove',
            label: 'Remove Provider',
            icon: <TrashIcon className="h-4 w-4" />,
            onClick: () => handleRemoveProvider(record.provider),
            disabled: loading[`remove_${record.provider}`],
            danger: true
          }
        ]

        return (
          <Space>
            <Button
              size="small"
              icon={<KeyIcon className="h-3 w-3" />}
              loading={testingProvider === record.provider}
              disabled={!record.hasApiKey}
              onClick={() => handleTestProvider(record.provider)}
            >
              Test
            </Button>

            <Dropdown
              menu={{
                items: menuItems.map(item =>
                  'type' in item ? item : {
                    ...item,
                    onClick: () => item.onClick()
                  }
                )
              }}
              trigger={['click']}
            >
              <Button
                size="small"
                icon={<MoreVerticalIcon className="h-3 w-3" />}
              />
            </Dropdown>
          </Space>
        )
      }
    }
  ]

  const getTotalUsageStats = () => {
    const totalRequests = usageStats.reduce((sum, stat) => sum + stat.requestCount, 0)
    const totalTokens = usageStats.reduce((sum, stat) => sum + stat.tokenUsage.total, 0)
    const totalCost = usageStats.reduce((sum, stat) => sum + stat.estimatedCost, 0)

    return { totalRequests, totalTokens, totalCost }
  }

  const { totalRequests, totalTokens, totalCost } = getTotalUsageStats()
  const activeProviders = configuredProviders.filter(p => p.status === 'active').length
  const totalProviders = configuredProviders.length

  return (
    <div className={className}>
      <Card
        title={
          <Space>
            <KeyIcon className="h-5 w-5 text-blue-600" />
            <span>Provider Management</span>
          </Space>
        }
        extra={
          <Button
            type="primary"
            icon={<PlusIcon className="h-4 w-4" />}
            onClick={onAddProvider}
          >
            Add Provider
          </Button>
        }
        className="shadow-sm"
      >
        {/* Summary Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6 p-4 bg-gray-50 rounded-lg">
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-600">{activeProviders}</div>
            <div className="text-sm text-gray-500">Active Providers</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600">{totalRequests.toLocaleString()}</div>
            <div className="text-sm text-gray-500">Total Requests</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-purple-600">{totalTokens.toLocaleString()}</div>
            <div className="text-sm text-gray-500">Total Tokens</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-orange-600">${totalCost.toFixed(4)}</div>
            <div className="text-sm text-gray-500">Total Cost</div>
          </div>
        </div>

        {/* Provider Status Overview */}
        {totalProviders > 0 && (
          <div className="mb-6">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm font-medium">Provider Status</span>
              <span className="text-xs text-gray-500">{activeProviders} of {totalProviders} active</span>
            </div>
            <Progress
              percent={(activeProviders / totalProviders) * 100}
              strokeColor="#52c41a"
              showInfo={false}
              size="small"
            />
          </div>
        )}

        {/* Providers Table */}
        {configuredProviders.length === 0 ? (
          <Alert
            message="No providers configured"
            description="Add your first LLM provider to start using AI features. Click 'Add Provider' to get started."
            type="info"
            showIcon
            action={
              <Button
                type="primary"
                onClick={onAddProvider}
                icon={<PlusIcon className="h-4 w-4" />}
              >
                Add Provider
              </Button>
            }
          />
        ) : (
          <Table<ProviderData>
            columns={columns}
            dataSource={configuredProviders}
            rowKey="provider"
            pagination={false}
            size="small"
            className="border border-gray-200 rounded"
          />
        )}
      </Card>

      {/* Remove Confirmation Modal */}
      <Modal
        title={`Remove ${showRemoveModal ? providers[showRemoveModal].name : ''}`}
        open={!!showRemoveModal}
        onCancel={() => setShowRemoveModal(null)}
        footer={null}
        centered
      >
        <div className="space-y-4">
          <Alert
            message="⚠️ Remove Provider"
            description={
              <div className="space-y-2">
                <p>This will permanently remove the provider and its configuration:</p>
                <ul className="list-disc list-inside space-y-1 text-sm">
                  <li>API key will be deleted</li>
                  <li>Model preferences will be reset</li>
                  <li>Usage history will be cleared</li>
                  <li>Active chat sessions will be terminated</li>
                </ul>
                <p className="font-semibold text-orange-600 mt-2">
                  This action requires PIN verification and cannot be undone.
                </p>
              </div>
            }
            type="warning"
            showIcon
          />

          <div className="flex justify-end space-x-2">
            <Button onClick={() => setShowRemoveModal(null)}>
              Cancel
            </Button>
            <Button
              danger
              type="primary"
              onClick={handleConfirmRemove}
              loading={showRemoveModal ? loading[`remove_${showRemoveModal}`] : false}
            >
              Confirm Removal
            </Button>
          </div>
        </div>
      </Modal>

      {/* PIN Entry Modal */}
      <PinEntryModal
        open={showPinModal}
        onSuccess={handlePinSuccess}
        onCancel={() => setShowPinModal(false)}
        title="Confirm Provider Removal"
        description="Please enter your PIN to confirm the removal of this provider and its associated data."
      />
    </div>
  )
}