import { PROVIDERS } from './providers'
import { getApiKey } from '../security/keystore'
import type { AiChatRequest, AiStreamEvent } from '../../shared/types'

type Send = (event: AiStreamEvent) => void

// Coordinates streaming AI requests: resolves the stored key, runs the provider
// stream, forwards deltas to the requesting window, and supports cancellation.
// Stateless w.r.t. windows — the caller passes a `send` bound to the window that
// made the request, so streams go back to the right renderer (multi-window safe).
export class AiService {
  private inflight = new Map<string, AbortController>()

  async chat(req: AiChatRequest, send: Send) {
    const provider = PROVIDERS[req.provider]
    if (!provider) {
      send({ type: 'error', requestId: req.requestId, message: 'Unknown provider.' })
      return
    }
    const apiKey = getApiKey(req.provider)
    if (!apiKey) {
      send({
        type: 'error',
        requestId: req.requestId,
        message: `No ${provider.name} API key set. Add one in Settings → AI.`,
      })
      return
    }
    const controller = new AbortController()
    this.inflight.set(req.requestId, controller)
    try {
      await provider.stream({
        model: req.model,
        system: req.system,
        messages: req.messages,
        apiKey,
        signal: controller.signal,
        onDelta: (text) => send({ type: 'delta', requestId: req.requestId, text }),
      })
      send({ type: 'done', requestId: req.requestId })
    } catch (err) {
      const message = controller.signal.aborted ? 'Generation cancelled.' : (err as Error).message
      send({ type: 'error', requestId: req.requestId, message })
    } finally {
      this.inflight.delete(req.requestId)
    }
  }

  cancel(requestId: string) {
    this.inflight.get(requestId)?.abort()
  }

  async validate(provider: 'openai' | 'anthropic'): Promise<{ ok: boolean; message: string }> {
    const key = getApiKey(provider)
    if (!key) return { ok: false, message: 'No API key saved yet — click Save first.' }
    // Hard guarantee the UI resolves, even if the underlying fetch never settles.
    const guard = new Promise<{ ok: boolean; message: string }>((resolve) =>
      setTimeout(
        () =>
          resolve({
            ok: false,
            message: 'Timed out (15s) — the app cannot reach the provider (firewall/VPN/proxy or no internet).',
          }),
        15000,
      ),
    )
    try {
      return await Promise.race([PROVIDERS[provider].validateCredentials(key), guard])
    } catch (e) {
      return { ok: false, message: (e as Error).message }
    }
  }

  listModels(provider: 'openai' | 'anthropic') {
    return PROVIDERS[provider].listModels()
  }
}
