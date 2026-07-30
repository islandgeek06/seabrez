import type { SearchEngine } from './types'

const SEARCH_URLS: Record<SearchEngine, (q: string) => string> = {
  google: (q) => `https://www.google.com/search?q=${q}`,
  bing: (q) => `https://www.bing.com/search?q=${q}`,
  duckduckgo: (q) => `https://duckduckgo.com/?q=${q}`,
  brave: (q) => `https://search.brave.com/search?q=${q}`,
}

const INTERNAL_SCHEME = 'intelleson:'

// Windows drive path (C:\… or C:/…) or POSIX absolute path (/…, not //).
const WIN_PATH = /^[a-zA-Z]:[\\/]/
const POSIX_PATH = /^\/(?!\/)/

/** Heuristic: does this text look like a URL/path rather than a search query? */
export function isProbablyUrl(input: string): boolean {
  const s = input.trim()
  if (!s) return false
  // Local files & explicit schemes first — these may legitimately contain spaces.
  if (/^file:\/\//i.test(s)) return true
  if (WIN_PATH.test(s) || POSIX_PATH.test(s)) return true
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(s)) return true // has scheme://
  if (s.startsWith(INTERNAL_SCHEME)) return true
  if (/\s/.test(s)) return false
  if (s === 'localhost' || s.startsWith('localhost:')) return true
  // host.tld or host.tld/path, optional port
  return /^[a-z0-9-]+(\.[a-z0-9-]+)+(:\d+)?(\/.*)?$/i.test(s)
}

/** Turn omnibox text into a navigable URL: real URLs & local file paths pass
 *  through (https added to bare hosts), everything else becomes a search. */
export function resolveOmniboxInput(input: string, engine: SearchEngine): string {
  const s = input.trim()
  if (!s) return 'about:blank'
  // Local file paths → file:// URL (encode spaces etc.).
  if (/^file:\/\//i.test(s)) return encodeURI(s)
  if (WIN_PATH.test(s)) return 'file:///' + encodeURI(s.replace(/\\/g, '/'))
  if (POSIX_PATH.test(s)) return 'file://' + encodeURI(s)
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(s) || s.startsWith(INTERNAL_SCHEME)) return s
  if (isProbablyUrl(s)) return `https://${s}`
  return SEARCH_URLS[engine](encodeURIComponent(s))
}

/** Origin of a URL, or '' if it can't be parsed. */
export function safeOrigin(url: string): string {
  try {
    return new URL(url).origin
  } catch {
    return ''
  }
}
