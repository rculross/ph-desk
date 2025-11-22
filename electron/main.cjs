const { app, BrowserWindow, Menu, ipcMain, safeStorage, dialog } = require('electron');
const path = require('path');
const crypto = require('crypto');
const fs = require('fs');
const packageJson = require('../package.json');
const {
  createAuthWindow,
  restoreCookies,
  getCurrentCookies,
  clearCookies
} = require('./auth-window.cjs');
const {
  openPlanhatBrowser,
  closePlanhatBrowser,
  togglePlanhatBrowser,
  isPlanhatBrowserOpen
} = require('./planhat-browser.cjs');
const { initializeMenu, setMainWindow: setMenuMainWindow, updateWindowMenu } = require('./menu.cjs');

const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

// Store will be initialized async
let store = null;

// Main window reference for auth window parent
let mainWindow = null;

// ============================================================================
// Encryption Key Management
// ============================================================================

/**
 * Generate a cryptographically secure random 32-byte encryption key
 * @returns {Buffer} 32-byte random key
 */
function generateEncryptionKey() {
  return crypto.randomBytes(32);
}

/**
 * Get the path to the keystore file
 * @returns {string} Absolute path to keystore file
 */
function getKeystorePath() {
  // Store keystore in app userData directory (separate from main store)
  const userDataPath = app.getPath('userData');
  return path.join(userDataPath, 'ph-desk-keystore.dat');
}

/**
 * Retrieve or generate the encryption key
 * This function ensures a unique random key is generated once and reused across sessions
 * @returns {Buffer} Encryption key (32 bytes)
 */
function getOrCreateEncryptionKey() {
  const keystorePath = getKeystorePath();

  try {
    // Check if keystore file exists
    if (fs.existsSync(keystorePath)) {
      console.log('[KeyStore] Found existing keystore, retrieving key...');

      // Read encrypted key from file
      const encryptedKey = fs.readFileSync(keystorePath);

      if (safeStorage.isEncryptionAvailable()) {
        // Decrypt the key using OS-level security
        const decryptedKey = safeStorage.decryptString(encryptedKey);

        // Convert hex string back to Buffer
        const keyBuffer = Buffer.from(decryptedKey, 'hex');

        console.log('[KeyStore] Successfully retrieved and decrypted existing key');
        return keyBuffer;
      } else {
        // If OS encryption not available, use the raw encrypted data as key
        // This is a fallback and less secure, but maintains backward compatibility
        console.warn('[KeyStore] OS encryption not available, using stored key directly');
        return encryptedKey.slice(0, 32); // Use first 32 bytes
      }
    } else {
      console.log('[KeyStore] No existing keystore found, generating new key...');

      // Generate a new random 32-byte key
      const newKey = generateEncryptionKey();

      // Save the key encrypted with OS security
      if (safeStorage.isEncryptionAvailable()) {
        // Convert Buffer to hex string for encryption
        const keyHexString = newKey.toString('hex');

        // Encrypt the key using OS-level security (Keychain on macOS, Credential Manager on Windows)
        const encryptedKey = safeStorage.encryptString(keyHexString);

        // Ensure userData directory exists
        const userDataPath = app.getPath('userData');
        if (!fs.existsSync(userDataPath)) {
          fs.mkdirSync(userDataPath, { recursive: true });
        }

        // Write encrypted key to file
        fs.writeFileSync(keystorePath, encryptedKey, { mode: 0o600 });

        console.log('[KeyStore] Generated new key and saved to keystore (OS-encrypted)');
      } else {
        // Fallback: store key with basic obfuscation (not ideal, but better than static key)
        console.warn('[KeyStore] OS encryption not available, using obfuscated storage');

        // Basic XOR obfuscation with a static salt (still better than plaintext)
        const obfuscationSalt = Buffer.from('ph-desk-v1-salt-DO-NOT-MODIFY', 'utf-8');
        const obfuscatedKey = Buffer.alloc(newKey.length);
        for (let i = 0; i < newKey.length; i++) {
          obfuscatedKey[i] = newKey[i] ^ obfuscationSalt[i % obfuscationSalt.length];
        }

        // Ensure userData directory exists
        const userDataPath = app.getPath('userData');
        if (!fs.existsSync(userDataPath)) {
          fs.mkdirSync(userDataPath, { recursive: true });
        }

        fs.writeFileSync(keystorePath, obfuscatedKey, { mode: 0o600 });

        console.log('[KeyStore] Generated new key with basic obfuscation');
      }

      return newKey;
    }
  } catch (error) {
    console.error('[KeyStore] Error managing encryption key:', error);

    // Fallback: generate a new key in memory (will be lost on restart)
    console.warn('[KeyStore] Using temporary in-memory key (will not persist)');
    return generateEncryptionKey();
  }
}

