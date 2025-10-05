import React, { useState, useEffect } from 'react'

import { Card, Button, Progress, Badge, Space, Modal, Alert, Tooltip } from 'antd'
import { clsx } from 'clsx'
import {
  ShieldIcon,
  LockIcon,
  UnlockIcon,
  ClockIcon,
  AlertTriangleIcon,
  RefreshCwIcon,
  TrashIcon
} from 'lucide-react'
import toast from 'react-hot-toast'

import { pinProtectionService } from '../../services/pin-protection.service'
import { logger } from '../../utils/logger'

import { PinEntryModal } from './PinEntryModal'

const log = logger.content

interface SecurityStatusProps {
  className?: string
  compact?: boolean
  onSessionExpired?: () => void
}

interface SessionStatus {
  isValid: boolean
  remainingTime: number
  sessionId?: string
  isLockedOut: boolean
  lockoutTime: number
  attemptsRemaining: number
}

export const SecurityStatus: React.FC<SecurityStatusProps> = ({
  className,
  compact = false,
  onSessionExpired
}) => {
  const [sessionStatus, setSessionStatus] = useState<SessionStatus>({
    isValid: false,
    remainingTime: 0,
    isLockedOut: false,
    lockoutTime: 0,
    attemptsRemaining: 5
  })
  const [loading, setLoading] = useState(false)
  const [showPinModal, setShowPinModal] = useState(false)
  const [showWipeModal, setShowWipeModal] = useState(false)
  const [refreshing, setRefreshing] = useState(false)

  // Refresh status every 30 seconds
  useEffect(() => {
    const interval = setInterval(refreshStatus, 30000)
    refreshStatus() // Initial load

    return () => clearInterval(interval)
  }, [])

  // Handle session expiration
  useEffect(() => {
    if (!sessionStatus.isValid && sessionStatus.remainingTime === 0 && onSessionExpired) {
      onSessionExpired()
    }
  }, [sessionStatus.isValid, sessionStatus.remainingTime, onSessionExpired])

  const refreshStatus = async () => {
    try {
      setRefreshing(true)
      log.debug('Refreshing security status')

      const [lockoutStatus] = await Promise.all([
        pinProtectionService.getLockoutStatus()
      ])

      const isSessionValid = pinProtectionService.isSessionValid()
      const remainingTime = pinProtectionService.getRemainingSessionTime()

      setSessionStatus({
        isValid: isSessionValid,
        remainingTime,
        isLockedOut: lockoutStatus.isLockedOut,
        lockoutTime: lockoutStatus.remainingTime,
        attemptsRemaining: lockoutStatus.attemptsRemaining
      })

      log.debug('Security status refreshed', {
        isValid: isSessionValid,
        remainingTime,
        isLockedOut: lockoutStatus.isLockedOut
      })

    } catch (error) {
      log.error('Failed to refresh security status', { error })
      toast.error('Failed to refresh security status')
    } finally {
      setRefreshing(false)
    }
  }

  const handleExtendSession = async () => {
    try {
      setLoading(true)
      log.debug('Extending session')

      await pinProtectionService.extendSession()
      await refreshStatus()

      toast.success('Session extended successfully')

    } catch (error) {
      log.error('Failed to extend session', { error })
      toast.error('Failed to extend session')
    } finally {
      setLoading(false)
    }
  }

  const handleLockSession = async () => {
    try {
      setLoading(true)
      log.info('Locking session manually')

      await pinProtectionService.lockSession()
      await refreshStatus()

      toast.success('Session locked successfully')

    } catch (error) {
      log.error('Failed to lock session', { error })
      toast.error('Failed to lock session')
    } finally {
      setLoading(false)
    }
  }

  const handleUnlockSession = () => {
    setShowPinModal(true)
  }

  const handlePinSuccess = async () => {
    setShowPinModal(false)
    await refreshStatus()
    toast.success('Session unlocked successfully')
  }

  const handlePinCancel = () => {
    setShowPinModal(false)
  }

  const handleEmergencyWipe = async () => {
    try {
      setLoading(true)
      log.warn('Executing emergency wipe')

      await pinProtectionService.emergencyWipe()
      await refreshStatus()

      toast.success('Emergency wipe completed - all data cleared')

    } catch (error) {
      log.error('Emergency wipe failed', { error })
      toast.error('Emergency wipe failed')
    } finally {
      setLoading(false)
      setShowWipeModal(false)
    }
  }

  const formatTime = (ms: number): string => {
    if (ms <= 0) return 'Expired'

    const minutes = Math.floor(ms / 60000)
    const seconds = Math.floor((ms % 60000) / 1000)

    if (minutes > 0) {
      return `${minutes}m ${seconds}s`
    }
    return `${seconds}s`
  }

  const getSessionProgress = (): number => {
    if (!sessionStatus.isValid) return 0

    const sessionTimeout = 30 * 60 * 1000 // 30 minutes default
    return Math.max(0, (sessionStatus.remainingTime / sessionTimeout) * 100)
  }

  const getProgressColor = (): string => {
    const progress = getSessionProgress()
    if (progress > 60) return '#52c41a' // green
    if (progress > 30) return '#faad14' // yellow
    return '#ff4d4f' // red
  }

  const getStatusBadge = () => {
    if (sessionStatus.isLockedOut) {
      return <Badge status="error" text="Locked Out" />
    }
    if (sessionStatus.isValid) {
      return <Badge status="success" text="Active" />
    }
    return <Badge status="default" text="Locked" />
  }

  if (compact) {
    return (
      <div className={clsx('flex items-center space-x-2', className)}>
        <Tooltip title="Security Status">
          <div className="flex items-center space-x-1">
            {sessionStatus.isValid ? (
              <ShieldIcon className="h-4 w-4 text-green-500" />
            ) : (
              <LockIcon className="h-4 w-4 text-gray-400" />
            )}
            {getStatusBadge()}
          </div>
        </Tooltip>

        {sessionStatus.isValid && (
          <Tooltip title={`Session expires in ${formatTime(sessionStatus.remainingTime)}`}>
            <div className="flex items-center space-x-1 text-xs text-gray-500">
              <ClockIcon className="h-3 w-3" />
              <span>{formatTime(sessionStatus.remainingTime)}</span>
            </div>
          </Tooltip>
        )}

        <Button
          type="text"
          size="small"
          icon={<RefreshCwIcon className="h-3 w-3" />}
          loading={refreshing}
          onClick={refreshStatus}
        />
      </div>
    )
  }

  return (
    <div className={className}>
      <Card
        title={
          <Space>
            <ShieldIcon className="h-5 w-5 text-blue-600" />
            <span>Security Status</span>
          </Space>
        }
        extra={
          <Button
            type="text"
            icon={<RefreshCwIcon className="h-4 w-4" />}
            loading={refreshing}
            onClick={refreshStatus}
            size="small"
          />
        }
        className="shadow-sm"
      >
        <div className="space-y-4">
          {/* Current Status */}
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <div className="font-medium">Session Status</div>
              {getStatusBadge()}
            </div>
            <div className="text-right text-sm text-gray-500">
              {sessionStatus.isValid && (
                <div>Expires in {formatTime(sessionStatus.remainingTime)}</div>
              )}
            </div>
          </div>

          {/* Session Progress */}
          {sessionStatus.isValid && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span>Session Time</span>
                <span className="text-gray-500">{formatTime(sessionStatus.remainingTime)}</span>
              </div>
              <Progress
                percent={getSessionProgress()}
                strokeColor={getProgressColor()}
                showInfo={false}
                size="small"
              />
            </div>
          )}

          {/* Lockout Status */}
          {sessionStatus.isLockedOut && (
            <Alert
              message="Account Locked"
              description={
                <div className="space-y-1">
                  <div>Too many failed attempts.</div>
                  <div className="text-sm">
                    Lockout expires in: <strong>{formatTime(sessionStatus.lockoutTime)}</strong>
                  </div>
                </div>
              }
              type="error"
              showIcon
            />
          )}

          {/* Failed Attempts Warning */}
          {!sessionStatus.isLockedOut && sessionStatus.attemptsRemaining < 5 && (
            <Alert
              message="Security Warning"
              description={`${sessionStatus.attemptsRemaining} PIN attempts remaining before lockout.`}
              type="warning"
              showIcon
            />
          )}

          {/* Action Buttons */}
          <div className="flex flex-wrap gap-2">
            {sessionStatus.isValid ? (
              <>
                <Button
                  type="default"
                  icon={<RefreshCwIcon className="h-4 w-4" />}
                  onClick={handleExtendSession}
                  loading={loading}
                  disabled={sessionStatus.isLockedOut}
                >
                  Extend Session
                </Button>
                <Button
                  icon={<LockIcon className="h-4 w-4" />}
                  onClick={handleLockSession}
                  loading={loading}
                >
                  Lock Session
                </Button>
              </>
            ) : (
              <Button
                type="primary"
                icon={<UnlockIcon className="h-4 w-4" />}
                onClick={handleUnlockSession}
                disabled={sessionStatus.isLockedOut}
              >
                Unlock Session
              </Button>
            )}

            <Button
              danger
              icon={<TrashIcon className="h-4 w-4" />}
              onClick={() => setShowWipeModal(true)}
              loading={loading}
            >
              Emergency Wipe
            </Button>
          </div>

          {/* Security Info */}
          <div className="text-xs text-gray-500 border-t pt-3">
            <div className="space-y-1">
              <div>• Sessions automatically expire after 30 minutes of inactivity</div>
              <div>• Failed PIN attempts trigger progressive delays and lockouts</div>
              <div>• Emergency wipe clears all stored credentials immediately</div>
            </div>
          </div>
        </div>
      </Card>

      {/* PIN Entry Modal */}
      <PinEntryModal
        open={showPinModal}
        onSuccess={handlePinSuccess}
        onCancel={handlePinCancel}
        title="Unlock Session"
        description="Please enter your PIN to unlock the session and access secure features."
      />

      {/* Emergency Wipe Confirmation */}
      <Modal
        title={
          <Space>
            <AlertTriangleIcon className="h-5 w-5 text-red-500" />
            <span>Emergency Wipe Confirmation</span>
          </Space>
        }
        open={showWipeModal}
        onCancel={() => setShowWipeModal(false)}
        footer={null}
        centered
      >
        <div className="space-y-4">
          <Alert
            message="⚠️ DESTRUCTIVE ACTION"
            description={
              <div className="space-y-2">
                <p>This will permanently delete:</p>
                <ul className="list-disc list-inside space-y-1 text-sm">
                  <li>All stored API keys</li>
                  <li>All chat history</li>
                  <li>All security settings</li>
                  <li>All usage statistics</li>
                </ul>
                <p className="font-semibold text-red-600 mt-2">
                  This action cannot be undone!
                </p>
              </div>
            }
            type="error"
            showIcon
          />

          <div className="flex justify-end space-x-2">
            <Button onClick={() => setShowWipeModal(false)}>
              Cancel
            </Button>
            <Button
              danger
              type="primary"
              onClick={handleEmergencyWipe}
              loading={loading}
            >
              Confirm Emergency Wipe
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}