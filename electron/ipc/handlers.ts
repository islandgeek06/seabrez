import { ipcMain, shell, dialog, app, BrowserWindow } from 'electron'
import { z } from 'zod'
import { S } from './schemas'
import {
  bookmarks,
  downloads as downloadsRepo,
  history,
  notes,
  permissions as permRepo,
  workspaces,
} from '../db/database'
import { getSettings, updateSettings } from '../services/settings'
import { hasApiKey, setApiKey } from '../security/keystore'
import { webSearch, validateSearchKey } from '../browser/search'
import { extractPage } from '../ai/extract'
import type { TabManager } from '../browser/tabs'
import type { DownloadManager } from '../browser/downloads'
import type { AiService } from '../ai/service'
import type { WindowManager } from '../browser/window-manager'
import type { AiStreamEvent } from '../../shared/types'
import { logger } from '../services/logger'

export interface IpcContext {
  windows: WindowManager
  downloads: DownloadManager
  ai: AiService
}

/** Register an invoke handler; validate the payload against `schema` first. */
function handle<T>(
  channel: string,
  schema: z.ZodType<T> | null,
  fn: (arg: T, event: Electron.IpcMainInvokeEvent) => unknown,
) {
  ipcMain.handle(channel, (event, raw) => {
    try {
      const arg = schema ? schema.parse(raw) : (raw as T)
      return fn(arg, event)
    } catch (err) {
      logger.error('ipc', channel, (err as Error).message)
      throw err
    }
  })
}

