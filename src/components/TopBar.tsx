import { useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowLeft,
  ArrowRight,
  RotateCw,
  X,
  Home,
  Star,
  Plus,
  Sparkles,
  Lock,
  Search,
} from 'lucide-react'
import { useStore } from '../store'
import { api } from '../api'
import { isProbablyUrl } from '../../shared/url'
import { AppMenu } from './AppMenu'

interface Suggestion {
  label: string
  sub: string
  value: string
  kind: 'history' | 'bookmark' | 'tab' | 'search'
}

export function TopBar() {
  const tabs = useStore((s) => s.tabs)
  const activeTabId = useStore((s) => s.activeTabId)
  const surface = useStore((s) => s.surface)
  const navigate = useStore((s) => s.navigate)
  const bookmarks = useStore((s) => s.bookmarks)
  const historyList = useStore((s) => s.history)
  const isBookmarked = useStore((s) => s.isCurrentBookmarked)
  const toggleBookmark = useStore((s) => s.toggleBookmarkCurrent)

  const active = tabs.find((t) => t.id === activeTabId)
  const [value, setValue] = useState('')
  const [focused, setFocused] = useState(false)
  const [highlight, setHighlight] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!focused) setValue(surface === 'web' && active && active.url !== 'about:blank' ? active.url : '')
  }, [active?.url, surface, focused, active])

  // Ensure history is available for suggestions.
  useEffect(() => {
    void useStore.getState().loadHistory()
  }, [])

  const suggestions = useMemo<Suggestion[]>(() => {
    const q = value.trim().toLowerCase()
    if (!q) return []
    const out: Suggestion[] = []
    for (const t of tabs) {
      if (t.id !== activeTabId && (t.title.toLowerCase().includes(q) || t.url.toLowerCase().includes(q)))
        out.push({ label: t.title || t.url, sub: 'Switch to tab', value: `tab:${t.id}`, kind: 'tab' })
    }
    for (const b of bookmarks) {
      if (b.title.toLowerCase().includes(q) || b.url.toLowerCase().includes(q))
        out.push({ label: b.title, sub: b.url, value: b.url, kind: 'bookmark' })
    }
    for (const h of historyList) {
      if (h.url.toLowerCase().includes(q) || h.title.toLowerCase().includes(q))
        out.push({ label: h.title || h.url, sub: h.url, value: h.url, kind: 'history' })
    }
    const trimmed = out.slice(0, 6)
    if (!isProbablyUrl(value))
      trimmed.push({ label: `Search “${value}”`, sub: 'Search the web', value, kind: 'search' })
    return trimmed
  }, [value, tabs, bookmarks, historyList, activeTabId])

  const choose = (s: Suggestion) => {
    setFocused(false)
    inputRef.current?.blur()
    if (s.kind === 'tab') useStore.getState().activateTab(Number(s.value.slice(4)))
    else navigate(s.value)
  }

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (focused && suggestions[highlight]) return choose(suggestions[highlight])
    if (value.trim()) {
      setFocused(false)
      inputRef.current?.blur()
      navigate(value)
    }
  }

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!suggestions.length) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHighlight((h) => Math.min(h + 1, suggestions.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlight((h) => Math.max(h - 1, 0))
    }
  }

  const secure = active?.url.startsWith('https://')

  return (
    <div className="topbar">
      <div className="nav-buttons">
        <button className="nav-btn" disabled={!active?.canGoBack} onClick={() => api.nav.back()} title="Back" aria-label="Back">
          <ArrowLeft size={18} />
        </button>
        <button className="nav-btn" disabled={!active?.canGoForward} onClick={() => api.nav.forward()} title="Forward" aria-label="Forward">
          <ArrowRight size={18} />
        </button>
        <button
          className="nav-btn"
          onClick={() => (active?.loading ? api.nav.stop() : api.nav.reload())}
          title={active?.loading ? 'Stop' : 'Reload'}
          aria-label={active?.loading ? 'Stop' : 'Reload'}
        >
          {active?.loading ? <X size={18} /> : <RotateCw size={16} />}
        </button>
        <button className="nav-btn" onClick={() => useStore.getState().setSurface('newtab')} title="Home" aria-label="Home">
          <Home size={17} />
        </button>
      </div>

      <div className="omnibox-wrap">
        <form className="command-bar" onSubmit={submit}>
          <span className="command-icon">
            {value.startsWith('http') ? (secure ? <Lock size={13} /> : <Search size={13} />) : <Sparkles size={13} />}
          </span>
          <input
            id="omnibox"
            ref={inputRef}
            value={value}
            onChange={(e) => {
              setValue(e.target.value)
              setHighlight(0)
            }}
            onFocus={() => setFocused(true)}
            onBlur={() => setTimeout(() => setFocused(false), 120)}
            onKeyDown={onKeyDown}
            placeholder="Search, enter a URL, or type a command"
            spellCheck={false}
            aria-label="Address and search bar"
            autoComplete="off"
          />
          {active && active.url !== 'about:blank' && surface === 'web' && (
            <button
              type="button"
              className={`icon-btn ${isBookmarked ? 'accent' : ''}`}
              title={isBookmarked ? 'Remove bookmark' : 'Bookmark (Ctrl+D)'}
              onClick={() => void toggleBookmark()}
            >
              <Star size={16} fill={isBookmarked ? 'currentColor' : 'none'} />
            </button>
          )}
        </form>

        {focused && suggestions.length > 0 && (
          <ul className="omnibox-suggestions glass-strong">
            {suggestions.map((s, i) => (
              <li key={i}>
                <button
                  className={`omnibox-suggestion ${i === highlight ? 'active' : ''}`}
                  onMouseDown={(e) => {
                    e.preventDefault()
                    choose(s)
                  }}
                >
                  <span className="sug-kind">{s.kind === 'search' ? '🔍' : s.kind === 'tab' ? '↹' : s.kind === 'bookmark' ? '★' : '↺'}</span>
                  <span className="sug-label">{s.label}</span>
                  <span className="sug-sub">{s.sub}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="topbar-actions">
        <button className="nav-btn" title="New tab (Ctrl+T)" aria-label="New tab" onClick={() => useStore.getState().newTab()}>
          <Plus size={18} />
        </button>
        <button className="nav-btn accent" title="AI Assistant (Ctrl+Shift+A)" aria-label="AI Assistant" onClick={() => useStore.getState().toggleAssistant()}>
          <Sparkles size={18} />
        </button>
        <AppMenu />
      </div>
    </div>
  )
}
