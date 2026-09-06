import { invoke } from '@tauri-apps/api/core'
import {
  dropInputsFromAbsolutePaths,
  dropInputsFromClassifiedPaths,
  type DropInput,
} from './dropInput'

export interface ClassifiedPathEntry {
  path: string
  kind: string
}

export type DesktopDragPhase = 'listening' | 'enter' | 'over' | 'drop' | 'leave' | 'unavailable'

export function isTauriRuntime(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window
}

/** Resolve absolute desktop paths to DropInput[], preferring Rust path_kind when available. */
export async function resolveDropInputsFromPaths(paths: string[]): Promise<DropInput[]> {
  const cleaned = paths.map((path) => path.trim()).filter(Boolean)

  if (cleaned.length === 0) {
    return []
  }

  if (isTauriRuntime()) {
    try {
      const classified = await invoke<ClassifiedPathEntry[]>('classify_paths', { paths: cleaned })

      return dropInputsFromClassifiedPaths(classified)
    } catch {
      // ponytail: fall back to name heuristic if invoke unavailable in tests/web
    }
  }

  return dropInputsFromAbsolutePaths(cleaned)
}

/**
 * Listen for OS file/folder drops with absolute paths (Tauri native drag-drop).
 * Requires `dragDropEnabled: true` on the window and `core:default` capability
 * so `onDragDropEvent` can register event listeners.
 *
 * On Linux, also listens for `open-diff://desktop-drop` from the Rust WebKitGTK bridge,
 * which recovers Thunar/Nautilus drops that wry's Leaving-state handler can miss.
 */
export async function listenDesktopPathDrop(
  onPaths: (paths: string[]) => void | Promise<void>,
  onPhase?: (phase: DesktopDragPhase, detail?: string) => void,
): Promise<() => void> {
  if (!isTauriRuntime()) {
    onPhase?.('unavailable', 'not-tauri')

    return () => undefined
  }

  const stoppers: (() => void)[] = []
  let lastDropKey = ''
  let lastDropAt = 0

  const deliverPaths = (paths: string[]): void => {
    const cleaned = paths.map((path) => path.trim()).filter(Boolean)

    if (cleaned.length === 0) {
      return
    }

    const key = cleaned.join('\0')
    const now = Date.now()

    if (key === lastDropKey && now - lastDropAt < 600) {
      return
    }

    lastDropKey = key
    lastDropAt = now
    onPhase?.('drop', `${String(cleaned.length)} path(s)`)
    void onPaths(cleaned)
  }

  try {
    const { getCurrentWebview } = await import('@tauri-apps/api/webview')
    const unlisten = await getCurrentWebview().onDragDropEvent((event) => {
      switch (event.payload.type) {
        case 'enter':
          onPhase?.('enter', `${String(event.payload.paths.length)} path(s)`)

          return
        case 'over':
          onPhase?.('over')

          return
        case 'leave':
          onPhase?.('leave')

          return
        case 'drop':
          deliverPaths(event.payload.paths)
      }
    })

    stoppers.push(unlisten)
    onPhase?.('listening', 'webview')
  } catch (error) {
    console.warn('[OpenDiff] desktop path drop listener unavailable', error)
    onPhase?.('unavailable', 'webview-listen-failed')
  }

  try {
    const { listen } = await import('@tauri-apps/api/event')
    const unlistenDrop = await listen<string[]>('open-diff://desktop-drop', (event) => {
      deliverPaths(event.payload)
    })
    const unlistenEnter = await listen<string[]>('open-diff://desktop-drag-enter', (event) => {
      onPhase?.('enter', `${String(event.payload.length)} path(s)`)
    })
    const unlistenLeave = await listen('open-diff://desktop-drag-leave', () => {
      onPhase?.('leave')
    })

    stoppers.push(unlistenDrop, unlistenEnter, unlistenLeave)
  } catch (error) {
    console.warn('[OpenDiff] Linux desktop drop bridge listener unavailable', error)
  }

  return () => {
    for (const stop of stoppers) {
      stop()
    }
  }
}
