# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

PH Tools Desktop is an Electron desktop application providing intelligent tools and automation for Planhat platform users. Built with React, TypeScript, Vite, and Electron, it was migrated from a Chrome extension and includes advanced features like data export, LLM integration, and Salesforce connectivity.

## Core Design Philosopies that MUST be followed
- **Prefer simpl solutions** We don't want to be complex.  Always prefer the solutions that is the simplest and changes the least amount of code
- **Do Not Change Patterns or Architecture** Only the Typescript Subagent can make decisions on architecure and coding patterns
- **Update only what is asked** Perform the actions that are asked of you. Do not make changes beyond the scope of the request.
- **Always Ask** when in doubt always ask for clarificaiton.  hours upon hours are wasted on incomplete or misunderstood specs.  Asking saves precious time.
- **Version Number Updates** Always update the patch portion of the version number after any change
- **The API is Sacred** The entire extension works via Planhat's bespoke API practices.  DO NOT ASSUME how it works.  Do not change API end points without first asking.  The API service is only edited with permission from the user.  If you do not follow this rule you will screw up the program and be terminated.

**Version**: 4.0.0
**Stack**: Electron 38 + React 18 + TypeScript 5 + Vite 5 + Zustand + TanStack Query

## Version Management

**MUST UPDATE after ANY change:**
1. `package.json` - NPM package version and Electron app version
2. `src/config/version.ts` - Application version display (APP_VERSION constant)

**Versioning Rules:**
- Increment PATCH number (3rd component) by 1 after every change
- Version format: MAJOR.MINOR.PATCH (e.g., 4.0.275)
- PATCH number can increment without limit (no rollover required)

**Development Workflow:**
```bash
# 1. Update version in package.json: "version": "4.0.275"
# 2. Update version in src/config/version.ts: export const APP_VERSION = '4.0.275'
# 3. Continue development with hot reload
npm run dev  # Hot reload handles React changes automatically
```

**Production Builds:**
```bash
# For production distribution builds (creates installers in release/)
npm run build:electron  # Builds React app to dist/ + packages Electron app to release/
```

**Note**: Unlike Chrome extensions, Electron supports hot reloading for renderer process (React) changes. Only run `npm run build:electron` for production distribution or when testing production builds locally. Main process changes (`electron/*.cjs`) require restarting `npm run dev`.

## Development Commands

### Running the App
```bash
npm run dev                # Start Vite dev server + Electron (recommended)
npm run dev:vite          # Start only Vite dev server (port 5173)
npm run dev:electron      # Start only Electron (waits for Vite)
```

### Building
```bash
npm run build             # Build React app with Vite
npm run build:electron    # Build React + package Electron app (creates .dmg/.exe)
```

### Testing & Quality
```bash
npm test                  # Run Vitest tests
npm run test:ui           # Run Vitest with UI
npm run test:coverage     # Run tests with coverage
npm run type-check        # TypeScript type checking (no emit)
npm run lint              # Run ESLint with auto-fix
npm run lint:check        # Run ESLint without auto-fix
npm run format            # Format code with Prettier
npm run format:check      # Check formatting with Prettier
```

**Important**: The project has known TypeScript errors (documented in README.md) that don't block runtime functionality. Type checking may fail but app runs correctly.

## Project Architecture

### Directory Structure
```
ph-desk/
├── electron/                # Electron main process code (CommonJS)
│   ├── main.cjs            # Main process entry, window management
│   ├── preload.cjs         # IPC bridge (secure context bridge)
│   └── auth-window.cjs     # Planhat authentication window manager
│
├── src/
│   ├── app/                # Main application UI
│   │   ├── App.tsx         # Root component with navigation
│   │   ├── main.tsx        # React entry point
│   │   └── components/     # App-level components (exporters, explorers)
│   │
│   ├── api/                # Planhat API integration layer
│   │   ├── client/         # HTTP client (axios-based)
│   │   ├── config/         # Endpoints, rate limiter, API registry
│   │   ├── queries/        # TanStack Query hooks
│   │   ├── services/       # Business logic services
│   │   ├── auth.ts         # Authentication service
│   │   ├── errors.ts       # Error handling
│   │   └── index.ts        # Centralized exports
│   │
│   ├── components/         # Reusable UI components
│   │   ├── ui/             # Base UI components (DataTable, ToolHeader, etc.)
│   │   ├── llm/            # LLM integration components
│   │   ├── integrations/   # Salesforce and other integrations
│   │   └── settings/       # Settings components
│   │
│   ├── hooks/              # React custom hooks
│   ├── services/           # Application services (export, LLM, Salesforce, etc.)
│   ├── stores/             # Zustand state management
│   │   ├── auth.store.ts   # Authentication state
│   │   ├── tenant.store.ts # Tenant context
│   │   └── app.store.ts    # Application state
│   │
│   ├── types/              # TypeScript type definitions
│   ├── utils/              # Utility functions
│   ├── schemas/            # Zod validation schemas
│   ├── config/             # App configuration
│   └── styles/             # Global styles
│
├── dist/                   # Vite build output
└── release/                # Electron packaged apps (.dmg, .exe)
```

