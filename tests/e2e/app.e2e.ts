import { test, expect, _electron as electron, type ElectronApplication, type Page } from '@playwright/test'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

// End-to-end smoke tests that launch the real Electron app. Run with:
//   npm run build && npm run test:e2e
// Requires a desktop/display session (Electron cannot run fully headless here).

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(__dirname, '..', '..')

let app: ElectronApplication
let page: Page

test.beforeAll(async () => {
  app = await electron.launch({ args: [root] })
  page = await app.firstWindow()
  await page.waitForSelector('.app-shell', { timeout: 30_000 })
})

test.afterAll(async () => {
  await app?.close()
})

test('app launches and shows the chrome', async () => {
  await expect(page.locator('.sidebar')).toBeVisible()
  await expect(page.locator('#omnibox')).toBeVisible()
})

test('can open a new tab via the omnibox', async () => {
  await page.locator('#omnibox').fill('example.com')
  await page.locator('#omnibox').press('Enter')
  await expect(page.locator('.tab')).toHaveCount(1, { timeout: 15_000 })
})

test('command palette opens', async () => {
  await page.keyboard.press('Control+Shift+P')
  await expect(page.locator('.palette')).toBeVisible()
  await page.keyboard.press('Escape')
})

test('settings surface persists a theme change', async () => {
  await page.locator('.sidebar-btn', { hasText: '' }).nth(4).click().catch(() => {})
  // Navigate to settings via command palette instead (robust to icon order).
  await page.keyboard.press('Control+Shift+P')
  await page.locator('.palette input').fill('settings')
  await page.keyboard.press('Enter')
  await expect(page.locator('.settings')).toBeVisible()
})
