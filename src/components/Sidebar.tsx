import {
  LayoutDashboard,
  Bookmark,
  History,
  StickyNote,
  Download,
  Settings as SettingsIcon,
  Sparkles,
} from 'lucide-react'
import { useStore } from '../store'
import type { Surface } from '../store'

const NAV: { surface: Surface; icon: typeof Bookmark; label: string }[] = [
  { surface: 'newtab', icon: LayoutDashboard, label: 'Dashboard' },
  { surface: 'bookmarks', icon: Bookmark, label: 'Bookmarks' },
  { surface: 'history', icon: History, label: 'History' },
  { surface: 'notes', icon: StickyNote, label: 'Notes' },
  { surface: 'downloads', icon: Download, label: 'Downloads' },
]

export function Sidebar() {
  const surface = useStore((s) => s.surface)
  const setSurface = useStore((s) => s.setSurface)
  const workspaces = useStore((s) => s.workspaces)
  const activeWs = useStore((s) => s.activeWorkspaceId)
  const setWorkspace = useStore((s) => s.setWorkspace)
  const toggleAssistant = useStore((s) => s.toggleAssistant)

  return (
    <nav className="sidebar" aria-label="Primary">
      <button className="sidebar-logo" title="Intelleson" onClick={() => setSurface('newtab')}>
        ◈
      </button>

      <div className="sidebar-group">
        {NAV.map((it) => {
          const Icon = it.icon
          return (
            <button
              key={it.surface}
              className={`sidebar-btn ${surface === it.surface ? 'active' : ''}`}
              title={it.label}
              aria-label={it.label}
              aria-current={surface === it.surface}
              onClick={() => setSurface(it.surface)}
            >
              <Icon size={19} />
            </button>
          )
        })}
      </div>

      <div className="sidebar-spacer" />

      <div className="sidebar-group" aria-label="Workspaces">
        {workspaces.slice(0, 6).map((w) => (
          <button
            key={w.id}
            className={`sidebar-ws ${w.id === activeWs ? 'active' : ''}`}
            title={w.name}
            style={{ ['--ws-accent' as string]: w.color }}
            onClick={() => setWorkspace(w.id)}
          >
            {w.icon}
          </button>
        ))}
      </div>

      <button
        className={`sidebar-btn ${surface === 'settings' ? 'active' : ''}`}
        title="Settings"
        aria-label="Settings"
        onClick={() => setSurface('settings')}
      >
        <SettingsIcon size={19} />
      </button>
      <button className="sidebar-ai" title="AI Assistant (Ctrl+Shift+A)" onClick={toggleAssistant}>
        <Sparkles size={20} />
      </button>
    </nav>
  )
}
