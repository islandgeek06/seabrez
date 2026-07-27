# Architecture

Intelleson Browser is an Electron desktop app with a strict process separation.

```
┌──────────────────────────────────────────────────────────────┐
│ Main process (Node)                                            │
│  • window + lifecycle           electron/main.ts               │
│  • TabManager (WebContentsView) electron/browser/tabs.ts       │
│  • DownloadManager              electron/browser/downloads.ts  │
│  • SQLite data layer            electron/db/*                  │
│  • AI streaming + providers     electron/ai/*                  │
│  • secure key store (safeStorage) electron/security/keystore.ts│
│  • permission handler           electron/security/permissions  │
│  • validated IPC handlers       electron/ipc/*                 │
└───────────────▲───────────────────────────────┬──────────────┘
                │ contextBridge (preload.ts)     │ WebContentsView
                │  window.intelleson.*           │ (real Chromium page)
┌───────────────┴───────────────┐   ┌────────────▼──────────────┐
│ Renderer — app UI (React/TS)  │   │ Web content process        │
│  • custom chrome, panels      │   │  • sandboxed, isolated     │
│  • Zustand store (src/store)  │   │  • its own session         │
│  • NO Node, NO direct network │   │  • never sees the preload  │
└───────────────────────────────┘   └────────────────────────────┘
```

## Key ideas

- **The renderer never touches Node, the network for AI, or the database
  directly.** It calls `window.intelleson.*` (defined in `electron/preload.ts`),
  every method of which maps to a Zod-validated `ipcMain.handle` in
  `electron/ipc/handlers.ts`.
- **Web pages render in `WebContentsView`** instances managed by `TabManager`,
  positioned to match a rectangle the renderer measures and reports
  (`view:setContentBounds`). This keeps the native page aligned with the custom
  chrome even as the sidebar/AI panel open and close.
- **AI streaming happens in the main process** so API keys never enter a
  renderer and browser CORS never applies. Deltas are pushed to the renderer
  over the `ai:stream` event channel.
- **`shared/`** holds pure, dependency-free modules (types, URL/text helpers,
  prompt templates) imported by both processes and covered by unit tests.

## Data flow example — "Summarize this page"

1. User clicks *Summarize* → `store.summarize()`.
2. Consent is checked (`settings.pageContextConsent` + per-site permission). If
   needed, a consent bar is shown; the action is stashed until approved.
3. `ai:extractPage` runs an injected script in the active tab, returning
   readable text (sensitive inputs stripped, injection flagged).
4. The text is truncated and wrapped as **untrusted** context
   (`shared/text.ts`) and combined with the summary prompt (`shared/prompts.ts`).
5. `ai:chat` streams the response from the chosen provider; deltas append to the
   assistant message in real time.

See also: [ai-provider-system.md](ai-provider-system.md),
[browser-security.md](browser-security.md), [database-schema.md](database-schema.md).
