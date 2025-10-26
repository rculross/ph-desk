/**
 * Sample Data Progress Modal
 *
 * Shows progress while collecting sample data from Planhat API endpoints
 */

import React from 'react'
import { X, CheckCircle2, XCircle, Loader2, Download } from 'lucide-react'
import type { SampleDataProgress } from '@/services/sample-data.service'

export interface SampleDataProgressProps {
  progress: SampleDataProgress
  isOpen: boolean
  onClose: () => void
}

export const SampleDataProgressModal: React.FC<SampleDataProgressProps> = ({
  progress,
  isOpen,
  onClose
}) => {
  if (!isOpen) return null

  const progressPercentage = Math.round((progress.currentIndex / progress.totalEndpoints) * 100)
  const canClose = progress.isComplete

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="relative w-full max-w-2xl rounded-lg bg-white shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
          <div className="flex items-center gap-3">
            <Download className="h-5 w-5 text-blue-600" />
            <h2 className="text-lg font-semibold text-gray-900">
              Getting Sample Data
            </h2>
          </div>
          {canClose && (
            <button
              onClick={onClose}
              className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>
          )}
        </div>

        {/* Content */}
        <div className="px-6 py-4">
          {/* Progress Bar */}
          <div className="mb-4">
            <div className="mb-2 flex items-center justify-between text-sm">
              <span className="font-medium text-gray-700">
                {progress.isComplete ? 'Complete' : 'In Progress'}
              </span>
              <span className="text-gray-500">
                {progress.currentIndex} / {progress.totalEndpoints} endpoints
              </span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-gray-200">
              <div
                className="h-full rounded-full bg-blue-600 transition-all duration-300"
                style={{ width: `${progressPercentage}%` }}
              />
            </div>
            <div className="mt-1 text-right text-xs text-gray-500">
              {progressPercentage}%
            </div>
          </div>

          {/* Current Endpoint */}
          {!progress.isComplete && progress.currentEndpoint && (
            <div className="mb-4 rounded-lg bg-blue-50 p-3">
              <div className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
                <div className="flex-1">
                  <div className="text-xs font-medium text-blue-900">
                    Fetching data from:
                  </div>
                  <div className="font-mono text-sm text-blue-700">
                    {progress.currentEndpoint}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Summary */}
          <div className="mb-4 grid grid-cols-2 gap-4">
            <div className="rounded-lg border border-gray-200 p-3">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-green-600" />
                <div>
                  <div className="text-xs text-gray-500">Completed</div>
                  <div className="text-lg font-semibold text-gray-900">
                    {progress.completed}
                  </div>
                </div>
              </div>
            </div>
            <div className="rounded-lg border border-gray-200 p-3">
              <div className="flex items-center gap-2">
                <XCircle className="h-5 w-5 text-red-600" />
                <div>
                  <div className="text-xs text-gray-500">Failed</div>
                  <div className="text-lg font-semibold text-gray-900">
                    {progress.failed}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Errors List */}
          {progress.errors.length > 0 && (
            <div className="mb-4">
              <div className="mb-2 text-sm font-medium text-gray-700">
                Errors ({progress.errors.length})
              </div>
              <div className="max-h-48 overflow-y-auto rounded-lg border border-red-200 bg-red-50">
                <ul className="divide-y divide-red-100">
                  {progress.errors.map((error, index) => (
                    <li key={index} className="p-3">
                      <div className="font-mono text-xs font-medium text-red-900">
                        {error.endpoint}
                      </div>
                      <div className="mt-1 text-xs text-red-700">
                        {error.error}
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {/* Completion Message */}
          {progress.isComplete && (
            <div className="rounded-lg bg-green-50 p-4">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="h-5 w-5 flex-shrink-0 text-green-600" />
                <div className="flex-1">
                  <div className="font-medium text-green-900">
                    Sample data collection complete!
                  </div>
                  <div className="mt-1 text-sm text-green-700">
                    {progress.completed} endpoint{progress.completed !== 1 ? 's' : ''} fetched successfully
                    {progress.failed > 0 && `, ${progress.failed} failed`}.
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 border-t border-gray-200 px-6 py-4">
          {canClose ? (
            <button
              onClick={onClose}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              Close
            </button>
          ) : (
            <div className="text-sm text-gray-500">
              Please wait while data is being collected...
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
