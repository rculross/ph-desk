const { contextBridge, ipcRenderer } = require('electron');

// Expose safe APIs to renderer process
contextBridge.exposeInMainWorld('electron', {
  platform: process.platform,

  // Authentication APIs - Phase 3
  auth: {
    /**
     * Open login window and authenticate
     * @param {string} environment - 'production' or 'demo'
     * @returns {Promise<{cookies: Array, tenantSlug: string|null, environment: string}>}
     */
    openLoginWindow: (environment) => ipcRenderer.invoke('auth:openLoginWindow', environment),

    /**
     * Get current session cookies
     * @returns {Promise<Array>}
     */
    getCookies: () => ipcRenderer.invoke('auth:getCookies'),

    /**
     * Set/restore cookies to session
     * @param {Array} cookies - Cookies to restore
     * @returns {Promise<void>}
     */
    setCookies: (cookies) => ipcRenderer.invoke('auth:setCookies', cookies),

    /**
     * Clear all authentication cookies (logout)
     * @returns {Promise<void>}
     */
    clearCookies: () => ipcRenderer.invoke('auth:clearCookies'),

    /**
     * Get stored auth data
     * @returns {Promise<object|null>}
     */
    getStoredAuth: () => ipcRenderer.invoke('auth:getStoredAuth'),

    /**
     * Check if currently authenticated
     * @returns {Promise<boolean>}
     */
    isAuthenticated: () => ipcRenderer.invoke('auth:isAuthenticated'),

    /**
     * Save last production tenant slug
     * @param {string} tenantSlug - Tenant slug to save
     * @returns {Promise<void>}
     */
    saveLastProdTenant: (tenantSlug) => ipcRenderer.invoke('auth:saveLastProdTenant', tenantSlug),

    /**
     * Logout and clear session
     * @returns {Promise<void>}
     */
    logout: () => ipcRenderer.invoke('auth:logout')
  },

  // Storage APIs - implemented in Phase 2
  storage: {
    /**
     * Get storage item(s)
     * @param {string | string[] | null} keys - Key(s) to retrieve, or null for all
     * @returns {Promise<Record<string, any>>}
     */
    get: (keys) => ipcRenderer.invoke('storage:get', keys),

    /**
     * Set storage item(s)
     * @param {Record<string, any>} items - Items to store
     * @returns {Promise<void>}
     */
    set: (items) => ipcRenderer.invoke('storage:set', items),

    /**
     * Remove storage item(s)
     * @param {string | string[]} keys - Key(s) to remove
     * @returns {Promise<void>}
     */
    remove: (keys) => ipcRenderer.invoke('storage:remove', keys),

    /**
     * Clear all storage
     * @returns {Promise<void>}
     */
    clear: () => ipcRenderer.invoke('storage:clear'),

    /**
     * Get bytes in use (approximation for Chrome compatibility)
     * @param {string | string[] | null} keys - Keys to measure, or null for all
     * @returns {Promise<number>}
     */
    getBytesInUse: (keys) => ipcRenderer.invoke('storage:getBytesInUse', keys),
  },

  // Preferences are now managed by electron-preferences library
  // Access via File -> Preferences menu (Cmd+,)
  // No renderer process API needed

  // Placeholder for future file system APIs (Phase 5)
  files: {
    // Will implement: export, download, etc.
  },

  // Window APIs
  window: {
    /**
     * Set window title
     * @param {string} title - New window title
     * @returns {Promise<void>}
     */
    setTitle: (title) => ipcRenderer.invoke('window:setTitle', title)
  },

  // Planhat Browser APIs
  planhatBrowser: {
    /**
     * Open Planhat browser window
     * @returns {Promise<void>}
     */
    open: () => ipcRenderer.invoke('planhat-browser:open'),

    /**
     * Close Planhat browser window
     * @returns {Promise<void>}
     */
    close: () => ipcRenderer.invoke('planhat-browser:close'),

    /**
     * Toggle Planhat browser window (open if closed, close if open)
     * @returns {Promise<void>}
     */
    toggle: () => ipcRenderer.invoke('planhat-browser:toggle'),

    /**
     * Check if Planhat browser window is open
     * @returns {Promise<boolean>}
     */
    isOpen: () => ipcRenderer.invoke('planhat-browser:is-open')
  },

  // Sample Data APIs
  sampleData: {
    /**
     * Open folder picker dialog
     * @returns {Promise<string|null>} Selected folder path or null if cancelled
     */
    selectFolder: () => ipcRenderer.invoke('sample-data:select-folder'),

    /**
     * Write JSON file to disk
     * @param {string} filePath - Full path to the file
     * @param {object} data - Data to write (will be JSON stringified)
     * @returns {Promise<void>}
     */
    writeFile: (filePath, data) => ipcRenderer.invoke('sample-data:write-file', filePath, data),

    /**
     * Listen for menu trigger to get sample data
     * @param {Function} callback - Callback function to invoke when triggered
     * @returns {Function} Cleanup function to remove listener
     */
    onGetSampleData: (callback) => {
      const handler = () => callback();
      ipcRenderer.on('menu:get-sample-data', handler);
      return () => ipcRenderer.removeListener('menu:get-sample-data', handler);
    }
  }
});
