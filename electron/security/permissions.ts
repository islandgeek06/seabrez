import { session, type Session } from 'electron'
import { permissions as permRepo } from '../db/database'

// Central permission handling. Sensitive permissions default to DENY unless the
// user has previously allowed them for that origin. Nothing is auto-approved.

const SENSITIVE = new Set([
  'media', // camera / microphone
  'geolocation',
  'notifications',
  'midi',
  'midiSysex',
  'display-capture',
  'clipboard-read',
])

function originOf(url: string): string {
  try {
    return new URL(url).origin
  } catch {
    return url
  }
}

export function installPermissionHandlers(sess: Session = session.defaultSession) {
  sess.setPermissionRequestHandler((wc, permission, callback, details) => {
    const origin = originOf(details.requestingUrl || wc?.getURL() || '')
    if (!SENSITIVE.has(permission)) {
      callback(true)
      return
    }
    const stored = permRepo.get(origin, permission)
    if (stored?.decision === 'allow') return callback(true)
    // Default to deny for sensitive permissions with no explicit allow.
    callback(false)
  })

  sess.setPermissionCheckHandler((_wc, permission, requestingOrigin) => {
    if (!SENSITIVE.has(permission)) return true
    return permRepo.get(originOf(requestingOrigin), permission)?.decision === 'allow'
  })
}
