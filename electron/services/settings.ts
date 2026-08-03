import { settingsRepo } from '../db/database'
import type { Settings } from '../../shared/types'

const KEY = 'app.settings'

export const DEFAULT_SETTINGS: Settings = {
  theme: 'dark',
  accent: '#6d5efc',
  displayName: '',
  searchEngine: 'google',
  homePage: 'intelleson://newtab',
  restoreSession: false,
  askWhereToSave: false,
  downloadDir: null,
  compactTabs: false,
  showSidebar: true,
  reduceMotion: false,
  dyslexiaFont: false,
  webSearchSource: 'duckduckgo',
  syncUrl: '',
  syncAnonKey: '',
  aiProvider: 'anthropic',
  aiModel: 'claude-sonnet-5',
  defaultSummaryStyle: 'keypoints',
  streamResponses: true,
  pageContextConsent: 'ask',
  hardwareAcceleration: true,
  doNotTrack: true,
}

export function getSettings(): Settings {
  const raw = settingsRepo.getAll()[KEY]
  if (!raw) return DEFAULT_SETTINGS
  try {
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) }
  } catch {
    return DEFAULT_SETTINGS
  }
}

export function updateSettings(patch: Partial<Settings>): Settings {
  const merged = { ...getSettings(), ...patch }
  settingsRepo.set(KEY, JSON.stringify(merged))
  return merged
}
