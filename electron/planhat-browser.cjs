/**
 * Planhat Browser Window Manager
 *
 * Creates and manages a dedicated BrowserWindow for browsing Planhat
 * Shares authentication session with main app via defaultSession
 */

const { BrowserWindow, session } = require('electron');
const { setPlanhatBrowserWindow, updateWindowMenu } = require('./menu.cjs');

/**
 * Planhat browser window instance
 */
let planhatBrowserWindow = null;

/**
 * Open Planhat browser window
 * Creates a new BrowserWindow for browsing Planhat if one doesn't exist
 *
 * @returns {Promise<void>}
 */
async function openPlanhatBrowser() {
  // If window already exists, just focus it
  if (planhatBrowserWindow && !planhatBrowserWindow.isDestroyed()) {
    console.log('[PlanhatBrowser] Window already exists, focusing...');
    planhatBrowserWindow.focus();
    return;
  }

  console.log('[PlanhatBrowser] Creating new Planhat browser window...');

  // Create new browser window
  planhatBrowserWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    title: 'Planhat Browser',
    webPreferences: {
      // CRITICAL: Use defaultSession to share cookies with auth window
      partition: undefined, // defaultSession
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: true,
      allowRunningInsecureContent: false
    },
    autoHideMenuBar: true,
    minimizable: true,
    maximizable: true,
    resizable: true,
    closable: true,
    fullscreenable: true,
    show: false // Don't show until ready
  });

  // Register with menu system
  setPlanhatBrowserWindow(planhatBrowserWindow);

  // Show window when ready to avoid flash
  planhatBrowserWindow.once('ready-to-show', () => {
    console.log('[PlanhatBrowser] Window ready, showing...');
    planhatBrowserWindow.show();
  });

  // Handle window focus to update menu checkmarks
  planhatBrowserWindow.on('focus', () => {
    updateWindowMenu();
  });

  // Handle window close
  planhatBrowserWindow.on('closed', () => {
    console.log('[PlanhatBrowser] Window closed');
    planhatBrowserWindow = null;
    setPlanhatBrowserWindow(null);
  });

  // Handle load failures
  planhatBrowserWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
    if (errorCode !== -3) { // -3 is ERR_ABORTED which is normal for redirects
      console.error(`[PlanhatBrowser] Failed to load: ${errorDescription} (${errorCode})`);
    }
  });

  // Log navigation for debugging
  planhatBrowserWindow.webContents.on('did-navigate', (event, url) => {
    console.log(`[PlanhatBrowser] Navigated to: ${url}`);
  });

  // Load Planhat
  const planhatUrl = 'https://ws.planhat.com';
  console.log(`[PlanhatBrowser] Loading Planhat: ${planhatUrl}`);

  try {
    await planhatBrowserWindow.loadURL(planhatUrl);
    console.log('[PlanhatBrowser] Planhat loaded successfully');
  } catch (error) {
    console.error('[PlanhatBrowser] Error loading Planhat:', error);
    if (planhatBrowserWindow && !planhatBrowserWindow.isDestroyed()) {
      planhatBrowserWindow.close();
    }
    throw error;
  }
}

/**
 * Close Planhat browser window
 *
 * @returns {Promise<void>}
 */
async function closePlanhatBrowser() {
  if (planhatBrowserWindow && !planhatBrowserWindow.isDestroyed()) {
    console.log('[PlanhatBrowser] Closing window...');
    planhatBrowserWindow.close();
    planhatBrowserWindow = null;
  } else {
    console.log('[PlanhatBrowser] No window to close');
  }
}

/**
 * Toggle Planhat browser window (open if closed, close if open)
 *
 * @returns {Promise<void>}
 */
async function togglePlanhatBrowser() {
  if (planhatBrowserWindow && !planhatBrowserWindow.isDestroyed()) {
    await closePlanhatBrowser();
  } else {
    await openPlanhatBrowser();
  }
}

/**
 * Check if Planhat browser window is open
 *
 * @returns {Promise<boolean>}
 */
async function isPlanhatBrowserOpen() {
  const isOpen = planhatBrowserWindow !== null && !planhatBrowserWindow.isDestroyed();
  console.log(`[PlanhatBrowser] Window status: ${isOpen ? 'open' : 'closed'}`);
  return isOpen;
}

module.exports = {
  openPlanhatBrowser,
  closePlanhatBrowser,
  togglePlanhatBrowser,
  isPlanhatBrowserOpen
};
