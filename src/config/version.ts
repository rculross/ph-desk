/**
 * Application version configuration
 * This must match the version in manifest.json and package.json
 */

declare global {
  const __VERSION__: string
  const __BUILD_TIME__: string
  const __NODE_ENV__: string
  const __DEV__: boolean
}

export const APP_VERSION = '4.0.12'

export const VERSION_INFO = {
  major: 4,
  minor: 0,
  patch: 12,
  full: APP_VERSION,
  displayName: `Planhat Tools v${APP_VERSION}`
}

export const BUILD_INFO = {
  version: typeof __VERSION__ !== 'undefined' ? __VERSION__ : APP_VERSION,
  buildTime: typeof __BUILD_TIME__ !== 'undefined' ? __BUILD_TIME__ : 'unknown',
  environment: typeof __NODE_ENV__ !== 'undefined' ? __NODE_ENV__ : 'unknown',
  isDevelopment: typeof __DEV__ !== 'undefined' ? __DEV__ : false,
  mode: typeof __NODE_ENV__ !== 'undefined' ? (__NODE_ENV__ === 'production' ? 'production' : 'development') : 'unknown'
}
