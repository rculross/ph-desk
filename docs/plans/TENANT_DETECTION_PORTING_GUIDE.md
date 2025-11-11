# Tenant Detection & Auto-Selection - Porting Guide

This guide explains how PH-Tools automatically detects and selects tenants when the app starts by scanning open browser tabs. All Planhat-specific API logic has been removed - you'll only find the tab scanning and URL parsing logic you need.

---

## Table of Contents

1. [Overview](#overview)
2. [The Detection Process](#the-detection-process)
3. [URL Pattern & Parsing](#url-pattern--parsing)
4. [Tab Scanning with Chrome API](#tab-scanning-with-chrome-api)
5. [Selection Priority Logic](#selection-priority-logic)
6. [Storage & Persistence](#storage--persistence)
7. [Multi-Environment Support](#multi-environment-support)
8. [Complete Code Examples](#complete-code-examples)
9. [Integration Checklist](#integration-checklist)

---

## Overview

### What This System Does

When your Chrome extension starts up, it:

1. **Scans all open Chrome tabs** to find tabs with your application URLs
2. **Extracts tenant identifiers** from the URLs (e.g., `ws.planhat.com/acme` → tenant is `acme`)
3. **Remembers the last selected tenant** from Chrome storage
4. **Auto-selects the best tenant** based on priority rules
5. **Persists the selection** so it survives browser restarts

### Why This Approach?

- **Zero user input** - Automatic detection from existing browsing
- **Fast startup** - Uses tabs that are already open
- **Reliable** - If a tab is open, the user definitely has access
- **Multi-tenant friendly** - Handles users who work across multiple tenants

---

## The Detection Process

### Step-by-Step Flow

```
Extension Startup
    ↓
1. Background Service Worker Starts
    → Scans tabs for Planhat URLs
    → Logs what it finds
    ↓
2. Tenant Store Initializes
    → Checks if tenant already set
    → If not, performs tab-first initialization
    ↓
3. Tab Scanning
    → Query Chrome tabs API
    → Parse URLs to extract tenant slugs
    → Validate tenant slugs
    ↓
4. Selection Priority
    → Last selected tenant (from storage)
    → 'planhat' fallback tenant
    → First available tenant
    ↓
5. Set Current Tenant
    → Update in-memory state
    → Save to Chrome storage
    → Configure API client
```

### Key Files in PH-Tools

1. **Background Service Worker** (`src/background/service-worker.ts`)
   - Lines 14-55: Startup detection
   - Lines 30-34: Tab scanning on startup

2. **Tenant Store** (`src/shared/stores/tenant.store.ts`)
   - Lines 719-817: `initializeTenantStore()` - Main initialization
   - Lines 736-779: Tab-first selection logic

3. **Tenant Service** (`src/shared/api/services/tenant.service.ts`)
   - Lines 924-1008: `scanChromeTabsForTenantsWithEnvironment()` - Tab scanning
   - Lines 530-582: `detectTenantFromUrl()` - URL parsing

---

## URL Pattern & Parsing

### Planhat URL Structure

Planhat uses this URL pattern:
```
https://ws.planhat.com/<TENANT_SLUG>/...rest-of-path
```

Examples:
- `https://ws.planhat.com/acme/companies` → Tenant: `acme`
- `https://ws.planhat.com/globex-corp/issues/123` → Tenant: `globex-corp`
- `https://ws.planhatdemo.com/demo-tenant/dashboard` → Tenant: `demo-tenant` (demo environment)

### URL Parsing Logic

```typescript
/**
 * Extract tenant slug from a Planhat URL
 * Format: ws.planhat.com/<tenant>/...
 */
function extractTenantFromUrl(url: string): string | null {
  try {
    const urlObj = new URL(url)

    // Check if it's a Planhat domain
    if (!urlObj.hostname.includes('planhat.com')) {
      return null
    }

    // Check for correct hostname
    if (urlObj.hostname !== 'ws.planhat.com' && urlObj.hostname !== 'ws.planhatdemo.com') {
      return null
    }

    // Extract path segments
    const pathSegments = urlObj.pathname.split('/').filter(Boolean)

    if (pathSegments.length === 0) {
      return null
    }

    // First segment is the tenant slug
    const tenantSlug = pathSegments[0]?.toLowerCase().trim()

    if (!tenantSlug) {
      return null
    }

    // Skip generic paths that aren't tenant slugs
    const skipPaths = ['login', 'logout', 'auth', 'api', 'static', 'assets', 'favicon.ico']
    if (skipPaths.includes(tenantSlug)) {
      return null
    }

    // Basic validation: tenant slugs should be alphanumeric with hyphens/underscores
    if (!/^[a-z0-9_-]+$/.test(tenantSlug)) {
      return null
    }

    return tenantSlug

  } catch (error) {
    console.error('Failed to parse URL:', error)
    return null
  }
}
```

### For Your Application

**Replace with your URL pattern:**

```typescript
// Example 1: Subdomain pattern (e.g., acme.myapp.com)
function extractTenantFromSubdomain(url: string): string | null {
  try {
    const urlObj = new URL(url)
    const parts = urlObj.hostname.split('.')

    // Assume pattern: <tenant>.myapp.com
    if (parts.length >= 3 && parts[1] === 'myapp' && parts[2] === 'com') {
      const tenant = parts[0]?.toLowerCase()

      // Skip 'www' or 'app' subdomains
      if (tenant === 'www' || tenant === 'app' || tenant === 'api') {
        return null
      }

      return tenant
    }

    return null
  } catch (error) {
    return null
  }
}

// Example 2: Query parameter pattern (e.g., myapp.com?tenant=acme)
function extractTenantFromQuery(url: string): string | null {
  try {
    const urlObj = new URL(url)
    return urlObj.searchParams.get('tenant')
  } catch (error) {
    return null
  }
}
```

---

## Tab Scanning with Chrome API

### Core Tab Scanning Function

This is the heart of the tenant detection system:

```typescript
/**
 * Scan Chrome tabs for open application tabs and extract tenant slugs
 * Returns unique list of tenants found in open tabs
 */
async function scanTabsForTenants(): Promise<string[]> {
  try {
    // Query for tabs matching your application's URL pattern
    const tabs = await chrome.tabs.query({
      url: 'https://ws.planhat.com/*'  // Replace with your URL pattern
    })

    console.log(`Tab scan: Found ${tabs.length} application tabs`)

    const tenants = new Set<string>()  // Use Set to avoid duplicates

    // Process each tab
    for (const tab of tabs) {
      if (!tab.url) continue

      const tenantSlug = extractTenantFromUrl(tab.url)

      if (tenantSlug) {
        tenants.add(tenantSlug)
        console.log(`Found tenant '${tenantSlug}' in tab ${tab.id}`)
      }
    }

    const tenantArray = Array.from(tenants)
    console.log(`Tab scan complete: ${tenantArray.length} unique tenants found`)

    return tenantArray

  } catch (error) {
    console.error('Failed to scan tabs for tenants:', error)
    return []
  }
}
```

### Multi-Environment Tab Scanning

If your app has multiple environments (production, staging, demo):

```typescript
interface TenantWithEnvironment {
  tenantSlug: string
  environment: 'production' | 'staging' | 'demo'
}

/**
 * Scan tabs and identify which environment each tenant is in
 */
async function scanTabsWithEnvironment(): Promise<TenantWithEnvironment[]> {
  try {
    // Query different URL patterns in parallel
    const [prodTabs, demoTabs, stagingTabs] = await Promise.all([
      chrome.tabs.query({ url: 'https://ws.myapp.com/*' }),
      chrome.tabs.query({ url: 'https://ws.myapp-demo.com/*' }),
      chrome.tabs.query({ url: 'https://ws.myapp-staging.com/*' })
    ])

    console.log(`Tab scan: ${prodTabs.length} prod, ${demoTabs.length} demo, ${stagingTabs.length} staging`)

    const tenants: TenantWithEnvironment[] = []
    const seen = new Set<string>()  // Track tenant+environment combos

    // Process production tabs
    for (const tab of prodTabs) {
      if (!tab.url) continue
      const tenant = extractTenantFromUrl(tab.url)
      if (tenant) {
        const key = `${tenant}:production`
        if (!seen.has(key)) {
          tenants.push({ tenantSlug: tenant, environment: 'production' })
          seen.add(key)
        }
      }
    }

    // Process demo tabs
    for (const tab of demoTabs) {
      if (!tab.url) continue
      const tenant = extractTenantFromUrl(tab.url)
      if (tenant) {
        const key = `${tenant}:demo`
        if (!seen.has(key)) {
          tenants.push({ tenantSlug: tenant, environment: 'demo' })
          seen.add(key)
        }
      }
    }

    // Process staging tabs
    for (const tab of stagingTabs) {
      if (!tab.url) continue
      const tenant = extractTenantFromUrl(tab.url)
      if (tenant) {
        const key = `${tenant}:staging`
        if (!seen.has(key)) {
          tenants.push({ tenantSlug: tenant, environment: 'staging' })
          seen.add(key)
        }
      }
    }

    console.log(`Tab scan complete: ${tenants.length} tenant-environment combinations found`)

    return tenants

  } catch (error) {
    console.error('Failed to scan tabs:', error)
    return []
  }
}
```

### Background Service Worker Integration

Call tab scanning on extension startup:

```typescript
// In your background service worker

chrome.runtime.onStartup.addListener(async () => {
  console.log('Extension started - scanning for tenants')

  try {
    const tenants = await scanTabsForTenants()
    console.log(`Startup scan found ${tenants.length} tenants:`, tenants)

    // You can store this for later use
    await chrome.storage.local.set({
      'available-tenants': tenants,
      'last-scan-time': Date.now()
    })

  } catch (error) {
    console.error('Startup tenant scan failed:', error)
  }
})

// Also scan on installation
chrome.runtime.onInstalled.addListener(async (details) => {
  console.log(`Extension ${details.reason}`)

  try {
    const tenants = await scanTabsForTenants()
    console.log(`Install scan found ${tenants.length} tenants:`, tenants)

  } catch (error) {
    console.error('Install tenant scan failed:', error)
  }
})
```

---

## Selection Priority Logic

### The Decision Tree

```typescript
/**
 * Select the best tenant to use from available options
 * Priority:
 * 1. Last selected tenant (if it has an open tab)
 * 2. Default tenant (if it has an open tab)
 * 3. First available tenant from tabs
 * 4. Hardcoded fallback
 */
async function selectInitialTenant(
  availableTenants: string[],
  defaultTenant = 'planhat'  // Your app's default
): Promise<string> {

  // Step 1: Try to load last selected tenant from storage
  try {
    const storage = await chrome.storage.local.get(['last-selected-tenant'])
    const lastSelected = storage['last-selected-tenant']

    if (lastSelected) {
      console.log(`Last selected tenant: ${lastSelected}`)

      // Check if last selected tenant has an open tab
      if (availableTenants.includes(lastSelected)) {
        console.log(`✓ Using last selected tenant '${lastSelected}' (has open tab)`)
        return lastSelected
      } else {
        console.log(`✗ Last selected tenant '${lastSelected}' has no open tab - checking fallback`)
      }
    }
  } catch (error) {
    console.warn('Failed to load last selected tenant:', error)
  }

  // Step 2: Try default tenant if it has an open tab
  if (availableTenants.includes(defaultTenant)) {
    console.log(`✓ Using default tenant '${defaultTenant}' (has open tab)`)
    return defaultTenant
  }

  // Step 3: Use first available tenant from tabs
  if (availableTenants.length > 0) {
    const firstAvailable = availableTenants[0]!
    console.log(`✓ Using first available tenant '${firstAvailable}'`)
    return firstAvailable
  }

  // Step 4: Final fallback (no tabs open)
  console.log(`⚠ No open tabs found, using hardcoded fallback '${defaultTenant}'`)
  return defaultTenant
}
```

### Complete Initialization Flow

```typescript
/**
 * Initialize tenant detection and selection on app startup
 */
async function initializeTenantDetection(): Promise<string | null> {
  console.log('Starting tab-first tenant initialization')

  try {
    // Step 1: Scan tabs
    const availableTenants = await scanTabsForTenants()
    console.log(`Found ${availableTenants.length} tenants in open tabs:`, availableTenants)

    // Step 2: Select best tenant
    const selectedTenant = await selectInitialTenant(availableTenants)
    console.log(`Selected tenant: ${selectedTenant}`)

    // Step 3: Save selection to storage
    await chrome.storage.local.set({
      'current-tenant': selectedTenant,
      'available-tenants': availableTenants,
      'last-selected-tenant': selectedTenant
    })

    console.log(`✓ Tenant initialization complete: ${selectedTenant}`)

    return selectedTenant

  } catch (error) {
    console.error('Tenant initialization failed:', error)
    return null
  }
}
```

---

## Storage & Persistence

### What to Store in Chrome Storage

```typescript
// Storage keys used by PH-Tools

interface TenantStorage {
  // Currently active tenant
  'current-tenant': string

  // Last tenant the user explicitly selected
  'last-selected-tenant': string

  // List of tenants found in open tabs
  'available-tenants': string[]

  // Full tenant object with metadata (optional)
  'current-tenant-info': {
    id: string
    slug: string
    name: string
    environment: 'production' | 'demo'
  }

  // Cache timestamp
  'tenants-last-fetched': number
}
```

### Storage Operations

```typescript
// Save current tenant selection
async function saveCurrentTenant(tenantSlug: string): Promise<void> {
  await chrome.storage.local.set({
    'current-tenant': tenantSlug,
    'last-selected-tenant': tenantSlug
  })
  console.log(`Saved current tenant: ${tenantSlug}`)
}

// Load current tenant
async function loadCurrentTenant(): Promise<string | null> {
  const result = await chrome.storage.local.get(['current-tenant'])
  return result['current-tenant'] || null
}

// Switch to different tenant
async function switchTenant(newTenantSlug: string): Promise<void> {
  console.log(`Switching tenant to: ${newTenantSlug}`)

  // Save to storage
  await saveCurrentTenant(newTenantSlug)

  // Notify other parts of extension
  await chrome.runtime.sendMessage({
    action: 'TENANT_CHANGED',
    payload: {
      tenant: newTenantSlug,
      previousTenant: await loadCurrentTenant()
    }
  })

  console.log(`Tenant switch complete: ${newTenantSlug}`)
}

// Clear tenant selection
async function clearCurrentTenant(): Promise<void> {
  await chrome.storage.local.remove(['current-tenant'])
  console.log('Cleared current tenant')
}
```

---

## Multi-Environment Support

### Detecting Environment from URL

```typescript
type Environment = 'production' | 'demo' | 'staging'

/**
 * Determine environment from URL
 */
function detectEnvironment(url: string): Environment | null {
  try {
    const urlObj = new URL(url)

    if (urlObj.hostname.includes('demo')) {
      return 'demo'
    }

    if (urlObj.hostname.includes('staging')) {
      return 'staging'
    }

    if (urlObj.hostname.includes('myapp.com')) {
      return 'production'
    }

    return null

  } catch (error) {
    return null
  }
}
```

### Environment-Aware Tab Scanning

```typescript
/**
 * Scan tabs and group by environment
 */
async function scanTabsByEnvironment(): Promise<{
  production: string[]
  demo: string[]
  staging: string[]
}> {
  const result = {
    production: [] as string[],
    demo: [] as string[],
    staging: [] as string[]
  }

  try {
    // Scan all relevant URLs
    const tabs = await chrome.tabs.query({
      url: [
        'https://ws.myapp.com/*',
        'https://ws.myapp-demo.com/*',
        'https://ws.myapp-staging.com/*'
      ]
    })

    for (const tab of tabs) {
      if (!tab.url) continue

      const tenant = extractTenantFromUrl(tab.url)
      const environment = detectEnvironment(tab.url)

      if (tenant && environment) {
        if (!result[environment].includes(tenant)) {
          result[environment].push(tenant)
        }
      }
    }

    console.log(`Environment scan:`, {
      production: result.production.length,
      demo: result.demo.length,
      staging: result.staging.length
    })

    return result

  } catch (error) {
    console.error('Environment scan failed:', error)
    return result
  }
}
```

---

## Complete Code Examples

### Example 1: Simple Single-Environment Detection

```typescript
/**
 * Basic tenant detection for a single environment
 * URL pattern: https://app.myservice.com/tenant/<TENANT_SLUG>/...
 */

// 1. URL Parser
function extractTenant(url: string): string | null {
  try {
    const urlObj = new URL(url)
    if (urlObj.hostname !== 'app.myservice.com') return null

    const match = urlObj.pathname.match(/^\/tenant\/([a-z0-9_-]+)/i)
    return match ? match[1]!.toLowerCase() : null
  } catch {
    return null
  }
}

// 2. Tab Scanner
async function scanForTenants(): Promise<string[]> {
  const tabs = await chrome.tabs.query({ url: 'https://app.myservice.com/tenant/*' })
  const tenants = new Set<string>()

  tabs.forEach(tab => {
    if (tab.url) {
      const tenant = extractTenant(tab.url)
      if (tenant) tenants.add(tenant)
    }
  })

  return Array.from(tenants)
}

// 3. Initialization
async function initialize(): Promise<void> {
  // Scan tabs
  const availableTenants = await scanForTenants()

  // Load last selection
  const storage = await chrome.storage.local.get(['last-tenant'])
  const lastTenant = storage['last-tenant']

  // Choose tenant
  let selectedTenant: string
  if (lastTenant && availableTenants.includes(lastTenant)) {
    selectedTenant = lastTenant
  } else if (availableTenants.length > 0) {
    selectedTenant = availableTenants[0]!
  } else {
    selectedTenant = 'default'
  }

  // Save selection
  await chrome.storage.local.set({
    'current-tenant': selectedTenant,
    'last-tenant': selectedTenant
  })

  console.log(`Initialized with tenant: ${selectedTenant}`)
}
```

### Example 2: Multi-Environment Detection (Production + Demo)

```typescript
/**
 * Multi-environment tenant detection
 * Production: https://app.myservice.com/<TENANT>/...
 * Demo: https://demo.myservice.com/<TENANT>/...
 */

interface TenantInfo {
  slug: string
  environment: 'production' | 'demo'
}

// 1. URL Parser with Environment Detection
function parseTenantUrl(url: string): TenantInfo | null {
  try {
    const urlObj = new URL(url)

    let environment: 'production' | 'demo' | null = null
    if (urlObj.hostname === 'app.myservice.com') environment = 'production'
    if (urlObj.hostname === 'demo.myservice.com') environment = 'demo'

    if (!environment) return null

    const pathParts = urlObj.pathname.split('/').filter(Boolean)
    if (pathParts.length === 0) return null

    const slug = pathParts[0]!.toLowerCase()
    if (!/^[a-z0-9_-]+$/.test(slug)) return null

    return { slug, environment }
  } catch {
    return null
  }
}

// 2. Tab Scanner with Environment
async function scanAllEnvironments(): Promise<TenantInfo[]> {
  const [prodTabs, demoTabs] = await Promise.all([
    chrome.tabs.query({ url: 'https://app.myservice.com/*' }),
    chrome.tabs.query({ url: 'https://demo.myservice.com/*' })
  ])

  const tenants: TenantInfo[] = []
  const seen = new Set<string>()

  for (const tab of [...prodTabs, ...demoTabs]) {
    if (!tab.url) continue
    const info = parseTenantUrl(tab.url)
    if (info) {
      const key = `${info.slug}:${info.environment}`
      if (!seen.has(key)) {
        tenants.push(info)
        seen.add(key)
      }
    }
  }

  return tenants
}

// 3. Smart Selection with Environment Preference
async function selectTenant(available: TenantInfo[]): Promise<TenantInfo | null> {
  // Load preference
  const storage = await chrome.storage.local.get(['last-tenant'])
  const lastTenant = storage['last-tenant'] as TenantInfo | undefined

  // Try to use last selected (if still available)
  if (lastTenant) {
    const match = available.find(t =>
      t.slug === lastTenant.slug && t.environment === lastTenant.environment
    )
    if (match) return match
  }

  // Prefer production over demo
  const prodTenant = available.find(t => t.environment === 'production')
  if (prodTenant) return prodTenant

  // Fallback to first available
  return available[0] || null
}

// 4. Complete Initialization
async function initializeMultiEnv(): Promise<void> {
  const availableTenants = await scanAllEnvironments()
  const selected = await selectTenant(availableTenants)

  if (selected) {
    await chrome.storage.local.set({
      'current-tenant': selected,
      'last-tenant': selected,
      'available-tenants': availableTenants
    })
    console.log(`Initialized: ${selected.slug} (${selected.environment})`)
  } else {
    console.warn('No tenants found in open tabs')
  }
}
```

### Example 3: Subdomain-Based Detection

```typescript
/**
 * Subdomain-based tenant detection
 * URL pattern: https://<TENANT>.myapp.com/...
 */

// 1. Extract tenant from subdomain
function extractTenantFromSubdomain(url: string): string | null {
  try {
    const urlObj = new URL(url)
    const parts = urlObj.hostname.split('.')

    // Pattern: <tenant>.myapp.com
    if (parts.length >= 3 && parts[1] === 'myapp' && parts[2] === 'com') {
      const tenant = parts[0]!.toLowerCase()

      // Skip system subdomains
      if (['www', 'app', 'api', 'admin'].includes(tenant)) {
        return null
      }

      return tenant
    }

    return null
  } catch {
    return null
  }
}

// 2. Scan tabs for subdomain tenants
async function scanSubdomainTenants(): Promise<string[]> {
  // Use wildcard pattern to match all subdomains
  const tabs = await chrome.tabs.query({ url: 'https://*.myapp.com/*' })

  const tenants = new Set<string>()

  for (const tab of tabs) {
    if (!tab.url) continue
    const tenant = extractTenantFromSubdomain(tab.url)
    if (tenant) tenants.add(tenant)
  }

  return Array.from(tenants)
}

// 3. Initialize with subdomain detection
async function initializeSubdomainMode(): Promise<void> {
  const tenants = await scanSubdomainTenants()

  if (tenants.length > 0) {
    const selected = tenants[0]!
    await chrome.storage.local.set({ 'current-tenant': selected })
    console.log(`Selected tenant from subdomain: ${selected}`)
  }
}
```

---

## Integration Checklist

### Step 1: Identify Your URL Pattern

Determine how tenants are identified in your app's URLs:

- [ ] **Path-based**: `/tenant/acme/...` or `/acme/...`
- [ ] **Subdomain-based**: `acme.myapp.com`
- [ ] **Query parameter**: `?tenant=acme`
- [ ] **Custom pattern**: Document it

### Step 2: Write URL Parser

- [ ] Create `extractTenant()` function for your URL pattern
- [ ] Add validation (regex, length, allowed characters)
- [ ] Handle edge cases (login pages, static assets)
- [ ] Test with real URLs from your app

### Step 3: Implement Tab Scanning

- [ ] Add `scanTabsForTenants()` function
- [ ] Update `chrome.tabs.query()` with your URL patterns
- [ ] Handle multi-environment if needed
- [ ] Add error handling

### Step 4: Add Selection Logic

- [ ] Implement `selectInitialTenant()` with priority rules
- [ ] Define your default tenant
- [ ] Add fallback handling

### Step 5: Storage Integration

- [ ] Set up Chrome storage schema
- [ ] Implement `saveCurrentTenant()`
- [ ] Implement `loadCurrentTenant()`
- [ ] Add `switchTenant()` for user changes

### Step 6: Background Service Worker

- [ ] Add tab scanning to `onStartup` listener
- [ ] Add tab scanning to `onInstalled` listener
- [ ] Log scan results for debugging

### Step 7: State Management Integration

If using Zustand, Redux, or similar:

- [ ] Create tenant store/slice
- [ ] Add initialization action
- [ ] Add tenant switching action
- [ ] Persist to Chrome storage

### Step 8: Testing

- [ ] Test with 0 tabs open (fallback)
- [ ] Test with 1 tab open
- [ ] Test with multiple tabs (same tenant)
- [ ] Test with multiple tabs (different tenants)
- [ ] Test last-selected preference
- [ ] Test environment switching (if applicable)
- [ ] Test after browser restart

---

## Permissions Required

Add to your `manifest.json`:

```json
{
  "permissions": [
    "tabs",
    "storage"
  ],
  "host_permissions": [
    "https://ws.planhat.com/*",
    "https://ws.planhatdemo.com/*"
  ]
}
```

**Replace with your domains!**

---

## Common Pitfalls

### 1. URL Patterns in manifest.json

❌ **Wrong** - Too specific:
```json
"host_permissions": ["https://ws.planhat.com/acme/*"]
```

✅ **Correct** - Use wildcards:
```json
"host_permissions": ["https://ws.planhat.com/*"]
```

### 2. Case Sensitivity

Always normalize tenant slugs:
```typescript
const tenant = extractedTenant.toLowerCase().trim()
```

### 3. Tab Query Timing

Don't call `chrome.tabs.query()` too early in extension lifecycle. Wait for `onStartup` or `onInstalled`.

### 4. Storage Limits

Chrome storage has limits (5 MB for local storage). Don't store large tenant lists:

```typescript
// ❌ Bad - Storing too much
await chrome.storage.local.set({
  'all-tenant-data': hugeArray
})

// ✅ Good - Store only what you need
await chrome.storage.local.set({
  'current-tenant': 'acme',
  'available-tenant-slugs': ['acme', 'globex', 'initech']
})
```

### 5. Async/Await in Listeners

Chrome listeners don't wait for promises. Return `true` for async:

```typescript
// ❌ Bad
chrome.runtime.onMessage.addListener(async (message) => {
  await doSomething()
})

// ✅ Good
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  doSomething().then(sendResponse)
  return true  // Keeps message channel open for async
})
```

---

## Summary

You now have everything needed to implement tab-based tenant detection:

✅ **URL Parsing** - Extract tenant from your URL pattern
✅ **Tab Scanning** - Find tenants in open Chrome tabs
✅ **Selection Logic** - Choose best tenant with priority rules
✅ **Storage** - Persist selection across sessions
✅ **Multi-Environment** - Handle production/demo/staging
✅ **Complete Examples** - Path-based, subdomain-based patterns

The key insight: **Don't ask the user - detect from what's already open!**

---

## Files to Reference

In the PH-Tools codebase:

1. **src/background/service-worker.ts** - Lines 14-55, 30-34 (startup scanning)
2. **src/shared/stores/tenant.store.ts** - Lines 719-817 (initialization)
3. **src/shared/api/services/tenant.service.ts** - Lines 924-1008 (tab scanning), 530-582 (URL parsing)

All Planhat API calls and tenant verification logic have been excluded from this guide!