### Key Architectural Patterns

#### 1. Electron Multi-Process Architecture
- **Main Process** (`electron/main.cjs`): Window management, authentication, IPC handlers
- **Renderer Process** (`src/`): React UI, runs in Chromium with Node.js integration disabled
- **Preload Script** (`electron/preload.cjs`): Secure IPC bridge using `contextBridge`

Access Electron APIs in renderer:
```typescript
window.electron.auth.openLoginWindow()
window.electron.auth.logout()
```

#### 2. Authentication Flow
The app uses embedded browser authentication with Planhat:
1. User clicks login → `auth.service.login()` → IPC to main process
2. Main process opens `auth-window.cjs` (BrowserWindow with real Planhat login)
3. User enters credentials → cookies captured → stored in electron-store (encrypted)
4. Cookies restored on app restart → auto-login if valid

**Files**: `electron/auth-window.cjs`, `src/services/auth.service.ts`, `src/stores/auth.store.ts`

#### 3. State Management (Zustand)
Three main stores with persistence:
- **authStore**: Authentication state, user data, session management
- **tenantStore**: Current tenant context, tenant settings
- **appStore**: Application state, notifications, modals

Stores use chrome.storage.local for persistence (Chrome API shim in Electron).

#### 4. API Layer (TanStack Query)
Centralized API integration with:
- **HTTP Client**: Axios-based with rate limiting, retries, error handling
- **Query Hooks**: TanStack Query hooks for data fetching (`src/api/queries/`)
- **Services**: Business logic (`src/api/services/`)
- **Validation**: Zod schemas for request/response validation

Usage:
```typescript
import { useIssuesQuery } from '@/api/queries/issues.queries'
import { issuesService } from '@/api/services/issues.service'
```

#### 5. Export System
Advanced export functionality with multiple formats:
- **Standard Export Service**: `src/services/export.service.ts` - Handles CSV, Excel (.xlsx), and JSON exports
- **Enhanced Export Service**: `src/services/enhanced-export.service.ts` - Multi-sheet Excel exports with formatting (used by WorkflowExporter)
- **Format Support**: CSV, Excel (.xlsx), JSON

**Note**: The codebase has been simplified to remove over-engineered alternatives. Use the standard export service for most cases, and the enhanced service only when multi-sheet Excel exports with formatting are required.

Handles large datasets with chunking, progress tracking, and memory management.

#### 6. Data Table (TanStack Table + Virtualization)
High-performance virtualized tables for large datasets:
- **Core**: `src/components/ui/DataTable.tsx`
- **Virtualization**: TanStack Virtual for row virtualization
- **Features**: Filtering, sorting, column reordering, selection, pagination, column visibility
- **Table Hook**: `src/hooks/useTableCore.ts` - Single, simplified hook for all table functionality
- **Persistence**: Tenant-specific persistence for column widths, order, and visibility

**Note**: The codebase has been simplified to use ONE table hook (`useTableCore.ts`). Previous "enhanced" alternatives have been removed in favor of this battle-tested implementation.

Performance considerations documented in `src/config/table-virtualization.ts`.

##### Table State Persistence

The table system automatically persists three types of state per tenant:

1. **Column Widths** - User-adjusted column sizes (via drag handles)
2. **Column Order** - Custom column arrangement via drag-and-drop
3. **Column Visibility** - Hidden/visible column preferences (via column visibility menu)

