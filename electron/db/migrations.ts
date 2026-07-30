// Ordered, idempotent SQL migrations. The runner (see database.ts) applies any
// migration whose version is greater than the stored user_version, inside a
// transaction, then bumps user_version. Never edit a shipped migration — add a
// new one.

export interface Migration {
  version: number
  name: string
  sql: string
}

export const MIGRATIONS: Migration[] = [
  {
    version: 1,
    name: 'initial-schema',
    sql: /* sql */ `
      CREATE TABLE settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updatedAt INTEGER NOT NULL
      );

      CREATE TABLE workspaces (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        icon TEXT NOT NULL DEFAULT '🗂️',
        color TEXT NOT NULL DEFAULT '#6d5efc',
        position INTEGER NOT NULL DEFAULT 0,
        createdAt INTEGER NOT NULL,
        updatedAt INTEGER NOT NULL
      );

      CREATE TABLE tabs (
        id TEXT PRIMARY KEY,
        workspaceId TEXT,
        url TEXT NOT NULL,
        title TEXT NOT NULL DEFAULT '',
        favicon TEXT,
        position INTEGER NOT NULL DEFAULT 0,
        pinned INTEGER NOT NULL DEFAULT 0,
        muted INTEGER NOT NULL DEFAULT 0,
        lastActiveAt INTEGER NOT NULL,
        createdAt INTEGER NOT NULL,
        updatedAt INTEGER NOT NULL
      );
      CREATE INDEX idx_tabs_workspace ON tabs(workspaceId);

      CREATE TABLE history (
        id TEXT PRIMARY KEY,
        workspaceId TEXT,
        url TEXT NOT NULL,
        title TEXT NOT NULL DEFAULT '',
        favicon TEXT,
        visitCount INTEGER NOT NULL DEFAULT 1,
        firstVisitedAt INTEGER NOT NULL,
        lastVisitedAt INTEGER NOT NULL
      );
      CREATE INDEX idx_history_url ON history(url);
      CREATE INDEX idx_history_lastVisited ON history(lastVisitedAt DESC);

      CREATE TABLE bookmarkFolders (
        id TEXT PRIMARY KEY,
        parentId TEXT,
        name TEXT NOT NULL,
        position INTEGER NOT NULL DEFAULT 0,
        createdAt INTEGER NOT NULL,
        updatedAt INTEGER NOT NULL
      );

      CREATE TABLE bookmarks (
        id TEXT PRIMARY KEY,
        folderId TEXT,
        workspaceId TEXT,
        title TEXT NOT NULL,
        url TEXT NOT NULL,
        favicon TEXT,
        pinned INTEGER NOT NULL DEFAULT 0,
        position INTEGER NOT NULL DEFAULT 0,
        createdAt INTEGER NOT NULL,
        updatedAt INTEGER NOT NULL
      );
      CREATE INDEX idx_bookmarks_folder ON bookmarks(folderId);
      CREATE INDEX idx_bookmarks_url ON bookmarks(url);

      CREATE TABLE notes (
        id TEXT PRIMARY KEY,
        workspaceId TEXT,
        title TEXT NOT NULL DEFAULT '',
        content TEXT NOT NULL DEFAULT '',
        sourceUrl TEXT,
        createdAt INTEGER NOT NULL,
        updatedAt INTEGER NOT NULL
      );
      CREATE INDEX idx_notes_workspace ON notes(workspaceId);

      CREATE TABLE aiConversations (
        id TEXT PRIMARY KEY,
        workspaceId TEXT,
        title TEXT NOT NULL DEFAULT '',
        provider TEXT NOT NULL,
        model TEXT NOT NULL,
        sourceUrl TEXT,
        createdAt INTEGER NOT NULL,
        updatedAt INTEGER NOT NULL
      );

      CREATE TABLE aiMessages (
        id TEXT PRIMARY KEY,
        conversationId TEXT NOT NULL,
        role TEXT NOT NULL,
        content TEXT NOT NULL,
        createdAt INTEGER NOT NULL
      );
      CREATE INDEX idx_aimessages_conversation ON aiMessages(conversationId);

      CREATE TABLE sitePermissions (
        id TEXT PRIMARY KEY,
        origin TEXT NOT NULL,
        permission TEXT NOT NULL,
        decision TEXT NOT NULL,
        createdAt INTEGER NOT NULL,
        updatedAt INTEGER NOT NULL,
        UNIQUE(origin, permission)
      );

      CREATE TABLE downloads (
        id TEXT PRIMARY KEY,
        url TEXT NOT NULL,
        filename TEXT NOT NULL,
        path TEXT NOT NULL,
        status TEXT NOT NULL,
        receivedBytes INTEGER NOT NULL DEFAULT 0,
        totalBytes INTEGER NOT NULL DEFAULT 0,
        startedAt INTEGER NOT NULL,
        completedAt INTEGER
      );
      CREATE INDEX idx_downloads_started ON downloads(startedAt DESC);
    `,
  },
  {
    version: 2,
    name: 'soft-delete-tombstones',
    sql: /* sql */ `
      ALTER TABLE bookmarks ADD COLUMN deleted INTEGER NOT NULL DEFAULT 0;
      ALTER TABLE notes ADD COLUMN deleted INTEGER NOT NULL DEFAULT 0;
    `,
  },
]
