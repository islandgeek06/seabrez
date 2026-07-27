import { defineConfig } from '@playwright/test'

// Electron end-to-end tests. Requires a build first (`npm run build`) and a
// display (Electron needs a GUI session). Uses Playwright's Electron launcher —
// no separate browser download is needed.
export default defineConfig({
  testDir: './tests/e2e',
  testMatch: '**/*.e2e.ts',
  timeout: 60_000,
  fullyParallel: false,
  workers: 1,
  reporter: 'list',
})
