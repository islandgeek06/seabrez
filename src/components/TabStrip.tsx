import { useState } from 'react'
import { X, Pin, Volume2, VolumeX, Plus, Copy, Shield } from 'lucide-react'
import { useStore } from '../store'
import { api } from '../api'
import type { LiveTab } from '../../shared/types'

export function TabStrip() {
  const tabs = useStore((s) => s.tabs)
  const activeTabId = useStore((s) => s.activeTabId)
  const activateTab = useStore((s) => s.activateTab)
  const closeTab = useStore((s) => s.closeTab)
  const newTab = useStore((s) => s.newTab)
  const [menu, setMenu] = useState<{ id: number; x: number; y: number } | null>(null)
  const [dragId, setDragId] = useState<number | null>(null)

  const onDrop = (targetId: number) => {
    if (dragId == null || dragId === targetId) return
    const toIndex = tabs.findIndex((t) => t.id === targetId)
    api.tabs.reorder(dragId, toIndex)
    setDragId(null)
  }

  return (
    <div className="tabstrip" role="tablist">
      {tabs.map((t: LiveTab) => (
        <div
          key={t.id}
          role="tab"
          aria-selected={t.id === activeTabId}
          className={`tab ${t.id === activeTabId ? 'active' : ''} ${t.isPrivate ? 'private' : ''} ${t.pinned ? 'pinned' : ''}`}
          onClick={() => activateTab(t.id)}
          onAuxClick={(e) => e.button === 1 && closeTab(t.id)}
          onContextMenu={(e) => {
            e.preventDefault()
            setMenu({ id: t.id, x: e.clientX, y: e.clientY })
          }}
          draggable
          onDragStart={() => setDragId(t.id)}
          onDragOver={(e) => e.preventDefault()}
          onDrop={() => onDrop(t.id)}
          title={t.title}
        >
          <span className="tab-favicon">
            {t.isPrivate ? (
              <Shield size={13} />
            ) : t.loading ? (
              <span className="spinner" />
            ) : t.favicon ? (
              <img src={t.favicon} alt="" />
            ) : (
              '◦'
            )}
          </span>
          {!t.pinned && <span className="tab-title">{t.title || 'New Tab'}</span>}
          {t.muted && <VolumeX size={12} className="tab-muted" />}
          {!t.pinned && (
            <button
              className="tab-close"
              onClick={(e) => {
                e.stopPropagation()
                closeTab(t.id)
              }}
              aria-label="Close tab"
            >
              <X size={13} />
            </button>
          )}
        </div>
      ))}
      <button className="tab-new" onClick={() => newTab()} title="New tab (Ctrl+T)" aria-label="New tab">
        <Plus size={15} />
      </button>

      {menu && (
        <>
          <div className="menu-backdrop" onClick={() => setMenu(null)} />
          <TabMenu
            id={menu.id}
            x={menu.x}
            y={menu.y}
            onClose={() => setMenu(null)}
          />
        </>
      )}
    </div>
  )
}

function TabMenu({ id, x, y, onClose }: { id: number; x: number; y: number; onClose: () => void }) {
  const tabs = useStore((s) => s.tabs)
  const closeTab = useStore((s) => s.closeTab)
  const tab = tabs.find((t) => t.id === id)
  const item = (label: string, icon: React.ReactNode, fn: () => void) => (
    <button
      className="menu-item"
      onClick={() => {
        fn()
        onClose()
      }}
    >
      {icon}
      {label}
    </button>
  )
  return (
    <div className="context-menu glass-strong" style={{ left: x, top: y }}>
      {item('Duplicate', <Copy size={14} />, () => api.tabs.duplicate(id))}
      {item(tab?.pinned ? 'Unpin' : 'Pin', <Pin size={14} />, () => api.tabs.setPinned(id, !tab?.pinned))}
      {item(tab?.muted ? 'Unmute' : 'Mute', <Volume2 size={14} />, () => api.tabs.setMuted(id, !tab?.muted))}
      <div className="menu-sep" />
      {item('Close', <X size={14} />, () => closeTab(id))}
      {item('Close others', <X size={14} />, () =>
        tabs.filter((t) => t.id !== id).forEach((t) => closeTab(t.id)),
      )}
      {item('Close to the right', <X size={14} />, () => {
        const idx = tabs.findIndex((t) => t.id === id)
        tabs.slice(idx + 1).forEach((t) => closeTab(t.id))
      })}
    </div>
  )
}
