# Testing Guide

## Run

```bash
npm test          # single run
npm run test:watch
```

Tests use **Vitest** with a `jsdom` environment and Testing Library.

## What's covered

| File | Covers |
| --- | --- |
| `tests/url.test.ts` | URL detection & omnibox→URL/search resolution (`shared/url.ts`) |
| `tests/text.test.ts` | content truncation & untrusted-context wrapping (`shared/text.ts`) |
| `tests/sqlite.test.ts` | the sql.js wrapper + migration schema: named/positional binding, `pragma`, and **disk persistence across reopen** |
| `tests/ErrorBoundary.test.tsx` | the render-error boundary component |

The sqlite test is effectively an integration test of the whole data layer: it
applies the real migration SQL, writes/reads rows, closes, reopens the file, and
asserts the data survived.

## Philosophy

- Pure logic lives in `shared/` precisely so it can be tested without Electron.
- AI provider network calls are not hit in tests (no paid API calls); the
  provider abstraction is structured so `stream`/`validateCredentials` can be
  mocked when adding provider-level tests.

## End-to-end (Playwright)

`npm run test:e2e` is wired for Electron E2E (launch, new tab, navigate,
bookmark, history, workspace, private-mode non-persistence). Running it requires
a display and a Playwright install; it is not part of the default CI-less flow.
