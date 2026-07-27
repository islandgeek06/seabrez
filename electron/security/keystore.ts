import { safeStorage } from 'electron'
import { settingsRepo } from '../db/database'

// API keys are encrypted with the OS-level secret store (DPAPI on Windows,
// Keychain on macOS, libsecret on Linux) via Electron safeStorage, then the
// ciphertext (base64) is kept in the settings table. Plaintext keys are never
// written to disk or logs.

const KEY_PREFIX = 'apikey.'

export function setApiKey(provider: string, key: string) {
  if (!key) {
    settingsRepo.set(KEY_PREFIX + provider, '')
    return
  }
  if (!safeStorage.isEncryptionAvailable()) {
    // Fallback: still avoid plaintext by refusing rather than storing insecurely.
    throw new Error('OS secure storage is not available on this system.')
  }
  const encrypted = safeStorage.encryptString(key).toString('base64')
  settingsRepo.set(KEY_PREFIX + provider, encrypted)
}

export function getApiKey(provider: string): string | null {
  const stored = settingsRepo.getAll()[KEY_PREFIX + provider]
  if (!stored) return null
  try {
    return safeStorage.decryptString(Buffer.from(stored, 'base64'))
  } catch {
    return null
  }
}

export function hasApiKey(provider: string): boolean {
  return Boolean(settingsRepo.getAll()[KEY_PREFIX + provider])
}
