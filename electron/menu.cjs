const { Menu, app, shell, dialog, BrowserWindow } = require('electron');
const path = require('path');

// Get preferences instance from main.cjs
let getPreferencesFromMain = null;

// Store reference to main window
let mainWindow = null;

/**
 * Set the main window reference
 * @param {BrowserWindow} window - The main application window
 */
function setMainWindow(window) {
  mainWindow = window;
}

/**
 * Set function to get preferences from main process
 * @param {Function} getPreferencesFn - Function that returns preferences instance
 */
function setPreferencesGetter(getPreferencesFn) {
  getPreferencesFromMain = getPreferencesFn;
}

/**
 * Open preferences window using electron-preferences
 */
function openPreferencesWindow() {
  if (!getPreferencesFromMain) {
    console.error('[Menu] Preferences getter not set');
    return;
  }

  const preferences = getPreferencesFromMain();

  if (!preferences) {
    console.error('[Menu] Preferences not initialized');
    return;
  }

  // Show preferences window (electron-preferences handles window creation)
  preferences.show();
  console.log('[Menu] Opened preferences window');
}

/**
 * Show about dialog
 */
function showAboutDialog() {
  const options = {
    type: 'info',
    title: 'About PH Tools Desktop',
    message: 'PH Tools Desktop',
    detail: `Version: 3.1.274\n\nIntelligent tools and automation for Planhat platform users.\n\nBuilt with Electron, React, TypeScript, and Vite.\n\n© 2024 PH Tools`,
    buttons: ['OK', 'View on GitHub'],
    defaultId: 0,
    icon: path.join(__dirname, '../src/assets/icons/icon128.png')
  };

  dialog.showMessageBox(mainWindow, options).then((result) => {
    if (result.response === 1) {
      // Open GitHub repo
      shell.openExternal('https://github.com/your-org/ph-tools-desktop');
    }
  });
}

/**
 * Create application menu
 * @returns {Menu} The application menu
 */
function createMenu() {
  const isMac = process.platform === 'darwin';

  const template = [
    // File Menu
    {
      label: 'File',
      submenu: [
        {
          label: 'Preferences...',
          accelerator: 'CmdOrCtrl+,',
          click: openPreferencesWindow
        },
        { type: 'separator' },
        isMac ? { role: 'close' } : { role: 'quit' }
      ]
    },

    // Edit Menu
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { type: 'separator' },
        { role: 'selectAll' }
      ]
    },

    // View Menu
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
        { type: 'separator' },
        { role: 'toggleDevTools' }
      ]
    },

    // Window Menu
    ...(isMac ? [{
      label: 'Window',
      submenu: [
        { role: 'minimize' },
        { role: 'zoom' },
        { type: 'separator' },
        { role: 'front' },
        { type: 'separator' },
        { role: 'window' }
      ]
    }] : []),

    // Help Menu
    {
      label: 'Help',
      submenu: [
        {
          label: 'About PH Tools Desktop',
          click: showAboutDialog
        },
        { type: 'separator' },
        {
          label: 'View Documentation',
          click: () => {
            shell.openExternal('https://github.com/your-org/ph-tools-desktop/docs');
          }
        },
        {
          label: 'Report Issue',
          click: () => {
            shell.openExternal('https://github.com/your-org/ph-tools-desktop/issues');
          }
        }
      ]
    }
  ];

  // macOS specific adjustments
  if (isMac) {
    // Add app name menu
    template.unshift({
      label: app.getName(),
      submenu: [
        { role: 'about' },
        { type: 'separator' },
        {
          label: 'Preferences',
          accelerator: 'Cmd+,',
          click: openPreferencesWindow
        },
        { type: 'separator' },
        { role: 'services', submenu: [] },
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hideOthers' },
        { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit' }
      ]
    });

    // Edit menu adjustments
    template[2].submenu.push(
      { type: 'separator' },
      {
        label: 'Speech',
        submenu: [
          { role: 'startSpeaking' },
          { role: 'stopSpeaking' }
        ]
      }
    );
  }

  return Menu.buildFromTemplate(template);
}

/**
 * Initialize application menu
 */
function initializeMenu() {
  const menu = createMenu();
  Menu.setApplicationMenu(menu);
}

/**
 * Update menu item states based on app state
 * @param {Object} state - App state object
 */
function updateMenuState(state = {}) {
  const menu = Menu.getApplicationMenu();
  if (!menu) return;

  // Example: Enable/disable items based on authentication
  // This can be extended as needed
  if (state.isAuthenticated !== undefined) {
    // Update menu items that depend on auth state
    const fileMenu = menu.items.find(item => item.label === 'File');
    if (fileMenu && fileMenu.submenu) {
      const preferencesItem = fileMenu.submenu.items.find(item => item.label === 'Preferences');
      if (preferencesItem) {
        preferencesItem.enabled = state.isAuthenticated;
      }
    }
  }
}

module.exports = {
  initializeMenu,
  updateMenuState,
  setMainWindow,
  setPreferencesGetter,
  openPreferencesWindow,
  showAboutDialog
};