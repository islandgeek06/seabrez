# Browser Security Model

## Process & isolation

- `contextIsolation: true`, `nodeIntegration: false` on every window and tab.
- Web content renders in **sandboxed** `WebContentsView`s
  (`sandbox: true`) with their own session; the app UI preload is never exposed
  to web pages.
- The app-UI renderer is locked down: `will-navigate` is blocked (the chrome
  cannot be navigated away) and `setWindowOpenHandler` denies popups, routing
  `http(s)` opens into new tabs and everything else to the OS via
  `shell.openExternal`.
- A Content-Security-Policy `<meta>` restricts the app UI (`index.html`).

## IPC

- The renderer can only reach `window.intelleson.*` (preload allowlist). There
  is no raw `ipcRenderer`, no arbitrary channel access, no Node.
- **Every** payload-carrying channel validates its input with a Zod schema
  (`electron/ipc/schemas.ts`) before the handler runs; invalid payloads throw.

## Permissions

`electron/security/permissions.ts` installs request + check handlers. Sensitive
permissions (camera, microphone, geolocation, notifications, MIDI,
display-capture, clipboard-read) **default to deny** unless the user has
explicitly allowed them for that origin (persisted in `sitePermissions`).
Nothing is auto-approved.

## Secrets

- API keys: encrypted via OS `safeStorage`; never in plain text, never logged.
- The logger (`electron/services/logger.ts`) redacts anything matching
  `api_key|authorization|password|token|secret` and never logs full prompts or
  form contents.

## Prompt injection

Web page content is treated as untrusted data. Before it reaches a model it is
wrapped with instructions to ignore embedded directives, and the extractor flags
text that appears to address an AI system so the UI/model can be extra cautious.
We do **not** claim injection can be perfectly prevented.

## Downloads

Downloads save to the OS Downloads folder (or a user-chosen dir), filenames are
sanitized, and files are **never** auto-executed.
