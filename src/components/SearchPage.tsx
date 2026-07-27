import { useState } from 'react'
import { Sparkles, Search, Copy, StickyNote, ExternalLink, Settings as Cog } from 'lucide-react'
import { useStore } from '../store'
import { resolveOmniboxInput } from '../../shared/url'

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}

// Intelleson's own results page: a streamed AI answer plus web links — instead
// of navigating to an external engine's page.
export function SearchPage() {
  const query = useStore((s) => s.searchQuery)
  const answer = useStore((s) => s.searchAnswer)
  const answerBusy = useStore((s) => s.searchAnswerBusy)
  const results = useStore((s) => s.searchResults)
  const resultsBusy = useStore((s) => s.searchResultsBusy)
  const webError = useStore((s) => s.searchWebError)
  const doSearch = useStore((s) => s.doSearch)
  const navigate = useStore((s) => s.navigate)
  const engine = useStore((s) => s.settings.searchEngine)
  const saveNote = useStore((s) => s.saveNote)
  const setSurface = useStore((s) => s.setSurface)

  const [refine, setRefine] = useState(query)

  const openExternal = () => navigate(resolveOmniboxInput(query, engine))

  return (
    <div className="searchpage">
      <form
        className="search-refine glass"
        onSubmit={(e) => {
          e.preventDefault()
          if (refine.trim()) void doSearch(refine)
        }}
      >
        <Search size={17} />
        <input value={refine} onChange={(e) => setRefine(e.target.value)} aria-label="Search" />
      </form>

      {/* AI answer */}
      <section className="card glass search-answer">
        <h3><Sparkles size={14} /> Answer</h3>
        <div className="search-answer-body">
          {answer || (answerBusy ? <TypingDots /> : 'No answer.')}
        </div>
        {answer && !answerBusy && (
          <div className="msg-actions" style={{ opacity: 1 }}>
            <button className="msg-action" onClick={() => navigator.clipboard.writeText(answer)}>
              <Copy size={12} /> Copy
            </button>
            <button
              className="msg-action"
              onClick={() => void saveNote({ title: query, content: answer })}
            >
              <StickyNote size={12} /> Save to notes
            </button>
          </div>
        )}
      </section>

      {/* Web results */}
      <section className="search-web">
        <div className="search-web-head">
          <h3>Sources</h3>
          <button className="chip" onClick={openExternal} title="Open on your external search engine">
            <ExternalLink size={12} /> Open in {engine}
          </button>
        </div>

        {webError === 'no-key' ? (
          <div className="card glass search-nokey">
            <p>Add a free <strong>Brave Search API key</strong> to show web links here (2,000 searches/month, no credit card).</p>
            <div className="webarea-actions">
              <button className="btn primary" onClick={() => setSurface('settings')}>
                <Cog size={14} /> Open Settings → Web search
              </button>
              <button className="btn" onClick={openExternal}>Search externally instead</button>
            </div>
          </div>
        ) : webError ? (
          <p className="muted">⚠️ {webError}</p>
        ) : resultsBusy ? (
          <p className="muted">Searching…</p>
        ) : results.length === 0 ? (
          <p className="muted">No web results.</p>
        ) : (
          <ul className="search-results">
            {results.map((r, i) => (
              <li key={i}>
                <button className="search-result" onClick={() => navigate(r.url)}>
                  <span className="search-result-head">
                    <span className="search-result-num">{i + 1}</span>
                    <span className="search-result-host">{hostOf(r.url)}</span>
                  </span>
                  <span className="search-result-title">{r.title}</span>
                  <span className="search-result-desc">{r.description}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}

function TypingDots() {
  return (
    <span className="typing">
      <span />
      <span />
      <span />
    </span>
  )
}
