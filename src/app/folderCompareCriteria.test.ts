import { beforeEach, describe, expect, it } from 'vitest'
import {
  defaultFolderCompareCriteria,
  folderCompareCriteriaStorageKey,
  loadFolderCompareCriteria,
  saveFolderCompareCriteria,
} from './folderCompareCriteria'

describe('folderCompareCriteria', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('defaults when storage is empty', () => {
    expect(loadFolderCompareCriteria()).toEqual(defaultFolderCompareCriteria())
  })

  it('persists and reloads comparison criteria', () => {
    saveFolderCompareCriteria({
      compareSize: false,
      compareModifiedTime: true,
      compareContents: false,
      compareCrc: true,
      followSymlinks: true,
    })

    expect(localStorage.getItem(folderCompareCriteriaStorageKey)).toContain('followSymlinks')
    expect(loadFolderCompareCriteria()).toEqual({
      compareSize: false,
      compareModifiedTime: true,
      compareContents: false,
      compareCrc: true,
      followSymlinks: true,
    })
  })
})
