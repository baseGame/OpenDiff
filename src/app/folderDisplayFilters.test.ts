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
      filesOnly: true,
    })

    expect(localStorage.getItem(folderDisplayFiltersStorageKey)).toContain('Different')
    expect(loadFolderDisplayFilters()).toEqual({
      statuses: ['Different', 'Left only', 'Right only'],
      showSuppressed: true,
      filesOnly: true,
    })
  })

  it('defaults filesOnly to false for older persisted payloads', () => {
    localStorage.setItem(
      folderDisplayFiltersStorageKey,
      JSON.stringify({
        statuses: ['Same'],
        showSuppressed: false,
      }),
    )

    expect(loadFolderDisplayFilters()).toEqual({
      statuses: ['Same'],
      showSuppressed: false,
      filesOnly: false,
    })
  })
})
