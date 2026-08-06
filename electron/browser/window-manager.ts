import { BrowserWindow, session, shell, type WebContents } from 'electron'
import { TabManager } from './tabs'
import { DownloadManager } from './downloads'
import { installPermissionHandlers } from '../security/permissions'
import { installContextMenu } from './context-menu'
import { getSettings } from '../services/settings'
import { logger, diag } from '../services/logger'

export interface AppWindow {
  id: number
  win: BrowserWindow
  tabs: TabManager
  isPrivate: boolean
}

interface Config {
  preload: string
  devUrl?: string
  rendererDist: string
  downloads: DownloadManager
}

// Owns every browser window. Each window has its own TabManager; private windows
// additionally get their own in-memory session partition so they are isolated
// from normal browsing AND from each other. IPC handlers resolve the correct
// window via `managerFor(event.sender)`.
export class WindowManager {
  private cfg: Config
  private windows = new Map<number, AppWindow>()
  private restoredOnce = false

  constructor(cfg: Config) {
    this.cfg = cfg
  }

  broadcast(channel: string, payload: unknown) {
    for (const { win } of this.windows.values()) {
      if (!win.isDestroyed()) win.webContents.send(channel, payload)
    }
  }

  managerFor(sender: WebContents): TabManager | undefined {
    return this.entryFor(sender)?.tabs
  }

  entryFor(sender: WebContents): AppWindow | undefined {
    const win = BrowserWindow.fromWebContents(sender)
    return win ? this.windows.get(win.id) : undefined
  }

  count() {
    return this.windows.size
  }

  createWindow(opts: { isPrivate?: boolean } = {}): AppWindow {
    const isPrivate = Boolean(opts.isPrivate)
    const win = new BrowserWindow({
      width: 1440,
      height: 920,
      minWidth: 960,
      minHeight: 640,
      backgroundColor: isPrivate ? '#171226' : '#0e0f13',
      autoHideMenuBar: true,
      titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
      webPreferences: {
        preload: this.cfg.preload,
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: false,
        spellcheck: true,
      },
    })

    // Private windows get a unique, ephemeral (in-memory) session partition.
    const privatePartition = isPrivate ? `intelleson-private-${win.id}-${Date.now()}` : undefined
    if (privatePartition) {
      const sess = session.fromPartition(privatePartition)
      installPermissionHandlers(sess)
      this.cfg.downloads.install(sess, () => getSettings().downloadDir)
    }

    const emit = (channel: string, payload: unknown) => {
      if (!win.isDestroyed()) win.webContents.send(channel, payload)
    }
    const tabs = new TabManager(win, emit, { defaultPrivate: isPrivate, privatePartition })
    const entry: AppWindow = { id: win.id, win, tabs, isPrivate }
    this.windows.set(win.id, entry)

    // Right-click copy/paste/select-all in the app UI's own inputs (omnibox,
    // notes editor, AI chat, search fields).
    installContextMenu(win.webContents)

    // Diagnostics: prove whether the preload actually loaded and exposed the API.
    win.webContents.on('preload-error', (_e, preloadPath, error) =>
      diag(`preload-error ${preloadPath} :: ${error.message}`),
    )
    win.webContents.once('did-finish-load', () => {
      win.webContents
        .executeJavaScript('typeof window.intelleson')
        .then((t) => diag(`window.intelleson type = ${t} (preload=${this.cfg.preload})`))
        .catch(() => {})
    })

    win.webContents.once('did-finish-load', () => {
      const settings = getSettings()
      // Only the first normal window restores the saved session.
      let restored = false
      if (!isPrivate && !this.restoredOnce && settings.restoreSession) {
        this.restoredOnce = true
        restored = tabs.restoreSession()
      }
      // Always start with a tab (the home/new-tab page) so the strip is never
      // empty and the "+" isn't sitting alone.
      if (!restored) tabs.createTab({})
      emit('app:ready', { settings, isPrivate })
    })

    // F12 / Ctrl+Shift+I while the app UI (not a page) has focus → open the
    // active tab's page DevTools, like a normal browser.
    win.webContents.on('before-input-event', (event, input) => {
      if (input.type !== 'keyDown') return
      const mod = input.control || input.meta
      const key = (input.key || '').toLowerCase()
      if (key === 'f12' || (mod && input.shift && key === 'i')) {
        event.preventDefault()
        tabs.toggleDevTools()
      }
    })

    // Lock the app-UI renderer: no navigation away, no popups.
    win.webContents.on('will-navigate', (e, url) => {
      if (url !== win.webContents.getURL()) e.preventDefault()
    })
    win.webContents.setWindowOpenHandler(({ url }) => {
      if (/^https?:\/\//i.test(url)) tabs.createTab({ url })
      else if (url) shell.openExternal(url)
      return { action: 'deny' }
    })

    win.on('close', () => {
      // Persist session only for normal windows.
      if (!isPrivate) {
        try {
          tabs.persistSession()
        } catch (e) {
          logger.error('session-persist', (e as Error).message)
        }
      }
    })
    win.on('closed', () => this.windows.delete(win.id))

    if (this.cfg.devUrl) win.loadURL(this.cfg.devUrl)
    else win.loadFile(`${this.cfg.rendererDist}/index.html`)

    return entry
  }

  persistAll() {
    for (const { tabs, isPrivate } of this.windows.values()) {
      if (!isPrivate) {
        try {
          tabs.persistSession()
        } catch {
          /* ignore */
        }
      }
    }
  }
}
