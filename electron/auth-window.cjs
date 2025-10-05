/**
 * Authentication Window Manager
 *
 * Creates and manages the Planhat login window for authentication
 * Captures session cookies after successful login
 */

const { BrowserWindow, session } = require('electron');
const path = require('path');

/**
 * Planhat login URLs
 */
const PLANHAT_LOGIN_URLS = {
  production: 'https://ws.planhat.com/login',
  demo: 'https://ws.planhatdemo.com/login'
};

/**
 * Success detection URLs (user is redirected here after successful login)
 */
const SUCCESS_URLS = {
  production: 'https://ws.planhat.com/',
  demo: 'https://ws.planhatdemo.com/'
};

/**
 * Cookie domains to capture
 */
const COOKIE_DOMAINS = [
  '.planhat.com',
  'planhat.com',
  'ws.planhat.com',
  'api.planhat.com',
  '.planhatdemo.com',
  'planhatdemo.com',
  'ws.planhatdemo.com',
  'api.planhatdemo.com'
];

/**
 * Create and display login window
 *
 * @param {BrowserWindow} parentWindow - Parent window reference
 * @param {string} environment - 'production' or 'demo'
 * @returns {Promise<{cookies: Array, tenantSlug: string|null, environment: string}>}
 */
async function createAuthWindow(parentWindow, environment = 'production') {
  return new Promise((resolve, reject) => {
    // Create login window
    const authWindow = new BrowserWindow({
      width: 500,
      height: 700,
      parent: parentWindow,
      modal: false, // Changed from true - allows user to close window
      show: false,
      title: 'Login to Planhat',
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: true,
        webSecurity: true
      },
      autoHideMenuBar: true,
      minimizable: true, // Changed from false - allow minimize
      maximizable: false,
      resizable: false,
      closable: true, // Explicitly allow closing
      fullscreenable: false
    });

    const loginUrl = PLANHAT_LOGIN_URLS[environment] || PLANHAT_LOGIN_URLS.production;
    const successUrl = SUCCESS_URLS[environment] || SUCCESS_URLS.production;

    console.log(`[Auth] Opening login window: ${loginUrl}`);

    // Track if we've already resolved
    let hasResolved = false;

    /**
     * Capture cookies from session
     */
    async function captureCookies() {
      try {
        const allCookies = [];

        // Capture cookies from all Planhat domains
        for (const domain of COOKIE_DOMAINS) {
          const cookies = await session.defaultSession.cookies.get({ domain });
          allCookies.push(...cookies);
        }

        console.log(`[Auth] Captured ${allCookies.length} cookies from Planhat domains`);

        // Log cookie names for debugging (not values for security)
        const cookieNames = allCookies.map(c => `${c.name} (${c.domain})`).join(', ');
        console.log(`[Auth] Cookie names: ${cookieNames}`);

        return allCookies;
      } catch (error) {
        console.error('[Auth] Error capturing cookies:', error);
        throw error;
      }
    }

    /**
     * Extract tenant slug from URL
     */
    function extractTenantSlug(url) {
      try {
        const urlObj = new URL(url);

        // Planhat URL format: https://ws.planhat.com/<tenant>/...
        const pathParts = urlObj.pathname.split('/').filter(Boolean);

        if (pathParts.length > 0 && pathParts[0] !== 'login') {
          console.log(`[Auth] Extracted tenant slug: ${pathParts[0]}`);
          return pathParts[0];
        }

        return null;
      } catch (error) {
        console.error('[Auth] Error extracting tenant slug:', error);
        return null;
      }
    }

    /**
     * Handle successful login
     */
    async function handleSuccess(url) {
      if (hasResolved) return;
      hasResolved = true;

      try {
        console.log('[Auth] Login successful, capturing session...');

        const cookies = await captureCookies();
        const tenantSlug = extractTenantSlug(url);

        // Close the auth window
        authWindow.close();

        resolve({
          cookies,
          tenantSlug,
          environment
        });
      } catch (error) {
        reject(error);
      }
    }

    /**
     * Monitor URL changes to detect successful login
     */
    authWindow.webContents.on('did-navigate', async (event, url) => {
      console.log(`[Auth] Navigation: ${url}`);

      // Check if user successfully logged in (redirected away from login page)
      if (url.startsWith(successUrl) && !url.includes('/login')) {
        await handleSuccess(url);
      }
    });

    /**
     * Also check navigation in new windows (some login flows open popups)
     */
    authWindow.webContents.on('did-navigate-in-page', async (event, url) => {
      console.log(`[Auth] In-page navigation: ${url}`);

      if (url.startsWith(successUrl) && !url.includes('/login')) {
        await handleSuccess(url);
      }
    });

    /**
     * Monitor for successful authentication via cookie changes
     * This is a fallback in case URL detection doesn't work
     */
    const cookieChangeListener = async (event, cookie, cause, removed) => {
      // Look for session cookies being set (not removed)
      if (!removed && COOKIE_DOMAINS.some(domain => cookie.domain.includes(domain))) {
        // Check if we have authentication cookies
        const currentUrl = authWindow.webContents.getURL();

        if (currentUrl.startsWith(successUrl) && !currentUrl.includes('/login')) {
          console.log('[Auth] Authentication detected via cookie change');

          // Remove listener to prevent multiple triggers
          session.defaultSession.cookies.removeListener('changed', cookieChangeListener);

          await handleSuccess(currentUrl);
        }
      }
    };

    session.defaultSession.cookies.on('changed', cookieChangeListener);

    /**
     * Handle window close (user cancelled)
     */
    authWindow.on('closed', () => {
      if (!hasResolved) {
        hasResolved = true;
        session.defaultSession.cookies.removeListener('changed', cookieChangeListener);
        reject(new Error('Login cancelled by user'));
      }
    });

    /**
     * Handle load failures
     */
    authWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
      if (errorCode !== -3) { // -3 is ERR_ABORTED which is normal for redirects
        console.error(`[Auth] Failed to load: ${errorDescription} (${errorCode})`);

        if (!hasResolved) {
          hasResolved = true;
          authWindow.close();
          reject(new Error(`Failed to load login page: ${errorDescription}`));
        }
      }
    });

    // Load login page and show window
    authWindow.loadURL(loginUrl).then(() => {
      authWindow.show();
    }).catch(error => {
      console.error('[Auth] Error loading login URL:', error);
      if (!hasResolved) {
        hasResolved = true;
        authWindow.close();
        reject(error);
      }
    });
  });
}

