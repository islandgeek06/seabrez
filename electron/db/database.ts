import { app } from 'electron'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { openDatabase, type SqliteDatabase } from './sqlite'
import { MIGRATIONS } from './migrations'
import type {
  Bookmark,
  BookmarkFolder,
  DownloadItem,
  HistoryEntry,
  Note,
  PersistedTab,
  SitePermission,
  Workspace,
} from '../../shared/types'

let db: SqliteDatabase

const now = () => Date.now()
const uid = () => randomUUID()

/** Open the DB (under userData) and run pending migrations. */
export async function initDatabase(): Promise<SqliteDatabase> {
  const file = path.join(app.getPath('userData'), 'intelleson.db')
  db = await openDatabase(file)
  migrate()
  seedDefaults()
  return db
}

/** Flush the in-memory DB image to disk (call on app quit). */
export function closeDatabase() {
  db?.close()
}

function migrate() {
  const current = db.pragma('user_version', { simple: true }) as number
  for (const m of MIGRATIONS) {
    if (m.version > current) {
      const tx = db.transaction(() => {
        db.exec(m.sql)
        db.pragma(`user_version = ${m.version}`)
      })
      tx()
    }
  }
}

function seedDefaults() {
  const count = db.prepare('SELECT COUNT(*) AS c FROM workspaces').get() as { c: number }
  if (count.c === 0) {
    workspaces.create({ name: 'Personal', icon: '🏠', color: '#6d5efc' })
    workspaces.create({ name: 'Work', icon: '💼', color: '#22c55e' })
  }
}

// --------------------------------------------------------------------------
// Settings (key/value)
// --------------------------------------------------------------------------
export const settingsRepo = {
  getAll(): Record<string, string> {
    const rows = db.prepare('SELECT key, value FROM settings').all() as {
      key: string
      value: string
    }[]
    return Object.fromEntries(rows.map((r) => [r.key, r.value]))
  },
  set(key: string, value: string) {
    db.prepare(
      `INSERT INTO settings (key, value, updatedAt) VALUES (?, ?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updatedAt = excluded.updatedAt`,
    ).run(key, value, now())
  },
}

// --------------------------------------------------------------------------
// Workspaces
// --------------------------------------------------------------------------
export const workspaces = {
  list(): Workspace[] {
    return db.prepare('SELECT * FROM workspaces ORDER BY position, createdAt').all() as Workspace[]
  },
  create(input: { name: string; icon?: string; color?: string }): Workspace {
    const ts = now()
    const pos =
      (db.prepare('SELECT COALESCE(MAX(position), -1) AS m FROM workspaces').get() as {
        m: number
      }).m + 1
    const ws: Workspace = {
      id: uid(),
      name: input.name,
      icon: input.icon ?? '🗂️',
      color: input.color ?? '#6d5efc',
      position: pos,
      createdAt: ts,
      updatedAt: ts,
    }
    db.prepare(
      `INSERT INTO workspaces (id, name, icon, color, position, createdAt, updatedAt)
       VALUES (@id, @name, @icon, @color, @position, @createdAt, @updatedAt)`,
    ).run(ws)
    return ws
  },
  update(id: string, patch: Partial<Pick<Workspace, 'name' | 'icon' | 'color' | 'position'>>) {
    const existing = db.prepare('SELECT * FROM workspaces WHERE id = ?').get(id) as Workspace
    if (!existing) return
    const merged = { ...existing, ...patch, updatedAt: now() }
    db.prepare(
      `UPDATE workspaces SET name=@name, icon=@icon, color=@color, position=@position, updatedAt=@updatedAt WHERE id=@id`,
    ).run(merged)
  },
  remove(id: string) {
    db.prepare('DELETE FROM workspaces WHERE id = ?').run(id)
  },
}

// --------------------------------------------------------------------------
// History
// --------------------------------------------------------------------------
export const history = {
  record(entry: { url: string; title: string; favicon?: string | null; workspaceId?: string | null }) {
    const existing = db.prepare('SELECT * FROM history WHERE url = ?').get(entry.url) as
      | HistoryEntry
      | undefined
    const ts = now()
    if (existing) {
      db.prepare(
        `UPDATE history SET title=?, favicon=?, visitCount=visitCount+1, lastVisitedAt=? WHERE id=?`,
      ).run(entry.title || existing.title, entry.favicon ?? existing.favicon, ts, existing.id)
    } else {
      db.prepare(
        `INSERT INTO history (id, workspaceId, url, title, favicon, visitCount, firstVisitedAt, lastVisitedAt)
         VALUES (?, ?, ?, ?, ?, 1, ?, ?)`,
      ).run(uid(), entry.workspaceId ?? null, entry.url, entry.title, entry.favicon ?? null, ts, ts)
    }
  },
  search(query: string, limit = 200): HistoryEntry[] {
    if (query) {
      const like = `%${query}%`
      return db
        .prepare(
          `SELECT * FROM history WHERE url LIKE ? OR title LIKE ? ORDER BY lastVisitedAt DESC LIMIT ?`,
        )
        .all(like, like, limit) as HistoryEntry[]
    }
    return db
      .prepare('SELECT * FROM history ORDER BY lastVisitedAt DESC LIMIT ?')
      .all(limit) as HistoryEntry[]
  },
  remove(id: string) {
    db.prepare('DELETE FROM history WHERE id = ?').run(id)
  },
  clearSince(sinceTs: number) {
    db.prepare('DELETE FROM history WHERE lastVisitedAt >= ?').run(sinceTs)
  },
  clearAll() {
    db.prepare('DELETE FROM history').run()
  },
}

