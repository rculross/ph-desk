import React, { useState, useEffect, useRef } from 'react'

import { Modal, Form, Input, Button, Progress, Alert, Space } from 'antd'
import { clsx } from 'clsx'
import { LockIcon, AlertTriangleIcon, ShieldIcon } from 'lucide-react'
import toast from 'react-hot-toast'

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
  const [lockoutStatus, setLockoutStatus] = useState({
    isLockedOut: false,
    remainingTime: 0,
    attemptsRemaining: 5
  })
  const [countdown, setCountdown] = useState(0)

  const pinInputRef = useRef<any>(null)
  const countdownIntervalRef = useRef<NodeJS.Timeout>()

  // Load lockout status when modal opens
  useEffect(() => {
    if (open) {
      loadLockoutStatus()
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

  // Handle lockout countdown
  useEffect(() => {
    if (lockoutStatus.isLockedOut && lockoutStatus.remainingTime > 0) {
      setCountdown(Math.ceil(lockoutStatus.remainingTime / 1000))

      countdownIntervalRef.current = setInterval(() => {
        setCountdown(prev => {
          if (prev <= 1) {
            clearInterval(countdownIntervalRef.current)
            loadLockoutStatus() // Refresh status when countdown ends
            return 0
          }
          return prev - 1
        })
      }, 1000)
    } else {
      clearInterval(countdownIntervalRef.current)
      setCountdown(0)
    }

    return () => {
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current)
      }
    }
  }, [lockoutStatus.isLockedOut, lockoutStatus.remainingTime])

  const loadLockoutStatus = async (): Promise<void> => {
    try {
      const status = await pinProtectionService.getLockoutStatus()
      setLockoutStatus(status)
      log.debug('Lockout status loaded', status)
    } catch (error) {
      log.error('Failed to load lockout status', { error })
    }
  }

  const handleSubmit = async (values: { pin: string }) => {
    if (lockoutStatus.isLockedOut) {
      setError('Account is locked. Please wait for the countdown to complete.')
      return
    }

    setLoading(true)
    setError('')

    try {
      log.debug('Attempting PIN verification')

      await pinProtectionService.verifyPin(values.pin)

      log.info('PIN verification successful')
      toast.success('PIN verified successfully')

      form.resetFields()
      onSuccess()

    } catch (error) {
      log.error('PIN verification failed', { error })

      if (error instanceof PinProtectionError) {
        setError(error.message)

        // Show specific error messages based on error code
        switch (error.code) {
          case 'LOCKOUT_ACTIVE':
            toast.error('Account locked due to too many failed attempts')
            break
          case 'MAX_ATTEMPTS_EXCEEDED':
            toast.error('Maximum attempts exceeded. All data has been wiped for security.')
            break
          case 'INVALID_PIN':
            toast.error('Incorrect PIN')
            break
          default:
            toast.error(error.message)
        }

        // If this is a critical error, close the modal
        if (error.code === 'MAX_ATTEMPTS_EXCEEDED' || error.code === 'EMERGENCY_WIPE_TRIGGERED') {
          setTimeout(() => {
            onCancel()
          }, 2000)
        }
      } else {
        setError('PIN verification failed. Please try again.')
        toast.error('PIN verification failed')
      }

      // Refresh lockout status after failed attempt
      await loadLockoutStatus()

    } finally {
      setLoading(false)
    }
  }

  const handleCancel = () => {
    form.resetFields()
    setError('')
    onCancel()
  }

  const formatTime = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = seconds % 60
    if (minutes > 0) {
      return `${minutes}m ${remainingSeconds}s`
    }
    return `${remainingSeconds}s`
  }

  const getProgressColor = (): string => {
    if (lockoutStatus.attemptsRemaining <= 1) return '#ff4d4f' // danger
    if (lockoutStatus.attemptsRemaining <= 2) return '#faad14' // warning
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

        {/* Lockout Status */}
        {lockoutStatus.isLockedOut ? (
          <Alert
            message="Account Locked"
            description={
              <div className="space-y-2">
                <p>Too many failed attempts. Please wait before trying again.</p>
                <div className="flex items-center justify-between text-sm">
                  <span>Time remaining:</span>
                  <span className="font-mono font-bold text-red-600">
                    {formatTime(countdown)}
                  </span>
                </div>
              </div>
            }
            type="error"
            icon={<LockIcon className="h-4 w-4" />}
            showIcon
          />
        ) : (
          /* Attempts Remaining */
          lockoutStatus.attemptsRemaining < 5 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">Attempts remaining:</span>
                <span className={clsx(
                  'font-semibold',
                  lockoutStatus.attemptsRemaining <= 1 && 'text-red-600',
                  lockoutStatus.attemptsRemaining === 2 && 'text-yellow-600',
                  lockoutStatus.attemptsRemaining > 2 && 'text-green-600'
                )}>
                  {lockoutStatus.attemptsRemaining}
                </span>
              </div>
              <Progress
                percent={(lockoutStatus.attemptsRemaining / 5) * 100}
                strokeColor={getProgressColor()}
                showInfo={false}
                size="small"
              />
            </div>
          )
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
          onFinish={handleSubmit}
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
              disabled={loading || lockoutStatus.isLockedOut}
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
              disabled={lockoutStatus.isLockedOut}
              className="min-w-[80px]"
            >
              {loading ? 'Verifying...' : 'Verify'}
            </Button>
          </div>
        </Form>

        {/* Security Notice */}
        <div className="text-xs text-gray-500 text-center border-t pt-3 mt-4">
          Your PIN is protected with progressive delays and automatic lockouts for security.
        </div>
      </div>
    </Modal>
  )
}