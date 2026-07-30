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

  // Global keyboard shortcuts.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const s = useStore.getState()
      const mod = e.ctrlKey || e.metaKey
      const key = e.key.toLowerCase()
      if (mod && e.shiftKey && key === 'p') return act(e, () => s.setPalette(true))
      if (mod && e.shiftKey && key === 'a') return act(e, () => s.toggleAssistant())
      if (mod && e.shiftKey && key === 't') return act(e, () => api.tabs.restoreClosed())
      if (mod && e.shiftKey && key === 'n') return act(e, () => api.window.newPrivate())
      if (mod && key === 'l') return act(e, focusOmnibox)
      if (mod && key === 't') return act(e, () => s.newTab())
      if (mod && key === 'w') return act(e, () => s.activeTabId != null && s.closeTab(s.activeTabId))
      if (mod && key === 'd') return act(e, () => void s.toggleBookmarkCurrent())
      if (mod && key === 'h') return act(e, () => s.setSurface('history'))
      if (mod && key === 'j') return act(e, () => s.setSurface('downloads'))
      if (mod && key === 'f') return act(e, () => s.openFind())
      if (mod && key === 'n') return act(e, () => api.window.newWindow())
      if (mod && key === 'tab') return act(e, () => cycleTab(e.shiftKey))
      if (e.key === 'Escape') {
        if (s.paletteOpen) s.setPalette(false)
        else if (s.find.open) s.closeFind()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
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
    </div>
  )
}

function act(e: KeyboardEvent, fn: () => void) {
  e.preventDefault()
  fn()
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
