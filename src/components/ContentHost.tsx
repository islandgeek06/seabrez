import { useEffect, useLayoutEffect, useRef } from 'react'
import { useStore } from '../store'
import { api } from '../api'
import { Dashboard } from './Dashboard'
import { SearchPage } from './SearchPage'
import { Settings } from './Settings'
import { HistoryPage } from './pages/HistoryPage'
import { BookmarksPage } from './pages/BookmarksPage'
import { NotesPage } from './pages/NotesPage'
import { DownloadsPage } from './pages/DownloadsPage'
import { WebEmpty } from './WebEmpty'

// This element occupies the exact rectangle where the native WebContentsView
// (real Chromium page) is positioned. It measures its own bounds and reports
// them to the main process so the page lines up with the chrome — including
// when the sidebar collapses or the AI panel opens.
export function ContentHost() {
  const surface = useStore((s) => s.surface)
  const assistantOpen = useStore((s) => s.assistantOpen)
  const ref = useRef<HTMLDivElement>(null)

  const report = () => {
    const el = ref.current
    if (!el) return
    const r = el.getBoundingClientRect()
    api.view.setContentBounds({
      x: Math.round(r.left),
      y: Math.round(r.top),
      width: Math.round(r.width),
      height: Math.round(r.height),
    })
  }

  useLayoutEffect(report, [surface, assistantOpen])

  useEffect(() => {
    report()
    const ro = new ResizeObserver(report)
    if (ref.current) ro.observe(ref.current)
    window.addEventListener('resize', report)
    return () => {
      ro.disconnect()
      window.removeEventListener('resize', report)
    }
  }, [])

  return (
    <div className="content-region" ref={ref}>
      {surface === 'web' && <WebEmpty />}
      {surface === 'newtab' && <Dashboard />}
      {surface === 'search' && <SearchPage />}
      {surface === 'settings' && <Settings />}
      {surface === 'history' && <HistoryPage />}
      {surface === 'bookmarks' && <BookmarksPage />}
      {surface === 'notes' && <NotesPage />}
      {surface === 'downloads' && <DownloadsPage />}
    </div>
  )
}
