/**
 * Simple logger using loglevel library
 * Replaces the custom BasicLogger implementation to eliminate eval() usage
 * and CSP issues while maintaining the same API for context-specific loggers.
 *
 * Supports user-configurable log levels saved to Chrome storage and is safe to
 * consume from service worker contexts that do not provide DOM globals.
 */

import log, { type LogLevelDesc, type LogLevelNumbers } from 'loglevel'

type RootLoggerWithNoConflict = log.RootLogger & { noConflict?: () => log.RootLogger }

const logWithNoConflict = log as RootLoggerWithNoConflict

// Obtain an isolated logger instance that does not rely on a global `window`
// reference. This protects service-worker consumers from DOM assumptions.
const rootLog = typeof logWithNoConflict.noConflict === 'function'
  ? logWithNoConflict.noConflict()
  : log

const safeConsole: Console = typeof globalThis !== 'undefined' && globalThis.console
  ? globalThis.console
  : console

// Track instantiated context loggers so we can update their level in sync.
const contextLoggers = new Map<string, log.Logger>()

// Set initial level to WARN (only warnings and errors) for hobby project simplicity
rootLog.setLevel(rootLog.levels.WARN)

// Level and context mappings for consistent formatting
const levelMap: Record<string, string> = {
  debug: 'DBG',
  info: 'INF',
  warn: 'WRN',
  error: 'ERR'
}

// Message counter for tracking log messages by level
const messageCounter: Record<string, Record<string, number>> = {
  debug: {},
  info: {},
  warn: {},
  error: {}
}

const contextMap: Record<string, string> = {
  BACKGROUND: 'BGD',
  CONTENT: 'CNT',
  EXTENSION: 'EXT',
  API: 'API',
  POPUP: 'EXT',  // Map POPUP to EXT since popup UI was removed
  SYSTEM: 'SYS'
}

// Create context-specific loggers
const createLogger = (context: string, targetConsole: Console = safeConsole) => {
  if (contextLoggers.has(context)) {
    return contextLoggers.get(context) as log.Logger
  }

  const contextLogger = rootLog.getLogger(context)

  // Set same level as root logger
  contextLogger.setLevel(rootLog.getLevel())

  // Override methods to add formatted prefix
  const originalFactory = contextLogger.methodFactory
  contextLogger.methodFactory = (methodName: string, logLevel: LogLevelNumbers, loggerName: string) => {
    const rawMethod = originalFactory(methodName, logLevel, loggerName)

    return (...args: unknown[]) => {
      const levelCode = levelMap[methodName] || methodName.toUpperCase().slice(0, 3)
      const contextCode = contextMap[context] || context.slice(0, 3)

      // Track message counts
      if (messageCounter[methodName]) {
        messageCounter[methodName][context] = (messageCounter[methodName][context] ?? 0) + 1
      }

      rawMethod.apply(targetConsole, [`[${levelCode} : ${contextCode}]`, ...args])
    }
  }

  // Rebuild methods with new factory
  contextLogger.setLevel(contextLogger.getLevel())

  contextLoggers.set(context, contextLogger)

  return contextLogger
}

export const createContextLogger = (context: string, targetConsole?: Console) =>
  createLogger(context, targetConsole)

// Export context-specific loggers matching the original API
export const logger: {
  bg: log.Logger
  content: log.Logger
  popup: log.Logger
  api: log.Logger
  extension: log.Logger
  system: log.Logger
  root: log.RootLogger
} = {
  bg: createLogger('BACKGROUND'),
  content: createLogger('CONTENT'),
  popup: createLogger('POPUP'),
  api: createLogger('API'),
  extension: createLogger('EXTENSION'),
  system: createLogger('SYSTEM'),

  // Root logger for general use
  root: rootLog
}

// Export default logger for backward compatibility
export default logger

// Helper function to set log level across all loggers
export const setLogLevel = (level: 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'silent') => {
  rootLog.setLevel(level)
  contextLoggers.forEach(contextLogger => {
    contextLogger.setLevel(level)
  })
}

// Function to get log message counts
export const getLogCounts = (): Record<string, Record<string, number>> => {
  return { ...messageCounter }
}

// Function to get total counts by level
export const getLogCountsByLevel = (): Record<string, number> => {
  const totals: Record<string, number> = {}

  Object.keys(messageCounter).forEach(level => {
    totals[level] = Object.values(messageCounter[level] || {}).reduce((sum, count) => sum + count, 0)
  })

  return totals
}

export const getLogLevelName = (level: LogLevelDesc | LogLevelNumbers): string => {
  if (typeof level === 'string') {
    return level.toUpperCase()
  }

  const match = Object.entries(rootLog.levels).find(([, value]) => value === level)
  return match ? match[0].toUpperCase() : 'UNKNOWN'
}

// Function to reset counters
export const resetLogCounts = (): void => {
  Object.keys(messageCounter).forEach(level => {
    messageCounter[level] = {}
  })
}

// Function to print log counts to console
export const printLogCounts = (): void => {
  const totals = getLogCountsByLevel()
  console.log.call(console, 'Log Message Counts by Level:')
  Object.entries(totals).forEach(([level, count]) => {
    if (count > 0) {
      console.log.call(console, `  ${level}: ${count}`)
    }
  })
  
  console.log.call(console, '\nDetailed counts by context:')
  Object.entries(messageCounter).forEach(([level, contexts]) => {
    if (Object.keys(contexts).length > 0) {
      console.log.call(console, `  ${level}:`)
      Object.entries(contexts).forEach(([context, count]) => {
        console.log.call(console, `    ${context}: ${count}`)
      })
    }
  })
}

// Initialize logger with user's saved preference from Chrome storage
export const initializeLoggerFromStorage = async (): Promise<void> => {
  try {
    // Check if Chrome APIs are available
    if (!chrome.storage) {
      logger.system.info('Chrome storage not available, using default log level')
      return
    }

    // Load saved log level from Chrome storage
    const result = await chrome.storage.local.get(['logLevel'])
    const savedLevel = result.logLevel as 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'silent' | undefined

    if (savedLevel) {
      setLogLevel(savedLevel)
      logger.system.info(`Initialized with saved log level: ${savedLevel}`)
    } else {
      // No saved preference, use hobby project default (warnings and errors only)
      const defaultLevel = 'warn'
      setLogLevel(defaultLevel)
      logger.system.warn(`No saved preference, using simplified default: ${defaultLevel}`)
    }
  } catch (error) {
    logger.system.warn('Failed to initialize from storage:', error)
    // Continue with current level
  }
}