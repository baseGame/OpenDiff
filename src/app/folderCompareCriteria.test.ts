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
    })

    expect(localStorage.getItem(folderCompareCriteriaStorageKey)).toContain('compareCrc')
    expect(loadFolderCompareCriteria()).toEqual({
      compareSize: false,
      compareModifiedTime: true,
      compareContents: false,
      compareCrc: true,
    })
  })
})
