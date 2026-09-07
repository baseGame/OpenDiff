import { describe, expect, it } from 'vitest'
import { buildFolderSyncReportText, defaultFolderSyncReportOutputPath } from './folderSyncReport'

describe('folderSyncReport', () => {
  it('builds a sibling folder-sync.txt path from the left folder', () => {
    expect(defaultFolderSyncReportOutputPath('D:/deploy/package')).toBe('D:/deploy/folder-sync.txt')
    expect(defaultFolderSyncReportOutputPath('D:/deploy/package/')).toBe(
      'D:/deploy/folder-sync.txt',
    )
    expect(defaultFolderSyncReportOutputPath('/tmp/a')).toBe('/tmp/folder-sync.txt')
    expect(defaultFolderSyncReportOutputPath('')).toBe('folder-sync.txt')
    expect(defaultFolderSyncReportOutputPath('solo')).toBe('folder-sync.txt')
  })

  it('builds the clipboard/file FOLDER-SYNC-REPORT payload', () => {
    const text = buildFolderSyncReportText({
      leftPath: 'D:/deploy/package',
      rightPath: 'D:/deploy/prod',
      strategy: 'mirrorRight',
      planName: 'Mirror to Right',
      summary: { total: 2, copy: 1, delete: 1, leave: 0, conflict: 0, overridden: 1 },
      rows: [
        {
          path: 'package/app.exe',
          action: 'Copy',
          planned: 'copyLeftToRight',
          override: 'leave',
          detail: 'Left item only exists',
        },
        {
          path: 'prod/old.dll',
          action: 'Delete',
          planned: 'delete',
          override: 'delete',
          detail: 'Right item does not exist on left',
        },
      ],
    })

    expect(text).toContain('FOLDER-SYNC-REPORT')
    expect(text).toContain('left: D:/deploy/package')
    expect(text).toContain('strategy: mirrorRight')
    expect(text).toContain('overridden: 1')
    expect(text).toContain('package/app.exe\tCopy\tcopyLeftToRight\tleave\tLeft item only exists')
    expect(text).toContain(
      'prod/old.dll\tDelete\tdelete\tdelete\tRight item does not exist on left',
    )
  })
})
