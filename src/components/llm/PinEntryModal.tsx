import React, { useState, useEffect, useRef } from 'react'

import { Modal, Form, Input, Button, Progress, Alert, Space, Divider } from 'antd'
import { clsx } from 'clsx'
import { LockIcon, AlertTriangleIcon, ShieldIcon, TrashIcon, InfoIcon, CheckCircleIcon } from 'lucide-react'

import { toastService } from '@/services/toast.service'

import { apiKeyManagerService } from '../../services/api-key-manager.service'
import { getDefaultPinExplanation } from '../../services/default-pin.service'
import { pinProtectionService } from '../../services/pin-protection.service'
import { PinProtectionError } from '../../types/llm-errors'
import { logger } from '../../utils/logger'

const log = logger.content

interface PinEntryModalProps {
  open: boolean
  onSuccess: () => void
  onCancel: () => void
  title?: string
  description?: string
  autoFocus?: boolean
}

export const PinEntryModal: React.FC<PinEntryModalProps> = ({
  open,
  onSuccess,
  onCancel,
  title = 'Enter PIN',
  description = 'Please enter your PIN to access secure features',
  autoFocus = true
}) => {
  const [form] = Form.useForm()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string>('')
  const [attemptStatus, setAttemptStatus] = useState({
    attempts: 0,
    attemptsRemaining: 3
  })
  const [showResetConfirmation, setShowResetConfirmation] = useState(false)
  const [resetting, setResetting] = useState(false)
  const [resetPinDisplay, setResetPinDisplay] = useState<string | null>(null)

  const pinInputRef = useRef<{ focus: () => void } | null>(null)

  // Load attempt status when modal opens
  useEffect(() => {
    if (open) {
      void loadAttemptStatus()
      setError('')
      form.resetFields()
    }
  }, [open, form])

  // Auto-focus PIN input when modal opens
  useEffect(() => {
    if (open && autoFocus && pinInputRef.current) {
      const timer = setTimeout(() => {
        pinInputRef.current?.focus()
      }, 100)
      return () => clearTimeout(timer)
    }
    return undefined
  }, [open, autoFocus])

  const loadAttemptStatus = async (): Promise<void> => {
    try {
      const status = await pinProtectionService.getAttemptStatus()
      setAttemptStatus(status)
      log.debug('Attempt status loaded', status)
    } catch (error) {
      log.error('Failed to load attempt status', { error })
    }
  }

  const handleSubmit = async (values: { pin: string }) => {
    setLoading(true)
    setError('')

    try {
      log.debug('Attempting PIN verification')

      await pinProtectionService.verifyPin(values.pin)

      log.info('PIN verification successful')
      toastService.success('PIN verified successfully')

      form.resetFields()
      onSuccess()

    } catch (error) {
      log.error('PIN verification failed', { error })

      if (error instanceof PinProtectionError) {
        setError(error.message)

        // Show specific error messages based on error code
        switch (error.code) {
          case 'MAX_ATTEMPTS_EXCEEDED':
            toastService.error('Maximum attempts exceeded. All data has been wiped for security.')
            break
          case 'INVALID_PIN':
            toastService.error('Incorrect PIN')
            break
          default:
            toastService.error(error.message)
        }

        // If this is a critical error, close the modal
        if (error.code === 'MAX_ATTEMPTS_EXCEEDED' || error.code === 'EMERGENCY_WIPE_TRIGGERED') {
          setTimeout(() => {
            onCancel()
          }, 2000)
        }
      } else {
        setError('PIN verification failed. Please try again.')
        toastService.error('PIN verification failed')
      }

      // Refresh attempt status after failed attempt
      await loadAttemptStatus()

    } finally {
      setLoading(false)
    }
  }

  const handleCancel = () => {
    form.resetFields()
    setError('')
    onCancel()
  }

  const handleResetClick = () => {
    setShowResetConfirmation(true)
  }

  const handleResetConfirm = async () => {
    setResetting(true)
    try {
      log.warn('User initiated emergency PIN reset')

      // Clear all API keys first
      apiKeyManagerService.clearSessionCache()

      // Execute emergency wipe and get the new PIN
      const newPin = await pinProtectionService.emergencyWipe()

      // Display the new PIN to the user
      setResetPinDisplay(newPin)
      toastService.success('PIN reset successfully. Your new PIN is: ' + newPin)

      log.info('Emergency wipe completed, new PIN displayed to user')

    } catch (error) {
      log.error('Failed to reset PIN', { error })
      toastService.error('Failed to reset PIN. Please try again.')
      setShowResetConfirmation(false)
    } finally {
      setResetting(false)
    }
  }

  const handleResetCancel = () => {
    setShowResetConfirmation(false)
    setResetPinDisplay(null)
  }

  const getProgressColor = (): string => {
    if (attemptStatus.attemptsRemaining <= 1) return '#ff4d4f' // danger
    if (attemptStatus.attemptsRemaining <= 2) return '#faad14' // warning
    return '#52c41a' // success
  }

  return (
    <Modal
      title={
        <Space className="items-center">
          <ShieldIcon className="h-5 w-5 text-blue-600" />
          <span>{title}</span>
        </Space>
      }
      open={open}
      onCancel={handleCancel}
      footer={null}
      closable={!loading}
      maskClosable={!loading}
      centered
      width={440}
      className="pin-entry-modal"
    >
      <div className="space-y-4">
        <p className="text-gray-600 text-sm">{description}</p>

        {/* Default PIN Hint */}
        <Alert
          message="Default PIN"
          description={getDefaultPinExplanation()}
          type="info"
          icon={<InfoIcon className="h-4 w-4" />}
          showIcon
        />

        {/* Attempts Remaining */}
        {attemptStatus.attemptsRemaining < 3 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600">Attempts remaining:</span>
              <span className={clsx(
                'font-semibold',
                attemptStatus.attemptsRemaining <= 1 && 'text-red-600',
                attemptStatus.attemptsRemaining === 2 && 'text-yellow-600'
              )}>
                {attemptStatus.attemptsRemaining}
              </span>
            </div>
            <Progress
              percent={(attemptStatus.attemptsRemaining / 3) * 100}
              strokeColor={getProgressColor()}
              showInfo={false}
              size="small"
            />
          </div>
        )}

        {/* Error Display */}
        {error && (
          <Alert
            message="Verification Failed"
            description={error}
            type="error"
            icon={<AlertTriangleIcon className="h-4 w-4" />}
            showIcon
            closable
            onClose={() => setError('')}
          />
        )}

        {/* PIN Input Form */}
        <Form
          form={form}
          onFinish={(values: { pin: string }) => { void handleSubmit(values) }}
          layout="vertical"
          className="space-y-4"
        >
          <Form.Item
            name="pin"
            label="PIN"
            rules={[
              { required: true, message: 'Please enter your PIN' },
              { min: 4, message: 'PIN must be at least 4 characters' }
            ]}
          >
            <Input.Password
              ref={pinInputRef}
              placeholder="Enter your PIN"
              disabled={loading}
              size="large"
              className="text-center tracking-widest"
              autoComplete="off"
              onPressEnter={() => form.submit()}
            />
          </Form.Item>

          <div className="flex justify-end space-x-2 pt-2">
            <Button
              onClick={handleCancel}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button
              type="primary"
              htmlType="submit"
              loading={loading}
              className="min-w-[80px]"
            >
              {loading ? 'Verifying...' : 'Verify'}
            </Button>
          </div>
        </Form>

        {/* Reset Button */}
        <Divider className="my-4" />
        <div className="flex justify-center">
          <Button
            type="link"
            danger
            icon={<TrashIcon className="h-3.5 w-3.5" />}
            onClick={handleResetClick}
            disabled={loading || resetting}
            size="small"
          >
            Forgot PIN? Reset All Data
          </Button>
        </div>

        {/* Security Notice */}
        <div className="text-xs text-gray-500 text-center border-t pt-3 mt-3">
          Your PIN is protected with rate limiting and automatic wipe after 3 failed attempts.
        </div>
      </div>

      {/* Reset Confirmation Modal */}
      <Modal
        title={
          <Space className="items-center">
            <AlertTriangleIcon className="h-5 w-5 text-red-600" />
            <span>Reset PIN and Delete All Data</span>
          </Space>
        }
        open={showResetConfirmation}
        onCancel={handleResetCancel}
        closable={!resetting}
        maskClosable={!resetting}
        centered
        width={500}
        footer={
          <div className="flex justify-end space-x-2">
            <Button onClick={handleResetCancel} disabled={resetting}>
              Cancel
            </Button>
            <Button
              type="primary"
              danger
              icon={<TrashIcon className="h-4 w-4" />}
              loading={resetting}
              onClick={() => { void handleResetConfirm() }}
            >
              {resetting ? 'Resetting...' : 'Reset PIN and Delete All Data'}
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          {/* New PIN Display (after reset) */}
          {resetPinDisplay && (
            <Alert
              message="Reset Complete! Your New PIN:"
              description={
                <div className="space-y-2">
                  <div className="text-center">
                    <div className="font-mono text-2xl font-bold text-green-600 bg-green-50 p-4 rounded border-2 border-green-200 my-2">
                      {resetPinDisplay}
                    </div>
                    <p className="text-sm text-gray-600 mt-2">
                      {getDefaultPinExplanation()}
                    </p>
                  </div>
                  <p className="text-sm text-gray-700 font-medium">
                    Please write this down or remember it. This PIN will be required to access secure features.
                  </p>
                  <Button
                    type="primary"
                    className="w-full"
                    onClick={() => {
                      setShowResetConfirmation(false)
                      setResetPinDisplay(null)
                      // Reload to ensure clean state
                      setTimeout(() => window.location.reload(), 500)
                    }}
                  >
                    I've Saved My PIN - Continue
                  </Button>
                </div>
              }
              type="success"
              icon={<CheckCircleIcon className="h-5 w-5" />}
              showIcon
            />
          )}

          {/* Warning Alert (before reset) */}
          {!resetPinDisplay && (
            <Alert
              message="This action cannot be undone"
              description="Resetting your PIN will permanently delete all secure data."
              type="error"
              icon={<AlertTriangleIcon className="h-4 w-4" />}
              showIcon
            />
          )}

          {/* What will be deleted */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium text-gray-900">
              <ShieldIcon className="h-4 w-4" />
              <span>The following data will be deleted:</span>
            </div>
            <ul className="list-disc list-inside space-y-1 text-sm text-gray-600 ml-6">
              <li>Current PIN and PIN hash</li>
              <li>All stored API keys (Claude, OpenAI, Gemini)</li>
              <li>Security settings and configurations</li>
              <li>Active session and authentication</li>
              <li>Failed attempt records and lockout data</li>
            </ul>
          </div>

          {/* What happens next */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium text-gray-900">
              <InfoIcon className="h-4 w-4" />
              <span>After reset:</span>
            </div>
            <ul className="list-disc list-inside space-y-1 text-sm text-gray-600 ml-6">
              <li>PIN will reset to default (today&apos;s date in MMDDYY format)</li>
              <li>You will need to re-enter all API keys</li>
              <li>Security settings will return to defaults</li>
              <li>The application will reload to ensure clean state</li>
            </ul>
          </div>

          {/* Final warning */}
          <Alert
            message="Are you sure you want to proceed?"
            description="This will permanently delete all your secure data and cannot be recovered."
            type="warning"
            showIcon
          />
        </div>
      </Modal>
    </Modal>
  )
}