// --------------------------------------------------------------------------
// Bookmarks + folders
// --------------------------------------------------------------------------
export const bookmarks = {
  list(): { folders: BookmarkFolder[]; items: Bookmark[] } {
    return {
      folders: db
        .prepare('SELECT * FROM bookmarkFolders ORDER BY position, name')
        .all() as BookmarkFolder[],
      items: db.prepare('SELECT * FROM bookmarks ORDER BY position, createdAt').all() as Bookmark[],
    }
  },
  create(input: {
    title: string
    url: string
    favicon?: string | null
    folderId?: string | null
    workspaceId?: string | null
  }): Bookmark {
    const ts = now()
    const b: Bookmark = {
      id: uid(),
      folderId: input.folderId ?? null,
      workspaceId: input.workspaceId ?? null,
      title: input.title,
      url: input.url,
      favicon: input.favicon ?? null,
      pinned: 0,
      position: 0,
      createdAt: ts,
      updatedAt: ts,
    }
    db.prepare(
      `INSERT INTO bookmarks (id, folderId, workspaceId, title, url, favicon, pinned, position, createdAt, updatedAt)
       VALUES (@id, @folderId, @workspaceId, @title, @url, @favicon, @pinned, @position, @createdAt, @updatedAt)`,
    ).run(b)
    return b
  },
  update(id: string, patch: Partial<Pick<Bookmark, 'title' | 'url' | 'folderId' | 'pinned' | 'position'>>) {
    const ex = db.prepare('SELECT * FROM bookmarks WHERE id = ?').get(id) as Bookmark
    if (!ex) return
    const merged = { ...ex, ...patch, updatedAt: now() }
    db.prepare(
      `UPDATE bookmarks SET title=@title, url=@url, folderId=@folderId, pinned=@pinned, position=@position, updatedAt=@updatedAt WHERE id=@id`,
    ).run(merged)
  },
  remove(id: string) {
    db.prepare('DELETE FROM bookmarks WHERE id = ?').run(id)
  },
  createFolder(name: string, parentId: string | null = null): BookmarkFolder {
    const ts = now()
    const f: BookmarkFolder = { id: uid(), parentId, name, position: 0, createdAt: ts, updatedAt: ts }
    db.prepare(
      `INSERT INTO bookmarkFolders (id, parentId, name, position, createdAt, updatedAt)
       VALUES (@id, @parentId, @name, @position, @createdAt, @updatedAt)`,
    ).run(f)
    return f
  },
  removeFolder(id: string) {
    db.prepare('UPDATE bookmarks SET folderId = NULL WHERE folderId = ?').run(id)
    db.prepare('DELETE FROM bookmarkFolders WHERE id = ?').run(id)
  },
  isBookmarked(url: string): boolean {
    return Boolean(db.prepare('SELECT 1 FROM bookmarks WHERE url = ? LIMIT 1').get(url))
  },
  // Insert-or-update a full row (from cloud sync), keeping whichever copy has the
  // newer updatedAt (last-write-wins).
  upsert(b: Bookmark) {
    db.prepare(
      `INSERT INTO bookmarks (id, folderId, workspaceId, title, url, favicon, pinned, position, createdAt, updatedAt)
       VALUES (@id, @folderId, @workspaceId, @title, @url, @favicon, @pinned, @position, @createdAt, @updatedAt)
       ON CONFLICT(id) DO UPDATE SET
         folderId=excluded.folderId, workspaceId=excluded.workspaceId, title=excluded.title,
         url=excluded.url, favicon=excluded.favicon, pinned=excluded.pinned, position=excluded.position,
         updatedAt=excluded.updatedAt
       WHERE excluded.updatedAt > bookmarks.updatedAt`,
    ).run(b)
  },
}

