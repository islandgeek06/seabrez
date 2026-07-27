# Architecture Decision Records

Deviations from the original build brief are recorded here (per operating
instruction 20).

## ADR-0001 — Single-app layout instead of a monorepo

**Decision:** Keep one Vite/Electron app at the repo root (`electron/`, `src/`,
`shared/`) rather than an `apps/desktop` + `packages/*` monorepo.

**Why:** For a first release built by one engineer, the monorepo's workspace
tooling adds overhead without functional benefit. Separation of concerns is
achieved with directories (`electron/db`, `electron/ai`, `electron/security`,
`shared`) and a clean IPC/preload boundary. The code can be lifted into
`packages/` later without rewrites because `shared/` is already dependency-free.

## ADR-0002 — sql.js (WASM) instead of better-sqlite3

**Decision:** Use `sql.js` (SQLite compiled to WebAssembly) behind a small
`better-sqlite3`-compatible wrapper (`electron/db/sqlite.ts`).

**Why:** `better-sqlite3` is a native module that must be compiled against
Electron's ABI, which requires Visual Studio C++ build tools. The target
environment lacked them, so the app could not launch. `sql.js` requires **zero
native compilation**, runs anywhere, and still provides real SQLite. The wrapper
mirrors the `prepare().get/all/run`, `exec`, `pragma`, and `transaction` API so
the repository layer is identical to what better-sqlite3 would use — migrating
to the native driver later is a one-file change.

**Trade-off:** sql.js keeps the DB in memory and persists a snapshot to disk
(debounced + on quit). This is more than adequate for browser-scale local data;
for very large datasets, switch to the native driver via the same wrapper.

## ADR-0003 — Built-in extractor instead of Mozilla Readability

**Decision:** Extract readable page text with a small injected script
(`electron/ai/extract.ts`) rather than bundling Readability.

**Why:** Avoids injecting a third-party library into arbitrary page contexts and
keeps the extraction path auditable. The function is isolated so Readability can
be dropped in later behind the same interface.

## ADR-0004 — Hand-built CSS design system instead of Tailwind/Radix

**Decision:** Ship a CSS-custom-property design system (`src/styles/global.css`)
instead of Tailwind + Radix.

**Why:** The theming requirements (dark/light/system, accent, glass,
reduce-motion, dyslexia font) are cleanly expressed with CSS variables, and it
keeps the dependency surface small. Radix primitives can be introduced
incrementally where accessibility of complex widgets warrants it.

## ADR-0005 — Multi-window with per-window TabManager (supersedes prior single-window note)

**Decision:** `WindowManager` (`electron/browser/window-manager.ts`) owns every
`BrowserWindow`, each with its own `TabManager`. IPC handlers resolve the target
manager via `BrowserWindow.fromWebContents(event.sender)`. **Private windows** are
real separate OS windows, each assigned a unique in-memory session partition
(`intelleson-private-<id>-<ts>`, no `persist:` prefix) so they never persist
history/cookies and are isolated from normal browsing and from each other.

**Why:** Routing IPC by sender keeps handlers simple while supporting any number
of windows; per-window private partitions give true private-browsing isolation.
AI streaming is sent back to the requesting window (`ai:chat` binds `send` to
`event.sender`), and download events broadcast to all windows.
