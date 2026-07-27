import { useEffect } from 'react'
import { FolderOpen, X, Pause, Play, Trash2 } from 'lucide-react'
import { useStore } from '../../store'
import { api } from '../../api'

function fmtBytes(n: number): string {
  if (!n) return '—'
  const units = ['B', 'KB', 'MB', 'GB']
  let i = 0
  let v = n
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024
    i++
  }
  return `${v.toFixed(1)} ${units[i]}`
}

export function DownloadsPage() {
  const downloads = useStore((s) => s.downloads)
  const loadDownloads = useStore((s) => s.loadDownloads)

  useEffect(() => {
    void loadDownloads()
  }, [loadDownloads])

  return (
    <div className="page">
      <div className="page-head">
        <h1>Downloads</h1>
        <button className="btn" onClick={() => void api.downloads.clearCompleted().then(() => loadDownloads())}>Clear completed</button>
      </div>
      {downloads.length === 0 && <p className="muted">No downloads yet.</p>}
      <ul className="record-list">
        {downloads.map((d) => {
          const pct = d.totalBytes ? Math.round((d.receivedBytes / d.totalBytes) * 100) : 0
          return (
            <li key={d.id}>
              <div className="record-main" style={{ cursor: 'default' }}>
                <span className="record-title">{d.filename}</span>
                <span className="record-sub">
                  {d.status === 'progressing' ? `${pct}% · ${fmtBytes(d.receivedBytes)} / ${fmtBytes(d.totalBytes)}` : `${d.status} · ${fmtBytes(d.totalBytes)}`}
                </span>
                {d.status === 'progressing' && (
                  <span className="dl-bar"><span className="dl-bar-fill" style={{ width: `${pct}%` }} /></span>
                )}
              </div>
              {d.status === 'progressing' && (
                <button className="icon-btn" title="Pause" onClick={() => api.downloads.pause(d.id)}><Pause size={14} /></button>
              )}
              {d.status === 'paused' && (
                <button className="icon-btn" title="Resume" onClick={() => api.downloads.resume(d.id)}><Play size={14} /></button>
              )}
              {d.status === 'progressing' || d.status === 'paused' ? (
                <button className="icon-btn" title="Cancel" onClick={() => api.downloads.cancel(d.id)}><X size={14} /></button>
              ) : (
                <button className="icon-btn" title="Show in folder" onClick={() => api.downloads.showInFolder(d.path)}><FolderOpen size={14} /></button>
              )}
              <button className="icon-btn" title="Remove" onClick={() => void api.downloads.remove(d.id).then(() => loadDownloads())}><Trash2 size={14} /></button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
