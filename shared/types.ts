// Domain types shared between the Electron main process, preload, and the
// React renderer. Keep this free of any runtime imports so it can be pulled
// into any process safely.

export type ThemeMode = 'dark' | 'light' | 'system'
export type SearchEngine = 'google' | 'bing' | 'duckduckgo' | 'brave'
export type AiProviderId = 'openai' | 'anthropic'

export interface Workspace {
  id: string
  name: string
  icon: string
  color: string
  position: number
  createdAt: number
  updatedAt: number
}

export interface HistoryEntry {
  id: string
  workspaceId: string | null
  url: string
  title: string
  favicon: string | null
  visitCount: number
  firstVisitedAt: number
  lastVisitedAt: number
}

export interface BookmarkFolder {
  id: string
  parentId: string | null
  name: string
  position: number
  createdAt: number
  updatedAt: number
}

export interface Bookmark {
  id: string
  folderId: string | null
  workspaceId: string | null
  title: string
  url: string
  favicon: string | null
  pinned: number
  position: number
  createdAt: number
  updatedAt: number
  deleted: number
}

export interface Note {
  id: string
  workspaceId: string | null
  title: string
  content: string
  sourceUrl: string | null
  createdAt: number
  updatedAt: number
  deleted: number
}

export interface PersistedTab {
  id: string
  workspaceId: string | null
  url: string
  title: string
  favicon: string | null
  position: number
  pinned: number
  muted: number
  lastActiveAt: number
  createdAt: number
  updatedAt: number
}

export interface DownloadItem {
  id: string
  url: string
  filename: string
  path: string
  status: 'progressing' | 'paused' | 'completed' | 'cancelled' | 'interrupted'
  receivedBytes: number
  totalBytes: number
  startedAt: number
  completedAt: number | null
}

export type PermissionKind =
  | 'camera'
  | 'microphone'
  | 'notifications'
  | 'geolocation'
  | 'clipboard'
  | 'midi'
  | 'display-capture'
  | 'ai-context'

export interface SitePermission {
  id: string
  origin: string
  permission: PermissionKind
  decision: 'allow' | 'deny' | 'ask'
  createdAt: number
  updatedAt: number
}

export interface AiConversation {
  id: string
  workspaceId: string | null
  title: string
  provider: string
  model: string
  sourceUrl: string | null
  createdAt: number
  updatedAt: number
}

export interface AiMessage {
  id: string
  conversationId: string
  role: 'system' | 'user' | 'assistant'
  content: string
  createdAt: number
}

export interface Settings {
  theme: ThemeMode
  accent: string
  searchEngine: SearchEngine
  homePage: string
  restoreSession: boolean
  askWhereToSave: boolean
  downloadDir: string | null
  compactTabs: boolean
  showSidebar: boolean
  reduceMotion: boolean
  dyslexiaFont: boolean
  webSearchSource: 'duckduckgo' | 'brave'
  syncUrl: string
  syncAnonKey: string
  aiProvider: AiProviderId
  aiModel: string
  defaultSummaryStyle: 'brief' | 'detailed' | 'keypoints' | 'executive'
  streamResponses: boolean
  pageContextConsent: 'ask' | 'session' | 'always'
  hardwareAcceleration: boolean
  doNotTrack: boolean
}

// ---- Live (non-persisted) runtime tab state pushed from main -> renderer ----
export interface LiveTab {
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

// ---- Page extraction result ----
export interface ExtractedPage {
  url: string
  title: string
  description: string
  text: string
  headings: string[]
  truncated: boolean
  containsAiInstructions: boolean
}

// ---- AI request/streaming contracts ----
export interface AiChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface AiChatRequest {
  provider: AiProviderId
  model: string
  messages: AiChatMessage[]
  system?: string
  requestId: string
}

export type AiStreamEvent =
  | { type: 'delta'; requestId: string; text: string }
  | { type: 'done'; requestId: string }
  | { type: 'error'; requestId: string; message: string }

export interface AiModel {
  id: string
  label: string
}

export interface SearchResult {
  title: string
  url: string
  description: string
}
