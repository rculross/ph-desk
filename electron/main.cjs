const { app, BrowserWindow, Menu, ipcMain } = require('electron');
const path = require('path');
const {
  createAuthWindow,
  restoreCookies,
  getCurrentCookies,
  clearCookies
} = require('./auth-window.cjs');

const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

// Store will be initialized async
let store = null;

// Main window reference for auth window parent
let mainWindow = null;

// Initialize electron-store for persistent storage (ESM import)
async function initializeStore() {
  const Store = (await import('electron-store')).default;
  store = new Store({
    name: 'ph-desk-storage',
    encryptionKey: 'ph-desk-secure-storage' // Basic encryption for sensitive data
  });
  return store;
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 768,
    title: 'PH Tools Desktop',
    icon: path.join(__dirname, '../src/assets/icons/icon128.png'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.cjs'),
      webSecurity: true,
      allowRunningInsecureContent: false
    },
    backgroundColor: '#ffffff',
    show: false // Don't show until ready
  });

  // Disable CORS for API requests in development and production
  // This is safe in Electron as we control both client and are making authenticated requests
  mainWindow.webContents.session.webRequest.onBeforeSendHeaders(
    { urls: ['https://api.planhat.com/*', 'https://*.planhat.com/*', 'https://*.planhatdemo.com/*'] },
    (details, callback) => {
      // Add headers but don't modify Origin to maintain cookie security
      callback({ requestHeaders: details.requestHeaders });
    }
  );

  mainWindow.webContents.session.webRequest.onHeadersReceived(
    { urls: ['https://api.planhat.com/*', 'https://*.planhat.com/*', 'https://*.planhatdemo.com/*'] },
    (details, callback) => {
      // Allow CORS by modifying response headers
      const headers = details.responseHeaders || {};
      headers['Access-Control-Allow-Origin'] = ['*'];
      headers['Access-Control-Allow-Methods'] = ['GET, POST, PUT, PATCH, DELETE, OPTIONS'];
      headers['Access-Control-Allow-Headers'] = ['*'];
      headers['Access-Control-Allow-Credentials'] = ['true'];
      callback({ responseHeaders: headers });
    }
  );

  // Show window when ready to avoid flash
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  // Load app
  if (isDev) {
    // Try multiple ports in case 5173 is in use
    const devUrl = process.env.VITE_DEV_SERVER_URL || 'http://localhost:5173';
    mainWindow.loadURL(devUrl);
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  // Handle window events
  mainWindow.on('closed', () => {
    // Dereference the window object
  });

  // Basic menu setup
  const menu = Menu.buildFromTemplate([
    {
      label: 'File',
      submenu: [
        {
          label: 'Export',
          accelerator: 'CmdOrCtrl+E',
          enabled: false // Will be enabled when data is loaded
        },
        { type: 'separator' },
        {
          label: 'Preferences',
          accelerator: 'CmdOrCtrl+,',
          enabled: false // Will be enabled in Phase 4
        },
        { type: 'separator' },
        { role: 'quit' }
      ]
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' }
      ]
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' }
      ]
    },
    {
      label: 'Window',
      submenu: [
        { role: 'minimize' },
        { role: 'zoom' },
        { type: 'separator' },
        { role: 'close' }
      ]
    },
    {
      label: 'Help',
      submenu: [
        {
          label: 'Documentation',
          click: async () => {
            const { shell } = require('electron');
            await shell.openExternal('https://github.com/your-org/ph-tools-desktop/docs');
          }
        },
        { type: 'separator' },
        {
          label: 'About PH Tools',
          click: () => {
            // Will show about dialog in Phase 5
          }
        }
      ]
    }
  ]);
  Menu.setApplicationMenu(menu);

  return mainWindow;
}

