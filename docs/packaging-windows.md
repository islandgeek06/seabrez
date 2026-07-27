# Packaging (Windows)

Intelleson uses `electron-builder`. Config lives in the `build` key of
`package.json`.

## Build an installer

```bash
npm run package:win
```

This runs `npm run build` then `electron-builder --win nsis`, producing an
installer under `release/`.

Output:
- **NSIS installer** (`Intelleson Browser Setup <version>.exe`) — not one-click,
  lets the user choose the install directory, creates Start Menu and Desktop
  shortcuts, and registers an uninstaller.

## Producing just the unpacked app

```bash
npx electron-builder --win --dir
```

This writes a fully runnable app to `release/win-unpacked/` (`Intelleson
Browser.exe`) without building the installer — useful for quick testing.

## Developer Mode requirement for the installer

Building the **NSIS installer** makes electron-builder extract its `winCodeSign`
tool, which contains macOS symlinks. On Windows, creating symlinks requires
elevation, so on a standard account you'll see:

```
ERROR: Cannot create symbolic link : A required privilege is not held by the client
```

and `release/` will contain `win-unpacked/` but no `Setup .exe`. Fix by either:

1. **Enable Developer Mode** — Settings → Privacy & security → For developers →
   Developer Mode (lets non-admin processes create symlinks), then re-run
   `npm run package:win`; **or**
2. Run the packaging command from an **elevated (Administrator)** terminal.

The app bundle itself builds fine without this — only the installer step needs it.

## App icon

The icon is generated from `assets/icon.svg`:

```bash
npm run icons
```

This writes `assets/icon.png` (1024²) and a multi-resolution `assets/icon.ico`
(16–256 px) using `sharp` + `png-to-ico`. electron-builder is configured to use
them for the app, installer, and uninstaller (`build.win.icon`,
`build.nsis.installerIcon`, etc.). Edit `assets/icon.svg` and re-run to rebrand.

## Code signing

The build is unsigned by default (Windows SmartScreen will warn users). To sign,
electron-builder reads standard environment variables — **no code changes
needed**:

```bash
# PowerShell
$env:CSC_LINK="C:\path\to\certificate.pfx"   # or a base64 string
$env:CSC_KEY_PASSWORD="your-cert-password"
npm run package:win
```

For EV/hardware-token or cloud signing (Azure Trusted Signing, DigiCert
KeyLocker, etc.), configure `build.win.signtoolOptions` / a custom `sign` hook
per the electron-builder docs. Keep certificates and passwords out of the repo —
supply them via CI secrets or local env vars only.

## Notes

- `sql.js` is pure WASM, so there is **no native rebuild step** — packaging works
  without Visual Studio build tools. (`sharp` is a dev-only dependency used at
  build time to make icons; it is not shipped in the app.)
- The renderer, main, and preload are built to `dist/` and `dist-electron/`,
  which are the only paths included in the package (`build.files`).

## macOS / Linux

`npm run package` builds for the current platform (dmg / AppImage targets are
pre-configured) — untested in this release; Windows is the primary target.
