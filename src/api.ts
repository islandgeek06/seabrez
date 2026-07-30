import type { SeaBrezApi } from '../electron/preload'

declare global {
  interface Window {
    intelleson?: SeaBrezApi
  }
}

export const isElectron = Boolean(window.intelleson?.isElectron)

// When running as a plain web page (`npm run dev` opened in a browser for a UI
// preview), there is no main process. This deep no-op proxy lets the whole UI
// render and be explored; data calls resolve to empty values.
function makeStub(): SeaBrezApi {
  const asyncNoop = () => Promise.resolve(undefined as unknown)
  const listNoop = () => Promise.resolve([] as unknown)
  const group = new Proxy(
    {},
    {
      get(_t, prop) {
        if (prop === 'list' || prop === 'search') return listNoop
        if (prop === 'get') return () => Promise.resolve(undefined)
        return asyncNoop
      },
    },
  )
  return new Proxy(
    { isElectron: false, on: () => () => {} } as unknown as SeaBrezApi,
    {
      get(target, prop) {
        if (prop in target) return (target as Record<string, unknown>)[prop as string]
        return group
      },
    },
  )
}

export const api: SeaBrezApi = window.intelleson ?? makeStub()
