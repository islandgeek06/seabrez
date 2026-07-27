import type { WebContents } from 'electron'
import type { ExtractedPage } from '../../shared/types'

const MAX_CHARS = 40000

// Self-contained extractor injected into the page. Deliberately dependency-free
// (Mozilla Readability can be swapped in later — see ADR-0003). It pulls the
// main readable text while skipping nav/script/style and never touches password
// or credit-card style inputs.
const EXTRACT_SCRIPT = /* js */ `
(() => {
  const clone = document.body ? document.body.cloneNode(true) : null;
  if (!clone) return null;
  clone.querySelectorAll('script,style,noscript,nav,header,footer,aside,svg,iframe').forEach(el => el.remove());
  // Never read sensitive inputs.
  clone.querySelectorAll('input[type=password],input[type=email],input[autocomplete*=cc-],input[name*=card],input[name*=cvv]').forEach(el => el.remove());
  const main = clone.querySelector('main,article,[role=main]') || clone;
  const text = (main.innerText || '').replace(/\\n{3,}/g, '\\n\\n').trim();
  const headings = Array.from(document.querySelectorAll('h1,h2,h3')).map(h => h.innerText.trim()).filter(Boolean).slice(0, 40);
  const desc = document.querySelector('meta[name=description]')?.getAttribute('content') || '';
  return { title: document.title, url: location.href, description: desc, text, headings };
})()
`

// Heuristics for text that appears to address an AI system directly (possible
// prompt injection). We surface a warning; we never claim perfect prevention.
const INJECTION_PATTERNS = [
  /ignore (all |previous |above )?(instructions|prompts)/i,
  /you are (now |a )?(an? )?(ai|assistant|chatgpt|claude)/i,
  /system prompt/i,
  /disregard (the )?(above|previous)/i,
  /\bact as\b.*\b(ai|assistant)\b/i,
]

export async function extractPage(wc: WebContents): Promise<ExtractedPage> {
  const raw = (await wc.executeJavaScript(EXTRACT_SCRIPT, true)) as {
    title: string
    url: string
    description: string
    text: string
    headings: string[]
  } | null

  if (!raw) {
    return {
      url: wc.getURL(),
      title: wc.getTitle(),
      description: '',
      text: '',
      headings: [],
      truncated: false,
      containsAiInstructions: false,
    }
  }

  const truncated = raw.text.length > MAX_CHARS
  const text = truncated ? raw.text.slice(0, MAX_CHARS) : raw.text
  const containsAiInstructions = INJECTION_PATTERNS.some((p) => p.test(text))

  return {
    url: raw.url,
    title: raw.title,
    description: raw.description,
    text,
    headings: raw.headings,
    truncated,
    containsAiInstructions,
  }
}
