const { BrowserWindow, ipcMain, app } = require('electron');
const path = require('path');

let preferencesWindow = null;
let store = null;

/**
 * Set the store reference
 * @param {Store} electronStore - The electron-store instance
 */
function setStore(electronStore) {
  store = electronStore;
}

/**
 * Create and show preferences window
 * @param {BrowserWindow} parentWindow - Parent window reference
 * @returns {Promise<BrowserWindow>} The preferences window
 */
function createPreferencesWindow(parentWindow) {
  return new Promise((resolve, reject) => {
    // If window already exists, focus it
    if (preferencesWindow && !preferencesWindow.isDestroyed()) {
      preferencesWindow.focus();
      resolve(preferencesWindow);
      return;
    }

    // Create preferences window
    preferencesWindow = new BrowserWindow({
      width: 700,
      height: 500,
      minWidth: 600,
      minHeight: 400,
      title: 'Preferences',
      parent: parentWindow,
      modal: process.platform !== 'darwin', // Modal on Windows/Linux
      show: false,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        preload: path.join(__dirname, 'preload.cjs'),
        webSecurity: true
      },
      backgroundColor: '#ffffff'
    });

    // Load preferences page
    const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

    if (isDev) {
      const devUrl = process.env.VITE_DEV_SERVER_URL || 'http://localhost:5173';
      preferencesWindow.loadURL(`${devUrl}#preferences`);
    } else {
      preferencesWindow.loadFile(path.join(__dirname, '../dist/index.html'), {
        hash: 'preferences'
      });
    }

    // Show when ready
    preferencesWindow.once('ready-to-show', () => {
      preferencesWindow.show();
      resolve(preferencesWindow);
    });

    // Handle window closed
    preferencesWindow.on('closed', () => {
      preferencesWindow = null;
    });

    // Handle load errors
    preferencesWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
      console.error('Failed to load preferences window:', errorDescription);
      reject(new Error(errorDescription));
    });
  });
}

/**
 * Get current preferences window
 * @returns {BrowserWindow|null} The preferences window or null
 */
function getPreferencesWindow() {
  return preferencesWindow;
}

/**
 * Close preferences window if open
 */
function closePreferencesWindow() {
  if (preferencesWindow && !preferencesWindow.isDestroyed()) {
    preferencesWindow.close();
  }
}

// ============================================================================
// Preferences IPC Handlers
// ============================================================================

/**
 * Initialize preferences IPC handlers
 */
function initializePreferencesHandlers() {
  /**
   * Get all preferences
   * @returns {Promise<object>} Preferences object
   */
  ipcMain.handle('preferences:get', async () => {
    try {
      if (!store) {
        console.warn('Store not initialized for preferences');
        return getDefaultPreferences();
      }

      const preferences = store.get('preferences') || getDefaultPreferences();
      console.log('[Preferences] Retrieved preferences:', preferences);
      return preferences;
    } catch (error) {
      console.error('[Preferences] Error getting preferences:', error);
      return getDefaultPreferences();
    }
  });

  /**
   * Save preferences
   * @param {object} preferences - Preferences to save
   * @returns {Promise<void>}
   */
  ipcMain.handle('preferences:save', async (event, preferences) => {
    try {
      if (!store) {
        console.warn('Store not initialized for preferences');
        throw new Error('Storage not available');
      }

      // Merge with existing preferences
      const existing = store.get('preferences') || getDefaultPreferences();
      const merged = { ...existing, ...preferences };

      store.set('preferences', merged);
      console.log('[Preferences] Saved preferences:', merged);

      // Notify all windows about preference changes
      const windows = BrowserWindow.getAllWindows();
      windows.forEach(window => {
        if (!window.isDestroyed()) {
          window.webContents.send('preferences:changed', merged);
        }
      });

      return merged;
    } catch (error) {
      console.error('[Preferences] Error saving preferences:', error);
      throw error;
    }
  });

  /**
   * Reset preferences to defaults
   * @returns {Promise<object>} Default preferences
   */
  ipcMain.handle('preferences:reset', async () => {
    try {
      const defaults = getDefaultPreferences();

      if (store) {
        store.set('preferences', defaults);
      }

      // Notify all windows
      const windows = BrowserWindow.getAllWindows();
      windows.forEach(window => {
        if (!window.isDestroyed()) {
          window.webContents.send('preferences:changed', defaults);
        }
      });

      console.log('[Preferences] Reset to defaults:', defaults);
      return defaults;
    } catch (error) {
      console.error('[Preferences] Error resetting preferences:', error);
      throw error;
    }
  });

  /**
   * Open preferences window
   * @returns {Promise<void>}
   */
  ipcMain.handle('preferences:openWindow', async () => {
    try {
      const mainWindow = BrowserWindow.getFocusedWindow() || BrowserWindow.getAllWindows()[0];
      await createPreferencesWindow(mainWindow);
    } catch (error) {
      console.error('[Preferences] Error opening window:', error);
      throw error;
    }
  });
}

/**
 * Get default preferences
 * @returns {object} Default preferences object
 */
function getDefaultPreferences() {
  return {
    general: {
      theme: 'system', // 'light', 'dark', 'system'
      startupBehavior: 'restore', // 'home', 'restore', 'blank'
      autoUpdate: true,
      notifications: true
    },
    export: {
      defaultFormat: 'csv', // 'csv', 'xlsx', 'json'
      defaultPath: null, // User's downloads folder by default
      openAfterExport: false,
      includeHeaders: true,
      dateFormat: 'ISO', // 'ISO', 'US', 'EU'
      encoding: 'utf-8'
    },
    api: {
      rateLimit: {
        enabled: true,
        requestsPerSecond: 10,
        maxConcurrent: 5
      },
      timeout: 30000, // 30 seconds
      retries: 3,
      retryDelay: 1000
    },
    advanced: {
      logLevel: 'info', // 'trace', 'debug', 'info', 'warn', 'error', 'silent'
      cacheEnabled: true,
      cacheDuration: 300000, // 5 minutes
      developerMode: false,
      experimentalFeatures: false
    }
  };
}

module.exports = {
  createPreferencesWindow,
  getPreferencesWindow,
  closePreferencesWindow,
  initializePreferencesHandlers,
  setStore,
  getDefaultPreferences
};