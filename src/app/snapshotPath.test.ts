import { describe, expect, it } from 'vitest'
import { folderSnapshotOutputPath, isSnapshotPath } from './snapshotPath'

describe('snapshotPath', () => {
  it('detects snapshot compare paths including legacy save names', () => {
    expect(isSnapshotPath('/tmp/tree.snapshot.json')).toBe(true)
    expect(isSnapshotPath('C:\\data\\workspace.opendiff-snapshot.json')).toBe(true)
    expect(isSnapshotPath('/tmp/open-diff-snapshot.json')).toBe(true)
    expect(isSnapshotPath('/tmp/OPEN-DIFF-SNAPSHOT.JSON')).toBe(true)
    expect(isSnapshotPath('/tmp/folder')).toBe(false)
    expect(isSnapshotPath('/tmp/notes.json')).toBe(false)
    expect(isSnapshotPath('')).toBe(false)
  })

  it('builds a reloadable snapshot output path from the folder basename', () => {
    expect(folderSnapshotOutputPath('/tmp/docs/')).toBe('/tmp/docs/docs.snapshot.json')
    expect(folderSnapshotOutputPath('C:\\work\\release')).toBe(
      'C:\\work\\release/release.snapshot.json',
    )
  })
})
