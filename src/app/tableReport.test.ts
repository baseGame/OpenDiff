import { describe, expect, it } from 'vitest'
import { buildTableReportText, defaultTableReportOutputPath } from './tableReport'

describe('tableReport', () => {
  it('builds a sibling table-compare.txt path from the left table', () => {
    expect(defaultTableReportOutputPath('C:/data/left.csv')).toBe('C:/data/table-compare.txt')
    expect(defaultTableReportOutputPath('/tmp/sheets/a.xlsx')).toBe('/tmp/sheets/table-compare.txt')
    expect(defaultTableReportOutputPath('')).toBe('table-compare.txt')
    expect(defaultTableReportOutputPath('solo.csv')).toBe('table-compare.txt')
  })

  it('builds the clipboard/file TABLE-REPORT payload', () => {
    const text = buildTableReportText({
      leftPath: 'C:/data/left.csv',
      rightPath: 'C:/data/right.csv',
      format: 'csv',
      keyColumns: '0',
      ignoredColumns: ['notes'],
      rowCount: 2,
      differenceCount: 1,
      differences: [{ key: 'row-1-quantity', text: '12 -> 14' }],
    })

    expect(text).toContain('TABLE-REPORT')
    expect(text).toContain('left: C:/data/left.csv')
    expect(text).toContain('keyColumns: 0')
    expect(text).toContain('ignoredColumns: notes')
    expect(text).toContain('differenceCells: 1')
    expect(text).toContain('row-1-quantity\t12 -> 14')
  })
})
