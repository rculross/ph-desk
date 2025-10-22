/**
 * Preferences Schema for electron-preferences
 * Defines the structure and UI for the native preferences dialog
 */

const { app } = require('electron');
const path = require('path');

/**
 * Get the preferences schema
 * @returns {object} electron-preferences schema
 */
function getPreferencesSchema() {
  return {
    // Window configuration
    browserWindowOverrides: {
      title: 'Preferences',
      width: 800,
      height: 600,
      minWidth: 700,
      minHeight: 500,
      resizable: true,
      maximizable: false,
      modal: true, // Modal dialog as requested
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        webSecurity: true
      }
    },

    // Preferences sections (tabs)
    sections: [
      // ======================================================================
      // GENERAL
      // ======================================================================
      {
        id: 'general',
        label: 'General',
        icon: 'settings-gear-63',
        form: {
          groups: [
            {
              label: 'Appearance',
              fields: [
                {
                  key: 'theme',
                  label: 'Theme',
                  type: 'radio',
                  options: [
                    { label: 'Light', value: 'light' },
                    { label: 'Dark', value: 'dark' },
                    { label: 'System', value: 'system' }
                  ],
                  default: 'system',
                  help: 'Choose the color theme for the application'
                }
              ]
            },
            {
              label: 'Startup',
              fields: [
                {
                  key: 'startupBehavior',
                  label: 'On Startup',
                  type: 'radio',
                  options: [
                    { label: 'Show Home', value: 'home' },
                    { label: 'Restore Last Session', value: 'restore' },
                    { label: 'Start Blank', value: 'blank' }
                  ],
                  default: 'restore',
                  help: 'What to show when the application starts'
                }
              ]
            },
            {
              label: 'Updates & Notifications',
              fields: [
                {
                  key: 'autoUpdate',
                  label: 'Automatically check for updates',
                  type: 'checkbox',
                  default: true
                },
                {
                  key: 'notifications',
                  label: 'Show desktop notifications',
                  type: 'checkbox',
                  default: true
                }
              ]
            }
          ]
        }
      },

      // ======================================================================
      // EXPORT
      // ======================================================================
      {
        id: 'export',
        label: 'Export',
        icon: 'cloud-download-93',
        form: {
          groups: [
            {
              label: 'Default Settings',
              fields: [
                {
                  key: 'defaultFormat',
                  label: 'Default Format',
                  type: 'radio',
                  options: [
                    { label: 'CSV', value: 'csv' },
                    { label: 'Excel (XLSX)', value: 'xlsx' },
                    { label: 'JSON', value: 'json' }
                  ],
                  default: 'csv',
                  help: 'Default export format for data exports'
                },
                {
                  key: 'dateFormat',
                  label: 'Date Format',
                  type: 'radio',
                  options: [
                    { label: 'ISO 8601 (YYYY-MM-DD)', value: 'ISO' },
                    { label: 'US (MM/DD/YYYY)', value: 'US' },
                    { label: 'EU (DD/MM/YYYY)', value: 'EU' }
                  ],
                  default: 'ISO',
                  help: 'Date format used in exported files'
                }
              ]
            },
            {
              label: 'Export Behavior',
              fields: [
                {
                  key: 'openAfterExport',
                  label: 'Open file after export',
                  type: 'checkbox',
                  default: false,
                  help: 'Automatically open exported files with default application'
                },
                {
                  key: 'includeHeaders',
                  label: 'Include column headers in exports',
                  type: 'checkbox',
                  default: true,
                  help: 'Add header row to CSV and Excel exports'
                }
              ]
            },
            {
              label: 'Advanced Export Options',
              fields: [
                {
                  key: 'encoding',
                  label: 'File Encoding',
                  type: 'text',
                  default: 'utf-8',
                  help: 'Character encoding for exported text files (e.g., utf-8, utf-16)'
                }
              ]
            }
          ]
        }
      },

      // ======================================================================
      // API
      // ======================================================================
      {
        id: 'api',
        label: 'API',
        icon: 'preferences',
        form: {
          groups: [
            {
              label: 'Rate Limiting',
              fields: [
                {
                  key: 'rateLimitEnabled',
                  label: 'Enable rate limiting',
                  type: 'checkbox',
                  default: true,
                  help: 'Limit API request rate to prevent server overload'
                },
                {
                  key: 'requestsPerSecond',
                  label: 'Requests Per Second',
                  type: 'slider',
                  min: 1,
                  max: 100,
                  default: 10,
                  help: 'Maximum number of API requests per second'
                },
                {
                  key: 'maxConcurrent',
                  label: 'Max Concurrent Requests',
                  type: 'slider',
                  min: 1,
                  max: 20,
                  default: 5,
                  help: 'Maximum number of simultaneous API requests'
                }
              ]
            },
            {
              label: 'Request Handling',
              fields: [
                {
                  key: 'timeout',
                  label: 'Request Timeout (seconds)',
                  type: 'slider',
                  min: 5,
                  max: 300,
                  default: 30,
                  help: 'Maximum time to wait for API response'
                },
                {
                  key: 'retries',
                  label: 'Max Retries',
                  type: 'slider',
                  min: 0,
                  max: 10,
                  default: 3,
                  help: 'Number of retry attempts for failed requests'
                },
                {
                  key: 'retryDelay',
                  label: 'Retry Delay (milliseconds)',
                  type: 'slider',
                  min: 100,
                  max: 10000,
                  default: 1000,
                  help: 'Delay between retry attempts'
                }
              ]
            }
          ]
        }
      },

      // ======================================================================
      // ADVANCED
      // ======================================================================
      {
        id: 'advanced',
        label: 'Advanced',
        icon: 'atom',
        form: {
          groups: [
            {
              label: 'Logging',
              fields: [
                {
                  key: 'logLevel',
                  label: 'Log Level',
                  type: 'dropdown',
                  options: [
                    { label: 'Trace (Most Verbose)', value: 'trace' },
                    { label: 'Debug', value: 'debug' },
                    { label: 'Info', value: 'info' },
                    { label: 'Warn', value: 'warn' },
                    { label: 'Error', value: 'error' },
                    { label: 'Silent (No Logs)', value: 'silent' }
                  ],
                  default: 'info',
                  help: 'Minimum level of log messages to display'
                }
              ]
            },
            {
              label: 'Caching',
              fields: [
                {
                  key: 'cacheEnabled',
                  label: 'Enable cache',
                  type: 'checkbox',
                  default: true,
                  help: 'Cache API responses to improve performance'
                },
                {
                  key: 'cacheDuration',
                  label: 'Cache Duration (minutes)',
                  type: 'slider',
                  min: 1,
                  max: 60,
                  default: 5,
                  help: 'How long to cache API responses'
                }
              ]
            },
            {
              label: 'Developer Options',
              fields: [
                {
                  key: 'developerMode',
                  label: 'Developer mode',
                  type: 'checkbox',
                  default: false,
                  help: 'Enable developer tools and debug features'
                },
                {
                  key: 'experimentalFeatures',
                  label: 'Enable experimental features',
                  type: 'checkbox',
                  default: false,
                  help: 'Try new features before they are officially released'
                }
              ]
            }
          ]
        }
      }
    ],

    // Default values (flat structure for electron-store compatibility)
    defaults: {
      // General
      theme: 'system',
      startupBehavior: 'restore',
      autoUpdate: true,
      notifications: true,

      // Export
      defaultFormat: 'csv',
      defaultPath: null,
      openAfterExport: false,
      includeHeaders: true,
      dateFormat: 'ISO',
      encoding: 'utf-8',

      // API (flatten rate limit object for electron-preferences)
      rateLimitEnabled: true,
      requestsPerSecond: 10,
      maxConcurrent: 5,
      timeout: 30000, // Store in milliseconds, display in seconds
      retries: 3,
      retryDelay: 1000,

      // Advanced
      logLevel: 'info',
      cacheEnabled: true,
      cacheDuration: 300000, // Store in milliseconds, display in minutes
      developerMode: false,
      experimentalFeatures: false
    }
  };
}

module.exports = { getPreferencesSchema };