export function registerIpc(ctx: IpcContext) {
  const { windows, downloads, ai } = ctx

  // Resolve the TabManager for the window that sent an IPC message.
  const tabsFor = (e: Electron.IpcMainInvokeEvent): TabManager | undefined =>
    windows.managerFor(e.sender)
  // Convenience: run a fn with the sender's TabManager (no-op if not found).
  const withTabs = (e: Electron.IpcMainInvokeEvent, fn: (t: TabManager) => unknown) => {
    const t = tabsFor(e)
    return t ? fn(t) : undefined
  }

  // ---- settings ----
  handle('settings:get', null, () => getSettings())
  handle('settings:set', S.settingsPatch, (patch) => updateSettings(patch as never))

  // ---- workspaces ----
  handle('workspaces:list', null, () => workspaces.list())
  handle('workspaces:create', S.workspaceCreate, (w) => workspaces.create(w))
  handle('workspaces:update', S.workspaceUpdate, ({ id, ...patch }) => {
    workspaces.update(id, patch)
    return workspaces.list()
  })
  handle('workspaces:remove', S.id, (id) => {
    workspaces.remove(id)
    return workspaces.list()
  })

  // ---- tabs ----
  handle('tabs:create', S.tabCreate, (o, e) => tabsFor(e)?.createTab(o))
  handle('tabs:close', S.tabId, ({ id }, e) => withTabs(e, (t) => t.closeTab(id)))
  handle('tabs:activate', S.tabId, ({ id }, e) => withTabs(e, (t) => t.setActive(id)))
  handle('tabs:duplicate', S.tabId, ({ id }, e) => withTabs(e, (t) => t.duplicate(id)))
  handle('tabs:restoreClosed', null, (_a, e) => withTabs(e, (t) => t.restoreClosed()))
  handle('tabs:setPinned', S.tabBool, ({ id, value }, e) => withTabs(e, (t) => t.setPinned(id, value)))
  handle('tabs:setMuted', S.tabBool, ({ id, value }, e) => withTabs(e, (t) => t.setMuted(id, value)))
  handle('tabs:reorder', S.tabReorder, ({ id, toIndex }, e) => withTabs(e, (t) => t.reorder(id, toIndex)))
  handle('tabs:moveToWorkspace', S.tabMoveWorkspace, ({ id, workspaceId }, e) =>
    withTabs(e, (t) => t.moveToWorkspace(id, workspaceId)),
  )

  // ---- navigation ----
  handle('nav:load', S.navLoad, ({ url }, e) => withTabs(e, (t) => t.load(url)))
  handle('nav:back', null, (_a, e) => withTabs(e, (t) => t.back()))
  handle('nav:forward', null, (_a, e) => withTabs(e, (t) => t.forward()))
  handle('nav:reload', null, (_a, e) => withTabs(e, (t) => t.reload()))
  handle('nav:stop', null, (_a, e) => withTabs(e, (t) => t.stop()))

  // ---- layout / view ----
  handle(
    'view:setContentBounds',
    z.object({ x: z.number(), y: z.number(), width: z.number(), height: z.number() }),
    (b, e) => withTabs(e, (t) => t.setContentBounds(b)),
  )
  handle('view:setWebVisible', z.object({ visible: z.boolean() }), ({ visible }, e) =>
    withTabs(e, (t) => t.setWebVisible(visible)),
  )

  // ---- find in page ----
  handle('find:start', S.findStart, (o, e) => withTabs(e, (t) => t.find(o.text, o)))
  handle('find:stop', null, (_a, e) => withTabs(e, (t) => t.stopFind()))

  // ---- bookmarks ----
  handle('bookmarks:list', null, () => bookmarks.list())
  handle('bookmarks:create', S.bookmarkCreate, (b) => bookmarks.create(b))
  handle('bookmarks:update', S.bookmarkUpdate, ({ id, ...patch }) => bookmarks.update(id, patch))
  handle('bookmarks:remove', S.id, (id) => bookmarks.remove(id))
  handle('bookmarks:createFolder', S.folderCreate, ({ name, parentId }) =>
    bookmarks.createFolder(name, parentId ?? null),
  )
  handle('bookmarks:removeFolder', S.id, (id) => bookmarks.removeFolder(id))
  handle('bookmarks:isBookmarked', S.navLoad, ({ url }) => bookmarks.isBookmarked(url))
  handle('bookmarks:exportHtml', null, () => exportBookmarksHtml())

  // ---- history ----
  handle('history:search', S.historySearch, ({ query }) => history.search(query ?? ''))
  handle('history:remove', S.id, (id) => history.remove(id))
  handle('history:clear', S.historyClear, ({ range }) => {
    if (range === 'all') return history.clearAll()
    const map = { hour: 3600e3, day: 86400e3, week: 7 * 86400e3, month: 30 * 86400e3 }
    history.clearSince(Date.now() - map[range])
  })

  // ---- notes ----
  handle('notes:list', S.noteQuery, ({ query }) => notes.list(query ?? ''))
  handle('notes:create', S.noteCreate, (n) => notes.create(n))
  handle('notes:update', S.noteUpdate, ({ id, ...patch }) => notes.update(id, patch))
  handle('notes:remove', S.id, (id) => notes.remove(id))

  // ---- downloads ----
  handle('downloads:list', null, () => downloadsRepo.list())
  handle('downloads:remove', S.id, (id) => downloadsRepo.remove(id))
  handle('downloads:clearCompleted', null, () => downloadsRepo.clearCompleted())
  handle('downloads:pause', S.id, (id) => downloads.pause(id))
  handle('downloads:resume', S.id, (id) => downloads.resume(id))
  handle('downloads:cancel', S.id, (id) => downloads.cancel(id))
  handle('downloads:open', S.navLoad, ({ url: filePath }) => downloads.openFile(filePath))
  handle('downloads:showInFolder', S.navLoad, ({ url: filePath }) =>
    downloads.showInFolder(filePath),
  )

  // ---- permissions ----
  handle('permissions:list', null, () => permRepo.list())
  handle('permissions:set', S.permissionSet, ({ origin, permission, decision }) =>
    permRepo.set(origin, permission, decision),
  )
  handle('permissions:remove', S.id, (id) => permRepo.remove(id))

  // ---- AI ----
  handle('ai:chat', S.aiChat, (req, e) => {
    const sender = e.sender
    void ai.chat(req, (event: AiStreamEvent) => {
      if (!sender.isDestroyed()) sender.send('ai:stream', event)
    })
    return { started: true }
  })
  handle('ai:cancel', S.requestId, ({ requestId }) => ai.cancel(requestId))
  handle('ai:listModels', S.aiProvider, (p) => ai.listModels(p))
  handle('ai:validate', S.aiProvider, (p) => ai.validate(p))
  handle('ai:hasKey', S.aiProvider, (p) => hasApiKey(p))
  handle('ai:setKey', S.aiSetKey, ({ provider, key }) => {
    setApiKey(provider, key)
    return { ok: hasApiKey(provider) }
  })
  handle('ai:extractPage', z.object({ tabId: z.number().int().optional() }).optional(), async (arg, e) => {
    const tabs = tabsFor(e)
    if (!tabs) return null
    const wc = arg?.tabId != null ? tabs.webContentsFor(arg.tabId) : tabs.activeWebContents()
    if (!wc) return null
    return extractPage(wc)
  })
  handle(
    'ai:extractTabs',
    z.object({ tabIds: z.array(z.number().int()).max(6) }),
    async ({ tabIds }, e) => {
      const tabs = tabsFor(e)
      if (!tabs) return []
      const out = []
      for (const id of tabIds) {
        const wc = tabs.webContentsFor(id)
        if (wc) out.push(await extractPage(wc))
      }
      return out
    },
  )

  // ---- web search (Brave) ----
  handle('search:web', S.searchWeb, ({ query }) => webSearch(query))
  handle('search:setKey', S.searchSetKey, ({ key }) => {
    setApiKey('brave', key)
    return { ok: hasApiKey('brave') }
  })
  handle('search:hasKey', null, () => hasApiKey('brave'))
  handle('search:validate', null, () => validateSearchKey())

  // ---- cloud sync: apply pulled rows into local SQLite (last-write-wins) ----
  handle('sync:applyBookmarks', S.syncBookmarks, ({ rows }) => {
    for (const r of rows) bookmarks.upsert(r)
    return { applied: rows.length }
  })
  handle('sync:applyNotes', S.syncNotes, ({ rows }) => {
    for (const r of rows) notes.upsert(r)
    return { applied: rows.length }
  })
  // All local rows incl. tombstones, so the pusher can propagate deletes.
  handle('sync:allBookmarks', null, () => bookmarks.listAllForSync())
  handle('sync:allNotes', null, () => notes.listAllForSync())

  // ---- window controls ----
  handle('window:minimize', null, (_a, e) => BrowserWindow.fromWebContents(e.sender)?.minimize())
  handle('window:maximize', null, (_a, e) => {
    const w = BrowserWindow.fromWebContents(e.sender)
    if (w?.isMaximized()) w.unmaximize()
    else w?.maximize()
  })
  handle('window:close', null, (_a, e) => BrowserWindow.fromWebContents(e.sender)?.close())
  handle('window:new', null, () => {
    windows.createWindow({ isPrivate: false })
  })
  handle('window:newPrivate', null, () => {
    windows.createWindow({ isPrivate: true })
  })

  // ---- app / misc ----
  handle('app:version', null, () => app.getVersion())
  handle('app:openExternal', S.openExternal, ({ url }) => {
    if (/^https?:\/\//i.test(url)) shell.openExternal(url)
  })
  handle('app:chooseDownloadDir', null, async (_a, e) => {
    const w = BrowserWindow.fromWebContents(e.sender)!
    const res = await dialog.showOpenDialog(w, { properties: ['openDirectory'] })
    if (res.canceled) return null
    updateSettings({ downloadDir: res.filePaths[0] })
    return res.filePaths[0]
  })
  handle('app:clearData', S.clearData, (opts) => {
    if (opts.history) history.clearAll()
    if (opts.downloads) downloadsRepo.clearCompleted()
    return { ok: true }
  })
}

function exportBookmarksHtml(): string {
  const { items } = bookmarks.list()
  const rows = items
    .map((b) => `    <DT><A HREF="${escapeHtml(b.url)}">${escapeHtml(b.title)}</A>`)
    .join('\n')
  return `<!DOCTYPE NETSCAPE-Bookmark-file-1>\n<TITLE>Bookmarks</TITLE>\n<H1>Bookmarks</H1>\n<DL><p>\n${rows}\n</DL><p>\n`
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!)
}
