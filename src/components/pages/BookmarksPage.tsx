import { useEffect, useState } from 'react'
import { Trash2, ExternalLink, FolderPlus, Download } from 'lucide-react'
import { useStore } from '../../store'
import { api } from '../../api'

export function BookmarksPage() {
  const bookmarks = useStore((s) => s.bookmarks)
  const refresh = useStore((s) => s.refreshBookmarks)
  const removeBookmark = useStore((s) => s.removeBookmark)
  const navigate = useStore((s) => s.navigate)
  const [q, setQ] = useState('')

  useEffect(() => {
    void refresh()
  }, [refresh])

  const filtered = q
    ? bookmarks.filter((b) => b.title.toLowerCase().includes(q.toLowerCase()) || b.url.toLowerCase().includes(q.toLowerCase()))
    : bookmarks

  const exportHtml = async () => {
    const html = (await api.bookmarks.exportHtml()) as string
    const blob = new Blob([html], { type: 'text/html' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = 'bookmarks.html'
    a.click()
  }

  return (
    <div className="page">
      <div className="page-head">
        <h1>Bookmarks</h1>
        <div className="page-actions">
          <input className="page-search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search bookmarks" />
          <button className="btn" onClick={() => void api.bookmarks.createFolder({ name: 'New folder' }).then(() => refresh())}><FolderPlus size={14} /> Folder</button>
          <button className="btn" onClick={() => void exportHtml()}><Download size={14} /> Export</button>
        </div>
      </div>
      {filtered.length === 0 && <p className="muted">No bookmarks yet. Press Ctrl+D on a page to add one.</p>}
      <ul className="record-list">
        {filtered.map((b) => (
          <li key={b.id}>
            <button className="record-main" onClick={() => navigate(b.url)}>
              {b.favicon ? <img src={b.favicon} alt="" /> : <span className="fav-dot">★</span>}
              <span className="record-title">{b.title}</span>
              <span className="record-sub">{b.url}</span>
            </button>
            <button className="icon-btn" title="Open" onClick={() => navigate(b.url)}><ExternalLink size={14} /></button>
            <button className="icon-btn" title="Remove" onClick={() => void removeBookmark(b.id)}><Trash2 size={14} /></button>
          </li>
        ))}
      </ul>
    </div>
  )
}
