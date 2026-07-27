import { app } from 'electron'
import fs from 'node:fs'
import path from 'node:path'

// Structured local logging. Never logs secrets, full prompts, or form contents.
// In development, also mirrors to the console.

type Level = 'debug' | 'info' | 'warn' | 'error'

const LEVELS: Record<Level, number> = { debug: 0, info: 1, warn: 2, error: 3 }
const MIN_LEVEL: Level = (process.env.LOG_LEVEL as Level) || 'info'
const REDACT = /(api[_-]?key|authorization|password|token|secret)/i

let logFile = ''
function file(): string {
  if (!logFile) {
    try {
      const dir = app.getPath('logs')
      fs.mkdirSync(dir, { recursive: true })
      logFile = path.join(dir, 'intelleson.log')
    } catch {
      logFile = ''
    }
  }
  return logFile
}

function redact(parts: unknown[]): string {
  return parts
    .map((p) => {
      const s = typeof p === 'string' ? p : safeStringify(p)
      return REDACT.test(s) ? '[redacted]' : s
    })
    .join(' ')
}

function safeStringify(v: unknown): string {
  try {
    return JSON.stringify(v)
  } catch {
    return String(v)
  }
}

function write(level: Level, event: string, parts: unknown[]) {
  if (LEVELS[level] < LEVELS[MIN_LEVEL]) return
  const line = `${new Date().toISOString()} [${level}] [${process.type}] ${event} ${redact(parts)}`
  if (!app.isPackaged) {
    // eslint-disable-next-line no-console
    console[level === 'debug' ? 'log' : level](line)
  }
  const f = file()
  if (f) {
    try {
      fs.appendFileSync(f, line + '\n')
    } catch {
      /* ignore */
    }
  }
}

export const logger = {
  debug: (event: string, ...parts: unknown[]) => write('debug', event, parts),
  info: (event: string, ...parts: unknown[]) => write('info', event, parts),
  warn: (event: string, ...parts: unknown[]) => write('warn', event, parts),
  error: (event: string, ...parts: unknown[]) => write('error', event, parts),
  logPath: () => file(),
}

// Always-on diagnostic line written to a fixed file under userData, used to
// confirm startup wiring (e.g. preload loading) even when console output isn't
// captured.
export function diag(msg: string) {
  try {
    const p = path.join(app.getPath('userData'), 'diag.log')
    fs.appendFileSync(p, `${new Date().toISOString()} ${msg}\n`)
  } catch {
    /* ignore */
  }
}
