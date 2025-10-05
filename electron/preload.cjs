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
    isAuthenticated: () => ipcRenderer.invoke('auth:isAuthenticated')
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

  // Placeholder for future file system APIs (Phase 5)
  files: {
    // Will implement: export, download, etc.
  }
});
