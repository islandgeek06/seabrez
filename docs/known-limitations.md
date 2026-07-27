# Known Limitations

This is a first release — an AI-first productivity browser MVP, not a Chrome
replacement. Known gaps and honest caveats:

## Verified vs. not

- ✅ **Typecheck, production build, and unit tests pass** (`npm run typecheck`,
  `npm run build`, `npm test`).
- ✅ **The web-only UI preview** (`npm run dev`) renders and is interactive.
- ✅ **The app packages to a runnable Windows bundle** (`release/win-unpacked/
  Intelleson Browser.exe`, ~181 MB) containing `main.js`, the CommonJS
  `preload.cjs`, and the SQLite WASM binary.
- ⚠️ **The NSIS `.exe` installer** requires Windows **Developer Mode** or an
  elevated terminal (electron-builder's `winCodeSign` extraction creates
  symlinks). See [packaging-windows.md](packaging-windows.md).
- ⚠️ **The full Electron desktop app was not launched in the build environment**
  (no GUI/display available there). The main-process browser/DB/AI paths are
  written to Electron 33 APIs and typecheck/build cleanly, but you should run
  `npm run dev:electron` on your machine to exercise live browsing, downloads,
  and streaming AI end-to-end. Report any runtime issue and it can be fixed
  quickly.

## Functional limitations

- **Multi-window is supported**: `New Window` (Ctrl+N) and `New Private Window`
  (Ctrl+Shift+N) open real separate OS windows, each with its own tab set. IPC is
  routed per-window by sender. Private windows use a unique in-memory session
  (no persisted history/cookies) and are visually distinguished.
- **Tracker/ad blocking** uses a small built-in domain list, not full EasyList
  rules.
- **Extraction** uses a built-in readable-text heuristic, not Mozilla
  Readability (ADR-0003).
- **Bookmark folders** exist in the schema and can be created/exported; nested
  drag-organization UI is minimal.
- **Hardware-acceleration toggle** is stored but applies on next launch only.
- **Data layer** is sql.js (in-memory + snapshot to disk). Excellent for
  browser-scale data; switch to native SQLite via the same wrapper for very
  large datasets (ADR-0002).
- **AI providers**: OpenAI and Anthropic implemented. Gemini/Azure/Ollama slot
  into the same `Provider` interface but aren't shipped yet.

## Explicitly out of scope for this release

Cloud sync, accounts/SSO, mobile apps, extension marketplace, VPN, password
manager, enterprise admin, and the other items listed in the build brief's
"excluded" section. The architecture leaves room for them (e.g. a `SyncService`
interface can be added without touching feature code).
