import { useEffect, useState } from 'react'
import { useStore } from '../store'
import { api, isElectron } from '../api'
import type { AiProviderId, Settings as SettingsType, ThemeMode } from '../../shared/types'

const ACCENTS = ['#6d5efc', '#22c55e', '#f59e0b', '#06b6d4', '#ec4899', '#ef4444']
const MODELS: Record<AiProviderId, { id: string; label: string }[]> = {
  anthropic: [
    { id: 'claude-opus-4-8', label: 'Claude Opus 4.8' },
    { id: 'claude-sonnet-5', label: 'Claude Sonnet 5' },
    { id: 'claude-haiku-4-5-20251001', label: 'Claude Haiku 4.5' },
  ],
  openai: [
    { id: 'gpt-4o', label: 'GPT-4o' },
    { id: 'gpt-4o-mini', label: 'GPT-4o mini' },
    { id: 'o3-mini', label: 'o3-mini' },
  ],
}

export function Settings() {
  const settings = useStore((s) => s.settings)
  const set = useStore((s) => s.setSetting)
  const setKey = useStore((s) => s.setKey)
  const hasKey = useStore((s) => s.aiProviderHasKey)

  const [keyInput, setKeyInput] = useState('')
  const [version, setVersion] = useState('')
  const [testResult, setTestResult] = useState<string>('')
  const searchKeyPresent = useStore((s) => s.searchWebKeyPresent)
  const [braveKey, setBraveKey] = useState('')
  const [braveResult, setBraveResult] = useState('')
  const syncUser = useStore((s) => s.syncUser)
  const syncBusy = useStore((s) => s.syncBusy)
  const syncMessage = useStore((s) => s.syncMessage)
  const lastSyncedAt = useStore((s) => s.lastSyncedAt)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  useEffect(() => {
    void (async () => setVersion((await api.appInfo.version()) as string))()
  }, [])

  const upd = <K extends keyof SettingsType>(k: K, v: SettingsType[K]) => void set(k, v)

  const testConnection = async () => {
    if (!isElectron) {
      setTestResult('✗ AI runs only in the desktop app. Launch it with: npm run dev:electron')
      return
    }
    // Save whatever is currently typed first, so Test always checks the latest key.
    if (keyInput) {
      try {
        await setKey(settings.aiProvider, keyInput)
        setKeyInput('')
      } catch (e) {
        setTestResult(`✗ Could not save key: ${(e as Error).message}`)
        return
      }
    }
    setTestResult('Testing…')
    const res = (await api.ai.validate(settings.aiProvider)) as { ok: boolean; message: string }
    setTestResult((res.ok ? '✓ ' : '✗ ') + res.message)
  }

  return (
    <div className="settings">
      <h1>Settings</h1>

      <section className="card glass">
        <h3>General</h3>
        <Row label="Your name (shown on the home page)">
          <input
            value={settings.displayName}
            onChange={(e) => upd('displayName', e.target.value)}
            placeholder="e.g. Alex, or your business name"
          />
        </Row>
        <Row label="Restore previous session on startup">
          <input type="checkbox" checked={settings.restoreSession} onChange={(e) => upd('restoreSession', e.target.checked)} />
        </Row>
        <Row label="Home / new tab">
          <input value={settings.homePage} onChange={(e) => upd('homePage', e.target.value)} />
        </Row>
        <Row label="Default search engine">
          <select value={settings.searchEngine} onChange={(e) => upd('searchEngine', e.target.value as SettingsType['searchEngine'])}>
            <option value="google">Google</option>
            <option value="bing">Bing</option>
            <option value="duckduckgo">DuckDuckGo</option>
            <option value="brave">Brave Search</option>
          </select>
        </Row>
        <Row label="Ask where to save downloads">
          <input type="checkbox" checked={settings.askWhereToSave} onChange={(e) => upd('askWhereToSave', e.target.checked)} />
        </Row>
        <Row label="Download folder">
          <button className="btn" onClick={() => void api.appInfo.chooseDownloadDir()}>
            {settings.downloadDir || 'Choose folder…'}
          </button>
        </Row>
      </section>

      <section className="card glass">
        <h3>Appearance</h3>
        <Row label="Theme">
          <div className="segmented">
            {(['dark', 'light', 'system'] as ThemeMode[]).map((t) => (
              <button key={t} className={settings.theme === t ? 'active' : ''} onClick={() => upd('theme', t)}>{t}</button>
            ))}
          </div>
        </Row>
        <Row label="Accent">
          <div className="accents">
            {ACCENTS.map((c) => (
              <button key={c} className={`accent-dot ${settings.accent === c ? 'active' : ''}`} style={{ background: c }} onClick={() => upd('accent', c)} />
            ))}
          </div>
        </Row>
        <Row label="Compact tabs">
          <input type="checkbox" checked={settings.compactTabs} onChange={(e) => upd('compactTabs', e.target.checked)} />
        </Row>
        <Row label="Show sidebar">
          <input type="checkbox" checked={settings.showSidebar} onChange={(e) => upd('showSidebar', e.target.checked)} />
        </Row>
        <Row label="Reduced motion">
          <input type="checkbox" checked={settings.reduceMotion} onChange={(e) => upd('reduceMotion', e.target.checked)} />
        </Row>
        <Row label="Dyslexia-friendly font">
          <input type="checkbox" checked={settings.dyslexiaFont} onChange={(e) => upd('dyslexiaFont', e.target.checked)} />
        </Row>
      </section>

      <section className="card glass">
        <h3>AI</h3>
        <Row label="Provider">
          <select
            value={settings.aiProvider}
            onChange={(e) => {
              const p = e.target.value as AiProviderId
              upd('aiProvider', p)
              upd('aiModel', MODELS[p][0].id)
              setKeyInput('')
              setTestResult('')
              void useStore.getState().refreshKeyStatus()
            }}
          >
            <option value="anthropic">Anthropic (Claude)</option>
            <option value="openai">OpenAI</option>
          </select>
        </Row>
        <Row label="Model">
          <select value={settings.aiModel} onChange={(e) => upd('aiModel', e.target.value)}>
            {MODELS[settings.aiProvider].map((m) => (
              <option key={m.id} value={m.id}>{m.label}</option>
            ))}
          </select>
        </Row>
        <Row label={`API key ${hasKey ? '(saved ✓)' : ''}`}>
          <div className="key-input">
            <input
              type="password"
              value={keyInput}
              onChange={(e) => setKeyInput(e.target.value)}
              placeholder={hasKey ? '•••••••• stored securely' : 'Paste API key'}
            />
            <button className="btn" onClick={() => keyInput && void setKey(settings.aiProvider, keyInput).then(() => setKeyInput(''))}>Save</button>
            <button className="btn" onClick={() => void testConnection()}>Test</button>
          </div>
        </Row>
        {testResult && <p className="muted small">{testResult}</p>}
        <Row label="Default summary style">
          <select value={settings.defaultSummaryStyle} onChange={(e) => upd('defaultSummaryStyle', e.target.value as SettingsType['defaultSummaryStyle'])}>
            <option value="brief">Brief</option>
            <option value="detailed">Detailed</option>
            <option value="keypoints">Key points</option>
            <option value="executive">Executive</option>
          </select>
        </Row>
        <Row label="Page-context consent">
          <select value={settings.pageContextConsent} onChange={(e) => upd('pageContextConsent', e.target.value as SettingsType['pageContextConsent'])}>
            <option value="ask">Ask every time</option>
            <option value="session">Remember for session</option>
            <option value="always">Always allow</option>
          </select>
        </Row>
        <p className="muted small">
          Keys are encrypted with your operating system's secure store (safeStorage) and never
          written in plain text. Page content is only sent to your AI provider after you consent.
        </p>
      </section>

      <section className="card glass">
        <h3>Web search</h3>
        <p className="muted small">
          Searches show an AI answer plus web links inside SeaBrez — you never land on Google.
        </p>
        <Row label="Web results source">
          <select
            value={settings.webSearchSource}
            onChange={(e) => upd('webSearchSource', e.target.value as SettingsType['webSearchSource'])}
          >
            <option value="duckduckgo">DuckDuckGo — no key, no signup (default)</option>
            <option value="brave">Brave Search API — needs a key</option>
          </select>
        </Row>
        {settings.webSearchSource === 'duckduckgo' && (
          <p className="muted small">Nothing to set up — DuckDuckGo results work out of the box.</p>
        )}
        {settings.webSearchSource === 'brave' && (
          <>
            <p className="muted small">
              Get a key at{' '}
              <button
                className="linklike"
                onClick={() => void api.appInfo.openExternal('https://api-dashboard.search.brave.com/register')}
              >
                api-dashboard.search.brave.com
              </button>{' '}
              (paid plan; includes ~1,000 free requests/month in credits).
            </p>
            <Row label={`Brave Search API key ${searchKeyPresent ? '(saved ✓)' : ''}`}>
              <div className="key-input">
                <input
                  type="password"
                  value={braveKey}
                  onChange={(e) => setBraveKey(e.target.value)}
                  placeholder={searchKeyPresent ? '•••••••• stored securely' : 'Paste Brave Search key'}
                />
                <button
                  className="btn"
                  onClick={() =>
                    void (async () => {
                      if (braveKey) {
                        await api.search.setKey(braveKey)
                        setBraveKey('')
                        await useStore.getState().refreshSearchKeyStatus()
                      }
                      setBraveResult('Testing…')
                      const r = (await api.search.validate()) as { ok: boolean; message: string }
                      setBraveResult((r.ok ? '✓ ' : '✗ ') + r.message)
                    })()
                  }
                >
                  Save &amp; Test
                </button>
              </div>
            </Row>
            {braveResult && <p className="muted small">{braveResult}</p>}
          </>
        )}
      </section>

      <section className="card glass">
        <h3>Account &amp; Sync</h3>
        <p className="muted small">
          Sign in to sync your bookmarks and notes across devices via your own free Supabase
          project. See <code>docs/cloud-sync.md</code> for the 5-minute setup (create project, run
          one SQL snippet, paste the two values below). No credit card.
        </p>
        <Row label="Supabase Project URL">
          <input
            value={settings.syncUrl}
            onChange={(e) => upd('syncUrl', e.target.value.trim())}
            placeholder="https://xxxx.supabase.co"
          />
        </Row>
        <Row label="Supabase anon public key">
          <input
            type="password"
            value={settings.syncAnonKey}
            onChange={(e) => upd('syncAnonKey', e.target.value.trim())}
            placeholder="eyJhbGci… (anon public key)"
          />
        </Row>

        {settings.syncUrl && settings.syncAnonKey ? (
          syncUser ? (
            <div className="sync-signedin">
              <p>
                Signed in as <strong>{syncUser.email}</strong>
                {lastSyncedAt ? ` · last synced ${new Date(lastSyncedAt).toLocaleTimeString()}` : ''}
              </p>
              <div className="btn-row">
                <button className="btn primary" disabled={syncBusy} onClick={() => void useStore.getState().syncNow()}>
                  {syncBusy ? 'Syncing…' : 'Sync now'}
                </button>
                <button className="btn" onClick={() => void useStore.getState().syncSignOut()}>
                  Sign out
                </button>
              </div>
            </div>
          ) : (
            <div className="sync-auth">
              <Row label="Email">
                <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
              </Row>
              <Row label="Password">
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 6 characters"
                />
              </Row>
              <div className="btn-row">
                <button
                  className="btn primary"
                  disabled={syncBusy || !email || !password}
                  onClick={() => void useStore.getState().syncSignIn(email, password)}
                >
                  {syncBusy ? '…' : 'Sign in'}
                </button>
                <button
                  className="btn"
                  disabled={syncBusy || !email || !password}
                  onClick={() => void useStore.getState().syncSignUp(email, password)}
                >
                  Create account
                </button>
              </div>
            </div>
          )
        ) : (
          <p className="muted small">Enter your Supabase URL and anon key above to enable sign-in.</p>
        )}
        {syncMessage && <p className="muted small">{syncMessage}</p>}
      </section>

      <section className="card glass">
        <h3>Privacy</h3>
        <Row label="Do Not Track">
          <input type="checkbox" checked={settings.doNotTrack} onChange={(e) => upd('doNotTrack', e.target.checked)} />
        </Row>
        <div className="btn-row">
          <button className="btn" onClick={() => void api.appInfo.clearData({ history: true }).then(() => useStore.getState().loadHistory())}>Clear history</button>
          <button className="btn" onClick={() => void api.appInfo.clearData({ downloads: true }).then(() => useStore.getState().loadDownloads())}>Clear downloads</button>
        </div>
        <ul className="briefing">
          <li>Tracker &amp; ad request blocking enabled</li>
          <li>Sandboxed, site-isolated web content</li>
          <li>Sensitive permissions denied unless you allow them per-site</li>
        </ul>
      </section>

      <section className="card glass">
        <h3>Advanced</h3>
        <Row label="Hardware acceleration (restart to apply)">
          <input type="checkbox" checked={settings.hardwareAcceleration} onChange={(e) => upd('hardwareAcceleration', e.target.checked)} />
        </Row>
        <p className="muted small">SeaBrez v{version || '0.1.0'} · Chromium via Electron</p>
      </section>
    </div>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="setting-row">
      <label>{label}</label>
      {children}
    </div>
  )
}
