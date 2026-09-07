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
  return `session-${nowMs}`
}

/**
 * Open a second app shell window with the same frontend entry.
 * Returns false when the runtime refused to create the window.
 */
export async function openSessionWindow(
  openBlank: (url: string, target: string) => Window | null = (url, target) =>
    window.open(url, target),
): Promise<boolean> {
  if (!sessionNewWindowCapability.supported) {
    return false
  }

  if (!isTauriRuntime()) {
    const opened = openBlank(window.location.href, '_blank')

    return opened != null
  }

  try {
    const { WebviewWindow } = await import('@tauri-apps/api/webviewWindow')
    const label = nextSessionWindowLabel()
    const webview = new WebviewWindow(label, {
      url: '/',
      title: 'OpenDiff',
      width: 1280,
      height: 820,
      minWidth: 980,
      minHeight: 640,
      focus: true,
    })

    return await new Promise<boolean>((resolve) => {
      let settled = false
      const finish = (ok: boolean) => {
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