/**
 * Restore cookies to Electron session
 *
 * @param {Array} cookies - Array of cookie objects
 * @returns {Promise<void>}
 */
async function restoreCookies(cookies) {
  if (!cookies || !Array.isArray(cookies)) {
    console.warn('[Auth] No cookies to restore');
    return;
  }

  console.log(`[Auth] Restoring ${cookies.length} cookies to session`);

  for (const cookie of cookies) {
    try {
      // Construct cookie URL
      const protocol = cookie.secure ? 'https://' : 'http://';
      const cookieUrl = `${protocol}${cookie.domain.startsWith('.') ? cookie.domain.substring(1) : cookie.domain}${cookie.path || '/'}`;

      await session.defaultSession.cookies.set({
        url: cookieUrl,
        name: cookie.name,
        value: cookie.value,
        domain: cookie.domain,
        path: cookie.path || '/',
        secure: cookie.secure || false,
        httpOnly: cookie.httpOnly || false,
        expirationDate: cookie.expirationDate,
        sameSite: cookie.sameSite || 'no_restriction'
      });

      console.log(`[Auth] Restored cookie: ${cookie.name} for ${cookie.domain}`);
    } catch (error) {
      console.error(`[Auth] Error restoring cookie ${cookie.name}:`, error.message);
    }
  }

  console.log('[Auth] All cookies restored');
}

/**
 * Get current session cookies
 *
 * @returns {Promise<Array>}
 */
async function getCurrentCookies() {
  const allCookies = [];

  for (const domain of COOKIE_DOMAINS) {
    const cookies = await session.defaultSession.cookies.get({ domain });
    allCookies.push(...cookies);
  }

  return allCookies;
}

/**
 * Clear all Planhat cookies
 *
 * @returns {Promise<void>}
 */
async function clearCookies() {
  console.log('[Auth] Clearing all Planhat cookies');

  for (const domain of COOKIE_DOMAINS) {
    const cookies = await session.defaultSession.cookies.get({ domain });

    for (const cookie of cookies) {
      const protocol = cookie.secure ? 'https://' : 'http://';
      const cookieUrl = `${protocol}${cookie.domain.startsWith('.') ? cookie.domain.substring(1) : cookie.domain}${cookie.path || '/'}`;

      await session.defaultSession.cookies.remove(cookieUrl, cookie.name);
    }
  }

  console.log('[Auth] All Planhat cookies cleared');
}

module.exports = {
  createAuthWindow,
  restoreCookies,
  getCurrentCookies,
  clearCookies,
  PLANHAT_LOGIN_URLS,
  COOKIE_DOMAINS
};
