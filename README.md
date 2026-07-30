# ◈ SeaBrez

An **AI-first desktop browser** — real Chromium browsing (Electron), local
SQLite storage, and streaming AI, in one installable app.

> Browse, understand, organize, and act on information without leaving your
> browser.

This is a working first release (MVP): it browses real websites, manages tabs
with session restore, stores bookmarks/history/notes/downloads/workspaces
locally, and puts a streaming AI assistant (OpenAI or Anthropic) one keystroke
away — with page content only ever sent after your consent.

---

## Download & install

**Windows 10/11 (64-bit).** Grab the latest build from the
[**Releases** page](../../releases):

- **`SeaBrez-Setup-<version>.exe`** — installer. Double-click to
  install (adds Start-menu / desktop shortcuts).
- **`SeaBrez-Setup-<version>.zip`** — portable. Unzip and run
  `SeaBrez.exe`; no install.

> **SmartScreen note:** the app isn't code-signed yet, so Windows may show
> *"Windows protected your PC."* Click **More info → Run anyway**. This is normal
> for unsigned apps and disappears once a code-signing certificate is added.

**Desktop only.** SeaBrez is a desktop application (Windows, and buildable for
macOS/Linux). There is **no mobile app** — your synced bookmarks/notes live in
your own Supabase, so a future mobile client could read them, but the browser
itself doesn't run on phones. Prefer to build from source? See
[Development](docs/development-guide.md).

---

## Features

**Browser**
- Real websites via Chromium (`WebContentsView`), multi-process & sandboxed
- Tabs: new/close/switch, **pin, mute, duplicate, reorder (drag), reopen
  closed**, context menu, favicons, loading state
- **Session restore** across restarts
- Back / forward / reload / home + an **omnibox** that takes URLs, searches
  (Google/Bing/DuckDuckGo/Brave), and shows suggestions from history, bookmarks,
  and open tabs
- **Find in page** (Ctrl+F), **command palette** (Ctrl+Shift+P), keyboard
  shortcuts throughout
- **Private tabs** with isolated, non-persistent sessions

**Local apps & data (SQLite)**
- Bookmarks (+ folders, HTML export), History (search + clear by range), Notes
  (Markdown, save AI replies), Downloads manager (pause/resume/cancel), Workspaces

**AI (OpenAI + Anthropic, streaming)**
- Assistant panel: chat, streaming, cancel, copy, **save to notes**
- Page-aware: **Summarize / Explain / Extract / Ask about this page**, **Rewrite
  & Translate selection**, **Compare tabs**
- **Consent required** before any page content is sent; keys stored with OS
  `safeStorage`
- Untrusted-content wrapping + prompt-injection warnings

**Polish & safety**
- Dark / light / system themes, accent colors, glass UI
- Accessibility: keyboard nav, focus states, ARIA labels, reduced motion,
  dyslexia-friendly font
- Validated IPC (Zod), per-site permission prompts, tracker/ad request blocking,
  redacting logger

---

## Quick start

```bash
npm install
npm run dev:electron
```

That launches the full desktop browser. For a fast UI-only look in any browser
(no native tabs/DB/AI):

```bash
npm run dev
```

### Connect AI

Open **Settings → AI**, choose OpenAI or Anthropic, paste your API key, click
**Test**. Keys are encrypted with your OS secure store and never leave your
machine except in direct calls to the provider you choose.

### Build a Windows installer

```bash
npm run package:win
```

Produces an NSIS installer in `release/`. No C++ build tools needed (the SQLite
layer is pure WebAssembly). See [docs/packaging-windows.md](docs/packaging-windows.md).

---

## Keyboard shortcuts

| Shortcut | Action | | Shortcut | Action |
| --- | --- | --- | --- | --- |
| `Ctrl+L` | Focus address bar | | `Ctrl+H` | History |
| `Ctrl+T` | New tab | | `Ctrl+J` | Downloads |
| `Ctrl+W` | Close tab | | `Ctrl+F` | Find in page |
| `Ctrl+Shift+T` | Reopen closed tab | | `Ctrl+Shift+P` | Command palette |
| `Ctrl+Tab` / `Ctrl+Shift+Tab` | Next / prev tab | | `Ctrl+Shift+A` | AI panel |
| `Ctrl+D` | Bookmark page | | `Ctrl+Shift+N` | New private tab |

---

## Tech stack

Electron 33 (Chromium/Blink/V8) · React 18 · TypeScript 5 · Vite 5 · Zustand ·
Zod · SQLite (sql.js WASM) · lucide-react · Vitest.

## Architecture (short version)

```
electron/  main process: browser/ (tabs, downloads), db/ (SQLite + migrations),
           ai/ (providers, streaming, extraction), ipc/ (Zod-validated handlers),
           security/ (safeStorage keys, permissions), services/
src/       renderer: React chrome, Zustand store, typed api bridge, design system
shared/    pure, tested modules: types, url, text, prompts
```

The renderer never touches Node, the network for AI, or the DB directly — it
calls `window.intelleson.*`, every method validated in the main process. AI
streams from the main process so keys never enter a renderer. Full details in
[docs/architecture.md](docs/architecture.md).

## Documentation

- [Architecture](docs/architecture.md) · [Decision records](docs/architecture-decisions.md)
- [AI provider system](docs/ai-provider-system.md) · [Security](docs/browser-security.md) · [Privacy](docs/privacy-model.md)
- [Database schema](docs/database-schema.md) · [Development](docs/development-guide.md)
- [Packaging (Windows)](docs/packaging-windows.md) · [Testing](docs/testing-guide.md)
- [Known limitations](docs/known-limitations.md) ← **read this for what is/ isn't verified**

## Status & honesty

`npm run typecheck`, `npm run build`, and `npm test` (15 tests) all pass; the web
UI preview is verified rendering. The full Electron app was not launched in the
build environment (no display there) — run `npm run dev:electron` locally to
exercise live browsing/AI, and see [known limitations](docs/known-limitations.md).

## Roadmap

Cloud sync, separate private windows, full ad-block rules, Gemini/Azure/Ollama
providers, extension support, enterprise SSO, and mobile — all designed to slot
into the existing abstractions. Not built in this release.

---

_Working name: **SeaBrez** · MIT License_