// ============================================================================
// Store Initialization
// ============================================================================

/**
 * Initialize electron-store for persistent storage (ESM import)
 * Uses a unique random 32-byte encryption key stored securely with OS-level encryption
 * @returns {Promise<Store>} Initialized store instance
 */
async function initializeStore() {
  const Store = (await import('electron-store')).default;

  try {
    // Get or create the encryption key (unique per installation)
    const encryptionKey = getOrCreateEncryptionKey();

    console.log('[Store] Initializing electron-store with secure encryption key');

    // Initialize store with encryption
    store = new Store({
      name: 'ph-desk-storage',
      encryptionKey,
      // Additional security options
      clearInvalidConfig: false // Don't auto-clear on decryption errors (fail safely)
    });

    console.log('[Store] Electron-store initialized successfully');

    return store;
  } catch (error) {
    console.error('[Store] Failed to initialize store:', error);

    // Fallback: initialize without encryption (less secure but functional)
    console.warn('[Store] Falling back to unencrypted storage');
    store = new Store({
      name: 'ph-desk-storage-fallback'
    });

    return store;
  }
}


function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 768,
    title: `Planhat Tools ${packageJson.version}`,
    icon: path.join(__dirname, '../src/assets/icons/icon128.png'),
    webPreferences: {
      partition: 'session:planhat', // CRITICAL: Use same session as auth window for cookie access
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.cjs'),
      webSecurity: true,
      allowRunningInsecureContent: false
    },
    backgroundColor: '#ffffff',
    show: false // Don't show until ready
  });

  // CRITICAL: Configure CORS for Planhat session partition (where auth cookies live)
  // The main window makes API calls, but cookies are stored in the Planhat partition
  const { session } = require('electron');
  const planhatSession = session.fromPartition('session:planhat');

  // Setup CORS handlers for Planhat session partition
  planhatSession.webRequest.onBeforeSendHeaders(
    { urls: ['https://api.planhat.com/*', 'https://*.planhat.com/*', 'https://*.planhatdemo.com/*'] },
    (details, callback) => {
      // Add headers but don't modify Origin to maintain cookie security
      callback({ requestHeaders: details.requestHeaders });
    }
  );

  planhatSession.webRequest.onHeadersReceived(
    { urls: ['https://api.planhat.com/*', 'https://*.planhat.com/*', 'https://*.planhatdemo.com/*'] },
    (details, callback) => {
      // Allow CORS by modifying response headers
      // Security: Restricted to only necessary HTTP methods and headers
      const headers = details.responseHeaders || {};

      // Remove any existing CORS headers to prevent duplication
      delete headers['access-control-allow-origin'];
      delete headers['access-control-allow-methods'];
      delete headers['access-control-allow-headers'];
      delete headers['access-control-allow-credentials'];
      delete headers['access-control-max-age'];
      delete headers['Access-Control-Allow-Origin'];
      delete headers['Access-Control-Allow-Methods'];
      delete headers['Access-Control-Allow-Headers'];
      delete headers['Access-Control-Allow-Credentials'];
      delete headers['Access-Control-Max-Age'];

      // Set specific origin for credentialed requests
      // IMPORTANT: Set as array with single value to replace any existing values
      const origin = isDev ? 'http://localhost:5173' : `file://${__dirname}`;
      headers['Access-Control-Allow-Origin'] = [origin];

      // Security: Restrict to only necessary HTTP methods (removed OPTIONS)
      // Preflight requests are handled by browser, no need to explicitly allow OPTIONS
      headers['Access-Control-Allow-Methods'] = ['GET, POST, PUT, PATCH, DELETE'];

      // Security: Restrict to only essential headers required by Planhat API
      // Removed unnecessary headers: X-Requested-With, Accept, Origin
      headers['Access-Control-Allow-Headers'] = ['Content-Type, Authorization, X-Client-Version, X-Request-Id'];

      headers['Access-Control-Allow-Credentials'] = ['true'];
      headers['Access-Control-Max-Age'] = ['86400']; // Cache preflight for 24 hours

      callback({ responseHeaders: headers });
    }
  );

  // Show window when ready to avoid flash
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    mainWindow.maximize(); // Maximize window to full screen
  });

  // Apply DevTools network filter to hide local network requests
  mainWindow.webContents.on('devtools-opened', () => {
    const devToolsWebContents = mainWindow.webContents.devToolsWebContents;

    if (devToolsWebContents) {
      // Apply filter to hide local network requests from Network tab
      // This uses the DevTools filter syntax: - prefix means "exclude"
      // Filters out: localhost, 127.x.x.x, 192.168.x.x, 10.x.x.x, 172.16-31.x.x, ::1
      const filterPattern = '-url:localhost -url:127.0.0.1 -url:192.168. -url:10. -url:172.1 -url:172.2 -url:172.3 -url:[::1]';

      // Try multiple approaches to set the filter (DevTools internals change frequently)
      const attemptSetFilter = (attempt = 1, maxAttempts = 10) => {
        setTimeout(() => {
          devToolsWebContents.executeJavaScript(`
            (function() {
              try {
                const filterPattern = '${filterPattern}';
                let filterSet = false;

                // Method 1: Try modern DevTools UI structure (Chromium 120+)
                // Look for the filter input by searching the DOM
                const filterInput = document.querySelector('.toolbar input[type="text"][placeholder*="Filter"], .toolbar input[aria-label*="Filter"], input[aria-label*="filter"]');
                if (filterInput && !filterSet) {
                  filterInput.value = filterPattern;
                  filterInput.dispatchEvent(new Event('input', { bubbles: true }));
                  filterInput.dispatchEvent(new Event('change', { bubbles: true }));
                  console.log('[DevTools Filter] Applied via DOM input (Method 1)');
                  filterSet = true;
                  return { success: true, method: 'DOM input' };
                }

                // Method 2: Try legacy UI.panels structure (older Chromium)
                if (window.UI && window.UI.panels && window.UI.panels.network && !filterSet) {
                  const networkPanel = window.UI.panels.network;
                  if (networkPanel._networkLogView && networkPanel._networkLogView._textFilterUI) {
                    networkPanel._networkLogView._textFilterUI.setValue(filterPattern);
                    console.log('[DevTools Filter] Applied via UI.panels (Method 2)');
                    filterSet = true;
                    return { success: true, method: 'UI.panels' };
                  }
                }

                // Method 3: Try Root.Runtime approach (some Chromium versions)
                if (window.Root && window.Root.Runtime && !filterSet) {
                  const runtime = window.Root.Runtime;
                  if (runtime.experiments && runtime.experiments.setEnabled) {
                    // Try to find and set the network filter
                    const views = document.querySelectorAll('.network-log-grid');
                    if (views.length > 0) {
                      const filterInput = views[0].querySelector('input[type="text"]');
                      if (filterInput) {
                        filterInput.value = filterPattern;
                        filterInput.dispatchEvent(new Event('input', { bubbles: true }));
                        console.log('[DevTools Filter] Applied via Root.Runtime (Method 3)');
                        filterSet = true;
                        return { success: true, method: 'Root.Runtime' };
                      }
                    }
                  }
                }

                // Method 4: Generic DOM search - find any text input in toolbar area
                if (!filterSet) {
                  const toolbarInputs = document.querySelectorAll('.toolbar input[type="text"], .network-toolbar input[type="text"]');
                  for (let input of toolbarInputs) {
                    // Check if this looks like a filter input (has filter-related attributes or is in the right location)
                    const isFilterInput =
                      input.placeholder?.toLowerCase().includes('filter') ||
                      input.ariaLabel?.toLowerCase().includes('filter') ||
                      input.className?.toLowerCase().includes('filter') ||
                      input.closest('.toolbar')?.querySelector('.clear-button');

                    if (isFilterInput) {
                      input.value = filterPattern;
                      input.dispatchEvent(new Event('input', { bubbles: true }));
                      input.dispatchEvent(new Event('change', { bubbles: true }));
                      console.log('[DevTools Filter] Applied via generic DOM search (Method 4)');
                      filterSet = true;
                      return { success: true, method: 'Generic DOM' };
                    }
                  }
                }

                if (!filterSet) {
                  return { success: false, error: 'No filter input found' };
                }
              } catch (e) {
                return { success: false, error: e.message };
              }
            })();
          `).then(result => {
            if (result && result.success) {
              console.log(`[DevTools] Network filter applied successfully using ${result.method}`);
            } else if (attempt < maxAttempts) {
              console.log(`[DevTools] Filter attempt ${attempt}/${maxAttempts} failed: ${result?.error || 'unknown'}, retrying...`);
              attemptSetFilter(attempt + 1, maxAttempts);
            } else {
              console.log(`[DevTools] Could not apply network filter after ${maxAttempts} attempts. Filter must be set manually in DevTools.`);
            }
          }).catch(err => {
            if (attempt < maxAttempts) {
              console.log(`[DevTools] Filter attempt ${attempt}/${maxAttempts} error: ${err.message}, retrying...`);
              attemptSetFilter(attempt + 1, maxAttempts);
            } else {
              console.log(`[DevTools] Could not apply network filter after ${maxAttempts} attempts: ${err.message}`);
            }
          });
        }, attempt === 1 ? 1000 : 500); // First attempt waits 1s, subsequent attempts wait 500ms
      };

      // Start attempting to set the filter
      attemptSetFilter();
    }
  });

  // Register local keyboard shortcuts for DevTools (only when app is focused)
  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (input.type !== 'keyDown') return;

    // F12 - Universal DevTools shortcut
    if (input.key === 'F12') {
      mainWindow.webContents.toggleDevTools();
      event.preventDefault();
      return;
    }

    // macOS: Cmd+Option+I or Cmd+Option+J
    if (process.platform === 'darwin') {
      if (input.meta && input.alt && (input.key === 'i' || input.key === 'I' || input.key === 'j' || input.key === 'J')) {
        mainWindow.webContents.toggleDevTools();
        event.preventDefault();
        return;
      }
    } else {
      // Windows/Linux: Ctrl+Shift+I or Ctrl+Shift+J
      if (input.control && input.shift && (input.key === 'i' || input.key === 'I' || input.key === 'j' || input.key === 'J')) {
        mainWindow.webContents.toggleDevTools();
        event.preventDefault();
        return;
      }
    }
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

  // Update menu when main window gains focus
  mainWindow.on('focus', () => {
    updateWindowMenu();
  });

  // Initialize application menu (delegated to menu.cjs)
  // Removed duplicate inline menu creation (lines 263-344, ~82 lines)
  // Menu creation is now handled by menu.cjs for better organization
  setMenuMainWindow(mainWindow);
  initializeMenu();

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

      // Filter out expired cookies
      const now = Date.now() / 1000; // Unix timestamp in seconds
      const validCookies = authData.cookies.filter(cookie => {
        if (cookie.expirationDate && cookie.expirationDate < now) {
          console.log(`[Main] Skipping expired cookie: ${cookie.name} (expired ${new Date(cookie.expirationDate * 1000).toISOString()})`);
          return false;
        }
        return true;
      });

      if (validCookies.length > 0) {
        await restoreCookies(validCookies);
        console.log(`[Main] Authentication session restored successfully (${validCookies.length} valid cookies, ${authData.cookies.length - validCookies.length} expired)`);

        // Update stored auth data to remove expired cookies
        if (validCookies.length < authData.cookies.length) {
          store.set('auth', {
            ...authData,
            cookies: validCookies
          });
        }
      } else {
        console.log('[Main] All cookies expired, clearing auth data');
        await store.delete('auth');
      }
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

