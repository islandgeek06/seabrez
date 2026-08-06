import { Menu, clipboard, BrowserWindow, type WebContents, type MenuItemConstructorOptions } from 'electron'

interface ContextMenuOptions {
  // True for actual web pages (tabs): adds link/image/navigation actions.
  isPage?: boolean
  // Open a URL in a new background tab (link/image "open in new tab").
  openInNewTab?: (url: string) => void
}

// Give a webContents a real right-click context menu — copy/cut/paste/select-all
// in editable fields, copy for selected text, link/image actions, page
// navigation, and inspect. Without this, right-clicking a page does nothing
// (no mouse copy/paste). Applied to every tab page and to the app UI itself.
export function installContextMenu(wc: WebContents, opts: ContextMenuOptions = {}) {
  wc.on('context-menu', (_event, params) => {
    const has = (s?: string) => typeof s === 'string' && s.length > 0
    const edit = params.editFlags
    const template: MenuItemConstructorOptions[] = []

    // Links
    if (has(params.linkURL)) {
      if (opts.openInNewTab) {
        template.push({ label: 'Open link in new tab', click: () => opts.openInNewTab?.(params.linkURL) })
      }
      template.push(
        { label: 'Copy link address', click: () => clipboard.writeText(params.linkURL) },
        { type: 'separator' },
      )
    }

    // Images
    if (params.mediaType === 'image' && has(params.srcURL)) {
      template.push(
        { label: 'Copy image', click: () => wc.copyImageAt(params.x, params.y) },
        { label: 'Copy image address', click: () => clipboard.writeText(params.srcURL) },
      )
      if (opts.openInNewTab) {
        template.push({ label: 'Open image in new tab', click: () => opts.openInNewTab?.(params.srcURL) })
      }
      template.push({ type: 'separator' })
    }

    // Editable fields — full clipboard actions (explicit wc.* so they target the
    // right webContents even when it's a WebContentsView, not the window).
    if (params.isEditable) {
      template.push(
        { label: 'Undo', enabled: edit.canUndo, click: () => wc.undo() },
        { label: 'Redo', enabled: edit.canRedo, click: () => wc.redo() },
        { type: 'separator' },
        { label: 'Cut', enabled: edit.canCut, click: () => wc.cut() },
        { label: 'Copy', enabled: edit.canCopy, click: () => wc.copy() },
        { label: 'Paste', enabled: edit.canPaste, click: () => wc.paste() },
        { label: 'Paste as plain text', enabled: edit.canPaste, click: () => wc.pasteAndMatchStyle() },
        { label: 'Select all', enabled: edit.canSelectAll, click: () => wc.selectAll() },
      )
    } else if (has(params.selectionText)) {
      // Selected, non-editable text.
      template.push({ label: 'Copy', click: () => wc.copy() })
      if (edit.canSelectAll) template.push({ label: 'Select all', click: () => wc.selectAll() })
    }

    // Page navigation (tab pages only).
    if (opts.isPage && !params.isEditable && !has(params.linkURL) && params.mediaType !== 'image') {
      if (template.length) template.push({ type: 'separator' })
      template.push(
        { label: 'Back', enabled: wc.navigationHistory.canGoBack(), click: () => wc.navigationHistory.goBack() },
        { label: 'Forward', enabled: wc.navigationHistory.canGoForward(), click: () => wc.navigationHistory.goForward() },
        { label: 'Reload', click: () => wc.reload() },
      )
    }

    // Inspect (dev-friendly, like a real browser).
    if (template.length) template.push({ type: 'separator' })
    template.push({
      label: 'Inspect',
      click: () => {
        wc.inspectElement(params.x, params.y)
        if (wc.isDevToolsOpened()) wc.devToolsWebContents?.focus()
      },
    })

    if (template.length === 0) return
    const menu = Menu.buildFromTemplate(template)
    const win = BrowserWindow.fromWebContents(wc) ?? BrowserWindow.getFocusedWindow() ?? undefined
    menu.popup(win ? { window: win } : undefined)
  })
}
