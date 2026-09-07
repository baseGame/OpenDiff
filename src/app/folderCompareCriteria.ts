import type { FolderCompareCriteria } from '@/types/diff'

export const folderCompareCriteriaStorageKey = 'open-diff-folder-compare-criteria'

export function defaultFolderCompareCriteria(): FolderCompareCriteria {
  return {
    compareSize: true,
    compareModifiedTime: false,
    compareContents: true,
    compareCrc: false,
    followSymlinks: false,
  }
}

export function loadFolderCompareCriteria(
  storage: Pick<Storage, 'getItem'> = localStorage,
): FolderCompareCriteria {
  try {
    const raw = storage.getItem(folderCompareCriteriaStorageKey)

    if (!raw) {
      return defaultFolderCompareCriteria()
    }

    const parsed = JSON.parse(raw) as Partial<FolderCompareCriteria>

    return {
      compareSize: parsed.compareSize !== false,
      compareModifiedTime: Boolean(parsed.compareModifiedTime),
      compareContents: parsed.compareContents !== false,
      compareCrc: Boolean(parsed.compareCrc),
      followSymlinks: Boolean(parsed.followSymlinks),
    }
  } catch {
    return defaultFolderCompareCriteria()
  }
}

export function saveFolderCompareCriteria(
  state: FolderCompareCriteria,
  storage: Pick<Storage, 'setItem'> = localStorage,
): void {
  storage.setItem(
    folderCompareCriteriaStorageKey,
    JSON.stringify({
      compareSize: state.compareSize,
      compareModifiedTime: state.compareModifiedTime,
      compareContents: state.compareContents,
      compareCrc: state.compareCrc,
      followSymlinks: Boolean(state.followSymlinks),
    }),
  )
}
