import { useEffect, useState } from 'react'
import { Trash2, ExternalLink } from 'lucide-react'
import { useStore } from '../../store'
import { api } from '../../api'

export function HistoryPage() {
  const history = useStore((s) => s.history)
  const loadHistory = useStore((s) => s.loadHistory)
  const clearHistory = useStore((s) => s.clearHistory)
  const navigate = useStore((s) => s.navigate)
  const [q, setQ] = useState('')

  useEffect(() => {
    void loadHistory('')
  }, [loadHistory])

  return (
    <div className="page">
      <div className="page-head">
        <h1>History</h1>
        <div className="page-actions">
          <input className="page-search" value={q} onChange={(e) => { setQ(e.target.value); void loadHistory(e.target.value) }} placeholder="Search history" />
          <select onChange={(e) => e.target.value && void clearHistory(e.target.value)} defaultValue="">
            <option value="" disabled>Clear…</option>
            <option value="hour">Last hour</option>
            <option value="day">Last 24 hours</option>
            <option value="week">Last 7 days</option>
            <option value="month">Last 30 days</option>
            <option value="all">All time</option>
          </select>
        </div>
      </div>
      {history.length === 0 && <p className="muted">No history yet.</p>}
      <ul className="record-list">
        {history.map((h) => (
          <li key={h.id}>
            <button className="record-main" onClick={() => navigate(h.url)}>
              {h.favicon ? <img src={h.favicon} alt="" /> : <span className="fav-dot">◦</span>}
              <span className="record-title">{h.title || h.url}</span>
              <span className="record-sub">{h.url}</span>
            </button>
            <span className="record-meta">{new Date(h.lastVisitedAt).toLocaleDateString()} · {h.visitCount}×</span>
            <button className="icon-btn" title="Open" onClick={() => navigate(h.url)}><ExternalLink size={14} /></button>
            <button className="icon-btn" title="Remove" onClick={() => void api.history.remove(h.id).then(() => loadHistory(q))}><Trash2 size={14} /></button>
          </li>
        ))}
      </ul>
    </div>
  )
}
