import { useEffect, useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { useStore } from '../../store'
import { api } from '../../api'
import type { Note } from '../../../shared/types'

export function NotesPage() {
  const notes = useStore((s) => s.notes)
  const loadNotes = useStore((s) => s.loadNotes)
  const removeNote = useStore((s) => s.removeNote)
  const [selected, setSelected] = useState<Note | null>(null)
  const [q, setQ] = useState('')

  useEffect(() => {
    void loadNotes('')
  }, [loadNotes])

  const create = async () => {
    await useStore.getState().saveNote({ title: 'Untitled note', content: '' })
    await loadNotes(q)
  }

  const save = async (patch: Partial<Note>) => {
    if (!selected) return
    const updated = { ...selected, ...patch }
    setSelected(updated)
    await api.notes.update({ id: selected.id, title: updated.title, content: updated.content })
    await loadNotes(q)
  }

  return (
    <div className="page notes-page">
      <div className="notes-list">
        <div className="page-head">
          <h1>Notes</h1>
          <button className="btn primary" onClick={() => void create()}><Plus size={14} /></button>
        </div>
        <input className="page-search" value={q} onChange={(e) => { setQ(e.target.value); void loadNotes(e.target.value) }} placeholder="Search notes" />
        <ul className="record-list">
          {notes.map((n) => (
            <li key={n.id} className={selected?.id === n.id ? 'active' : ''}>
              <button className="record-main" onClick={() => setSelected(n)}>
                <span className="record-title">{n.title || 'Untitled'}</span>
                <span className="record-sub">{new Date(n.updatedAt).toLocaleDateString()}</span>
              </button>
              <button className="icon-btn" onClick={() => { void removeNote(n.id); if (selected?.id === n.id) setSelected(null) }}><Trash2 size={14} /></button>
            </li>
          ))}
          {notes.length === 0 && <li className="muted" style={{ padding: 12 }}>No notes yet.</li>}
        </ul>
      </div>
      <div className="notes-editor">
        {selected ? (
          <>
            <input
              className="note-title"
              value={selected.title}
              onChange={(e) => void save({ title: e.target.value })}
              placeholder="Title"
            />
            <textarea
              className="note-body"
              value={selected.content}
              onChange={(e) => void save({ content: e.target.value })}
              placeholder="Write in Markdown…"
            />
            {selected.sourceUrl && <p className="muted small">Source: {selected.sourceUrl}</p>}
          </>
        ) : (
          <div className="notes-empty muted">Select or create a note.</div>
        )}
      </div>
    </div>
  )
}
