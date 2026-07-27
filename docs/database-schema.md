# Database Schema

Local SQLite (via sql.js — see ADR-0002), stored at
`<userData>/intelleson.db`. Migrations live in `electron/db/migrations.ts` and
run automatically on startup, gated by `PRAGMA user_version`. Typed repositories
are in `electron/db/database.ts`.

## Tables (v1)

| Table | Purpose | Key columns |
| --- | --- | --- |
| `settings` | key/value app config + encrypted API keys | `key`, `value`, `updatedAt` |
| `workspaces` | workspaces | `id`, `name`, `icon`, `color`, `position` |
| `tabs` | persisted session tabs for restore | `id`, `workspaceId`, `url`, `title`, `pinned`, `muted`, `position` |
| `history` | browsing history (normal mode only) | `url`, `title`, `visitCount`, `firstVisitedAt`, `lastVisitedAt` |
| `bookmarkFolders` | bookmark folders (nested via `parentId`) | `id`, `parentId`, `name`, `position` |
| `bookmarks` | bookmarks | `id`, `folderId`, `workspaceId`, `title`, `url`, `pinned` |
| `notes` | local notes | `id`, `workspaceId`, `title`, `content`, `sourceUrl` |
| `aiConversations` | conversation metadata | `id`, `provider`, `model`, `sourceUrl` |
| `aiMessages` | conversation messages | `conversationId`, `role`, `content` |
| `sitePermissions` | per-origin permission decisions | `origin`, `permission`, `decision` (unique per pair) |
| `downloads` | download history | `url`, `filename`, `path`, `status`, `receivedBytes`, `totalBytes` |

Indexes exist on `tabs.workspaceId`, `history.url`, `history.lastVisitedAt`,
`bookmarks.folderId`, `bookmarks.url`, `notes.workspaceId`,
`aiMessages.conversationId`, and `downloads.startedAt`.

## Privacy

Private-mode browsing is **never** written to `history` or `tabs`. Clearing data
(Settings → Privacy) removes history/downloads rows.

## Migrations

Add a new entry to the `MIGRATIONS` array with the next `version` and its SQL —
never edit a shipped migration. The runner applies every migration whose version
exceeds the stored `user_version`, in a transaction.
