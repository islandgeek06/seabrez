import { useState } from 'react'
import { GitCompare, X } from 'lucide-react'
import { useStore } from '../store'

// Lets the user select 2+ open tabs and send them to the AI for comparison.
// The comparison streams into the assistant panel via the normal ai:chat path.
export function ComparePicker() {
  const open = useStore((s) => s.comparePickerOpen)
  const close = useStore((s) => s.setComparePicker)
  const tabs = useStore((s) => s.tabs)
  const compareTabs = useStore((s) => s.compareTabs)
  const [selected, setSelected] = useState<number[]>([])

  if (!open) return null

  const eligible = tabs.filter((t) => t.url && t.url !== 'about:blank' && !t.isPrivate)

  const toggle = (id: number) =>
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : s.length < 6 ? [...s, id] : s))

  const run = () => {
    if (selected.length < 2) return
    void compareTabs(selected)
    setSelected([])
    close(false)
  }

  return (
    <div className="palette-overlay" onClick={() => close(false)}>
      <div className="compare-picker glass-strong" onClick={(e) => e.stopPropagation()}>
        <header className="compare-head">
          <strong><GitCompare size={15} /> Compare tabs</strong>
          <button className="icon-btn" onClick={() => close(false)}><X size={16} /></button>
        </header>
        <p className="muted small">Select 2–6 open tabs to compare with AI.</p>
        <ul className="compare-list">
          {eligible.length === 0 && <li className="muted" style={{ padding: 10 }}>No comparable tabs open.</li>}
          {eligible.map((t) => (
            <li key={t.id}>
              <label>
                <input type="checkbox" checked={selected.includes(t.id)} onChange={() => toggle(t.id)} />
                {t.favicon ? <img src={t.favicon} alt="" /> : <span className="fav-dot">◦</span>}
                <span className="compare-title">{t.title || t.url}</span>
              </label>
            </li>
          ))}
        </ul>
        <div className="compare-actions">
          <span className="muted small">{selected.length} selected</span>
          <button className="btn primary" disabled={selected.length < 2} onClick={run}>
            Compare with AI
          </button>
        </div>
      </div>
    </div>
  )
}
