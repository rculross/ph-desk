/**
 * Electron API Type Definitions
 *
 * Defines TypeScript interfaces for Electron APIs exposed via preload script
 */

export interface ElectronStorage {
  /**
   * Get storage item(s)
   * @param keys - Key(s) to retrieve, or null for all items
   * @returns Promise resolving to storage items
   */
  get<T = any>(keys: string | string[] | null): Promise<Record<string, T>>;

  /**
   * Set storage item(s)
   * @param items - Items to store
   * @returns Promise that resolves when storage is complete
   */
  set(items: Record<string, any>): Promise<void>;

  /**
   * Remove storage item(s)
   * @param keys - Key(s) to remove
   * @returns Promise that resolves when removal is complete
   */
  remove(keys: string | string[]): Promise<void>;

  /**
   * Clear all storage
   * @returns Promise that resolves when storage is cleared
   */
  clear(): Promise<void>;

  /**
   * Get bytes in use (approximation for Chrome compatibility)
   * @param keys - Keys to measure, or null for all items
   * @returns Promise resolving to approximate bytes used
   */
  getBytesInUse(keys: string | string[] | null): Promise<number>;
}

export interface PlanhatCookie {
  name: string;
  value: string;
  domain: string;
  path: string;
  secure: boolean;
  httpOnly: boolean;
  expirationDate?: number;
  sameSite?: string;
}

export interface AuthResult {
  cookies: PlanhatCookie[];
  tenantSlug: string | null;
  environment: 'production' | 'demo';
}

export interface StoredAuthData {
  cookies: PlanhatCookie[];
  tenantSlug: string | null;
  environment: 'production' | 'demo';
  lastLogin: number;
}

export interface TenantStorageData {
  lastProdTenant: string | null;
  // Note: lastDemoTenant is stored in-memory only (Zustand store), not persisted
}

export interface ElectronTenant {
  /**
   * Get tenant storage data
   * NOTE: Only production tenant is persisted between sessions
   * Demo tenants are stored in-memory only (Zustand store)
   * @returns Promise resolving to tenant storage data with lastProdTenant
   */
  getStorage(): Promise<TenantStorageData>;

  /**
   * Save production tenant storage data
   * NOTE: Only production tenants are persisted between sessions
   * Demo tenants are stored in-memory only and cleared on app restart
   * @param tenantSlug - Production tenant slug to save
   * @returns Promise that resolves when storage is saved
   */
  saveStorage(tenantSlug: string): Promise<void>;

  /**
   * Clear tenant storage data (clears lastProdTenant)
   * @returns Promise that resolves when storage is cleared
   */
  clearStorage(): Promise<void>;
}

export interface ElectronAuth {
  /**
   * Open login window and authenticate with Planhat
   * @param environment - 'production' or 'demo'
   * @returns Promise resolving to auth result with cookies
   */
  openLoginWindow(environment?: 'production' | 'demo'): Promise<AuthResult>;

  /**
   * Get current session cookies
   * @returns Promise resolving to array of cookies
   */
  getCookies(): Promise<PlanhatCookie[]>;

  /**
   * Set/restore cookies to session
   * @param cookies - Cookies to restore
   * @returns Promise that resolves when cookies are set
   */
  setCookies(cookies: PlanhatCookie[]): Promise<void>;

  /**
   * Clear all authentication cookies (logout)
   * @returns Promise that resolves when cookies are cleared
   */
  clearCookies(): Promise<void>;

  /**
   * Get stored auth data from persistent storage
   * @returns Promise resolving to stored auth data or null
   */
  getStoredAuth(): Promise<StoredAuthData | null>;

  /**
   * Check if currently authenticated (has valid cookies)
   * @returns Promise resolving to authentication status
   */
  isAuthenticated(): Promise<boolean>;

  /**
   * Save last production tenant slug to persistent storage
   * @param tenantSlug - Tenant slug to save
   * @returns Promise that resolves when tenant slug is saved
   */
  saveLastProdTenant(tenantSlug: string): Promise<void>;

  /**
   * Logout and clear session
   * @returns Promise that resolves when logout is complete
   */
  logout(): Promise<void>;
}

// Preferences are now managed by electron-preferences library
// Access via File -> Preferences menu (Cmd+,)
// No renderer process API needed - preferences handled by native dialog

export interface ElectronFiles {
  // Placeholder for future file system APIs (Phase 5)
}

export interface ElectronWindow {
  /**
   * Set window title
   * @param title - New window title
   * @returns Promise that resolves when title is set
   */
  setTitle(title: string): Promise<void>;
}

export interface ElectronPlanhatBrowser {
  /**
   * Open Planhat browser window
   * @returns Promise that resolves when window is opened
   */
  open(): Promise<void>;

  /**
   * Close Planhat browser window
   * @returns Promise that resolves when window is closed
   */
  close(): Promise<void>;

  /**
   * Toggle Planhat browser window (open if closed, close if open)
   * @returns Promise that resolves when toggle is complete
   */
  toggle(): Promise<void>;

  /**
   * Check if Planhat browser window is open
   * @returns Promise resolving to open status
   */
  isOpen(): Promise<boolean>;
}

export interface ElectronSampleData {
  /**
   * Open folder picker dialog
   * @returns Promise resolving to selected folder path or null if cancelled
   */
  selectFolder(): Promise<string | null>;

  /**
   * Write JSON file to disk
   * @param filePath - Full path to the file
   * @param data - Data to write (will be JSON stringified)
   * @returns Promise that resolves when file is written
   */
  writeFile(filePath: string, data: any): Promise<void>;

  /**
   * Listen for menu trigger to get sample data
   * @param callback - Callback function to invoke when triggered
   * @returns Cleanup function to remove listener
   */
  onGetSampleData(callback: () => void): () => void;
}

export interface ElectronIpcRenderer {
  /**
   * Register a one-time listener for an IPC message
   * @param channel - IPC channel name
   * @param listener - Callback function to invoke when message is received
   * @returns Cleanup function to remove listener
   */
  on(channel: string, listener: () => void): () => void;
}

export interface ElectronAPI {
  platform: string;
  storage: ElectronStorage;
  tenant: ElectronTenant;
  auth: ElectronAuth;
  files: ElectronFiles;
  window: ElectronWindow;
  planhatBrowser: ElectronPlanhatBrowser;
  sampleData: ElectronSampleData;
  ipcRenderer: ElectronIpcRenderer;
}

declare global {
  interface Window {
    electron: ElectronAPI;
  }
}

export {}
