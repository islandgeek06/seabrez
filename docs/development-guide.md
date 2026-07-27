# Development Guide

## Prerequisites

- Node.js 20+ (built with Node 24; Electron bundles its own Node 20 runtime)
- npm 10+
- No C++ build tools required (sql.js is pure WASM — see ADR-0002)

## Install

```bash
npm install
```

## Run

| Command | What it does |
| --- | --- |
| `npm run dev:electron` | Full desktop app: real Chromium browsing + SQLite + AI |
| `npm run dev` | Web-only UI preview (no native tabs/DB/AI) at http://localhost:5273 |
| `npm run build` | Typecheck + build renderer, main, and preload |
| `npm test` | Run unit/component tests (Vitest) |
| `npm run typecheck` | `tsc --noEmit` over `src`, `electron`, `shared` |
| `npm run package:win` | Build a Windows NSIS installer |

## Project layout

```
electron/   main process — browser/, db/, ai/, ipc/, security/, services/
src/        renderer — components/, store.ts, api.ts, styles/
shared/     pure modules shared by both + tested (types, url, text, prompts)
tests/      Vitest unit + component tests
docs/       this documentation
```

## Conventions

- Business logic lives in the main process or `shared/`, not in React
  components.
- Every new IPC channel: add a Zod schema in `electron/ipc/schemas.ts`, a
  handler in `handlers.ts`, and a preload method in `preload.ts`.
- Keep `shared/` free of Electron/DOM imports so it stays unit-testable.
- Run `npm run typecheck && npm test && npm run build` before committing.

## Environment

Copy `.env.example` → `.env`. It contains only non-secret values. AI keys are
entered in the app (Settings → AI) and encrypted with the OS secure store —
never put them in `.env`.
