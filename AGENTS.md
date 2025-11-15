# Repository Guidelines

## Project Structure & Module Organization
- `src/` contains the React + TypeScript front end; key subfolders include `app/` for page shells, `components/` for reusable UI, `services/` and `api/` for Planhat integrations, `stores/` for Zustand state, and `utils/` for shared helpers.
- `electron/` hosts the desktop shell (`main.cjs`, `menu.cjs`, preload scripts) plus auth window wiring; `dist/` is generated Vite output bundled into releases.
- Docs that describe user workflows and APIs live in `docs/`; design assets stay under `src/assets/`. Keep new tests beside the code (e.g., `components/ui/__tests__/DataTable.*`).

## Build, Test, and Development Commands
- `npm run dev` starts Vite and Electron concurrently for local hacking.
- `npm run build` emits the production web bundle; `npm run build:electron` wraps that bundle with `electron-builder` for installers.
- `npm run type-check`, `npm run lint`, and `npm run format:check` gate CI-quality runs; prefer `npm run format` only when you intend to commit the changes.
- `npm run test`, `npm run test:ui`, and `npm run test:coverage` execute Vitest in CLI, UI, or coverage modes; use `npm run test:coverage -- --runInBand` when diagnosing flakiness.

## Coding Style & Naming Conventions
- Follow the ESLint + Prettier config (TS/TSX, 2-space indent, single quotes spared by Prettier). Do not disable lint rules unless documented.
- Use PascalCase for React components, camelCase for functions/state, and kebab-case for file names except React components (`WorkflowExporter.tsx`).
- Centralize types in `src/types/` or module-level `types.ts`; favor Zod schemas in `src/schemas/` when validating inputs.

## Testing Guidelines
- Vitest with @testing-library drives unit/UI specs; mirror production data paths (e.g., `services/__tests__/export.service.test.ts`).
- Write deterministic tests, mock network calls through Axios interceptors, and aim for meaningful coverage (>=80% in new modules).
- Use `describe('<Component>')` plus behavior-focused `it('renders columns when …')` naming.

## Commit & Pull Request Guidelines
- Commits in history read as concise, sentence-case summaries (e.g., `Improve settings modal UX and clean up documentation`). Keep scope focused and include context about user impact.
- PRs should link Planhat/issue IDs, describe risk, attach screenshots for UI changes, and note any manual verification on macOS/Windows builds.

## Security & Configuration Tips
- Store secrets in the OS keychain; never hardcode tenant keys. Electron preload scripts and `electron/config/` expect sanitized environment variables.
- Keep Node ≥18 and npm ≥9 as enforced in `package.json`. Run `npm audit` before tagging a release.
