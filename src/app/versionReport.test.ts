import { describe, expect, it } from 'vitest'
import { buildVersionReportText, defaultVersionReportOutputPath } from './versionReport'

describe('versionReport', () => {
  it('builds a sibling version-compare.txt path from the left binary', () => {
    expect(defaultVersionReportOutputPath('C:/apps/left.exe')).toBe('C:/apps/version-compare.txt')
    expect(defaultVersionReportOutputPath('/opt/bin/a.so')).toBe('/opt/bin/version-compare.txt')
    expect(defaultVersionReportOutputPath('')).toBe('version-compare.txt')
    expect(defaultVersionReportOutputPath('solo.exe')).toBe('version-compare.txt')
  })

  it('builds the clipboard/file VERSION-REPORT payload', () => {
    const text = buildVersionReportText({
      leftPath: 'C:/apps/left.exe',
      rightPath: 'C:/apps/right.exe',
      summary: { added: 0, removed: 0, modified: 1, unchanged: 1 },
      fields: [
        {
          group: 'Fixed Info',
          field: 'FileVersion',
          left: '1.0.0.0',
          right: '1.1.0.0',
          status: 'modified',
          important: true,
        },
        {
          group: 'String Info',
          field: 'Comments',
          left: 'alpha',
          right: 'beta',
          status: 'modified',
          important: false,
        },
      ],
    })

    expect(text).toContain('VERSION-REPORT')
    expect(text).toContain('left: C:/apps/left.exe')
    expect(text).toContain('modified: 1')
    expect(text).toContain('Fixed Info\tFileVersion\t1.0.0.0\t1.1.0.0\tmodified\timportant')
    expect(text).toContain('String Info\tComments\talpha\tbeta\tmodified\tunimportant')
  })
})
