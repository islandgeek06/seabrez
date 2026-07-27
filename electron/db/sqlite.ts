// A minimal better-sqlite3-compatible synchronous wrapper built on sql.js
// (SQLite compiled to WebAssembly). This lets the whole data layer use the
// familiar `.prepare().get/all/run`, `.exec`, `.pragma`, `.transaction` API
// while requiring ZERO native compilation — the app runs on any machine
// without Visual Studio / build tools.
//
// See docs/architecture-decisions.md (ADR-0002) for why we chose sql.js over
// better-sqlite3 in this environment.
import initSqlJs, { type Database as WasmDb, type SqlJsStatic } from 'sql.js'
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)

// Mirrors better-sqlite3's binding: either variadic positional args
// (`.run(a, b, c)`) or a single named-params object (`.run(row)`), where the
// SQL uses `@name` placeholders.
function normalizeParams(args: unknown[]): Record<string, unknown> | unknown[] {
  if (args.length === 0) return []
  const first = args[0]
  const isNamed =
    args.length === 1 &&
    typeof first === 'object' &&
    first !== null &&
    !Array.isArray(first)
  if (isNamed) {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(first as Record<string, unknown>)) out['@' + k] = v
    return out
  }
  // Single array argument is still positional; otherwise the spread args.
  if (args.length === 1 && Array.isArray(first)) return first as unknown[]
  return args
}

export interface Statement {
  get(...params: unknown[]): unknown
  all(...params: unknown[]): unknown[]
  run(...params: unknown[]): void
}

export class SqliteDatabase {
  private db: WasmDb
  private file: string
  private saveTimer: NodeJS.Timeout | null = null

  constructor(db: WasmDb, file: string) {
    this.db = db
    this.file = file
  }

  prepare(sql: string): Statement {
    const db = this.db
    const persist = () => this.scheduleSave()
    return {
      get(...params: unknown[]) {
        const stmt = db.prepare(sql)
        try {
          stmt.bind(normalizeParams(params) as never)
          if (stmt.step()) return stmt.getAsObject()
          return undefined
        } finally {
          stmt.free()
        }
      },
      all(...params: unknown[]) {
        const stmt = db.prepare(sql)
        const rows: unknown[] = []
        try {
          stmt.bind(normalizeParams(params) as never)
          while (stmt.step()) rows.push(stmt.getAsObject())
          return rows
        } finally {
          stmt.free()
        }
      },
      run(...params: unknown[]) {
        const stmt = db.prepare(sql)
        try {
          stmt.bind(normalizeParams(params) as never)
          stmt.step()
        } finally {
          stmt.free()
        }
        persist()
      },
    }
  }

  exec(sql: string): void {
    this.db.run(sql)
    this.scheduleSave()
  }

  /** Supports `pragma('user_version', {simple:true})` reads and `pragma('user_version = N')` writes. */
  pragma(source: string, opts?: { simple?: boolean }): unknown {
    const trimmed = source.trim()
    if (trimmed.includes('=')) {
      this.db.run(`PRAGMA ${trimmed}`)
      this.scheduleSave()
      return undefined
    }
    const res = this.db.exec(`PRAGMA ${trimmed}`)
    const value = res[0]?.values?.[0]?.[0]
    return opts?.simple ? value : value
  }

  transaction<T>(fn: () => T): () => T {
    return () => {
      this.db.run('BEGIN')
      try {
        const result = fn()
        this.db.run('COMMIT')
        this.scheduleSave()
        return result
      } catch (e) {
        this.db.run('ROLLBACK')
        throw e
      }
    }
  }

  /** Debounced write of the in-memory DB image to disk. */
  private scheduleSave() {
    if (this.saveTimer) return
    this.saveTimer = setTimeout(() => {
      this.saveTimer = null
      this.saveNow()
    }, 250)
  }

  saveNow() {
    try {
      const data = this.db.export()
      fs.writeFileSync(this.file, Buffer.from(data))
    } catch {
      /* best-effort persistence */
    }
  }

  close() {
    if (this.saveTimer) clearTimeout(this.saveTimer)
    this.saveNow()
    this.db.close()
  }
}

let SQL: SqlJsStatic | null = null

/** Load sql.js once, reading the wasm binary from node_modules (works in asar). */
export async function openDatabase(file: string): Promise<SqliteDatabase> {
  if (!SQL) {
    const wasmPath = path.join(path.dirname(require.resolve('sql.js')), 'sql-wasm.wasm')
    const buf = fs.readFileSync(wasmPath)
    const wasmBinary = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength)
    SQL = await initSqlJs({ wasmBinary })
  }
  const existing = fs.existsSync(file) ? new Uint8Array(fs.readFileSync(file)) : undefined
  const db = existing ? new SQL.Database(existing) : new SQL.Database()
  db.run('PRAGMA foreign_keys = ON')
  return new SqliteDatabase(db, file)
}