// --------------------------------------------------------------------------
// Notes
// --------------------------------------------------------------------------
export const notes = {
  list(query = ''): Note[] {
    if (query) {
      const like = `%${query}%`
      return db
        .prepare('SELECT * FROM notes WHERE title LIKE ? OR content LIKE ? ORDER BY updatedAt DESC')
        .all(like, like) as Note[]
    }
    return db.prepare('SELECT * FROM notes ORDER BY updatedAt DESC').all() as Note[]
  },
  create(input: Partial<Note>): Note {
    const ts = now()
    const n: Note = {
      id: uid(),
      workspaceId: input.workspaceId ?? null,
      title: input.title ?? 'Untitled note',
      content: input.content ?? '',
      sourceUrl: input.sourceUrl ?? null,
      createdAt: ts,
      updatedAt: ts,
    }
    db.prepare(
      `INSERT INTO notes (id, workspaceId, title, content, sourceUrl, createdAt, updatedAt)
       VALUES (@id, @workspaceId, @title, @content, @sourceUrl, @createdAt, @updatedAt)`,
    ).run(n)
    return n
  },
  update(id: string, patch: Partial<Pick<Note, 'title' | 'content' | 'workspaceId' | 'sourceUrl'>>) {
    const ex = db.prepare('SELECT * FROM notes WHERE id = ?').get(id) as Note
    if (!ex) return
    const merged = { ...ex, ...patch, updatedAt: now() }
    db.prepare(
      `UPDATE notes SET title=@title, content=@content, workspaceId=@workspaceId, sourceUrl=@sourceUrl, updatedAt=@updatedAt WHERE id=@id`,
    ).run(merged)
  },
  remove(id: string) {
    db.prepare('DELETE FROM notes WHERE id = ?').run(id)
  },
  // Insert-or-update a full row (from cloud sync), last-write-wins on updatedAt.
  upsert(n: Note) {
    db.prepare(
      `INSERT INTO notes (id, workspaceId, title, content, sourceUrl, createdAt, updatedAt)
       VALUES (@id, @workspaceId, @title, @content, @sourceUrl, @createdAt, @updatedAt)
       ON CONFLICT(id) DO UPDATE SET
         workspaceId=excluded.workspaceId, title=excluded.title, content=excluded.content,
         sourceUrl=excluded.sourceUrl, updatedAt=excluded.updatedAt
       WHERE excluded.updatedAt > notes.updatedAt`,
    ).run(n)
  },
}

// --------------------------------------------------------------------------
// Session tabs (persisted for restore)
// --------------------------------------------------------------------------
export const sessionTabs = {
  list(): PersistedTab[] {
    return db.prepare('SELECT * FROM tabs ORDER BY position').all() as PersistedTab[]
  },
  replaceAll(tabs: Omit<PersistedTab, 'createdAt' | 'updatedAt'>[]) {
    const ts = now()
    const tx = db.transaction(() => {
      db.prepare('DELETE FROM tabs').run()
      const stmt = db.prepare(
        `INSERT INTO tabs (id, workspaceId, url, title, favicon, position, pinned, muted, lastActiveAt, createdAt, updatedAt)
         VALUES (@id, @workspaceId, @url, @title, @favicon, @position, @pinned, @muted, @lastActiveAt, @createdAt, @updatedAt)`,
      )
      tabs.forEach((t) => stmt.run({ ...t, createdAt: ts, updatedAt: ts }))
    })
    tx()
  },
}

// --------------------------------------------------------------------------
// Downloads
// --------------------------------------------------------------------------
export const downloads = {
  list(): DownloadItem[] {
    return db.prepare('SELECT * FROM downloads ORDER BY startedAt DESC').all() as DownloadItem[]
  },
  upsert(d: DownloadItem) {
    db.prepare(
      `INSERT INTO downloads (id, url, filename, path, status, receivedBytes, totalBytes, startedAt, completedAt)
       VALUES (@id, @url, @filename, @path, @status, @receivedBytes, @totalBytes, @startedAt, @completedAt)
       ON CONFLICT(id) DO UPDATE SET status=excluded.status, receivedBytes=excluded.receivedBytes,
         totalBytes=excluded.totalBytes, completedAt=excluded.completedAt`,
    ).run(d)
  },
  remove(id: string) {
    db.prepare('DELETE FROM downloads WHERE id = ?').run(id)
  },
  clearCompleted() {
    db.prepare("DELETE FROM downloads WHERE status = 'completed'").run()
  },
}

// --------------------------------------------------------------------------
// Site permissions
// --------------------------------------------------------------------------
export const permissions = {
  list(): SitePermission[] {
    return db.prepare('SELECT * FROM sitePermissions ORDER BY origin').all() as SitePermission[]
  },
  get(origin: string, permission: string): SitePermission | undefined {
    return db
      .prepare('SELECT * FROM sitePermissions WHERE origin = ? AND permission = ?')
      .get(origin, permission) as SitePermission | undefined
  },
  set(origin: string, permission: string, decision: 'allow' | 'deny' | 'ask') {
    const ts = now()
    db.prepare(
      `INSERT INTO sitePermissions (id, origin, permission, decision, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(origin, permission) DO UPDATE SET decision=excluded.decision, updatedAt=excluded.updatedAt`,
    ).run(uid(), origin, permission, decision, ts, ts)
  },
  remove(id: string) {
    db.prepare('DELETE FROM sitePermissions WHERE id = ?').run(id)
  },
}

export function clearBrowsingData(opts: { history?: boolean; downloads?: boolean }) {
  if (opts.history) history.clearAll()
  if (opts.downloads) db.prepare('DELETE FROM downloads').run()
}
