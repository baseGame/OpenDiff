import { describe, expect, it } from 'vitest'
import {
  invertRowIds,
  selectAllRowIds,
  selectFileRowIds,
  selectRowIdsByNameFilter,
  selectRowIdsByStatuses,
} from './folderRowSelection'

const rows = [
  {
    id: 'a',
    kind: 'file' as const,
    status: 'Same' as const,
    relativePath: 'a.txt',
    leftName: 'a.txt',
  },
  {
    id: 'b',
    kind: 'file' as const,
    status: 'Different' as const,
    relativePath: 'notes/b.md',
    leftName: 'b.md',
  },
  {
    id: 'c',
    kind: 'directory' as const,
    status: 'Left only' as const,
    relativePath: 'docs',
    leftName: 'docs',
  },
  {
    id: 'd',
    kind: 'file' as const,
    status: 'Right only' as const,
    relativePath: 'only-right.log',
    rightName: 'only-right.log',
  },
]

describe('folderRowSelection', () => {
  it('selects all, files, statuses, name matches, and invert', () => {
    expect(selectAllRowIds(rows)).toEqual(['a', 'b', 'c', 'd'])
    expect(selectFileRowIds(rows)).toEqual(['a', 'b', 'd'])
    expect(selectRowIdsByStatuses(rows, ['Same', 'Different'])).toEqual(['a', 'b'])
    expect(selectRowIdsByStatuses(rows, ['Left only', 'Right only'])).toEqual(['c', 'd'])
    expect(selectRowIdsByNameFilter(rows, 'B.MD')).toEqual(['b'])
    expect(selectRowIdsByNameFilter(rows, '  ')).toEqual([])
    expect(invertRowIds(rows, ['a', 'c'])).toEqual(['b', 'd'])
  })
})
