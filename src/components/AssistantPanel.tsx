import { useEffect, useRef, useState } from 'react'
import { Sparkles, X, Trash2, Copy, StickyNote, Square } from 'lucide-react'
import { useStore } from '../store'
import { isElectron } from '../api'

const QUICK = [
  { label: 'Summarize', run: () => useStore.getState().summarize() },
  { label: 'Explain', run: () => useStore.getState().explainPage() },
  { label: 'Key points', run: () => useStore.getState().extract('claims') },
  { label: 'Compare tabs', run: () => useStore.getState().setComparePicker(true) },
]

export function AssistantPanel() {
  const chat = useStore((s) => s.chat)
  const aiBusy = useStore((s) => s.aiBusy)
  const ask = useStore((s) => s.ask)
  const cancelAi = useStore((s) => s.cancelAi)
  const clearChat = useStore((s) => s.clearChat)
  const toggleAssistant = useStore((s) => s.toggleAssistant)
  const settings = useStore((s) => s.settings)
  const hasKey = useStore((s) => s.aiProviderHasKey)
  const pendingConsent = useStore((s) => s.pendingConsent)
  const saveNote = useStore((s) => s.saveNote)

  const [input, setInput] = useState('')
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chat, aiBusy])

  const send = (e: React.FormEvent) => {
    e.preventDefault()
    if (input.trim()) {
      void ask(input)
      setInput('')
    }
  }

  return (
    <aside className="assistant glass-strong" aria-label="AI Assistant">
      <header className="assistant-header">
        <div>
          <strong><Sparkles size={14} /> Assistant</strong>
          <span className="assistant-sub">
            {settings.aiProvider} · {settings.aiModel}
            {isElectron && !hasKey && <span className="warn-dot"> · no key</span>}
          </span>
        </div>
        <div className="assistant-header-actions">
          <button className="icon-btn" title="Clear conversation" onClick={clearChat}><Trash2 size={15} /></button>
          <button className="icon-btn" title="Close" onClick={toggleAssistant}><X size={16} /></button>
        </div>
      </header>

      <div className="assistant-quick">
        {QUICK.map((a) => (
          <button key={a.label} className="chip" onClick={() => void a.run()}>{a.label}</button>
        ))}
      </div>

      {isElectron && !hasKey && (
        <div className="assistant-banner">
          Add an {settings.aiProvider} API key in <strong>Settings → AI</strong> to enable responses.
        </div>
      )}

      <div className="assistant-messages">
        {chat.length === 0 && (
          <div className="assistant-empty">
            <p>Ask about the current page, write, plan, or research.</p>
            <p className="muted small">Page-aware actions ask permission before reading a page.</p>
          </div>
        )}
        {chat.map((m) => (
          <div key={m.id} className={`msg msg-${m.role}`}>
            <div className="msg-role">{m.role === 'user' ? 'You' : <Sparkles size={13} />}</div>
            <div className="msg-body">
              {m.content || (aiBusy ? <TypingDots /> : '')}
              {m.role === 'assistant' && m.content && (
                <div className="msg-actions">
                  <button className="msg-action" onClick={() => navigator.clipboard.writeText(m.content)}>
                    <Copy size={12} /> Copy
                  </button>
                  <button
                    className="msg-action"
                    onClick={() => void saveNote({ title: 'AI note', content: m.content })}
                  >
                    <StickyNote size={12} /> Save to notes
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}
        <div ref={endRef} />
      </div>

      {pendingConsent && <ConsentBar />}

      <form className="assistant-input" onSubmit={send}>
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              send(e)
            }
          }}
          placeholder="Message SeaBrez…"
          rows={2}
          aria-label="Message the assistant"
        />
        {aiBusy ? (
          <button type="button" className="btn" onClick={cancelAi} title="Stop">
            <Square size={14} />
          </button>
        ) : (
          <button className="btn primary" type="submit">Send</button>
        )}
      </form>
    </aside>
  )
}

function ConsentBar() {
  const pc = useStore((s) => s.pendingConsent)!
  const approve = useStore((s) => s.approveConsent)
  const deny = useStore((s) => s.denyConsent)
  return (
    <div className="consent-bar">
      <p>
        Use the contents of <strong>{pc.origin}</strong> as AI context for “{pc.label}”?
      </p>
      <div className="consent-actions">
        <button className="btn primary" onClick={() => approve('once')}>Allow once</button>
        <button className="btn" onClick={() => approve('site')}>Always for this site</button>
        <button className="btn" onClick={deny}>Deny</button>
      </div>
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
