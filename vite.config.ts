import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import electron from 'vite-plugin-electron'
import renderer from 'vite-plugin-electron-renderer'

// Builds up to three targets:
//   - the React renderer (the custom browser chrome / UI)  — always
//   - the Electron main process + preload                  — on build, or when
//     ELECTRON=1 (so `npm run dev` stays a pure web preview and only
//     `npm run dev:electron` launches the desktop app).
export default defineConfig(({ command }) => {
  const wantElectron = command === 'build' || process.env.ELECTRON === '1'

  const electronPlugins = wantElectron
    ? [
        electron([
          {
            entry: 'electron/main.ts',
            vite: {
              build: {
                outDir: 'dist-electron',
                rollupOptions: { external: ['electron', 'sql.js', 'electron-updater'] },
              },
            },
          },
          {
            entry: 'electron/preload.ts',
            onstart(options) {
              options.reload()
            },
            vite: {
              build: {
                outDir: 'dist-electron',
                rollupOptions: {
                  external: ['electron', 'sql.js'],
                  // Emit an ESM preload with an explicit .mjs extension. Electron
                  // loads .mjs preloads as ES modules (sandbox is disabled), which
                  // matches how this bundle references `electron`. A .cjs name here
                  // would be loaded as CommonJS and choke on the ESM import.
                  output: { format: 'es', entryFileNames: 'preload.mjs' },
                },
              },
            },
          },
        ]),
        renderer(),
      ]
    : []

  return {
    plugins: [react(), ...electronPlugins],
    server: { port: 5273 },
    build: { outDir: 'dist' },
  }
})
