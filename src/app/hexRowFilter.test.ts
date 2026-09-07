import { describe, expect, it } from 'vitest'
import { filterHexRows } from './hexRowFilter'

describe('filterHexRows', () => {
  const rows = [
    {
      offset: '00000000',
      cells: [{ different: false }, { different: false }],
    },
    {
      offset: '00000010',
      cells: [{ different: false }, { different: true }],
    },
    {
      offset: '00000020',
      cells: [{ different: true }, { different: true }],
    },
  ]

  it('keeps every row in all mode', () => {
    expect(filterHexRows(rows, 'all')).toEqual(rows)
  })

  it('keeps rows that contain any different byte in diffs mode', () => {
    expect(filterHexRows(rows, 'diffs').map((row) => row.offset)).toEqual(['00000010', '00000020'])
  })

  it('keeps only fully matching rows in same mode', () => {
    expect(filterHexRows(rows, 'same').map((row) => row.offset)).toEqual(['00000000'])
  })
})
