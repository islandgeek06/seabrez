# Privacy Model

Intelleson is **local-first**: your data lives on your device in a local SQLite
file. There is no account, no telemetry, and no cloud sync in this release.

## What is stored locally

History, bookmarks, notes, workspaces, session tabs, downloads, per-site
permissions, AI conversation metadata, and settings — all in
`<userData>/intelleson.db`. Encrypted API keys are stored via the OS secure
store.

## Private browsing

Private tabs use an in-memory session (no `persist:` partition). While private:

- Browsing history is **not** recorded.
- Cookies/storage are discarded when the private session ends.
- Private tabs are **not** restored on next launch.
- Page-based AI conversations are not saved unless you explicitly save them.

Private tabs are clearly marked with a shield indicator.

**Accurate expectations:** private browsing hides activity from *other users of
this device* and this browser's own history. It does **not** make you anonymous
to the websites you visit, your employer, your internet provider, or a network
administrator.

## Tracker & ad blocking

A built-in request blocklist cancels requests to common ad/analytics domains
(`electron/main.ts`). This is a starting set; EasyList-style rules can be loaded
later.

## Permissions

Camera, microphone, geolocation, notifications, and similar are denied by
default and only granted per-origin with your explicit consent.

## AI & your data

Page content is only sent to your chosen AI provider **after you consent** (per
the page-context consent setting). Requests go directly from your machine to the
provider using your own key. Intelleson does not proxy or retain them.

## Your controls

Settings → Privacy lets you clear history and downloads. History and downloads
can also be managed item-by-item on their pages.
