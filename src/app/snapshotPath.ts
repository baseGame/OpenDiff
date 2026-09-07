/** Match sources.rs snapshot compare-side detection for Folder Compare chips. */

import { pathBaseName } from './sessionToolbars'

export function isSnapshotPath(path: string): boolean {
  const lower = path.trim().replaceAll('\\', '/').toLowerCase()

  if (!lower) {
    return false
  }

  if (lower.endsWith('.snapshot.json') || lower.endsWith('.opendiff-snapshot.json')) {
    return true
  }

  const base = lower.split('/').pop() ?? ''

  return base === 'open-diff-snapshot.json'
}

/** Prefer `{folder}.snapshot.json` so saved snapshots reload as compare sides. */
export function folderSnapshotOutputPath(sourceRoot: string): string {
  const normalizedRoot = sourceRoot.replace(/[/\\]+$/u, '')
  const base = pathBaseName(normalizedRoot) || 'folder'

  return `${normalizedRoot}/${base}.snapshot.json`
}
