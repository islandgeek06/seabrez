import { useEffect } from 'react'
import { useStore } from './store'
import { api, isElectron } from './api'
import { Sidebar } from './components/Sidebar'
import { TopBar } from './components/TopBar'
import { TabStrip } from './components/TabStrip'
import { ContentHost } from './components/ContentHost'
import { AssistantPanel } from './components/AssistantPanel'
import { CommandPalette } from './components/CommandPalette'
import { ComparePicker } from './components/ComparePicker'
import { FindBar } from './components/FindBar'
import { UpdateToast } from './components/UpdateToast'
import { Logo } from './components/Logo'

export default function App() {
  const ready = useStore((s) => s.ready)
  const settings = useStore((s) => s.settings)
  const assistantOpen = useStore((s) => s.assistantOpen)
  const findOpen = useStore((s) => s.find.open)
  const isPrivate = useStore((s) => s.isPrivateWindow)

  useEffect(() => {
    void useStore.getState().init()
  }, [])

  // Theme + accent + accessibility.
  useEffect(() => {
    if (!ready) return
    const root = document.documentElement
    const mode =
      settings.theme === 'system'
        ? window.matchMedia('(prefers-color-scheme: dark)').matches
          ? 'dark'
          : 'light'
        : settings.theme
    root.dataset.theme = mode
    root.style.setProperty('--accent', settings.accent)
    root.dataset.reduceMotion = String(settings.reduceMotion)
    root.dataset.dyslexia = String(settings.dyslexiaFont)
  }, [ready, settings.theme, settings.accent, settings.reduceMotion, settings.dyslexiaFont])

  // Global keyboard shortcuts. Keys pressed while the app UI has focus are
  // handled here; keys pressed while a web page has focus are intercepted in the
  // main process and forwarded over the 'shortcut' channel — both run the same
  // action map so every shortcut works regardless of what's focused.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey
      const key = e.key.toLowerCase()
      if (e.key === 'Escape') {
        const s = useStore.getState()
        if (s.paletteOpen) s.setPalette(false)
        else if (s.find.open) s.closeFind()
        return
      }
      const action = keyToAction(mod, e.shiftKey, key)
      if (action) {
        e.preventDefault()
        runShortcut(action)
      }
    }
    window.addEventListener('keydown', onKey)
    const offShortcut = api.on('shortcut', (p) => runShortcut((p as { action: string }).action))
    return () => {
      window.removeEventListener('keydown', onKey)
      offShortcut()
    }
  }, [])

  if (!ready) {
    return (
      <div className="boot">
        <div className="boot-logo"><Logo size={32} /></div>
        <p>Starting SeaBrez…</p>
      </div>
    )
  }

  return (
    <div
      className="app-shell"
      data-sidebar={settings.showSidebar}
      data-private={isPrivate}
      data-assistant={assistantOpen}
    >
      {!isElectron && (
        <div className="preview-banner">
          ⚠️ Browser preview only — no live pages, storage, or AI here. Use the{' '}
          <strong>SeaBrez desktop app window</strong> (run <code>npm run dev:electron</code>),
          not this <code>localhost:5273</code> tab.
        </div>
      )}
      {settings.showSidebar && <Sidebar />}
      <div className="main-column">
        {isPrivate && (
          <div className="private-banner">🛡️ Private window — history, cookies, and tabs are not saved.</div>
        )}
        <div className="chrome">
          <TabStrip />
          <TopBar />
          {findOpen && <FindBar />}
        </div>
        <ContentHost />
      </div>
      {assistantOpen && <AssistantPanel />}
      <CommandPalette />
      <ComparePicker />
      <UpdateToast />
    </div>
  )
}

// Keep this in sync with shortcutAction() in electron/browser/tabs.ts.
function keyToAction(mod: boolean, shift: boolean, key: string): string | null {
  if (mod && shift && key === 'p') return 'palette'
  if (mod && shift && key === 'a') return 'assistant'
  if (mod && shift && key === 't') return 'restoreTab'
  if (mod && shift && key === 'n') return 'newPrivate'
  if (mod && shift && key === 'tab') return 'cycleTabBack'
  if (mod && key === 'tab') return 'cycleTab'
  if (mod && key === 'l') return 'omnibox'
  if (mod && key === 't') return 'newTab'
  if (mod && key === 'w') return 'closeTab'
  if (mod && key === 'd') return 'bookmark'
  if (mod && key === 'h') return 'history'
  if (mod && key === 'j') return 'downloads'
  if (mod && key === 'f') return 'find'
  if (mod && key === 'n') return 'newWindow'
  return null
}

function runShortcut(action: string) {
  const s = useStore.getState()
  switch (action) {
    case 'palette': return s.setPalette(true)
    case 'assistant': return s.toggleAssistant()
    case 'restoreTab': return void api.tabs.restoreClosed()
    case 'newPrivate': return void api.window.newPrivate()
    case 'omnibox': return focusOmnibox()
    case 'newTab': return s.newTab()
    case 'closeTab': return void (s.activeTabId != null && s.closeTab(s.activeTabId))
    case 'bookmark': return void s.toggleBookmarkCurrent()
    case 'history': return s.setSurface('history')
    case 'downloads': return s.setSurface('downloads')
    case 'find': return s.openFind()
    case 'newWindow': return void api.window.newWindow()
    case 'cycleTab': return cycleTab(false)
    case 'cycleTabBack': return cycleTab(true)
  }
}
function focusOmnibox() {
  const el = document.getElementById('omnibox') as HTMLInputElement | null
  el?.focus()
  el?.select()
}
function cycleTab(back: boolean) {
  const s = useStore.getState()
  if (s.tabs.length < 2 || s.activeTabId == null) return
  const idx = s.tabs.findIndex((t) => t.id === s.activeTabId)
  const next = (idx + (back ? -1 : 1) + s.tabs.length) % s.tabs.length
  s.activateTab(s.tabs[next].id)
}
