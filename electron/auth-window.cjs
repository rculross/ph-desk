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
      width: 800,
      height: 900,
      parent: parentWindow,
      modal: false, // Changed from true - allows user to close window
      show: false,
      title: 'Login to Planhat',
      webPreferences: {
        // CRITICAL FIX: Use defaultSession for auth window to allow Google OAuth
        // Google OAuth does full-page redirects, not popups, so the auth window itself
        // needs access to existing Google session cookies
        partition: undefined, // Use defaultSession instead of session:planhat
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: true,
        webSecurity: true,
        // Allow popups for OAuth flows
        nativeWindowOpen: true,
        allowRunningInsecureContent: false
      },
      autoHideMenuBar: true,
      minimizable: true, // Changed from false - allow minimize
      maximizable: false,
      resizable: true, // Allow resize for better debugging
      closable: true, // Explicitly allow closing
      fullscreenable: false
    });

    const loginUrl = PLANHAT_LOGIN_URLS[environment] || PLANHAT_LOGIN_URLS.production;
    const successUrl = SUCCESS_URLS[environment] || SUCCESS_URLS.production;

    console.log(`[Auth] Opening login window: ${loginUrl}`);

    // Track if we've already resolved
    let hasResolved = false;

    /**
     * Handle popup windows for OAuth flows (Google, SAML, etc)
     */
    authWindow.webContents.setWindowOpenHandler((details) => {
      console.log(`[Auth] =================================================================`);
      console.log(`[Auth] POPUP REQUESTED: ${details.url}`);

      // Allow OAuth popups from Google, Microsoft, and other providers
      const allowedDomains = [
        'accounts.google.com',
        'login.microsoftonline.com',
        'login.windows.net',
        'auth0.com',
        'planhat.com',
        'planhatdemo.com'
      ];

      const url = new URL(details.url);

      // Special handling for Okta (detect any *.okta.com or *.oktapreview.com)
      const isOktaDomain = /^[a-z0-9-]+\.(okta|oktapreview)\.com$/i.test(url.hostname);

      const isAllowed = allowedDomains.some(domain => url.hostname.includes(domain)) || isOktaDomain;

      console.log(`[Auth] Hostname: ${url.hostname}`);
      console.log(`[Auth] Is Okta: ${isOktaDomain}`);
      console.log(`[Auth] Is Allowed: ${isAllowed}`);

      if (isAllowed) {
        // Determine session strategy based on auth provider
        const isGoogleAuth = url.hostname.includes('accounts.google.com');
        const isMicrosoftAuth = url.hostname.includes('login.microsoftonline.com') ||
                               url.hostname.includes('login.windows.net');
        const isOktaAuth = isOktaDomain;

        // CRITICAL FIX: Use defaultSession for third-party OAuth providers
        // This allows access to existing user accounts/cookies (Google, Microsoft, Okta)
        // Use session:planhat only for Planhat-specific auth flows
        const useDefaultSession = isGoogleAuth || isMicrosoftAuth || isOktaAuth;

        console.log(`[Auth] Is Google Auth: ${isGoogleAuth}`);
        console.log(`[Auth] Is Microsoft Auth: ${isMicrosoftAuth}`);
        console.log(`[Auth] Is Okta Auth: ${isOktaAuth}`);
        console.log(`[Auth] Will use defaultSession: ${useDefaultSession}`);
        console.log(`[Auth] =================================================================`);

        return {
          action: 'allow',
          overrideBrowserWindowOptions: {
            width: 800,
            height: 900,
            webPreferences: {
              partition: useDefaultSession ? undefined : 'session:planhat',
              nodeIntegration: false,
              contextIsolation: true,
              sandbox: true,
              devTools: true // Enable DevTools for OAuth popup
            }
          }
        };
      }

      console.log(`[Auth] POPUP DENIED - domain not in allowed list`);
      console.log(`[Auth] =================================================================`);
      return { action: 'deny' };
    });

    /**
     * Monitor child windows for OAuth completion and cookie transfer
     */
    authWindow.webContents.on('did-create-window', (childWindow) => {
      console.log('[Auth] =================================================================');
      console.log('[Auth] OAuth popup window created');

      const childPartition = childWindow.webContents.getWebPreferences().partition;
      console.log(`[Auth] Child window using partition: ${childPartition || 'defaultSession'}`);
      console.log('[Auth] =================================================================');

      // Open DevTools on popup window for debugging
      childWindow.webContents.openDevTools({ mode: 'detach' });

      // Log when popup is ready
      childWindow.webContents.on('did-finish-load', () => {
        const currentUrl = childWindow.webContents.getURL();
        console.log(`[Auth] Popup loaded: ${currentUrl}`);
      });

      // Monitor child window navigation
      childWindow.webContents.on('will-redirect', async (event, url) => {
        console.log(`[Auth] >>>>>> OAuth popup WILL REDIRECT: ${url}`);

        // Check if redirecting back to Planhat after OAuth
        if (url.includes('planhat.com') || url.includes('planhatdemo.com')) {
          console.log('[Auth] !!!!! OAuth flow completed, returning to Planhat !!!!!');

          // If OAuth used defaultSession, transfer cookies to session:planhat
          if (!childPartition || childPartition === 'persist:default') {
            console.log('[Auth] Transferring OAuth-generated cookies from defaultSession to session:planhat');

            try {
              const defaultSession = require('electron').session.defaultSession;
              const planhatSession = session.fromPartition('session:planhat');

              // Get cookies from defaultSession for Planhat domains
              for (const domain of COOKIE_DOMAINS) {
                const cookies = await defaultSession.cookies.get({ domain });

                for (const cookie of cookies) {
                  // Normalize domain for cross-subdomain compatibility
                  let normalizedDomain = cookie.domain;

                  if (cookie.domain === 'ws.planhat.com' || cookie.domain === 'api.planhat.com') {
                    normalizedDomain = '.planhat.com';
                  } else if (cookie.domain === 'ws.planhatdemo.com' || cookie.domain === 'api.planhatdemo.com') {
                    normalizedDomain = '.planhatdemo.com';
                  }

                  // Transfer to session:planhat
                  const protocol = cookie.secure ? 'https://' : 'http://';
                  const cookieUrl = `${protocol}${normalizedDomain.startsWith('.') ? normalizedDomain.substring(1) : normalizedDomain}${cookie.path || '/'}`;

                  await planhatSession.cookies.set({
                    url: cookieUrl,
                    name: cookie.name,
                    value: cookie.value,
                    domain: normalizedDomain,
                    path: cookie.path || '/',
                    secure: cookie.secure,
                    httpOnly: cookie.httpOnly || false,
                    expirationDate: cookie.expirationDate,
                    sameSite: 'no_restriction'
                  });

                  console.log(`[Auth] Transferred cookie: ${cookie.name} (${normalizedDomain}) from defaultSession to session:planhat`);
                }
              }
            } catch (error) {
              console.error('[Auth] Error transferring cookies:', error);
            }
          }
        }
      });

      childWindow.webContents.on('did-navigate', async (event, url) => {
        console.log(`[Auth] >>>>>> OAuth popup DID NAVIGATE: ${url}`);

        // Also log cookies at each navigation step
        try {
          const childSession = childWindow.webContents.session;
          const cookies = await childSession.cookies.get({});
          console.log(`[Auth] Current cookies in popup session: ${cookies.length} cookies`);
          cookies.forEach(cookie => {
            console.log(`[Auth]   - ${cookie.name} (domain: ${cookie.domain})`);
          });
        } catch (err) {
          console.error('[Auth] Error getting popup cookies:', err);
        }
      });
    });

    /**
     * Capture cookies from session
     */
    async function captureCookies() {
      try {
        const allCookies = [];

        // Get cookies from defaultSession (where auth window lives)
        const defaultSession = require('electron').session.defaultSession;

        // Capture cookies from all Planhat domains
        for (const domain of COOKIE_DOMAINS) {
          const cookies = await defaultSession.cookies.get({ domain });
          allCookies.push(...cookies);
        }

        console.log(`[Auth] Captured ${allCookies.length} cookies from Planhat domains in defaultSession`);

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
          // Normalize tenant slug to lowercase
          const tenantSlug = pathParts[0].toLowerCase();
          console.log(`[Auth] Extracted tenant slug: ${tenantSlug}`);
          return tenantSlug;
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

        // CRITICAL: Immediately transfer cookies to session:planhat for main window
        console.log('[Auth] Transferring cookies to session:planhat for main window...');
        const planhatSession = session.fromPartition('session:planhat');

        for (const cookie of cookies) {
          try {
            // Normalize domain for cross-subdomain compatibility
            let normalizedDomain = cookie.domain;

            if (cookie.domain === 'ws.planhat.com' || cookie.domain === 'api.planhat.com') {
              normalizedDomain = '.planhat.com';
            } else if (cookie.domain === 'ws.planhatdemo.com' || cookie.domain === 'api.planhatdemo.com') {
              normalizedDomain = '.planhatdemo.com';
            }

            const protocol = 'https://';
            const cookieUrl = `${protocol}${normalizedDomain.startsWith('.') ? normalizedDomain.substring(1) : normalizedDomain}${cookie.path || '/'}`;

            await planhatSession.cookies.set({
              url: cookieUrl,
              name: cookie.name,
              value: cookie.value,
              domain: normalizedDomain,
              path: cookie.path || '/',
              secure: true,
              httpOnly: cookie.httpOnly || false,
              expirationDate: cookie.expirationDate,
              sameSite: 'no_restriction'
            });

            console.log(`[Auth] Transferred cookie to session:planhat: ${cookie.name} (${normalizedDomain})`);
          } catch (error) {
            console.error(`[Auth] Error transferring cookie ${cookie.name}:`, error.message);
          }
        }

        console.log('[Auth] All cookies transferred to session:planhat');

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
    // Use defaultSession (where auth window lives)
    const defaultSession = require('electron').session.defaultSession;

    const cookieChangeListener = async (event, cookie, cause, removed) => {
      // Look for session cookies being set (not removed)
      if (!removed && COOKIE_DOMAINS.some(domain => cookie.domain.includes(domain))) {
        // Check if we have authentication cookies
        const currentUrl = authWindow.webContents.getURL();

        console.log(`[Auth] Cookie changed in defaultSession: ${cookie.name} (${cookie.domain}), current URL: ${currentUrl}`);

        if (currentUrl.startsWith(successUrl) && !currentUrl.includes('/login')) {
          console.log('[Auth] Authentication detected via cookie change');

          // Remove listener to prevent multiple triggers
          defaultSession.cookies.removeListener('changed', cookieChangeListener);

          await handleSuccess(currentUrl);
        }
      }
    };

    defaultSession.cookies.on('changed', cookieChangeListener);

    /**
     * Handle window close (user cancelled)
     */
    authWindow.on('closed', () => {
      if (!hasResolved) {
        hasResolved = true;
        defaultSession.cookies.removeListener('changed', cookieChangeListener);
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
 * Security: Forces all authentication cookies to use secure flag (HTTPS only)
 *
 * Restores cookies to BOTH defaultSession (for auth window) AND session:planhat (for main window)
 *
 * @param {Array} cookies - Array of cookie objects
 * @returns {Promise<void>}
 */
async function restoreCookies(cookies) {
  if (!cookies || !Array.isArray(cookies)) {
    console.warn('[Auth] No cookies to restore');
    return;
  }

  console.log(`[Auth] Restoring ${cookies.length} cookies to both defaultSession and session:planhat`);

  const defaultSession = require('electron').session.defaultSession;
  const planhatSession = session.fromPartition('session:planhat');

  for (const cookie of cookies) {
    try {
      // Security: Force HTTPS for all authentication cookies
      // This prevents cookie theft via man-in-the-middle attacks
      const protocol = 'https://';

      // CRITICAL FIX: Normalize domain to allow cross-subdomain access
      // If domain is 'ws.planhat.com', change to '.planhat.com'
      // If domain is 'api.planhat.com', change to '.planhat.com'
      let normalizedDomain = cookie.domain;

      if (cookie.domain === 'ws.planhat.com' || cookie.domain === 'api.planhat.com') {
        normalizedDomain = '.planhat.com';
        console.log(`[Auth] Normalized cookie domain from ${cookie.domain} to ${normalizedDomain}`);
      } else if (cookie.domain === 'ws.planhatdemo.com' || cookie.domain === 'api.planhatdemo.com') {
        normalizedDomain = '.planhatdemo.com';
        console.log(`[Auth] Normalized cookie domain from ${cookie.domain} to ${normalizedDomain}`);
      }

      const cookieUrl = `${protocol}${normalizedDomain.startsWith('.') ? normalizedDomain.substring(1) : normalizedDomain}${cookie.path || '/'}`;

      const cookieConfig = {
        url: cookieUrl,
        name: cookie.name,
        value: cookie.value,
        domain: normalizedDomain, // Use normalized domain
        path: cookie.path || '/',
        secure: true, // Security: Always enforce secure flag for authentication cookies
        httpOnly: cookie.httpOnly || false,
        expirationDate: cookie.expirationDate,
        sameSite: 'no_restriction' // Required for cross-subdomain
      };

      // Set cookie in BOTH sessions
      await defaultSession.cookies.set(cookieConfig);
      await planhatSession.cookies.set(cookieConfig);

      console.log(`[Auth] Restored cookie to both sessions: ${cookie.name} for ${normalizedDomain}`);
    } catch (error) {
      console.error(`[Auth] Error restoring cookie ${cookie.name}:`, error.message);
    }
  }

  console.log('[Auth] All cookies restored to both defaultSession and session:planhat');
}

/**
 * Get current session cookies from BOTH sessions
 *
 * @returns {Promise<Array>}
 */
async function getCurrentCookies() {
  const allCookies = [];
  const seenCookies = new Set();

  const defaultSession = require('electron').session.defaultSession;
  const planhatSession = session.fromPartition('session:planhat');

  // Check both sessions and deduplicate
  for (const domain of COOKIE_DOMAINS) {
    // Get from defaultSession first
    const defaultCookies = await defaultSession.cookies.get({ domain });
    for (const cookie of defaultCookies) {
      const cookieKey = `${cookie.name}:${cookie.domain}:${cookie.path}`;
      if (!seenCookies.has(cookieKey)) {
        allCookies.push(cookie);
        seenCookies.add(cookieKey);
      }
    }

    // Get from session:planhat
    const planhatCookies = await planhatSession.cookies.get({ domain });
    for (const cookie of planhatCookies) {
      const cookieKey = `${cookie.name}:${cookie.domain}:${cookie.path}`;
      if (!seenCookies.has(cookieKey)) {
        allCookies.push(cookie);
        seenCookies.add(cookieKey);
      }
    }
  }

  console.log(`[Auth] Retrieved ${allCookies.length} unique cookies from both sessions`);
  return allCookies;
}

/**
 * Clear all Planhat cookies from BOTH sessions
 *
 * @returns {Promise<void>}
 */
async function clearCookies() {
  console.log('[Auth] Clearing all Planhat cookies from both sessions');

  const defaultSession = require('electron').session.defaultSession;
  const planhatSession = session.fromPartition('session:planhat');

  for (const domain of COOKIE_DOMAINS) {
    // Clear from defaultSession
    const defaultCookies = await defaultSession.cookies.get({ domain });
    for (const cookie of defaultCookies) {
      const protocol = cookie.secure ? 'https://' : 'http://';
      const cookieUrl = `${protocol}${cookie.domain.startsWith('.') ? cookie.domain.substring(1) : cookie.domain}${cookie.path || '/'}`;
      await defaultSession.cookies.remove(cookieUrl, cookie.name);
    }

    // Clear from session:planhat
    const planhatCookies = await planhatSession.cookies.get({ domain });
    for (const cookie of planhatCookies) {
      const protocol = cookie.secure ? 'https://' : 'http://';
      const cookieUrl = `${protocol}${cookie.domain.startsWith('.') ? cookie.domain.substring(1) : cookie.domain}${cookie.path || '/'}`;
      await planhatSession.cookies.remove(cookieUrl, cookie.name);
    }
  }

  console.log('[Auth] All Planhat cookies cleared from both sessions');
}

module.exports = {
  createAuthWindow,
  restoreCookies,
  getCurrentCookies,
  clearCookies,
  PLANHAT_LOGIN_URLS,
  COOKIE_DOMAINS
};