**Storage Keys Pattern:**
- `table-column-widths-{entityType}-{tenantSlug}`
- `table-column-order-{entityType}-{tenantSlug}`
- `table-column-visibility-{entityType}-{tenantSlug}`

**Enable Persistence:**
```typescript
<Table
  data={data}
  columns={columns}
  entityType="issue"           // Required for persistence keys
  tenantSlug={currentTenant}   // Required for tenant-specific persistence
  enablePersistence={true}     // Enables all three persistence features
/>
```

**How it Works:**
- Persistence is automatically enabled when both `entityType` and `tenantSlug` are provided
- Each tenant maintains separate preferences for all three features
- State is loaded on component mount and saved with 500ms debounce
- Uses `storageManager` (backed by electron-store in Electron, localStorage as fallback)
- Validation ensures persisted state is valid before applying

**Implementation Details:**
- Column widths persist when `enableColumnResizing={true}` (default)
- Column order persists automatically when tenant context is available
- Column visibility persists automatically when tenant context is available
- See `src/hooks/useTableCore.ts` (lines 103-107, 256-267, 338-441, 512-534)

#### 7. Tool Header Pattern
Standardized header components for consistent UI:
- **Architecture Guide**: `src/types/ui-architecture.md`
- **Components**: `ToolHeader`, `ToolHeaderButton`, `ToolHeaderControls`
- **Categories**: OUTPUT, DATA, EXPORT, FILTER (semantic grouping)

Usage:
```tsx
<ToolHeader title="Export Tool" icon={ExportIcon}>
  <ToolHeaderControls category={CONTROL_CATEGORIES.EXPORT}>
    <ToolHeaderButton variant="primary" onClick={handleExport}>
      Export
    </ToolHeaderButton>
  </ToolHeaderControls>
</ToolHeader>
```

## Path Aliases

TypeScript and Vite are configured with path aliases:
```typescript
@/*            → src/*
@/api/*        → src/api/*
@/components/* → src/components/*
@/hooks/*      → src/hooks/*
@/stores/*     → src/stores/*
@/services/*   → src/services/*
@/types/*      → src/types/*
@/utils/*      → src/utils/*
@/app/*        → src/app/*
```

Always use these aliases for imports within the project.

## Testing Strategy

### Test Framework
- **Vitest**: Test runner with Jest-compatible API
- **React Testing Library**: Component testing
- **Coverage**: V8 coverage provider

### Test Locations
Tests are colocated with code in `__tests__/` directories:
```
src/components/ui/__tests__/
src/hooks/__tests__/
src/services/__tests__/
```

### Running Specific Tests
```bash
npx vitest src/services/__tests__/export.service.test.ts
npx vitest --watch
```

## Important Development Notes

### Electron Main Process Changes
When modifying `electron/*.cjs` files, **restart the entire dev process** (kill and re-run `npm run dev`). Hot reload only works for React code.

### Authentication Development
- Login window loads real Planhat login page (`https://ws.planhat.com`)
- Cookies are managed in Electron session and persisted via electron-store
- Test with different tenants using the TenantSelector component

### API Development
- All Planhat API calls go through the centralized API layer (`src/api/`)
- Rate limiting is enabled by default (configurable in `src/api/config/rate-limiter.ts`)
- Use TanStack Query hooks for data fetching (automatic caching, refetching, error handling)

### Export Development
- Large exports use chunked processing to prevent memory issues
- Progress tracking via `ExportProgress` component
- Format-specific logic in `src/services/exports/`

### LLM Integration
- API keys stored securely with PIN protection (`src/services/pin-protection.service.ts`)
- Encryption via `src/services/encryption.service.ts`
- Multiple provider support (OpenAI, Anthropic, etc.)

### Salesforce Integration
- OAuth flow managed in main process
- Data processor: `src/services/salesforce-data-processor.service.ts`
- Search service: `src/services/salesforce-search.service.ts`

## Common Patterns

### Adding a New API Endpoint
1. Define endpoint in `src/api/config/endpoints.ts`
2. Add service method in appropriate service file (e.g., `src/api/services/companies.service.ts`)
3. Create TanStack Query hook in `src/api/queries/` if needed
4. Export from `src/api/index.ts`

### Adding a New Export Format
1. Extend `ExportFormat` type in `src/types/export.ts`
2. Add format handler in `src/services/export.service.ts` (or `enhanced-export.service.ts` for multi-sheet Excel)
3. Update format selection UI in exporter components

