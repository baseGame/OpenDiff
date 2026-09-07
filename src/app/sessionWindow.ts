import { isTauriRuntime } from './desktopDrop'

/** Capability flag: multi-window is wired via Tauri WebviewWindow + create permission. */
export const sessionNewWindowCapability = {
  supported: true,
  /**
   * Requires capabilities/default.json to grant:
   * - windows: main + session-*
   * - core:webview:allow-create-webview-window
   * Browser / non-Tauri falls back to window.open of the same origin.
   */
  requiresCreateWebviewPermission: true,
} as const

export function nextSessionWindowLabel(nowMs: number = Date.now()): string {
  return `session-${String(nowMs)}`
}

/** Normalize a router path/hash into a same-origin entry URL for a new window. */
export function sessionWindowEntryUrl(
  entryPath = '/',
  origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost',
): string {
  const trimmed = entryPath.trim() || '/'
  const path = trimmed.startsWith('/') ? trimmed : `/${trimmed}`

  return new URL(path, origin).href
}

/**
 * Open a second app shell window with the same frontend entry.
 * Pass entryPath (e.g. route.fullPath) so the new window opens that session route.
 * Returns false when the runtime refused to create the window.
 * Windows do not share live session state — only the starting route.
 */
export async function openSessionWindow(
  openBlank: (url: string, target: string) => Window | null = (url, target) =>
    window.open(url, target),
  entryPath = '/',
): Promise<boolean> {
  const href = sessionWindowEntryUrl(entryPath)

  if (!isTauriRuntime()) {
    const opened = openBlank(href, '_blank')

    return opened != null
  }

  try {
    const { WebviewWindow } = await import('@tauri-apps/api/webviewWindow')
    const label = nextSessionWindowLabel()
    const path = new URL(href).pathname + new URL(href).search + new URL(href).hash
    const webview = new WebviewWindow(label, {
      url: path || '/',
      title: 'OpenDiff',
      width: 1280,
      height: 820,
      minWidth: 980,
      minHeight: 640,
      focus: true,
    })

    return await new Promise<boolean>((resolve) => {
      let settled = false
      const finish = (ok: boolean): void => {
        if (settled) {
          return
        }
        settled = true
        resolve(ok)
      }

      void webview.once('tauri://created', () => finish(true))
      void webview.once('tauri://error', () => finish(false))
      window.setTimeout(() => finish(true), 1_500)
    })
  } catch {
    return false
  }
}
