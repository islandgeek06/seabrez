import { useEffect, useMemo, useState } from 'react'
import { Search, Plus, X } from 'lucide-react'
import { useStore } from '../store'

interface Shortcut {
  id: string
  name: string
  url: string
}

const DEFAULT_SHORTCUTS: Shortcut[] = [
  { id: 's1', name: 'YouTube', url: 'https://youtube.com' },
  { id: 's2', name: 'Gmail', url: 'https://mail.google.com' },
  { id: 's3', name: 'Wikipedia', url: 'https://wikipedia.org' },
  { id: 's4', name: 'GitHub', url: 'https://github.com' },
]

const TILE_COLORS = ['#22d3ee', '#3b82f6', '#6d5efc', '#ec4899', '#f59e0b', '#22c55e', '#06b6d4']

function hostOf(url: string): string {
  try {
    return new URL(url.startsWith('http') ? url : `https://${url}`).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}
function initialOf(s: Shortcut): string {
  return (s.name || hostOf(s.url)).trim().charAt(0).toUpperCase() || '•'
}
function colorFor(seed: string): string {
  let h = 0
  for (const c of seed) h = (h * 31 + c.charCodeAt(0)) >>> 0
  return TILE_COLORS[h % TILE_COLORS.length]
}

export function Dashboard() {
  const navigate = useStore((s) => s.navigate)
  const workspaces = useStore((s) => s.workspaces)
  const activeWs = useStore((s) => s.activeWorkspaceId)
  const ws = workspaces.find((w) => w.id === activeWs)

  const [q, setQ] = useState('')
  const [shortcuts, setShortcuts] = useState<Shortcut[]>(() => {
    try {
      const raw = localStorage.getItem('seabrez.shortcuts')
      return raw ? JSON.parse(raw) : DEFAULT_SHORTCUTS
    } catch {
      return DEFAULT_SHORTCUTS
    }
  })
  const [adding, setAdding] = useState(false)
  const [newUrl, setNewUrl] = useState('')
  const [newName, setNewName] = useState('')

  useEffect(() => {
    localStorage.setItem('seabrez.shortcuts', JSON.stringify(shortcuts))
  }, [shortcuts])

  const greeting = useMemo(() => {
    const h = new Date().getHours()
    return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening'
  }, [])

  const addShortcut = (e: React.FormEvent) => {
    e.preventDefault()
    const url = newUrl.trim()
    if (!url) return
    const full = /^https?:\/\//i.test(url) ? url : `https://${url}`
    setShortcuts((s) => [
      ...s,
      { id: Math.random().toString(36).slice(2), name: newName.trim() || hostOf(full), url: full },
    ])
    setNewUrl('')
    setNewName('')
    setAdding(false)
  }

  return (
    <div className="home">
      <div className="home-inner">
        <header className="home-head">
          <h1>{greeting}</h1>
          {ws && (
            <span className="home-ws">
              {ws.icon} {ws.name}
            </span>
          )}
        </header>

        {/* Single search — routes URLs to the page, everything else to AI search */}
        <form
          className="home-search"
          onSubmit={(e) => {
            e.preventDefault()
            if (q.trim()) {
              navigate(q)
              setQ('')
            }
          }}
        >
          <Search size={18} strokeWidth={1.75} />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search, type a URL, or ask anything"
            aria-label="Search or ask"
            autoFocus
          />
        </form>

        {/* Customizable shortcuts */}
        <div className="shortcuts">
          {shortcuts.map((s) => (
            <div key={s.id} className="shortcut">
              <button className="shortcut-btn" onClick={() => navigate(s.url)} title={s.url}>
                <span className="shortcut-tile" style={{ background: colorFor(s.name || s.url) }}>
                  {initialOf(s)}
                </span>
                <span className="shortcut-name">{s.name || hostOf(s.url)}</span>
              </button>
              <button
                className="shortcut-remove"
                title="Remove"
                onClick={() => setShortcuts((all) => all.filter((x) => x.id !== s.id))}
              >
                <X size={12} />
              </button>
            </div>
          ))}

          <div className="shortcut">
            <button className="shortcut-btn" onClick={() => setAdding(true)}>
              <span className="shortcut-tile shortcut-tile-add">
                <Plus size={22} strokeWidth={1.75} />
              </span>
              <span className="shortcut-name muted">Add</span>
            </button>
          </div>
        </div>
      </div>

      {adding && (
        <div className="add-overlay" onClick={() => setAdding(false)}>
          <form className="add-card glass-strong" onClick={(e) => e.stopPropagation()} onSubmit={addShortcut}>
            <h3>Add shortcut</h3>
            <label>
              Website URL
              <input
                autoFocus
                value={newUrl}
                onChange={(e) => setNewUrl(e.target.value)}
                placeholder="example.com"
              />
            </label>
            <label>
              Name <span className="muted">(optional)</span>
              <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Example" />
            </label>
            <div className="add-actions">
              <button type="button" className="btn" onClick={() => setAdding(false)}>
                Cancel
              </button>
              <button type="submit" className="btn primary" disabled={!newUrl.trim()}>
                Add
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
