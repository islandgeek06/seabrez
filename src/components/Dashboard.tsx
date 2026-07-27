import { useEffect, useState } from 'react'
import { Sparkles, Search, FileText, LayoutGrid, MessageCircle } from 'lucide-react'
import { useStore } from '../store'

export function Dashboard() {
  const navigate = useStore((s) => s.navigate)
  const ask = useStore((s) => s.ask)
  const summarize = useStore((s) => s.summarize)
  const bookmarks = useStore((s) => s.bookmarks)
  const historyList = useStore((s) => s.history)
  const notes = useStore((s) => s.notes)
  const workspaces = useStore((s) => s.workspaces)
  const activeWs = useStore((s) => s.activeWorkspaceId)
  const ws = workspaces.find((w) => w.id === activeWs)

  const [q, setQ] = useState('')

  useEffect(() => {
    void useStore.getState().loadHistory()
    void useStore.getState().loadNotes()
  }, [])

  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'

  const frequent = [...historyList].sort((a, b) => b.visitCount - a.visitCount).slice(0, 8)
  const recentBookmarks = bookmarks.slice(0, 6)
  const recentNotes = notes.slice(0, 4)

  const quick = [
    { icon: Search, label: 'Start research', run: () => ask('Help me start researching a topic. Ask me what to research.') },
    { icon: FileText, label: 'Summarize a page', run: () => void summarize() },
    { icon: MessageCircle, label: 'Draft something', run: () => ask('Help me draft a message or document.') },
    { icon: LayoutGrid, label: 'Organize my tabs', run: () => ask('Suggest how to group my open tabs into workspaces.') },
  ]

  return (
    <div className="dashboard">
      <header className="dash-header">
        <h1>
          {greeting}
          {ws && <span className="dash-ws"> · {ws.icon} {ws.name}</span>}
        </h1>
        <p className="dash-date">
          {new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}
        </p>
      </header>

      <form
        className="dash-command glass"
        onSubmit={(e) => {
          e.preventDefault()
          if (q.trim()) {
            navigate(q)
            setQ('')
          }
        }}
      >
        <Search size={18} />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search the web or enter a URL"
          aria-label="Search or enter address"
          autoFocus
        />
      </form>

      <div className="dash-quick">
        {quick.map((a) => {
          const Icon = a.icon
          return (
            <button key={a.label} className="dash-quick-btn glass" onClick={a.run}>
              <Icon size={16} />
              {a.label}
            </button>
          )
        })}
      </div>

      <div className="dash-grid">
        <section className="card glass">
          <h3><Sparkles size={14} /> Ask Intelleson</h3>
          <AskBox onAsk={(t) => void ask(t)} />
        </section>

        <section className="card glass">
          <h3>Frequent</h3>
          {frequent.length === 0 && <p className="muted small">Sites you visit often will appear here.</p>}
          <div className="quick-sites">
            {frequent.map((h) => (
              <button key={h.id} className="quick-site" onClick={() => navigate(h.url)} title={h.url}>
                {h.favicon ? <img src={h.favicon} alt="" /> : <span className="quick-site-emoji">◦</span>}
                <span>{h.title || hostOf(h.url)}</span>
              </button>
            ))}
          </div>
        </section>

        <section className="card glass">
          <h3>Recent bookmarks</h3>
          {recentBookmarks.length === 0 && <p className="muted small">Bookmark a page to see it here.</p>}
          <ul className="link-list">
            {recentBookmarks.map((b) => (
              <li key={b.id}>
                <button onClick={() => navigate(b.url)}>★ {b.title}</button>
              </li>
            ))}
          </ul>
        </section>

        <section className="card glass">
          <h3>Recent notes</h3>
          {recentNotes.length === 0 && <p className="muted small">Notes you save appear here.</p>}
          <ul className="link-list">
            {recentNotes.map((n) => (
              <li key={n.id}>
                <button onClick={() => useStore.getState().setSurface('notes')}>📝 {n.title || 'Untitled'}</button>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  )
}

function AskBox({ onAsk }: { onAsk: (t: string) => void }) {
  const [v, setV] = useState('')
  return (
    <form
      className="dash-ask"
      onSubmit={(e) => {
        e.preventDefault()
        if (v.trim()) {
          onAsk(v)
          setV('')
        }
      }}
    >
      <input value={v} onChange={(e) => setV(e.target.value)} placeholder="Ask anything…" aria-label="Ask AI" />
      <button className="btn primary" type="submit">Ask</button>
    </form>
  )
}

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace('www.', '')
  } catch {
    return url
  }
}
