import { useState } from 'react'
import {
  MoreVertical,
  SquarePlus,
  AppWindow,
  Shield,
  History,
  Download,
  Bookmark,
  StickyNote,
  Search as SearchIcon,
  Settings as SettingsIcon,
} from 'lucide-react'
import { useStore } from '../store'
import { api } from '../api'

// Browser-style "⋮" menu — the discoverable home for New Window / New Private
// Window / New Tab plus quick jumps. Shortcuts still work independently.
export function AppMenu() {
  const [open, setOpen] = useState(false)
  const s = useStore.getState

  const item = (label: string, hint: string, icon: React.ReactNode, run: () => void) => (
    <button
      className="menu-item"
      onClick={() => {
        run()
        setOpen(false)
      }}
    >
      {icon}
      <span className="menu-item-label">{label}</span>
      {hint && <kbd>{hint}</kbd>}
    </button>
  )

  return (
    <div className="appmenu-wrap">
      <button
        className="nav-btn"
        title="Menu"
        aria-label="Menu"
        aria-haspopup="menu"
        onClick={() => setOpen((v) => !v)}
      >
        <MoreVertical size={18} />
      </button>

      {open && (
        <>
          <div className="menu-backdrop" onClick={() => setOpen(false)} />
          <div className="context-menu appmenu glass-strong" role="menu">
            {item('New tab', 'Ctrl+T', <SquarePlus size={15} />, () => void s().newTab())}
            {item('New window', 'Ctrl+N', <AppWindow size={15} />, () => api.window.newWindow())}
            {item('New private window', 'Ctrl+Shift+N', <Shield size={15} />, () => api.window.newPrivate())}
            <div className="menu-sep" />
            {item('History', 'Ctrl+H', <History size={15} />, () => s().setSurface('history'))}
            {item('Downloads', 'Ctrl+J', <Download size={15} />, () => s().setSurface('downloads'))}
            {item('Bookmarks', '', <Bookmark size={15} />, () => s().setSurface('bookmarks'))}
            {item('Notes', '', <StickyNote size={15} />, () => s().setSurface('notes'))}
            <div className="menu-sep" />
            {item('Find in page', 'Ctrl+F', <SearchIcon size={15} />, () => s().openFind())}
            {item('Settings', '', <SettingsIcon size={15} />, () => s().setSurface('settings'))}
          </div>
        </>
      )}
    </div>
  )
}
