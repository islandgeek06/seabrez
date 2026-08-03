import { net } from 'electron'
import { getApiKey } from '../security/keystore'
import { getSettings } from '../services/settings'
import type { SearchResult, NewsItem } from '../../shared/types'

// Web search sources. Default is DuckDuckGo, which needs NO API key and NO
// signup. Brave is an optional keyed source. All requests go through Electron's
// net stack (system proxy honored).

const BRAVE_KEY_SLOT = 'brave'

function stripTags(s: string): string {
  return (s || '').replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim()
}

function decodeHtml(s: string): string {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&#39;/g, "'")
}

async function fetchTimeout(url: string, init: RequestInit, ms = 12000): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), ms)
  try {
    return await net.fetch(url, { ...init, signal: controller.signal })
  } finally {
    clearTimeout(timer)
  }
}

// --- DuckDuckGo (no key) --------------------------------------------------
// Parses the HTML results endpoint. Unofficial and best-effort — may need
// updating if DuckDuckGo changes its markup.
async function duckduckgoSearch(
  query: string,
): Promise<{ results?: SearchResult[]; error?: string }> {
  try {
    const res = await fetchTimeout(
      `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`,
      {
        method: 'POST',
        headers: {
          'content-type': 'application/x-www-form-urlencoded',
          'user-agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
        },
        body: `q=${encodeURIComponent(query)}`,
      },
    )
    if (!res.ok) return { error: `DuckDuckGo error (HTTP ${res.status}).` }
    const html = await res.text()

    const results: SearchResult[] = []
    // Each result block contains a result__a link and a result__snippet.
    const linkRe =
      /<a[^>]+class="result__a"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g
    const snippetRe = /<a[^>]+class="result__snippet"[^>]*>([\s\S]*?)<\/a>/g
    const snippets: string[] = []
    let sm: RegExpExecArray | null
    while ((sm = snippetRe.exec(html))) snippets.push(stripTags(decodeHtml(sm[1])))

    let m: RegExpExecArray | null
    let i = 0
    while ((m = linkRe.exec(html)) && results.length < 10) {
      let url = decodeHtml(m[1])
      // DuckDuckGo wraps external links: //duckduckgo.com/l/?uddg=<encoded>
      const uddg = url.match(/[?&]uddg=([^&]+)/)
      if (uddg) url = decodeURIComponent(uddg[1])
      if (url.startsWith('//')) url = 'https:' + url
      const title = stripTags(decodeHtml(m[2]))
      if (title && /^https?:\/\//.test(url)) {
        results.push({ title, url, description: snippets[i] ?? '' })
      }
      i++
    }
    if (results.length === 0) return { error: 'No results (DuckDuckGo returned an unexpected page).' }
    return { results }
  } catch (e) {
    const aborted = (e as Error).name === 'AbortError'
    return { error: aborted ? 'Timed out reaching DuckDuckGo.' : (e as Error).message }
  }
}

// --- Brave (keyed) --------------------------------------------------------
async function braveSearch(
  query: string,
): Promise<{ results?: SearchResult[]; error?: string }> {
  const apiKey = getApiKey(BRAVE_KEY_SLOT)
  if (!apiKey) return { error: 'no-key' }
  try {
    const res = await fetchTimeout(
      `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=10`,
      { headers: { Accept: 'application/json', 'X-Subscription-Token': apiKey } },
    )
    if (res.status === 401 || res.status === 403) return { error: 'Invalid Brave Search API key.' }
    if (res.status === 429) return { error: 'Brave Search rate limit reached.' }
    if (!res.ok) return { error: `Brave Search error (HTTP ${res.status}).` }
    const data = await res.json()
    const results: SearchResult[] = (data.web?.results ?? []).slice(0, 10).map(
      (r: { title?: string; url?: string; description?: string }) => ({
        title: stripTags(r.title ?? r.url ?? ''),
        url: r.url ?? '',
        description: stripTags(r.description ?? ''),
      }),
    )
    return { results }
  } catch (e) {
    const aborted = (e as Error).name === 'AbortError'
    return { error: aborted ? 'Timed out reaching Brave Search.' : (e as Error).message }
  }
}

// --- Dispatcher -----------------------------------------------------------
export async function webSearch(
  query: string,
): Promise<{ results?: SearchResult[]; error?: string }> {
  const source = getSettings().webSearchSource
  return source === 'brave' ? braveSearch(query) : duckduckgoSearch(query)
}

// --- Top stories (no key) -------------------------------------------------
// Real, keyless general world news from the Google News RSS top-stories feed.
// Requests go through Electron's net stack, so no CORS/proxy issues.
const NEWS_FEED = 'https://news.google.com/rss?hl=en-US&gl=US&ceid=US:en'

export async function topStories(): Promise<{ items?: NewsItem[]; error?: string }> {
  try {
    const res = await fetchTimeout(NEWS_FEED, {
      headers: {
        Accept: 'application/rss+xml, application/xml, text/xml',
        'user-agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
      },
    })
    if (!res.ok) return { error: `News error (HTTP ${res.status}).` }
    const xml = await res.text()

    const items: NewsItem[] = []
    const itemRe = /<item>([\s\S]*?)<\/item>/g
    let m: RegExpExecArray | null
    while ((m = itemRe.exec(xml)) && items.length < 6) {
      const block = m[1]
      const rawTitle = block.match(/<title>([\s\S]*?)<\/title>/)?.[1] ?? ''
      const link = (block.match(/<link>([\s\S]*?)<\/link>/)?.[1] ?? '').trim()
      const source = decodeHtml(stripTags(block.match(/<source[^>]*>([\s\S]*?)<\/source>/)?.[1] ?? '')).trim()
      let title = decodeHtml(stripTags(rawTitle)).trim()
      // Google News appends " - Publisher" to titles; drop it when redundant.
      if (source && title.endsWith(` - ${source}`)) {
        title = title.slice(0, -(source.length + 3)).trim()
      }
      if (title && /^https?:\/\//.test(link)) {
        items.push({ title, url: link, source })
      }
    }
    if (items.length === 0) return { error: 'No stories right now.' }
    return { items }
  } catch (e) {
    const aborted = (e as Error).name === 'AbortError'
    return { error: aborted ? 'Timed out fetching news.' : (e as Error).message }
  }
}

export async function validateSearchKey(): Promise<{ ok: boolean; message: string }> {
  const res = await braveSearch('test')
  if (res.error === 'no-key') return { ok: false, message: 'No Brave Search key saved yet.' }
  if (res.error) return { ok: false, message: res.error }
  return { ok: true, message: 'Connection OK' }
}