// Unregister all shortcuts when app quits
app.on('will-quit', () => {
  globalShortcut.unregisterAll();
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

/**
 * Save last production tenant slug
 * @param {string} tenantSlug - Tenant slug to save
 * @returns {Promise<void>}
 */
ipcMain.handle('auth:saveLastProdTenant', async (event, tenantSlug) => {
  try {
    if (!store) {
      console.warn('[Main] Store not initialized yet');
      return;
    }

    // Get existing auth data or create new
    const authData = store.get('auth') || {};
    authData.tenantSlug = tenantSlug;
    authData.lastLogin = Date.now();

    store.set('auth', authData);
    console.log(`[Main] Saved last production tenant: ${tenantSlug}`);
  } catch (error) {
    console.error('[Main] Error saving last production tenant:', error);
    throw error;
  }
});

/**
 * Logout - clear cookies and auth data
 * @returns {Promise<void>}
 */
ipcMain.handle('auth:logout', async () => {
  try {
    await clearCookies();

    // Clear stored auth data
    if (store) {
      await store.delete('auth');
      console.log('[Main] Auth data cleared from storage');
    }

    console.log('[Main] Logout successful');
  } catch (error) {
    console.error('[Main] Error during logout:', error);
    throw error;
  }
});

// ============================================================================
// Planhat Browser IPC Handlers
// ============================================================================

/**
 * Open Planhat browser window
 * @returns {Promise<void>}
 */
ipcMain.handle('planhat-browser:open', async () => {
  try {
    await openPlanhatBrowser();
    console.log('[Main] Planhat browser window opened');
  } catch (error) {
    console.error('[Main] Error opening Planhat browser:', error);
    throw error;
  }
});

/**
 * Close Planhat browser window
 * @returns {Promise<void>}
 */
ipcMain.handle('planhat-browser:close', async () => {
  try {
    await closePlanhatBrowser();
    console.log('[Main] Planhat browser window closed');
  } catch (error) {
    console.error('[Main] Error closing Planhat browser:', error);
    throw error;
  }
});

/**
 * Toggle Planhat browser window
 * @returns {Promise<void>}
 */
ipcMain.handle('planhat-browser:toggle', async () => {
  try {
    await togglePlanhatBrowser();
    console.log('[Main] Planhat browser window toggled');
  } catch (error) {
    console.error('[Main] Error toggling Planhat browser:', error);
    throw error;
  }
});

/**
 * Check if Planhat browser window is open
 * @returns {Promise<boolean>}
 */
ipcMain.handle('planhat-browser:is-open', async () => {
  try {
    const isOpen = await isPlanhatBrowserOpen();
    return isOpen;
  } catch (error) {
    console.error('[Main] Error checking Planhat browser status:', error);
    return false;
  }
});

// ============================================================================
// Window IPC Handlers
// ============================================================================

/**
 * Set window title
 * @param {string} title - New window title
 * @returns {Promise<void>}
 */
ipcMain.handle('window:setTitle', async (event, title) => {
  try {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.setTitle(title);
      console.log(`[Main] Window title set to: ${title}`);
    }
  } catch (error) {
    console.error('[Main] Error setting window title:', error);
    throw error;
  }
});

// ============================================================================
// Tenant Storage IPC Handlers
// ============================================================================

/**
 * Get tenant storage data
 * NOTE: Only lastProdTenant is persisted between sessions
 * Demo tenants are stored in-memory only (Zustand store)
 * @returns {Promise<{lastProdTenant: string|null}>}
 */
ipcMain.handle('tenant:get-storage', async () => {
  try {
    if (!store) {
      console.warn('[Main] Store not initialized yet');
      return { lastProdTenant: null };
    }

    const tenantStorage = store.get('tenant-storage') || {};
    console.log('[Main] Retrieved tenant storage:', tenantStorage);

    return {
      lastProdTenant: tenantStorage.lastProdTenant || null
    };
  } catch (error) {
    console.error('[Main] Error getting tenant storage:', error);
    return { lastProdTenant: null };
  }
});

/**
 * Save tenant storage data (production tenants only)
 * NOTE: Only production tenants are persisted between sessions
 * Demo tenants are stored in-memory only and cleared on app restart
 * @param {string} tenantSlug - Production tenant slug to save
 * @returns {Promise<void>}
 */
ipcMain.handle('tenant:save-storage', async (event, tenantSlug) => {
  try {
    if (!store) {
      console.warn('[Main] Store not initialized yet');
      return;
    }

    // Get existing storage and update production tenant
    const tenantStorage = store.get('tenant-storage') || {};
    tenantStorage.lastProdTenant = tenantSlug;
    tenantStorage.updatedAt = Date.now();

    store.set('tenant-storage', tenantStorage);
    console.log('[Main] Saved tenant storage:', tenantStorage);
  } catch (error) {
    console.error('[Main] Error saving tenant storage:', error);
    throw error;
  }
});

/**
 * Clear tenant storage data
 * @returns {Promise<void>}
 */
ipcMain.handle('tenant:clear-storage', async () => {
  try {
    if (!store) {
      console.warn('[Main] Store not initialized yet');
      return;
    }

    store.delete('tenant-storage');
    console.log('[Main] Cleared tenant storage');
  } catch (error) {
    console.error('[Main] Error clearing tenant storage:', error);
    throw error;
  }
});

// ============================================================================
// Sample Data IPC Handlers
// ============================================================================

/**
 * Open folder picker dialog
 * @returns {Promise<string|null>} Selected folder path or null if cancelled
 */
ipcMain.handle('sample-data:select-folder', async () => {
  try {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openDirectory', 'createDirectory'],
      title: 'Save Sample Data',
      buttonLabel: 'Save'
    });

    if (result.canceled || result.filePaths.length === 0) {
      return null;
    }

    return result.filePaths[0];
  } catch (error) {
    console.error('[Main] Error opening folder picker:', error);
    throw error;
  }
});

/**
 * Write JSON file to disk
 * @param {string} filePath - Full path to the file
 * @param {object} data - Data to write (will be JSON stringified)
 * @returns {Promise<void>}
 */
ipcMain.handle('sample-data:write-file', async (event, filePath, data) => {
  try {
    // Create directory structure if it doesn't exist
    const dirPath = path.dirname(filePath);
    await fs.promises.mkdir(dirPath, { recursive: true });

    // Write the file
    const jsonContent = JSON.stringify(data, null, 2);
    await fs.promises.writeFile(filePath, jsonContent, 'utf-8');
    console.log(`[Main] Sample data file written: ${filePath}`);
  } catch (error) {
    console.error('[Main] Error writing sample data file:', error);
    throw error;
  }
});

// ============================================================================
// Preferences IPC Handlers
// ============================================================================

// Note: Preferences IPC handlers are now managed by preferences-window.cjs
// Removed duplicate handlers from main.cjs (lines 707-810, ~104 lines)
// DEFAULT_PREFERENCES is now imported from config/preferences-defaults.cjs
