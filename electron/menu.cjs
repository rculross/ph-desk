const { Menu, app, shell, dialog, BrowserWindow } = require('electron');
const path = require('path');

// Store reference to main window and Planhat browser
let mainWindow = null;
let planhatBrowserWindow = null;

/**
 * Set the main window reference
 * @param {BrowserWindow} window - The main application window
 */
function setMainWindow(window) {
  mainWindow = window;
}

/**
 * Set the Planhat browser window reference
 * @param {BrowserWindow} window - The Planhat browser window
 */
function setPlanhatBrowserWindow(window) {
  planhatBrowserWindow = window;
  // Update menu to reflect new window state
  updateWindowMenu();
}

/**
 * Open preferences by sending IPC message to renderer
 */
function openPreferencesWindow() {
  if (!mainWindow || mainWindow.isDestroyed()) {
    console.error('[Menu] Main window not available');
    return;
  }

  // Send IPC message to renderer to open settings modal
  mainWindow.webContents.send('menu:open-preferences');
  console.log('[Menu] Sent IPC message to open settings modal');
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
          label: 'Get Sample Data...',
          click: () => {
            if (mainWindow && !mainWindow.isDestroyed()) {
              mainWindow.webContents.send('menu:get-sample-data');
            }
          }
        },
        { type: 'separator' },
        {
          label: 'Preferences...',
          accelerator: 'CmdOrCtrl+,',
          click: openPreferencesWindow
        },
        { type: 'separator' },
        {
          label: 'Restart',
          click: () => {
            // Relaunch the app and then quit the current instance
            app.relaunch();
            app.quit();
          }
        },
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
        {
          label: 'Toggle Developer Tools',
          accelerator: isMac ? 'Alt+Command+I' : 'Ctrl+Shift+I',
          click: () => {
            if (mainWindow && !mainWindow.isDestroyed()) {
              mainWindow.webContents.toggleDevTools();
            }
          }
        },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' }
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
        // Explicit window list (dynamically updated)
        {
          id: 'main-window',
          label: 'PH Tools Desktop',
          type: 'checkbox',
          checked: true,
          click: () => {
            if (mainWindow && !mainWindow.isDestroyed()) {
              mainWindow.show();
              mainWindow.focus();
            }
          }
        },
        {
          id: 'planhat-browser',
          label: 'Planhat Browser',
          type: 'checkbox',
          checked: false,
          visible: false, // Initially hidden until browser is opened
          click: () => {
            if (planhatBrowserWindow && !planhatBrowserWindow.isDestroyed()) {
              planhatBrowserWindow.show();
              planhatBrowserWindow.focus();
            }
          }
        }
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

/**
 * Update Window menu to reflect current window states
 * Shows/hides Planhat browser menu item and updates checked states
 */
function updateWindowMenu() {
  const menu = Menu.getApplicationMenu();
  if (!menu) {
    console.log('[Menu] No application menu found');
    return;
  }

  // Find Window menu (only on macOS)
  const windowMenu = menu.items.find(item => item.label === 'Window');
  if (!windowMenu || !windowMenu.submenu) {
    console.log('[Menu] Window menu not found');
    return;
  }

  // Find the window menu items
  const mainWindowItem = windowMenu.submenu.items.find(item => item.id === 'main-window');
  const planhatBrowserItem = windowMenu.submenu.items.find(item => item.id === 'planhat-browser');

  if (!mainWindowItem || !planhatBrowserItem) {
    console.log('[Menu] Window menu items not found');
    return;
  }

  // Update Planhat browser menu item visibility
  const browserIsOpen = planhatBrowserWindow && !planhatBrowserWindow.isDestroyed();
  planhatBrowserItem.visible = browserIsOpen;

  // Update checked states based on focus
  const focusedWindow = BrowserWindow.getFocusedWindow();
  mainWindowItem.checked = focusedWindow === mainWindow;
  planhatBrowserItem.checked = focusedWindow === planhatBrowserWindow;

  console.log(`[Menu] Window menu updated - Browser visible: ${browserIsOpen}`);
}

module.exports = {
  initializeMenu,
  updateMenuState,
  updateWindowMenu,
  setMainWindow,
  setPlanhatBrowserWindow,
  openPreferencesWindow,
  showAboutDialog
};