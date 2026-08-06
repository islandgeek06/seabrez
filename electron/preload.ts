import { contextBridge, ipcRenderer } from 'electron'

// The single audited bridge between the untrusted-capable renderer and the main
// process. Every method maps to a validated ipcMain handler. No Node, no raw
// ipcRenderer, no arbitrary channel access is exposed.
const invoke = (channel: string, arg?: unknown) => ipcRenderer.invoke(channel, arg)

const api = {
  isElectron: true,

  settings: {
    get: () => invoke('settings:get'),
    set: (patch: Record<string, unknown>) => invoke('settings:set', patch),
  },
  workspaces: {
    list: () => invoke('workspaces:list'),
    create: (w: unknown) => invoke('workspaces:create', w),
    update: (w: unknown) => invoke('workspaces:update', w),
    remove: (id: string) => invoke('workspaces:remove', id),
  },
  tabs: {
    get: () => invoke('tabs:get'),
    create: (o: unknown = {}) => invoke('tabs:create', o),
    close: (id: number) => invoke('tabs:close', { id }),
    activate: (id: number) => invoke('tabs:activate', { id }),
    duplicate: (id: number) => invoke('tabs:duplicate', { id }),
    restoreClosed: () => invoke('tabs:restoreClosed'),
    setPinned: (id: number, value: boolean) => invoke('tabs:setPinned', { id, value }),
    setMuted: (id: number, value: boolean) => invoke('tabs:setMuted', { id, value }),
    reorder: (id: number, toIndex: number) => invoke('tabs:reorder', { id, toIndex }),
    moveToWorkspace: (id: number, workspaceId: string | null) =>
      invoke('tabs:moveToWorkspace', { id, workspaceId }),
    setWorkspace: (workspaceId: string) => invoke('tabs:setWorkspace', { workspaceId }),
  },
  nav: {
    load: (url: string) => invoke('nav:load', { url }),
    back: () => invoke('nav:back'),
    forward: () => invoke('nav:forward'),
    reload: () => invoke('nav:reload'),
    stop: () => invoke('nav:stop'),
  },
  view: {
    setContentBounds: (b: { x: number; y: number; width: number; height: number }) =>
      invoke('view:setContentBounds', b),
    setWebVisible: (visible: boolean) => invoke('view:setWebVisible', { visible }),
  },
  find: {
    start: (o: unknown) => invoke('find:start', o),
    stop: () => invoke('find:stop'),
  },
  bookmarks: {
    list: () => invoke('bookmarks:list'),
    create: (b: unknown) => invoke('bookmarks:create', b),
    update: (b: unknown) => invoke('bookmarks:update', b),
    remove: (id: string) => invoke('bookmarks:remove', id),
    createFolder: (o: unknown) => invoke('bookmarks:createFolder', o),
    removeFolder: (id: string) => invoke('bookmarks:removeFolder', id),
    isBookmarked: (url: string) => invoke('bookmarks:isBookmarked', { url }),
    exportHtml: () => invoke('bookmarks:exportHtml'),
  },
  history: {
    search: (query?: string) => invoke('history:search', { query }),
    remove: (id: string) => invoke('history:remove', id),
    clear: (range: string) => invoke('history:clear', { range }),
  },
  notes: {
    list: (query?: string) => invoke('notes:list', { query }),
    create: (n: unknown) => invoke('notes:create', n),
    update: (n: unknown) => invoke('notes:update', n),
    remove: (id: string) => invoke('notes:remove', id),
  },
  downloads: {
    list: () => invoke('downloads:list'),
    remove: (id: string) => invoke('downloads:remove', id),
    clearCompleted: () => invoke('downloads:clearCompleted'),
    pause: (id: string) => invoke('downloads:pause', id),
    resume: (id: string) => invoke('downloads:resume', id),
    cancel: (id: string) => invoke('downloads:cancel', id),
    open: (filePath: string) => invoke('downloads:open', { url: filePath }),
    showInFolder: (filePath: string) => invoke('downloads:showInFolder', { url: filePath }),
  },
  permissions: {
    list: () => invoke('permissions:list'),
    set: (o: unknown) => invoke('permissions:set', o),
    remove: (id: string) => invoke('permissions:remove', id),
  },
  ai: {
    chat: (req: unknown) => invoke('ai:chat', req),
    cancel: (requestId: string) => invoke('ai:cancel', { requestId }),
    listModels: (provider: string) => invoke('ai:listModels', provider),
    validate: (provider: string) => invoke('ai:validate', provider),
    hasKey: (provider: string) => invoke('ai:hasKey', provider),
    setKey: (provider: string, key: string) => invoke('ai:setKey', { provider, key }),
    extractPage: (tabId?: number) => invoke('ai:extractPage', tabId != null ? { tabId } : undefined),
    extractTabs: (tabIds: number[]) => invoke('ai:extractTabs', { tabIds }),
  },
  search: {
    web: (query: string) => invoke('search:web', { query }),
    setKey: (key: string) => invoke('search:setKey', { key }),
    hasKey: () => invoke('search:hasKey'),
    validate: () => invoke('search:validate'),
  },
  news: {
    top: () => invoke('news:top'),
  },
  update: {
    get: () => invoke('update:get'),
    check: () => invoke('update:check'),
    install: () => invoke('update:install'),
  },
  sync: {
    applyBookmarks: (rows: unknown[]) => invoke('sync:applyBookmarks', { rows }),
    applyNotes: (rows: unknown[]) => invoke('sync:applyNotes', { rows }),
    allBookmarks: () => invoke('sync:allBookmarks'),
    allNotes: () => invoke('sync:allNotes'),
  },
  window: {
    minimize: () => invoke('window:minimize'),
    maximize: () => invoke('window:maximize'),
    close: () => invoke('window:close'),
    newWindow: () => invoke('window:new'),
    newPrivate: () => invoke('window:newPrivate'),
  },
  appInfo: {
    version: () => invoke('app:version'),
    openExternal: (url: string) => invoke('app:openExternal', { url }),
    chooseDownloadDir: () => invoke('app:chooseDownloadDir'),
    clearData: (o: unknown) => invoke('app:clearData', o),
  },

  on: (channel: string, listener: (payload: unknown) => void) => {
    const wrapped = (_e: unknown, payload: unknown) => listener(payload)
    ipcRenderer.on(channel, wrapped)
    return () => ipcRenderer.removeListener(channel, wrapped)
  },
}

contextBridge.exposeInMainWorld('intelleson', api)

export type SeaBrezApi = typeof api
