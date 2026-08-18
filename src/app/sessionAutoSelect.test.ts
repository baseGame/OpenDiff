import { describe, expect, it } from 'vitest'
import { selectSessionForDrop } from './sessionAutoSelect'
import type { ValidDropClassification } from './dropInput'

function pair(
  leftPath: string,
  rightPath: string,
  leftKind: 'file' | 'directory' = 'file',
  rightKind: 'file' | 'directory' = leftKind,
): ValidDropClassification {
  let kind: ValidDropClassification['kind'] = 'mixed'

  if (leftKind === 'directory' && rightKind === 'directory') {
    kind = 'folders'
  }

  if (leftKind === 'file' && rightKind === 'file') {
    kind = 'files'
  }

  return {
    kind,
    left: { path: leftPath, kind: leftKind, sourceKind: leftKind, displayName: leftPath },
    right: { path: rightPath, kind: rightKind, sourceKind: rightKind, displayName: rightPath },
  }
}

describe('selectSessionForDrop', () => {
  it('selects folder compare for two directories', () => {
    expect(selectSessionForDrop(pair('left', 'right', 'directory'))).toMatchObject({
      sessionType: 'folder-compare',
      route: '/compare/folder',
      enabled: true,
    })
  })

  it('selects text compare for common text file extensions', () => {
    expect(selectSessionForDrop(pair('left.ts', 'right.ts'))).toMatchObject({
      sessionType: 'text-compare',
      route: '/compare/text',
      enabled: true,
    })
  })

  it('selects text patch for patch and diff files', () => {
    expect(selectSessionForDrop(pair('change.diff', 'change.diff'))).toMatchObject({
      sessionType: 'text-patch',
      route: '/patch/text',
      enabled: true,
    })

    expect(selectSessionForDrop(pair('feature.patch', 'feature.patch'))).toMatchObject({
      sessionType: 'text-patch',
      route: '/patch/text',
      enabled: true,
    })
  })

  it('selects picture compare for image extensions', () => {
    expect(selectSessionForDrop(pair('before.png', 'after.jpeg'))).toMatchObject({
      sessionType: 'picture-compare',
      route: '/compare/picture',
      enabled: true,
    })
  })

  it('selects table compare for spreadsheet and delimited files', () => {
    expect(selectSessionForDrop(pair('left.csv', 'right.tsv'))).toMatchObject({
      sessionType: 'table-compare',
      route: '/compare/table',
      enabled: true,
    })

    expect(selectSessionForDrop(pair('sales.xlsx', 'sales.xlsx'))).toMatchObject({
      sessionType: 'table-compare',
      route: '/compare/table',
      enabled: true,
    })
  })

  it('selects registry, media, and version compares for those extensions', () => {
    expect(selectSessionForDrop(pair('left.reg', 'right.reg'))).toMatchObject({
      sessionType: 'registry-compare',
      route: '/compare/registry',
    })
    expect(selectSessionForDrop(pair('left.mp3', 'right.flac'))).toMatchObject({
      sessionType: 'media-compare',
      route: '/compare/media',
    })
    expect(selectSessionForDrop(pair('left.exe', 'right.dll'))).toMatchObject({
      sessionType: 'version-compare',
      route: '/compare/version',
    })
  })

  it('selects archive compare for zip and tar pairs', () => {
    expect(selectSessionForDrop(pair('left.zip', 'right.zip'))).toMatchObject({
      sessionType: 'archive-compare',
      route: '/compare/folder',
      enabled: true,
    })
    expect(selectSessionForDrop(pair('old.tar', 'new.tgz'))).toMatchObject({
      sessionType: 'archive-compare',
      route: '/compare/folder',
      enabled: true,
    })
  })

  it('selects hex compare for binary or unknown file extensions', () => {
    expect(selectSessionForDrop(pair('left.bin', 'right.dat'))).toMatchObject({
      sessionType: 'hex-compare',
      route: '/compare/hex',
      enabled: true,
    })
  })

  it('falls back to hex compare for mixed inputs', () => {
    expect(selectSessionForDrop(pair('left.txt', 'right', 'file', 'directory'))).toMatchObject({
      sessionType: 'hex-compare',
      route: '/compare/hex',
      enabled: true,
    })
  })
})
