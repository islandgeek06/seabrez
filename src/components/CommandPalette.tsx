import { useEffect, useMemo, useRef, useState } from 'react'
import { useStore } from '../store'
import { api } from '../api'

interface Command {
  id: string
  label: string
  hint?: string
  run: () => void
}

// Fuzzy subsequence match (no AI — local command matching per spec).
function fuzzy(query: string, text: string): boolean {
  const q = query.toLowerCase()
  const t = text.toLowerCase()
  let i = 0
  for (const ch of t) if (ch === q[i]) i++
  return i === q.length
}

export function CommandPalette() {
  const open = useStore((s) => s.paletteOpen)
  const setPalette = useStore((s) => s.setPalette)
  const [query, setQuery] = useState('')
  const [highlight, setHighlight] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open) {
      setQuery('')
      setHighlight(0)
      setTimeout(() => inputRef.current?.focus(), 20)
    }
  }, [open])

  const commands = useMemo<Command[]>(() => {
    const s = useStore.getState()
    const base: Command[] = [
      { id: 'newtab', label: 'New Tab', hint: 'Ctrl+T', run: () => void s.newTab() },
      { id: 'newwindow', label: 'New Window', hint: 'Ctrl+N', run: () => api.window.newWindow() },
      { id: 'private', label: 'New Private Window', hint: 'Ctrl+Shift+N', run: () => api.window.newPrivate() },
      { id: 'restore', label: 'Reopen Closed Tab', hint: 'Ctrl+Shift+T', run: () => api.tabs.restoreClosed() },
      { id: 'dash', label: 'Go to Dashboard', run: () => s.setSurface('newtab') },
      { id: 'history', label: 'Open History', hint: 'Ctrl+H', run: () => s.setSurface('history') },
      { id: 'bookmarks', label: 'Open Bookmarks', run: () => s.setSurface('bookmarks') },
      { id: 'downloads', label: 'Open Downloads', hint: 'Ctrl+J', run: () => s.setSurface('downloads') },
      { id: 'notes', label: 'Open Notes', run: () => s.setSurface('notes') },
      { id: 'settings', label: 'Open Settings', run: () => s.setSurface('settings') },
      { id: 'find', label: 'Find in Page', hint: 'Ctrl+F', run: () => s.openFind() },
      { id: 'ai', label: 'Toggle AI Assistant', hint: 'Ctrl+Shift+A', run: () => s.toggleAssistant() },
      { id: 'summarize', label: 'Summarize this page', run: () => void s.summarize() },
      { id: 'compare', label: 'Compare open tabs with AI', run: () => s.setComparePicker(true) },
      { id: 'bookmark', label: 'Bookmark current page', hint: 'Ctrl+D', run: () => void s.toggleBookmarkCurrent() },
      { id: 'sidebar', label: 'Toggle sidebar', run: () => void s.setSetting('showSidebar', !s.settings.showSidebar) },
    ]
    for (const w of s.workspaces)
      base.push({ id: `ws-${w.id}`, label: `Switch to ${w.name}`, hint: 'Workspace', run: () => s.setWorkspace(w.id) })
    return base
  }, [open])

  const filtered = query ? commands.filter((c) => fuzzy(query, c.label)) : commands

  if (!open) return null

  const exec = (c: Command) => {
    c.run()
    setPalette(false)
  }
  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (filtered[highlight]) exec(filtered[highlight])
    else if (query.trim()) {
      useStore.getState().navigate(query)
      setPalette(false)
    }
  }

  return (
    <div className="palette-overlay" onClick={() => setPalette(false)}>
      <div className="palette glass-strong" onClick={(e) => e.stopPropagation()}>
        <form onSubmit={submit}>
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setHighlight(0)
            }}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') {
                e.preventDefault()
                setHighlight((h) => Math.min(h + 1, filtered.length - 1))
              } else if (e.key === 'ArrowUp') {
                e.preventDefault()
                setHighlight((h) => Math.max(h - 1, 0))
              }
            }}
            placeholder="Type a command, or a URL / search…"
            aria-label="Command palette"
          />
        </form>
        <div className="palette-list">
          {filtered.map((c, i) => (
            <button key={c.id} className={`palette-item ${i === highlight ? 'active' : ''}`} onClick={() => exec(c)}>
              <span>{c.label}</span>
              {c.hint && <kbd>{c.hint}</kbd>}
            </button>
          ))}
          {filtered.length === 0 && (
            <button className="palette-item active" onClick={submit}>
              <span>Search / open “{query}”</span>
              <kbd>↵</kbd>
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
