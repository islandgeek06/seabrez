import { WebContentsView, type BrowserWindow, type Rectangle } from 'electron'
import { history, sessionTabs } from '../db/database'

export interface TabManagerOptions {
  /** New tabs default to private (used by private windows). */
  defaultPrivate?: boolean
  /** In-memory session partition for private tabs in this window. */
  privatePartition?: string
}

export interface TabState {
  id: number
  url: string
  title: string
  favicon: string | null
  loading: boolean
  canGoBack: boolean
  canGoForward: boolean
  pinned: boolean
  muted: boolean
  workspaceId: string | null
  isPrivate: boolean
}

interface Tab extends TabState {
  view: WebContentsView
}

type Emit = (channel: string, payload: unknown) => void

export class TabManager {
  private win: BrowserWindow
  private emit: Emit
  private tabs: Tab[] = []
  private activeId: number | null = null
  private nextId = 1
  private bounds: Rectangle = { x: 56, y: 88, width: 800, height: 600 }
  private webVisible = true
  private closedStack: { url: string; workspaceId: string | null }[] = []
  private defaultPrivate: boolean
  private privatePartition: string
  private currentWorkspaceId: string | null = null
  private activeByWorkspace = new Map<string, number>()

  constructor(win: BrowserWindow, emit: Emit, opts: TabManagerOptions = {}) {
    this.win = win
    this.emit = emit
    this.defaultPrivate = opts.defaultPrivate ?? false
    this.privatePartition = opts.privatePartition ?? 'intelleson-private'
  }

  // ---- layout ----------------------------------------------------------
  setContentBounds(b: Rectangle) {
    this.bounds = b
    this.layout()
  }

  setWebVisible(visible: boolean) {
    this.webVisible = visible
    this.layout()
  }

  private layout() {
    for (const t of this.tabs) {
      const show = t.id === this.activeId && this.webVisible
      t.view.setVisible(show)
      if (show) t.view.setBounds(this.bounds)
    }
  }

  // ---- state push ------------------------------------------------------
  private snapshot(t: Tab): TabState {
    const { view: _view, ...state } = t
    return state
  }

  private pushList() {
    this.emit('tabs:list', {
      tabs: this.tabs.map((t) => this.snapshot(t)),
      activeId: this.activeId,
    })
  }

  private pushOne(t: Tab) {
    this.emit('tabs:updated', this.snapshot(t))
  }

  /** Current tabs + active id, for the renderer to sync on init (no event race). */
  getSnapshot() {
    return { tabs: this.tabs.map((t) => this.snapshot(t)), activeId: this.activeId }
  }

  // ---- lifecycle -------------------------------------------------------
  createTab(opts: {
    url?: string
    background?: boolean
    isPrivate?: boolean
    workspaceId?: string | null
  } = {}): number {
    const id = this.nextId++
    const isPrivate = opts.isPrivate ?? this.defaultPrivate
    const partition = isPrivate ? this.privatePartition : undefined
    const view = new WebContentsView({
      webPreferences: {
        sandbox: true,
        contextIsolation: true,
        nodeIntegration: false,
        ...(partition ? { partition } : {}),
      },
    })
    const tab: Tab = {
      id,
      view,
      url: opts.url ?? 'about:blank',
      title: 'New Tab',
      favicon: null,
      loading: Boolean(opts.url),
      canGoBack: false,
      canGoForward: false,
      pinned: false,
      muted: false,
      workspaceId: opts.workspaceId ?? this.currentWorkspaceId ?? null,
      isPrivate,
    }
    this.tabs.push(tab)
    this.win.contentView.addChildView(view)
    this.wire(tab)
    if (opts.url && opts.url !== 'about:blank') view.webContents.loadURL(opts.url).catch(() => {})
    // Push the list BEFORE activating so the renderer already knows this tab
    // (and its blank/loaded state) when it handles tabs:activated.
    this.pushList()
    if (!opts.background || this.activeId == null) this.setActive(id)
    return id
  }

  private wire(tab: Tab) {
    const wc = tab.view.webContents
    const update = () => {
      tab.url = wc.getURL()
      tab.title = wc.getTitle() || tab.title
      tab.loading = wc.isLoading()
      tab.canGoBack = wc.navigationHistory.canGoBack()
      tab.canGoForward = wc.navigationHistory.canGoForward()
      this.pushOne(tab)
    }
    wc.on('page-title-updated', () => {
      update()
      this.recordHistory(tab)
    })
    wc.on('did-navigate', () => {
      update()
      this.recordHistory(tab)
    })
    wc.on('did-navigate-in-page', update)
    wc.on('did-start-loading', update)
    wc.on('did-stop-loading', update)
    wc.on('page-favicon-updated', (_e, favicons) => {
      tab.favicon = favicons[0] ?? null
      this.pushOne(tab)
    })
    wc.on('found-in-page', (_e, result) => {
      this.emit('find:result', {
        tabId: tab.id,
        matches: result.matches,
        activeMatchOrdinal: result.activeMatchOrdinal,
      })
    })
    wc.setWindowOpenHandler(({ url }) => {
      this.createTab({ url, background: true, isPrivate: tab.isPrivate, workspaceId: tab.workspaceId })
      return { action: 'deny' }
    })
  }

  private recordHistory(tab: Tab) {
    if (tab.isPrivate) return
    const url = tab.view.webContents.getURL()
    if (!url || url === 'about:blank' || url.startsWith('data:')) return
    history.record({ url, title: tab.view.webContents.getTitle(), favicon: tab.favicon, workspaceId: tab.workspaceId })
  }

