import { describe, expect, it } from 'vitest'
import {
  buildPictureReportText,
  defaultPictureReportOutputPath,
  formatPictureBoundingRect,
} from './pictureReport'

describe('pictureReport', () => {
  it('builds a sibling picture-compare.txt path from the left image', () => {
    expect(defaultPictureReportOutputPath('C:/images/left.png')).toBe(
      'C:/images/picture-compare.txt',
    )
    expect(defaultPictureReportOutputPath('/tmp/shots/a.webp')).toBe(
      '/tmp/shots/picture-compare.txt',
    )
    expect(defaultPictureReportOutputPath('')).toBe('picture-compare.txt')
    expect(defaultPictureReportOutputPath('solo.png')).toBe('picture-compare.txt')
  })

  it('formats bounding rect text and builds the clipboard/file payload', () => {
    expect(
      formatPictureBoundingRect({
        x: 1,
        y: 0,
        width: 2,
        height: 3,
      }),
    ).toBe('1, 0, 2 x 3')
    expect(formatPictureBoundingRect(null)).toBe('--')

    const text = buildPictureReportText({
      leftPath: 'C:/images/left.png',
      rightPath: 'C:/images/right.png',
      statistics: {
        totalPixels: 10,
        differentPixels: 2,
        differenceRatio: 0.2,
        boundingRect: { x: 1, y: 0, width: 2, height: 3 },
      },
      metadataRows: [{ key: 'dimensions', left: '2 x 1', right: '2 x 1', status: 'equal' }],
    })

    expect(text).toContain('PICTURE-REPORT')
    expect(text).toContain('left: C:/images/left.png')
    expect(text).toContain('differentPixels: 2')
    expect(text).toContain('boundingRect: 1, 0, 2 x 3')
    expect(text).toContain('dimensions\t2 x 1\t2 x 1\tequal')
  })
})
