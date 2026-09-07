import { describe, expect, it } from 'vitest'
import {
  clampSectionIndex,
  flattenPatchSections,
  reconstructAlignedRows,
  reconstructSidesFromFile,
  reconstructSidesFromHunk,
} from './textPatchSections'
import type { PatchFile } from '@/types/diff'

const sampleFiles: PatchFile[] = [
  {
    oldPath: 'a/file.txt',
    newPath: 'b/file.txt',
    hunks: [
      {
        oldStart: 1,
        oldCount: 2,
        newStart: 1,
        newCount: 2,
        heading: 'first',
        lines: [
          { kind: 'context', oldNumber: 1, newNumber: 1, text: 'keep' },
          { kind: 'removed', oldNumber: 2, newNumber: null, text: 'old' },
          { kind: 'added', oldNumber: null, newNumber: 2, text: 'new' },
        ],
      },
      {
        oldStart: 10,
        oldCount: 1,
        newStart: 10,
        newCount: 1,
        heading: 'second',
        lines: [{ kind: 'removed', oldNumber: 10, newNumber: null, text: 'gone' }],
      },
    ],
  },
]

describe('textPatchSections', () => {
  it('flattens hunks into navigable sections', () => {
    expect(flattenPatchSections(sampleFiles)).toEqual([
      expect.objectContaining({
        fileIndex: 0,
        hunkIndex: 0,
        heading: 'first',
        oldPath: 'a/file.txt',
      }),
      expect.objectContaining({
        fileIndex: 0,
        hunkIndex: 1,
        heading: 'second',
      }),
    ])
  })

  it('reconstructs left and right sides from a hunk', () => {
    const file = sampleFiles[0]
    const sides = reconstructSidesFromHunk(file, file.hunks[0])

    expect(sides).toEqual({
      left: 'keep\nold',
      right: 'keep\nnew',
      leftSource: 'a/file.txt',
      rightSource: 'b/file.txt',
    })
  })

  it('reconstructs all hunks in a file', () => {
    const sides = reconstructSidesFromFile(sampleFiles[0])

    expect(sides.left).toContain('old')
    expect(sides.left).toContain('gone')
    expect(sides.right).toContain('new')
    expect(sides.right).not.toContain('gone')
  })

  it('aligns remove+add as one side-by-side row', () => {
    const rows = reconstructAlignedRows(sampleFiles[0].hunks[0].lines)

    expect(rows).toEqual([
      {
        left: { text: 'keep', kind: 'context', lineNumber: 1 },
        right: { text: 'keep', kind: 'context', lineNumber: 1 },
      },
      {
        left: { text: 'old', kind: 'removed', lineNumber: 2 },
        right: { text: 'new', kind: 'added', lineNumber: 2 },
      },
    ])
  })

  it('keeps unpaired removals and additions on their own rows', () => {
    const rows = reconstructAlignedRows(sampleFiles[0].hunks[1].lines)

    expect(rows).toEqual([
      {
        left: { text: 'gone', kind: 'removed', lineNumber: 10 },
        right: { text: '', kind: 'empty', lineNumber: null },
      },
    ])
  })

  it('clamps section indices', () => {
    expect(clampSectionIndex(0, 0)).toBe(0)
    expect(clampSectionIndex(2, 2)).toBe(0)
    expect(clampSectionIndex(-1, 2)).toBe(1)
  })
})
