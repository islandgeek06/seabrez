import { useStore } from '../store'
import { isElectron } from '../api'

// Shown in the content region only when a "web" surface is active but there is
// no tab drawing over it (or when running the web-only preview).
export function WebEmpty() {
  const tabs = useStore((s) => s.tabs)
  const newTab = useStore((s) => s.newTab)
  if (tabs.length && isElectron) return <div className="webarea-native" />
  return (
    <div className="webarea-empty">
      <div className="webarea-card">
        <h2>◎ Browser</h2>
        {isElectron ? (
          <p>No open tabs. Open one to start browsing with real Chromium.</p>
        ) : (
          <p>
            This is the <strong>web preview</strong> of SeaBrez's interface. Live page
            rendering, SQLite storage, and AI run in the desktop app
            (<code>npm run dev:electron</code>). Every panel here is interactive.
          </p>
        )}
        <div className="webarea-actions">
          <button className="btn primary" onClick={() => void newTab('https://www.wikipedia.org')}>
            Open Wikipedia
          </button>
          <button className="btn" onClick={() => void newTab('https://news.ycombinator.com')}>
            Open Hacker News
          </button>
        </div>
      </div>
    </div>
  )
}
