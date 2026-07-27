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
