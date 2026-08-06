import {
  LayoutDashboard,
  Bookmark,
  History,
  StickyNote,
  Download,
  DownloadCloud,
  Settings as SettingsIcon,
  Sparkles,
} from 'lucide-react'
import { useStore } from '../store'
import { Logo } from './Logo'
import { WsIcon } from './WorkspaceIcon'
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
  const update = useStore((s) => s.update)
  const installUpdate = useStore((s) => s.installUpdate)
  const showUpdate = update.status === 'available' || update.status === 'downloaded'

  return (
    <nav className="sidebar" aria-label="Primary">
      <button className="sidebar-logo" title="SeaBrez" onClick={() => setSurface('newtab')}>
        <Logo size={22} />
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
            <WsIcon icon={w.icon} size={18} />
          </button>
        ))}
        <button
          className="sidebar-ws sidebar-ws-add"
          title="Add / manage workspaces"
          aria-label="Add or manage workspaces"
          onClick={() => setSurface('settings')}
        >
          +
        </button>
      </div>

      {showUpdate && (
        <button
          className={`sidebar-update ${update.status === 'downloaded' ? 'ready' : 'downloading'}`}
          title={
            update.status === 'downloaded'
              ? `Update ${update.version ? `v${update.version} ` : ''}ready — click to restart & install`
              : `Downloading update${update.percent ? ` ${update.percent}%` : ''}…`
          }
          aria-label={update.status === 'downloaded' ? 'Update ready to install' : 'Downloading update'}
          onClick={() => (update.status === 'downloaded' ? installUpdate() : setSurface('settings'))}
        >
          {update.status === 'downloaded' ? <DownloadCloud size={19} /> : <Download size={19} />}
          <span className="sidebar-update-dot" />
        </button>
      )}

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
