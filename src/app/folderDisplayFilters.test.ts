import { beforeEach, describe, expect, it } from 'vitest'
import {
  defaultFolderDisplayFilters,
  folderDisplayFiltersStorageKey,
  loadFolderDisplayFilters,
  saveFolderDisplayFilters,
} from './folderDisplayFilters'

describe('folderDisplayFilters', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('defaults to all statuses visible', () => {
    expect(loadFolderDisplayFilters()).toEqual(defaultFolderDisplayFilters())
  })

  it('persists and reloads Diffs/Same/Orphans filters', () => {
    saveFolderDisplayFilters({
      statuses: ['Different', 'Left only', 'Right only'],
      showSuppressed: true,
    })

    expect(localStorage.getItem(folderDisplayFiltersStorageKey)).toContain('Different')
    expect(loadFolderDisplayFilters()).toEqual({
      statuses: ['Different', 'Left only', 'Right only'],
      showSuppressed: true,
    })
  })
})
