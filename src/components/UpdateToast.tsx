import { Download, RefreshCw, X } from 'lucide-react'
import { useStore } from '../store'

// A small toast, bottom-left, that appears when a new version is downloading or
// ready to install. Driven by the main-process auto-updater events.
export function UpdateToast() {
  const update = useStore((s) => s.update)
  const install = useStore((s) => s.installUpdate)
  const dismiss = useStore((s) => s.dismissUpdate)

  const show =
    !update.dismissed && (update.status === 'available' || update.status === 'downloaded')
  if (!show) return null

  const ver = update.version ? `v${update.version}` : 'A new version'
  const ready = update.status === 'downloaded'

  return (
    <div className="update-toast glass-strong" role="status" aria-live="polite">
      <span className="update-toast-icon">
        {ready ? <Download size={18} /> : <RefreshCw size={18} className="spin" />}
      </span>
      <div className="update-toast-body">
        <strong>{ready ? `${ver} is ready` : `Downloading ${ver}…`}</strong>
        <span className="update-toast-sub">
          {ready
            ? 'Restart SeaBrez to finish updating.'
            : `${update.percent ? `${update.percent}% ` : ''}It’ll be ready shortly.`}
        </span>
      </div>
      {ready && (
        <button className="btn primary update-toast-action" onClick={install}>
          Restart &amp; update
        </button>
      )}
      <button className="update-toast-close" aria-label="Dismiss" onClick={dismiss}>
        <X size={15} />
      </button>
    </div>
  )
}
