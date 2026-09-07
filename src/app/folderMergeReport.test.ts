import { describe, expect, it } from 'vitest'
import { buildFolderMergeReportText, defaultFolderMergeReportOutputPath } from './folderMergeReport'

describe('folderMergeReport', () => {
  it('builds a sibling folder-merge.txt path from the left folder', () => {
    expect(defaultFolderMergeReportOutputPath('D:/workspace/merge/left')).toBe(
      'D:/workspace/merge/folder-merge.txt',
    )
    expect(defaultFolderMergeReportOutputPath('D:/workspace/merge/left/')).toBe(
      'D:/workspace/merge/folder-merge.txt',
    )
    expect(defaultFolderMergeReportOutputPath('/tmp/a')).toBe('/tmp/folder-merge.txt')
    expect(defaultFolderMergeReportOutputPath('')).toBe('folder-merge.txt')
    expect(defaultFolderMergeReportOutputPath('solo')).toBe('folder-merge.txt')
  })

  it('builds the clipboard/file FOLDER-MERGE-REPORT payload', () => {
    const text = buildFolderMergeReportText({
      leftPath: 'D:/merge/left',
      basePath: 'D:/merge/base',
      rightPath: 'D:/merge/right',
      outputPath: 'D:/merge/out',
      summary: { actions: 2, automatic: 1, conflicts: 1 },
      rows: [
        {
          path: 'same.txt',
          action: 'Keep output',
          detail: 'All sides match',
        },
        {
          path: 'notes.txt',
          action: 'Mark conflict',
          detail: 'Left and right diverge',
        },
      ],
    })

    expect(text).toContain('FOLDER-MERGE-REPORT')
    expect(text).toContain('left: D:/merge/left')
    expect(text).toContain('base: D:/merge/base')
    expect(text).toContain('actions: 2')
    expect(text).toContain('same.txt\tKeep output\tAll sides match')
    expect(text).toContain('notes.txt\tMark conflict\tLeft and right diverge')
  })
})
