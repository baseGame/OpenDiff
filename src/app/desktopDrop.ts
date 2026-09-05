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

export async function listenDesktopPathDrop(
  onPaths: (paths: string[]) => void | Promise<void>,
): Promise<() => void> {
  if (!isTauriRuntime()) {
    return () => undefined
  }

  try {
    const { getCurrentWebview } = await import('@tauri-apps/api/webview')
    const unlisten = await getCurrentWebview().onDragDropEvent((event) => {
      if (event.payload.type !== 'drop') {
        return
      }

      void onPaths(event.payload.paths)
    })

    return unlisten
  } catch {
    return () => undefined
  }
}
