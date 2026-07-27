# AI Provider System

All AI features route through one abstraction so providers are swappable.

## Interface

`electron/ai/providers.ts` defines:

```ts
interface Provider {
  id: 'openai' | 'anthropic'
  name: string
  listModels(): AiModel[]
  validateCredentials(apiKey: string): Promise<boolean>
  stream(args: StreamArgs): Promise<void> // calls onDelta(text) as tokens arrive
}
```

Implemented: **OpenAI** (`/v1/chat/completions`, SSE) and **Anthropic**
(`/v1/messages`, SSE). Adding Gemini/Azure/Ollama = add one `Provider` object to
the `PROVIDERS` map and a model list in Settings.

## Request lifecycle

1. Renderer builds messages + system prompt (`shared/prompts.ts`) and calls
   `window.intelleson.ai.chat(request)` with a unique `requestId`.
2. `AiService` (`electron/ai/service.ts`) resolves the stored key via
   `keystore.getApiKey`, opens an `AbortController`, and calls the provider's
   `stream`.
3. Each delta is pushed to the renderer as
   `{ type: 'delta', requestId, text }` on the `ai:stream` channel; the store
   appends it to the active assistant message.
4. `{ type: 'done' }` or `{ type: 'error', message }` ends the stream.
   `ai:cancel(requestId)` aborts in flight.

## Keys

Keys are entered in **Settings → AI**, encrypted with `safeStorage`
(`electron/security/keystore.ts`), and stored as ciphertext in the settings
table. They are only ever read in the main process, never sent to a renderer,
never logged. **Test** in Settings calls `validateCredentials`.

## Prompt safety

Page content is wrapped as untrusted (`shared/text.ts#wrapUntrustedContext`)
with an explicit instruction not to follow embedded directions, and an extra
warning when the extractor flags AI-directed text. See
[browser-security.md](browser-security.md).
