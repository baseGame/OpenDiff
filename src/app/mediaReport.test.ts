import { describe, expect, it } from 'vitest'
import { buildMediaReportText, defaultMediaReportOutputPath } from './mediaReport'

describe('mediaReport', () => {
  it('builds a sibling media-compare.txt path from the left media file', () => {
    expect(defaultMediaReportOutputPath('C:/music/left.mp3')).toBe('C:/music/media-compare.txt')
    expect(defaultMediaReportOutputPath('/opt/audio/a.flac')).toBe('/opt/audio/media-compare.txt')
    expect(defaultMediaReportOutputPath('')).toBe('media-compare.txt')
    expect(defaultMediaReportOutputPath('solo.mp3')).toBe('media-compare.txt')
  })

  it('builds the clipboard/file MEDIA-REPORT payload', () => {
    const text = buildMediaReportText({
      leftPath: 'C:/music/left.mp3',
      rightPath: 'C:/music/right.mp3',
      summary: { added: 0, removed: 0, modified: 1, unchanged: 1 },
      fields: [
        {
          field: 'Title',
          left: 'Alpha',
          right: 'Beta',
          status: 'modified',
          important: true,
        },
        {
          field: 'Comment',
          left: 'demo',
          right: 'demo-b',
          status: 'modified',
          important: false,
        },
      ],
    })

    expect(text).toContain('MEDIA-REPORT')
    expect(text).toContain('left: C:/music/left.mp3')
    expect(text).toContain('modified: 1')
    expect(text).toContain('Title\tAlpha\tBeta\tmodified\timportant')
    expect(text).toContain('Comment\tdemo\tdemo-b\tmodified\tunimportant')
  })
})
