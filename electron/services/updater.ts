import electronUpdater from 'electron-updater'
import { app } from 'electron'
import { logger } from './logger'

// electron-updater ships as CommonJS; destructure the default export so this
// works from the ESM main bundle.
const { autoUpdater } = electronUpdater

type Broadcast = (channel: string, payload: unknown) => void
type UpdateState = { state: string; version: string | null; message?: string }

let broadcast: Broadcast = () => {}
let initialized = false

// Remember the latest status so a newly-opened window can sync it (an update may
// have been downloaded before the renderer subscribed, or on a prior launch).
let last: UpdateState = { state: 'idle', version: null }

function push(state: string, extra: { version?: string; message?: string } = {}) {
  last = { state, version: extra.version ?? last.version, message: extra.message }
  logger.info('updater', state, last.version ?? '', extra.message ?? '')
  broadcast('update:status', { state, version: last.version, message: extra.message })
}

export function getUpdateState(): UpdateState {
  return last
}

// Wire the GitHub-releases auto-updater. Updates are downloaded automatically in
// the background; the renderer is told when one is available/downloaded so it
// can show a notification with a "Restart & update" action. The `latest.yml`
// published alongside each release (see build.publish = github) is the feed.
export function initUpdater(bc: Broadcast) {
  broadcast = bc
  if (initialized) return
  initialized = true

  // Only a packaged build has the embedded app-update.yml feed; dev has none.
  if (!app.isPackaged) return

  autoUpdater.autoDownload = true
  autoUpdater.autoInstallOnAppQuit = true

  autoUpdater.on('checking-for-update', () => push('checking'))
  autoUpdater.on('update-available', (info) => push('available', { version: info.version }))
  autoUpdater.on('update-not-available', () => push('none'))
  autoUpdater.on('download-progress', (p) =>
    broadcast('update:progress', { percent: Math.round(p.percent) }),
  )
  autoUpdater.on('update-downloaded', (info) => push('downloaded', { version: info.version }))
  autoUpdater.on('error', (err) => {
    const message = err?.message ?? String(err)
    logger.error('updater', message)
    push('error', { message })
  })

  // Check shortly after launch, then every 3 hours.
  const check = () =>
    autoUpdater.checkForUpdates().catch((e) => logger.error('updater-check', (e as Error).message))
  setTimeout(check, 8000)
  setInterval(check, 3 * 60 * 60 * 1000)
}

// Manual "Check for updates" from the UI.
export function checkForUpdatesNow(): { ok: boolean; reason?: string } {
  if (!app.isPackaged) return { ok: false, reason: 'dev' }
  autoUpdater.checkForUpdates().catch((e) => logger.error('updater-check', (e as Error).message))
  return { ok: true }
}

// Quit and install the downloaded update, then relaunch.
export function quitAndInstall(): { ok: boolean } {
  if (!app.isPackaged) return { ok: false }
  // Defer so the IPC reply can flush before the app tears down.
  setImmediate(() => autoUpdater.quitAndInstall(false, true))
  return { ok: true }
}