// App lifecycle events
app.whenReady().then(async () => {
  // Initialize store before creating window
  await initializeStore();
  console.log('Electron store initialized');

  // Restore saved authentication session
  try {
    const authData = store.get('auth');
    if (authData && authData.cookies && Array.isArray(authData.cookies)) {
      console.log('[Main] Restoring saved authentication session...');
      await restoreCookies(authData.cookies);
      console.log('[Main] Authentication session restored successfully');
    } else {
      console.log('[Main] No saved authentication session found');
    }
  } catch (error) {
    console.error('[Main] Error restoring authentication session:', error);
  }

  createWindow();

  app.on('activate', () => {
    // On macOS, re-create window when dock icon is clicked and no windows are open
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  // On macOS, apps typically stay active until user quits explicitly with Cmd + Q
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Handle any uncaught errors
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// ============================================================================
// Storage IPC Handlers
// ============================================================================

/**
 * Get storage item(s)
 * @param {string | string[] | null} keys - Key(s) to retrieve, or null for all
 * @returns {Promise<Record<string, any>>} Storage items
 */
ipcMain.handle('storage:get', async (event, keys) => {
  try {
    if (!store) {
      console.warn('Storage not initialized yet');
      return {};
    }

    if (keys === null) {
      // Get all items
      return store.store;
    } else if (typeof keys === 'string') {
      // Get single item
      const value = store.get(keys);
      return value !== undefined ? { [keys]: value } : {};
    } else if (Array.isArray(keys)) {
      // Get multiple items
      const result = {};
      for (const key of keys) {
        const value = store.get(key);
        if (value !== undefined) {
          result[key] = value;
        }
      }
      return result;
    }
    return {};
  } catch (error) {
    console.error('Storage get error:', error);
    throw error;
  }
});

/**
 * Set storage item(s)
 * @param {Record<string, any>} items - Items to store
 * @returns {Promise<void>}
 */
ipcMain.handle('storage:set', async (event, items) => {
  try {
    if (!store) {
      console.warn('Storage not initialized yet');
      return;
    }
    for (const [key, value] of Object.entries(items)) {
      store.set(key, value);
    }
  } catch (error) {
    console.error('Storage set error:', error);
    throw error;
  }
});

/**
 * Remove storage item(s)
 * @param {string | string[]} keys - Key(s) to remove
 * @returns {Promise<void>}
 */
ipcMain.handle('storage:remove', async (event, keys) => {
  try {
    if (!store) {
      console.warn('Storage not initialized yet');
      return;
    }
    if (typeof keys === 'string') {
      store.delete(keys);
    } else if (Array.isArray(keys)) {
      for (const key of keys) {
        store.delete(key);
      }
    }
  } catch (error) {
    console.error('Storage remove error:', error);
    throw error;
  }
});

/**
 * Clear all storage
 * @returns {Promise<void>}
 */
ipcMain.handle('storage:clear', async () => {
  try {
    if (!store) {
      console.warn('Storage not initialized yet');
      return;
    }
    store.clear();
  } catch (error) {
    console.error('Storage clear error:', error);
    throw error;
  }
});

/**
 * Get bytes in use (approximation for compatibility)
 * @param {string | string[] | null} keys - Keys to measure, or null for all
 * @returns {Promise<number>} Approximate bytes used
 */
ipcMain.handle('storage:getBytesInUse', async (event, keys) => {
  try {
    if (!store) {
      console.warn('Storage not initialized yet');
      return 0;
    }

    let data;
    if (keys === null) {
      data = store.store;
    } else if (typeof keys === 'string') {
      data = store.get(keys);
    } else if (Array.isArray(keys)) {
      data = {};
      for (const key of keys) {
        const value = store.get(key);
        if (value !== undefined) {
          data[key] = value;
        }
      }
    }

    // Calculate approximate size
    const jsonString = JSON.stringify(data);
    return Buffer.byteLength(jsonString, 'utf8');
  } catch (error) {
    console.error('Storage getBytesInUse error:', error);
    return 0;
  }
});

// ============================================================================
// Authentication IPC Handlers
// ============================================================================

/**
 * Open login window and authenticate
 * @param {string} environment - 'production' or 'demo'
 * @returns {Promise<{cookies: Array, tenantSlug: string|null, environment: string}>}
 */
ipcMain.handle('auth:openLoginWindow', async (event, environment = 'production') => {
  try {
    console.log(`[Main] Opening login window for ${environment}`);

    if (!mainWindow) {
      throw new Error('Main window not available');
    }

    const authResult = await createAuthWindow(mainWindow, environment);

    // Store cookies and auth data persistently
    if (store) {
      await store.set('auth', {
        cookies: authResult.cookies,
        tenantSlug: authResult.tenantSlug,
        environment: authResult.environment,
        lastLogin: Date.now()
      });
      console.log('[Main] Auth data saved to storage');
    }

    return authResult;
  } catch (error) {
    console.error('[Main] Login error:', error);
    throw error;
  }
});

/**
 * Get current session cookies
 * @returns {Promise<Array>}
 */
ipcMain.handle('auth:getCookies', async () => {
  try {
    const cookies = await getCurrentCookies();
    console.log(`[Main] Retrieved ${cookies.length} current cookies`);
    return cookies;
  } catch (error) {
    console.error('[Main] Error getting cookies:', error);
    throw error;
  }
});

/**
 * Set/restore cookies to session
 * @param {Array} cookies - Cookies to restore
 * @returns {Promise<void>}
 */
ipcMain.handle('auth:setCookies', async (event, cookies) => {
  try {
    await restoreCookies(cookies);
    console.log('[Main] Cookies restored successfully');
  } catch (error) {
    console.error('[Main] Error setting cookies:', error);
    throw error;
  }
});

/**
 * Clear all authentication cookies
 * @returns {Promise<void>}
 */
ipcMain.handle('auth:clearCookies', async () => {
  try {
    await clearCookies();

    // Also clear stored auth data
    if (store) {
      await store.delete('auth');
      console.log('[Main] Auth data cleared from storage');
    }

    console.log('[Main] All auth cookies cleared');
  } catch (error) {
    console.error('[Main] Error clearing cookies:', error);
    throw error;
  }
});

/**
 * Get stored auth data
 * @returns {Promise<object|null>}
 */
ipcMain.handle('auth:getStoredAuth', async () => {
  try {
    if (!store) {
      return null;
    }

    const authData = store.get('auth');
    console.log('[Main] Retrieved stored auth:', authData ? 'found' : 'not found');
    return authData || null;
  } catch (error) {
    console.error('[Main] Error getting stored auth:', error);
    return null;
  }
});

/**
 * Check if currently authenticated
 * @returns {Promise<boolean>}
 */
ipcMain.handle('auth:isAuthenticated', async () => {
  try {
    const cookies = await getCurrentCookies();
    const hasAuthCookies = cookies.length > 0;

    console.log(`[Main] Auth check: ${hasAuthCookies ? 'authenticated' : 'not authenticated'}`);
    return hasAuthCookies;
  } catch (error) {
    console.error('[Main] Error checking authentication:', error);
    return false;
  }
});
