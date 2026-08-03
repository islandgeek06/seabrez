import { useEffect, useMemo, useState } from 'react'
import { Search, Plus, X, Sparkles, FileText, LayoutGrid, MessageCircle } from 'lucide-react'
import { useStore } from '../store'
import { api } from '../api'
import type { NewsItem } from '../../shared/types'
import { WeatherWidget } from './WeatherWidget'

interface Shortcut {
  id: string
  name: string
  url: string
}
interface Task {
  id: string
  text: string
  done: boolean
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
function loadJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

export function Dashboard() {
  const navigate = useStore((s) => s.navigate)
  const ask = useStore((s) => s.ask)
  const summarize = useStore((s) => s.summarize)
  const bookmarks = useStore((s) => s.bookmarks)
  const notes = useStore((s) => s.notes)
  const historyList = useStore((s) => s.history)
  const openTabs = useStore((s) => s.tabs.length)
  const displayName = useStore((s) => s.settings.displayName)

  const [q, setQ] = useState('')
  const [shortcuts, setShortcuts] = useState<Shortcut[]>(() =>
    loadJson('seabrez.shortcuts', DEFAULT_SHORTCUTS),
  )
  const [adding, setAdding] = useState(false)
  const [newUrl, setNewUrl] = useState('')
  const [newName, setNewName] = useState('')
  const [tasks, setTasks] = useState<Task[]>(() => loadJson('seabrez.tasks', []))
  const [taskInput, setTaskInput] = useState('')
  const [note, setNote] = useState(() => localStorage.getItem('seabrez.note') || '')
  const [news, setNews] = useState<NewsItem[]>([])
  const [newsState, setNewsState] = useState<'loading' | 'ok' | 'error'>('loading')
  const [newsErr, setNewsErr] = useState('')

  useEffect(() => {
    void useStore.getState().loadNotes()
    void useStore.getState().loadHistory()
  }, [])

  useEffect(() => {
    let alive = true
    void (async () => {
      try {
        const res = (await api.news.top()) as { items?: NewsItem[]; error?: string } | undefined
        if (!alive) return
        if (res?.items?.length) {
          setNews(res.items)
          setNewsState('ok')
        } else {
          setNewsErr(res?.error || 'Headlines are available in the desktop app.')
          setNewsState('error')
        }
      } catch {
        if (alive) {
          setNewsErr('Could not load headlines.')
          setNewsState('error')
        }
      }
    })()
    return () => {
      alive = false
    }
  }, [])
  useEffect(() => localStorage.setItem('seabrez.shortcuts', JSON.stringify(shortcuts)), [shortcuts])
  useEffect(() => localStorage.setItem('seabrez.tasks', JSON.stringify(tasks)), [tasks])
  useEffect(() => localStorage.setItem('seabrez.note', note), [note])

  const greeting = useMemo(() => {
    const h = new Date().getHours()
    return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening'
  }, [])
  const dateStr = useMemo(
    () => new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' }),
    [],
  )

  const recentBookmarks = bookmarks.slice(0, 5)
  const recentNotes = notes.slice(0, 4)

  // Daily briefing computed from the app's own real data.
  const briefing = useMemo(() => {
    const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? '' : 's'}`
    const startOfDay = new Date()
    startOfDay.setHours(0, 0, 0, 0)
    const visitedToday = historyList.filter((h) => h.lastVisitedAt >= startOfDay.getTime()).length
    const pending = tasks.filter((t) => !t.done).length
    const doneCount = tasks.filter((t) => t.done).length
    return [
      `${plural(openTabs, 'open tab')} right now`,
      pending > 0
        ? `${plural(pending, 'task')} to do${doneCount ? ` · ${doneCount} done` : ''}`
        : 'No tasks pending — add one under Tasks',
      `${plural(bookmarks.length, 'bookmark')} saved · ${plural(notes.length, 'note')}`,
      `${plural(visitedToday, 'page')} visited today`,
    ]
  }, [openTabs, tasks, bookmarks.length, notes.length, historyList])

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
  const addTask = (e: React.FormEvent) => {
    e.preventDefault()
    if (!taskInput.trim()) return
    setTasks((t) => [...t, { id: Math.random().toString(36).slice(2), text: taskInput, done: false }])
    setTaskInput('')
  }

  const quickActions = [
    { icon: Search, label: 'Start research', run: () => ask('Help me start researching a topic. Ask me what to research.') },
    { icon: FileText, label: 'Summarize page', run: () => void summarize() },
    { icon: MessageCircle, label: 'Draft something', run: () => ask('Help me draft a message or document.') },
    { icon: LayoutGrid, label: 'Organize tabs', run: () => ask('Suggest how to group my open tabs into workspaces.') },
  ]

  return (
    <div className="home">
      <div className="home-inner">
        <header className="home-top">
          <h1>
            {greeting}
            {displayName ? `, ${displayName}` : ''}
          </h1>
          <p className="home-date">{dateStr}</p>
        </header>

        {/* Single search — URLs load, everything else goes to AI search */}
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

        {/* Bento grid of widgets */}
        <div className="bento">
          <section className="tile glass weather-tile">
            <WeatherWidget />
          </section>

          <section className="tile glass bento-2">
            <h3>📋 Daily briefing</h3>
            <ul className="briefing">
              {briefing.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </section>

          <section className="tile glass bento-tall">
            <h3>✓ Tasks</h3>
            <form onSubmit={addTask} className="task-add">
              <input value={taskInput} onChange={(e) => setTaskInput(e.target.value)} placeholder="Add a task…" />
            </form>
            <ul className="tasks">
              {tasks.length === 0 && <li className="muted small">Nothing yet — add one above.</li>}
              {tasks.map((t) => (
                <li key={t.id} className={t.done ? 'done' : ''}>
                  <label>
                    <input
                      type="checkbox"
                      checked={t.done}
                      onChange={() => setTasks((all) => all.map((x) => (x.id === t.id ? { ...x, done: !x.done } : x)))}
                    />
                    {t.text}
                  </label>
                  <button className="task-del" onClick={() => setTasks((all) => all.filter((x) => x.id !== t.id))}>
                    <X size={13} />
                  </button>
                </li>
              ))}
            </ul>
          </section>

          <section className="tile glass">
            <h3>📝 Quick note</h3>
            <textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Jot something… (auto-saved)" />
          </section>

          <section className="tile glass">
            <h3><Sparkles size={14} /> AI quick actions</h3>
            <div className="qa-list">
              {quickActions.map((a) => {
                const Icon = a.icon
                return (
                  <button key={a.label} className="qa-btn" onClick={a.run}>
                    <Icon size={15} /> {a.label}
                  </button>
                )
              })}
            </div>
          </section>

          <section className="tile glass">
            <h3>★ Bookmarks</h3>
            {recentBookmarks.length === 0 && <p className="muted small">Ctrl+D to bookmark a page.</p>}
            <ul className="link-list">
              {recentBookmarks.map((b) => (
                <li key={b.id}>
                  <button onClick={() => navigate(b.url)}>★ {b.title}</button>
                </li>
              ))}
            </ul>
          </section>

          <section className="tile glass bento-2">
            <h3>📰 Top stories</h3>
            {newsState === 'loading' && <p className="muted small">Loading headlines…</p>}
            {newsState === 'error' && <p className="muted small">{newsErr}</p>}
            {newsState === 'ok' && (
              <ul className="news">
                {news.map((n) => (
                  <li key={n.url}>
                    <button className="news-link" onClick={() => navigate(n.url)} title={n.url}>
                      <span className="news-title">{n.title}</span>
                      {n.source && <span className="news-src">{n.source}</span>}
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {newsState === 'ok' && (
              <button
                className="chip"
                onClick={() =>
                  ask(
                    `Summarize today's top tech headlines for me:\n${news
                      .map((n) => `- ${n.title} (${n.source})`)
                      .join('\n')}`,
                  )
                }
              >
                Summarize with AI →
              </button>
            )}
          </section>

          <section className="tile glass">
            <h3>📓 Recent notes</h3>
            {recentNotes.length === 0 && <p className="muted small">Notes you save appear here.</p>}
            <ul className="link-list">
              {recentNotes.map((n) => (
                <li key={n.id}>
                  <button onClick={() => useStore.getState().setSurface('notes')}>📝 {n.title || 'Untitled'}</button>
                </li>
              ))}
            </ul>
          </section>

          <section className="tile glass">
            <h3><Sparkles size={14} /> Recommendations</h3>
            <ul className="reco-list">
              {[
                'Group your research tabs into a workspace?',
                'Sleep background tabs to save memory.',
                'Turn my open tabs into a reading list.',
              ].map((r) => (
                <li key={r}>
                  <button onClick={() => ask(r)}>
                    <Sparkles size={13} /> {r}
                  </button>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </div>

      {adding && (
        <div className="add-overlay" onClick={() => setAdding(false)}>
          <form className="add-card glass-strong" onClick={(e) => e.stopPropagation()} onSubmit={addShortcut}>
            <h3>Add shortcut</h3>
            <label>
              Website URL
              <input autoFocus value={newUrl} onChange={(e) => setNewUrl(e.target.value)} placeholder="example.com" />
            </label>
            <label>
              Name <span className="muted">(optional)</span>
              <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Example" />
            </label>
            <div className="add-actions">
              <button type="button" className="btn" onClick={() => setAdding(false)}>Cancel</button>
              <button type="submit" className="btn primary" disabled={!newUrl.trim()}>Add</button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
