import { app, BrowserWindow, session } from 'electron'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { initDatabase, closeDatabase } from './db/database'
import { getSettings } from './services/settings'
import { installPermissionHandlers } from './security/permissions'
import { DownloadManager } from './browser/downloads'
import { AiService } from './ai/service'
import { WindowManager } from './browser/window-manager'
import { registerIpc } from './ipc/handlers'
import { initUpdater } from './services/updater'
import { logger } from './services/logger'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL']
const RENDERER_DIST = path.join(__dirname, '../dist')
const PRELOAD = path.join(__dirname, 'preload.mjs')

let windows: WindowManager | null = null

// Minimal built-in tracker/ad blocklist for the shared (normal) web session.
const BLOCKLIST = [
  'doubleclick.net',
  'googlesyndication.com',
  'google-analytics.com',
  'adservice.google.com',
  'analytics.tiktok.com',
  'ads.yahoo.com',
]

function applyWebSessionDefaults() {
  const sess = session.defaultSession
  // IMPORTANT: pass a URL filter so the callback ONLY runs for blocked domains.
  // An unfiltered onBeforeRequest routes every request through the main process
  // and kills Chromium's network fast-path (makes all pages feel laggy).
  const blockPatterns = BLOCKLIST.flatMap((d) => [`*://${d}/*`, `*://*.${d}/*`])
  sess.webRequest.onBeforeRequest({ urls: blockPatterns }, (_details, cb) => cb({ cancel: true }))
  installPermissionHandlers(sess)
}

app.whenReady().then(async () => {
  try {
    await initDatabase()
  } catch (e) {
    logger.error('db-init', (e as Error).message)
  }
  applyWebSessionDefaults()

  const ai = new AiService()
  // Downloads broadcast to every window (download data is global).
  const downloads = new DownloadManager((channel, payload) => windows?.broadcast(channel, payload))

  windows = new WindowManager({
    preload: PRELOAD,
    devUrl: VITE_DEV_SERVER_URL,
    rendererDist: RENDERER_DIST,
    downloads,
  })

  // Normal downloads on the shared session.
  downloads.install(session.defaultSession, () => getSettings().downloadDir)

  registerIpc({ windows, downloads, ai })

  // Background auto-updates from GitHub releases; notifies the renderer.
  initUpdater((channel, payload) => windows?.broadcast(channel, payload))

  windows.createWindow({ isPrivate: false })

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) windows?.createWindow({ isPrivate: false })
  })
})

app.on('before-quit', () => {
  windows?.persistAll()
  closeDatabase()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
