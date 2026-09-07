import { describe, expect, it } from 'vitest'
import {
  buildHexReportText,
  defaultHexReportOutputPath,
  formatHexReportOffset,
  hexReportRowsFromDiffRanges,
} from './hexReport'

describe('hexReport', () => {
  it('builds a sibling hex-compare.txt path from the left binary', () => {
    expect(defaultHexReportOutputPath('C:/bin/left.bin')).toBe('C:/bin/hex-compare.txt')
    expect(defaultHexReportOutputPath('/tmp/data/a.dat')).toBe('/tmp/data/hex-compare.txt')
    expect(defaultHexReportOutputPath('')).toBe('hex-compare.txt')
    expect(defaultHexReportOutputPath('solo.bin')).toBe('hex-compare.txt')
  })

  it('formats offsets and builds the clipboard/file payload', () => {
    expect(formatHexReportOffset(1)).toBe('00000001')
    expect(formatHexReportOffset(0x80000000)).toBe('80000000')

    const text = buildHexReportText({
      leftPath: 'C:/bin/left.bin',
      rightPath: 'C:/bin/right.bin',
      originalLen: 4,
      modifiedLen: 4,
      rows: [
        { offset: 1, originalHex: '42', modifiedHex: '58' },
        { offset: 3, originalHex: '44', modifiedHex: null },
      ],
    })

    expect(text).toContain('HEX-REPORT')
    expect(text).toContain('left: C:/bin/left.bin')
    expect(text).toContain('changedRows: 2')
    expect(text).toContain('00000001\t42\t58')
    expect(text).toContain('00000003\t44\t--')
  })

  it('expands binary diff ranges into per-byte report rows', () => {
    expect(
      hexReportRowsFromDiffRanges([{ offset: 1, leftBytes: [0x42, 0x43], rightBytes: [0x58] }]),
    ).toEqual([
      { offset: 1, originalHex: '42', modifiedHex: '58' },
      { offset: 2, originalHex: '43', modifiedHex: null },
    ])
  })
})
