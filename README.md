# PH Tools Desktop

Advanced desktop application providing intelligent tools and automation for Planhat platform users.

**Version:** 3.1.274
**Platform:** Electron (cross-platform: macOS, Windows, Linux)

## Migration Status: Phase 1 Complete ✅

This is an Electron desktop application migrated from the PH Tools Chrome extension. Phase 1 setup is complete and the app is ready for Phase 2 development.

## Quick Start

### Development

```bash
# Install dependencies (already done)
npm install

# Start development server
npm run dev

# This will:
# 1. Start Vite dev server on http://localhost:5173
# 2. Wait for Vite to be ready
# 3. Launch Electron app pointing to dev server
```

### Building

```bash
# Build React app
npm run build

# Build Electron app for distribution
npm run build:electron

# Output will be in /release folder
# - macOS: .dmg and .zip files
# - Windows: .exe installer and portable .exe
```

### Testing

```bash
# TypeScript type checking
npm run type-check

# ESLint
npm run lint

# Run tests (when available)
npm test
```

## Project Structure

```
ph-desk/
├── electron/              # Electron main process
│   ├── main.cjs          # Application entry point
│   └── preload.cjs       # Preload script (IPC bridge)
│
├── src/
│   ├── app/              # Main application UI (was extension-page/)
│   │   ├── App.tsx       # Root component
│   │   ├── main.tsx      # React entry point
│   │   └── components/   # App-specific components
│   │
│   ├── shared/           # Shared code (90%+ unchanged from extension)
│   │   ├── api/          # Planhat API integration
│   │   ├── components/   # Reusable UI components
│   │   ├── hooks/        # React hooks
│   │   ├── services/     # Business logic services
│   │   ├── stores/       # Zustand state management
│   │   ├── types/        # TypeScript definitions
│   │   └── utils/        # Utility functions
│   │
│   ├── assets/           # Icons, images
│   ├── styles/           # Global styles
│   ├── config/           # App configuration
│   └── types/            # Additional type definitions
│
├── dist/                 # Vite build output
├── release/              # Electron packaged apps
│
├── index.html            # HTML entry point
├── package.json          # Dependencies and scripts
├── vite.config.ts        # Vite configuration
├── electron-builder.json # Electron packaging config
└── tsconfig.json         # TypeScript configuration
```

## Key Changes from Chrome Extension

### What Was Removed
- ❌ `src/background/` - Chrome service worker
- ❌ `src/content/` - Chrome content scripts
- ❌ `src/popup/` - Chrome popup UI
- ❌ `public/manifest.json` - Chrome extension manifest
- ❌ `@crxjs/vite-plugin` - Chrome extension build plugin
- ❌ `@types/chrome` - Chrome API types

### What Was Added
- ✅ `electron/main.cjs` - Electron main process
- ✅ `electron/preload.cjs` - Electron preload script
- ✅ `src/shared/utils/chrome-shim.ts` - Chrome API stub (Phase 1 only)
- ✅ Electron and electron-builder packages
- ✅ Updated Vite config for Electron

### What Was Preserved (90%+)
- ✅ All `/shared` folder code (API, services, components, hooks, stores, utils, types)
- ✅ All React components and business logic
- ✅ All Planhat API integrations
- ✅ All data processing and export functionality
- ✅ All UI components (Ant Design, TanStack, etc.)
- ✅ All existing dependencies

## Chrome API Shim (Phase 1 - Temporary)

The `src/shared/utils/chrome-shim.ts` file provides stub implementations of Chrome APIs to allow the code to compile and run. These are console warnings only in Phase 1.

**Phase 4** will replace these with proper Electron implementations:
- Chrome Storage → Electron's safeStorage API
- Chrome Runtime → Electron IPC
- Chrome Tabs → Not needed in desktop app

## Known Issues (Expected)

### TypeScript Errors
The project has the **same TypeScript errors** as the original Chrome extension:
- Missing type definitions in test files
- Type assertion issues in some components
- Import path resolution (temporary)

These are **documented and expected** - they don't block development or runtime functionality.

### Chrome API References
Currently handled by chrome-shim.ts stub. Will be properly implemented in Phase 4 with Electron APIs.

## Phase Roadmap

### ✅ Phase 1: Project Setup (Complete)
- New Electron project structure
- All source code migrated
- Chrome API stubs in place
- Vite + Electron configured
- Dependencies installed
- App compiles and runs

### 🔄 Phase 2: Remove Chrome-Specific Code (Next)
- Update storage layer to use Electron APIs
- Remove chrome-shim.ts stub
- Implement proper Electron storage
- Clean up Chrome-specific references

### 🔄 Phase 3: Electron Main Process Enhancement
- Window state persistence
- Native menus
- App lifecycle management
- System integration

### 🔄 Phase 4: Authentication (Hardest Part)
- Embedded browser login flow
- Session cookie management
- API authentication with Electron
- Token refresh handling

### 🔄 Phase 5: Desktop Features
- File system integration
- Native notifications
- System tray (optional)
- Auto-updater (optional)

### 🔄 Phase 6: Build & Distribution
- Code signing
- macOS .dmg creation
- Windows installer
- Cross-platform testing

## Development Notes

### Running the App

The dev server uses concurrently to run both Vite and Electron:
1. Vite starts on port 5173 (or next available)
2. wait-on waits for Vite to be ready
3. Electron launches and loads from Vite dev server
4. Hot reload works for React code
5. Electron needs restart for main process changes

### Debugging

- **React DevTools**: Available in Electron dev mode
- **Chrome DevTools**: Auto-opens in dev mode (F12)
- **Electron Logs**: Check terminal output
- **Main Process**: Add console.log to electron/main.cjs

### Building for Production

```bash
# Build everything
npm run build:electron

# Output locations:
# - macOS: release/PH Tools-3.1.274.dmg
# - macOS: release/PH Tools-3.1.274-mac.zip
# - Windows: release/PH Tools Setup 3.1.274.exe
# - Windows: release/PH Tools 3.1.274.exe (portable)
```

## Troubleshooting

### Vite port conflict
If port 5173 is in use, Vite will auto-select next port. Update `wait-on` URL in package.json if needed.

### Electron won't start
1. Check Vite is running: `curl http://localhost:5173`
2. Check electron/main.cjs for errors
3. Try: `npm run dev:vite` then `npm run dev:electron` separately

### White screen on launch
1. Check browser console (F12) for errors
2. Verify dist/index.html exists after build
3. Check CSP in index.html isn't blocking resources

### Module not found errors
1. Run `npm install` again
2. Clear node_modules and reinstall
3. Check tsconfig.json paths are correct

## License

MIT

## Support

For issues and questions, see the main PH Tools documentation.