  setActive(id: number) {
    const tab = this.tabs.find((t) => t.id === id)
    if (!tab) return
    this.activeId = id
    this.webVisible = true
    if (tab.workspaceId) {
      this.currentWorkspaceId = tab.workspaceId
      this.activeByWorkspace.set(tab.workspaceId, id)
    }
    this.layout()
    this.emit('tabs:activated', { id })
  }

  // Switch the active browsing context to a workspace: show that workspace's
  // last-active tab (or its first), or hide the web view (→ home) if it has none.
  setActiveWorkspace(workspaceId: string) {
    this.currentWorkspaceId = workspaceId
    const remembered = this.activeByWorkspace.get(workspaceId)
    const target =
      remembered != null && this.tabs.some((t) => t.id === remembered && t.workspaceId === workspaceId)
        ? remembered
        : this.tabs.find((t) => t.workspaceId === workspaceId)?.id
    if (target != null) {
      this.setActive(target)
    } else {
      // No tabs in this workspace → open a fresh home tab so there's always one.
      this.createTab({ workspaceId })
    }
  }

  closeTab(id: number) {
    const idx = this.tabs.findIndex((t) => t.id === id)
    if (idx === -1) return
    const tab = this.tabs[idx]
    if (!tab.isPrivate && tab.url && tab.url !== 'about:blank') {
      this.closedStack.push({ url: tab.url, workspaceId: tab.workspaceId })
    }
    this.win.contentView.removeChildView(tab.view)
    ;(tab.view.webContents as unknown as { close?: () => void }).close?.()
    this.tabs.splice(idx, 1)
    // Always keep at least one tab (the home/new-tab page), like Chrome.
    if (this.tabs.length === 0) {
      this.activeId = null
      this.createTab({ workspaceId: this.currentWorkspaceId })
      return
    }
    if (this.activeId === id) {
      const next = this.tabs[idx] ?? this.tabs[idx - 1]
      this.activeId = next?.id ?? null
      if (next) this.setActive(next.id)
    }
    this.layout()
    this.pushList()
  }

  restoreClosed() {
    const last = this.closedStack.pop()
    if (last) this.createTab({ url: last.url, workspaceId: last.workspaceId })
  }

  duplicate(id: number) {
    const t = this.tabById(id)
    if (t) this.createTab({ url: t.url, isPrivate: t.isPrivate, workspaceId: t.workspaceId })
  }

  setPinned(id: number, value: boolean) {
    const t = this.tabById(id)
    if (t) {
      t.pinned = value
      this.pushOne(t)
    }
  }

  setMuted(id: number, value: boolean) {
    const t = this.tabById(id)
    if (t) {
      t.muted = value
      t.view.webContents.setAudioMuted(value)
      this.pushOne(t)
    }
  }

  moveToWorkspace(id: number, workspaceId: string | null) {
    const t = this.tabById(id)
    if (t) {
      t.workspaceId = workspaceId
      this.pushOne(t)
    }
  }

  reorder(id: number, toIndex: number) {
    const from = this.tabs.findIndex((t) => t.id === id)
    if (from === -1) return
    const [t] = this.tabs.splice(from, 1)
    this.tabs.splice(Math.max(0, Math.min(toIndex, this.tabs.length)), 0, t)
    this.pushList()
  }

  // ---- navigation ------------------------------------------------------
  private withActive(fn: (t: Tab) => void) {
    const t = this.activeId != null ? this.tabById(this.activeId) : undefined
    if (t) fn(t)
  }

  load(url: string) {
    this.withActive((t) => {
      t.view.webContents.loadURL(url).catch(() => {})
    })
  }
  back() {
    this.withActive((t) => t.view.webContents.navigationHistory.canGoBack() && t.view.webContents.navigationHistory.goBack())
  }
  forward() {
    this.withActive((t) => t.view.webContents.navigationHistory.canGoForward() && t.view.webContents.navigationHistory.goForward())
  }
  reload() {
    this.withActive((t) => t.view.webContents.reload())
  }
  stop() {
    this.withActive((t) => t.view.webContents.stop())
  }

  // ---- find in page ----------------------------------------------------
  find(text: string, opts: { forward?: boolean; matchCase?: boolean; findNext?: boolean }) {
    this.withActive((t) => {
      if (!text) return
      t.view.webContents.findInPage(text, {
        forward: opts.forward ?? true,
        matchCase: opts.matchCase ?? false,
        findNext: opts.findNext ?? false,
      })
    })
  }
  stopFind() {
    this.withActive((t) => t.view.webContents.stopFindInPage('clearSelection'))
  }

  // ---- helpers ---------------------------------------------------------
  tabById(id: number) {
    return this.tabs.find((t) => t.id === id)
  }

  activeWebContents() {
    return this.activeId != null ? this.tabById(this.activeId)?.view.webContents : undefined
  }

  webContentsFor(id: number) {
    return this.tabById(id)?.view.webContents
  }

  // ---- session persistence --------------------------------------------
  persistSession() {
    const now = Date.now()
    const persistable = this.tabs
      .filter((t) => !t.isPrivate && t.url && t.url !== 'about:blank')
      .map((t, i) => ({
        id: String(t.id),
        workspaceId: t.workspaceId,
        url: t.url,
        title: t.title,
        favicon: t.favicon,
        position: i,
        pinned: t.pinned ? 1 : 0,
        muted: t.muted ? 1 : 0,
        lastActiveAt: now,
      }))
    sessionTabs.replaceAll(persistable)
  }

  restoreSession(): boolean {
    const saved = sessionTabs.list()
    if (saved.length === 0) return false
    for (const s of saved) {
      this.createTab({ url: s.url, background: true, workspaceId: s.workspaceId })
    }
    if (this.tabs[0]) this.setActive(this.tabs[0].id)
    return true
  }
}
