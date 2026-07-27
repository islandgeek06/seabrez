import { net } from 'electron'
import type { AiChatMessage, AiModel } from '../../shared/types'

// Provider abstraction. Streaming happens in the MAIN process so API keys never
// enter a renderer and browser CORS rules don't apply. Each provider normalizes
// its wire format to a simple async delta callback.

export interface StreamArgs {
  model: string
  system?: string
  messages: AiChatMessage[]
  apiKey: string
  signal: AbortSignal
  onDelta: (text: string) => void
}

export interface ValidationResult {
  ok: boolean
  message: string
}

export interface Provider {
  id: 'openai' | 'anthropic'
  name: string
  listModels(): AiModel[]
  validateCredentials(apiKey: string): Promise<ValidationResult>
  stream(args: StreamArgs): Promise<void>
}

// Server-sent-events line reader shared by both providers.
async function readSse(
  res: Response,
  onEvent: (data: string) => void,
): Promise<void> {
  const reader = res.body?.getReader()
  if (!reader) return
  const decoder = new TextDecoder()
  let buffer = ''
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''
    for (const line of lines) {
      const trimmed = line.trim()
      if (trimmed.startsWith('data:')) onEvent(trimmed.slice(5).trim())
    }
  }
}

// fetch that rejects after `ms` instead of hanging forever (e.g. behind a
// firewall/proxy where the connection never completes).
// Uses Electron's net.fetch (Chromium network stack) so AI requests honor the
// system proxy/VPN exactly like the browser tabs do. Rejects after `ms` instead
// of hanging forever.
async function fetchWithTimeout(url: string, init: RequestInit, ms = 12000): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), ms)
  try {
    return await net.fetch(url, { ...init, signal: controller.signal })
  } finally {
    clearTimeout(timer)
  }
}

const openai: Provider = {
  id: 'openai',
  name: 'OpenAI',
  listModels: () => [
    { id: 'gpt-4o', label: 'GPT-4o' },
    { id: 'gpt-4o-mini', label: 'GPT-4o mini' },
    { id: 'o3-mini', label: 'o3-mini' },
  ],
  async validateCredentials(apiKey) {
    try {
      const res = await fetchWithTimeout('https://api.openai.com/v1/models', {
        headers: { authorization: `Bearer ${apiKey}` },
      })
      if (res.ok) return { ok: true, message: 'Connection OK' }
      if (res.status === 401) return { ok: false, message: 'Invalid API key (401 Unauthorized).' }
      if (res.status === 429)
        return { ok: false, message: 'Key valid but rate-limited/over quota (429). Check billing.' }
      return { ok: false, message: `OpenAI returned HTTP ${res.status}.` }
    } catch (e) {
      const aborted = (e as Error).name === 'AbortError'
      return {
        ok: false,
        message: aborted
          ? 'Timed out reaching OpenAI — likely a firewall, VPN, or proxy blocking the app.'
          : `Network error reaching OpenAI: ${(e as Error).message}`,
      }
    }
  },
  async stream({ model, system, messages, apiKey, signal, onDelta }) {
    const res = await net.fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      signal,
      headers: { 'content-type': 'application/json', authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model,
        stream: true,
        messages: [...(system ? [{ role: 'system', content: system }] : []), ...messages],
      }),
    })
    if (!res.ok) throw new Error(await friendlyError(res))
    await readSse(res, (data) => {
      if (data === '[DONE]') return
      try {
        const json = JSON.parse(data)
        const delta = json.choices?.[0]?.delta?.content
        if (delta) onDelta(delta)
      } catch {
        /* ignore keep-alives */
      }
    })
  },
}

const anthropic: Provider = {
  id: 'anthropic',
  name: 'Anthropic (Claude)',
  listModels: () => [
    { id: 'claude-opus-4-8', label: 'Claude Opus 4.8' },
    { id: 'claude-sonnet-5', label: 'Claude Sonnet 5' },
    { id: 'claude-haiku-4-5-20251001', label: 'Claude Haiku 4.5' },
  ],
  async validateCredentials(apiKey) {
    try {
      // Lightweight probe: a 1-token message. 401/403 => bad key.
      const res = await fetchWithTimeout('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 1,
          messages: [{ role: 'user', content: 'hi' }],
        }),
      })
      if (res.status === 401 || res.status === 403)
        return { ok: false, message: `Invalid API key (${res.status}).` }
      if (res.status === 429)
        return { ok: false, message: 'Key valid but rate-limited (429).' }
      return { ok: true, message: 'Connection OK' }
    } catch (e) {
      const aborted = (e as Error).name === 'AbortError'
      return {
        ok: false,
        message: aborted
          ? 'Timed out reaching Anthropic — likely a firewall, VPN, or proxy blocking the app.'
          : `Network error reaching Anthropic: ${(e as Error).message}`,
      }
    }
  },
  async stream({ model, system, messages, apiKey, signal, onDelta }) {
    const res = await net.fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      signal,
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model,
        max_tokens: 2048,
        stream: true,
        system,
        messages: messages.map((m) => ({ role: m.role === 'system' ? 'user' : m.role, content: m.content })),
      }),
    })
    if (!res.ok) throw new Error(await friendlyError(res))
    await readSse(res, (data) => {
      try {
        const json = JSON.parse(data)
        if (json.type === 'content_block_delta' && json.delta?.text) onDelta(json.delta.text)
      } catch {
        /* ignore */
      }
    })
  },
}

async function friendlyError(res: Response): Promise<string> {
  if (res.status === 401 || res.status === 403) return 'Invalid or missing API key.'
  let msg = ''
  let code = ''
  try {
    const body = await res.json()
    msg = body?.error?.message || ''
    code = body?.error?.code || body?.error?.type || ''
  } catch {
    /* no body */
  }
  if (res.status === 429) {
    if (/quota|insufficient|billing/i.test(`${code} ${msg}`)) {
      return 'Your AI account has no remaining credit/quota. Add billing/credits to your provider (e.g. platform.openai.com/account/billing), or switch provider in Settings → AI.'
    }
    return 'Too many requests right now — wait a few seconds and try again.'
  }
  if (res.status >= 500) return 'The AI provider is temporarily unavailable.'
  return msg || `Request failed (${res.status}).`
}

export const PROVIDERS: Record<'openai' | 'anthropic', Provider> = { openai, anthropic }
