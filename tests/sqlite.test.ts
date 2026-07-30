import { describe, it, expect, afterAll } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { openDatabase } from '../electron/db/sqlite'
import { MIGRATIONS } from '../electron/db/migrations'

const file = path.join(os.tmpdir(), `intelleson-test-${Date.now()}.db`)

afterAll(() => {
  try {
    fs.unlinkSync(file)
  } catch {
    /* ignore */
  }
})

describe('sqlite shim + migrations', () => {
  it('applies the schema and supports named + positional params, pragma, and persistence', async () => {
    const db = await openDatabase(file)

    // Run the initial migration and bump user_version.
    db.exec(MIGRATIONS[0].sql)
    db.pragma(`user_version = ${MIGRATIONS[0].version}`)
    expect(db.pragma('user_version', { simple: true })).toBe(1)

    // Named-object binding (@col).
    db.prepare(
      `INSERT INTO workspaces (id, name, icon, color, position, createdAt, updatedAt)
       VALUES (@id, @name, @icon, @color, @position, @createdAt, @updatedAt)`,
    ).run({ id: 'w1', name: 'Work', icon: '💼', color: '#000', position: 0, createdAt: 1, updatedAt: 1 })

    // Positional binding.
    const row = db.prepare('SELECT * FROM workspaces WHERE id = ?').get('w1') as { name: string }
    expect(row.name).toBe('Work')

    const all = db.prepare('SELECT * FROM workspaces').all() as unknown[]
    expect(all).toHaveLength(1)

    db.saveNow()
    db.close()

    // Reopen and confirm data persisted to disk.
    const db2 = await openDatabase(file)
    const again = db2.prepare('SELECT COUNT(*) AS c FROM workspaces').get() as { c: number }
    expect(again.c).toBe(1)
    db2.close()
  })
})

describe('delete-sync: tombstones + last-write-wins', () => {
  const f2 = path.join(os.tmpdir(), `intelleson-tomb-${Date.now()}.db`)
  afterAll(() => {
    try {
      fs.unlinkSync(f2)
    } catch {
      /* ignore */
    }
  })

  it('applies all migrations, soft-deletes, and honors LWW on the deleted flag', async () => {
    const db = await openDatabase(f2)
    for (const m of MIGRATIONS) {
      db.exec(m.sql)
      db.pragma(`user_version = ${m.version}`)
    }
    // Migration 2 added the column.
    const cols = (db.prepare('PRAGMA table_info(bookmarks)').all() as { name: string }[]).map(
      (c) => c.name,
    )
    expect(cols).toContain('deleted')

    const ins = db.prepare(
      `INSERT INTO bookmarks (id, folderId, workspaceId, title, url, favicon, pinned, position, createdAt, updatedAt, deleted)
       VALUES (@id,@folderId,@workspaceId,@title,@url,@favicon,@pinned,@position,@createdAt,@updatedAt,@deleted)`,
    )
    ins.run({ id: 'b1', folderId: null, workspaceId: null, title: 'A', url: 'https://a.com', favicon: null, pinned: 0, position: 0, createdAt: 1, updatedAt: 10, deleted: 0 })

    // Soft delete → hidden from the live list, present in the full sync list.
    db.prepare('UPDATE bookmarks SET deleted = 1, updatedAt = ? WHERE id = ?').run(20, 'b1')
    expect((db.prepare('SELECT COUNT(*) c FROM bookmarks WHERE deleted = 0').get() as { c: number }).c).toBe(0)
    expect((db.prepare('SELECT COUNT(*) c FROM bookmarks').get() as { c: number }).c).toBe(1)

    // Incoming OLDER remote copy (updatedAt=15 < 20) must NOT resurrect it.
    const upsert = db.prepare(
      `INSERT INTO bookmarks (id, folderId, workspaceId, title, url, favicon, pinned, position, createdAt, updatedAt, deleted)
       VALUES (@id,@folderId,@workspaceId,@title,@url,@favicon,@pinned,@position,@createdAt,@updatedAt,@deleted)
       ON CONFLICT(id) DO UPDATE SET deleted=excluded.deleted, updatedAt=excluded.updatedAt
       WHERE excluded.updatedAt > bookmarks.updatedAt`,
    )
    upsert.run({ id: 'b1', folderId: null, workspaceId: null, title: 'A', url: 'https://a.com', favicon: null, pinned: 0, position: 0, createdAt: 1, updatedAt: 15, deleted: 0 })
    expect((db.prepare('SELECT deleted FROM bookmarks WHERE id = ?').get('b1') as { deleted: number }).deleted).toBe(1)

    // Incoming NEWER copy (updatedAt=30) that un-deletes wins.
    upsert.run({ id: 'b1', folderId: null, workspaceId: null, title: 'A', url: 'https://a.com', favicon: null, pinned: 0, position: 0, createdAt: 1, updatedAt: 30, deleted: 0 })
    expect((db.prepare('SELECT deleted FROM bookmarks WHERE id = ?').get('b1') as { deleted: number }).deleted).toBe(0)
    db.close()
  })
})