### Adding a New Tool/Feature
1. Create component in `src/app/components/`
2. Add navigation item in `src/app/App.tsx` (navigationCategories)
3. Register route/tab handling in App component
4. Use ToolHeader pattern for consistency

### Adding State to Zustand Store
1. Add state and actions to appropriate store in `src/stores/`
2. Export new selectors from store file
3. Use in components with `useAuthStore()`, `useTenantStore()`, etc.

### Working with Table Persistence
When using the Table component with tenant-specific data:
1. **Always provide both `entityType` and `tenantSlug`** - This enables automatic persistence
2. **Column widths, order, and visibility are persisted automatically** - No additional code needed
3. **Users' table preferences are isolated per tenant** - Each tenant has separate saved preferences
4. **Persistence uses debounced saves (500ms)** - Prevents excessive storage writes during rapid changes

Example:
```typescript
import { useTenantStore } from '@/stores/tenant.store'

function IssuesExporter() {
  const currentTenant = useTenantStore(state => state.currentTenant)

  return (
    <Table
      data={issues}
      columns={columns}
      entityType="issue"
      tenantSlug={currentTenant?.slug}  // Required for persistence
      enablePersistence={true}           // Optional (default: true)
    />
  )
}
```

**Migration Note**: The legacy `useTablePersistence` hook is deprecated. Use the built-in persistence in `useTableCore`/`Table` instead.

## Build & Distribution

### Development Build
```bash
npm run build  # Outputs to dist/
```

### Production Build
```bash
npm run build:electron
```

Outputs to `release/`:
- **macOS**: `.dmg` and `.zip` (x64 + arm64)
- **Windows**: `.exe` installer and portable `.exe` (x64)
- **Linux**: `.AppImage` and `.deb`

Configuration: `electron-builder.json`

## Migration Status

This app was migrated from a Chrome extension. Current migration phase:

- ✅ **Phase 1**: Project setup, Electron structure
- ✅ **Phase 2**: Chrome API removal (chrome-shim.ts removed)
- ✅ **Phase 3**: Authentication system (Planhat embedded login)
- 🔄 **Phase 4**: Ongoing - Desktop feature enhancements

### Chrome API Shim
A Chrome API compatibility shim (`src/utils/chrome-api-shim.ts`) provides drop-in replacements for Chrome APIs:
- **chrome.storage.local** → delegates to `window.electron.storage` (backed by electron-store)
- **chrome.tabs** → returns empty arrays (not applicable in desktop)
- **chrome.runtime** → provides stubs for messaging APIs

The shim is automatically imported in `src/app/main.tsx` and ensures existing Chrome extension code runs in Electron without modification.

## Debugging

### React DevTools
Available in dev mode (auto-opens). Press F12 or Cmd+Option+I (Mac) / Ctrl+Shift+I (Windows).

### Main Process Debugging
Add `console.log()` statements to `electron/*.cjs` files. Output appears in terminal where `npm run dev` was run.

### Renderer Process Debugging
Use browser DevTools (F12). Console, Network, Sources tabs available.

### Electron Logs
Main process logs appear in terminal. Renderer logs in DevTools console.

## Performance Considerations

### Table Virtualization
Large datasets (>1000 rows) should use DataTable with virtualization enabled. Configuration in `src/config/table-virtualization.ts`.

### Memory Management
- Export services use chunked processing
- Large API responses paginated (default: 100 items per page)
- React.memo used for expensive components

### Bundle Size
- Vite handles code splitting automatically
- Tree-shaking enabled for production builds
- Terser minification enabled

## Security Notes

### API Key Storage
LLM API keys stored with:
1. User-provided PIN protection
2. Encryption via `encryption.service.ts`
3. Secure storage in electron-store

### Authentication
- Cookies stored encrypted in electron-store
- Session validation on app start
- Auto-logout on session expiration

### IPC Security
- contextBridge used for secure IPC
- No Node.js integration in renderer process
- Validation on all IPC messages

### CORS Handling
CORS is handled at the Electron session level in `electron/main.cjs`:
- Response headers modified to allow cross-origin requests to Planhat API
- Safe because Electron controls both the client and server communication
- Cookies remain secure (credentials: true)
