import { describe, expect, it } from 'vitest'
import {
  mergeSheetOptions,
  preferredSheetSelection,
  tableFormatFromPath,
  tableFormatFromPaths,
  usesWorkbookSheets,
} from './tableSheets'

describe('tableSheets', () => {
  it('detects spreadsheet and html formats from paths', () => {
    expect(tableFormatFromPath('C:/data/left.xlsx')).toBe('xlsx')
    expect(tableFormatFromPath('C:/data/left.xls')).toBe('xls')
    expect(tableFormatFromPath('C:/data/left.htm')).toBe('html')
    expect(tableFormatFromPath('C:/data/left.tsv')).toBe('tsv')
    expect(tableFormatFromPaths('', 'C:/data/right.html')).toBe('html')
    expect(usesWorkbookSheets('xlsx')).toBe(true)
    expect(usesWorkbookSheets('csv')).toBe(false)
  })

  it('merges sheet options without duplicates and prefers matching names', () => {
    expect(mergeSheetOptions(['Inventory', 'Flags'], ['flags', 'Notes'])).toEqual([
      'Inventory',
      'Flags',
      'flags',
      'Notes',
    ])
    expect(preferredSheetSelection(['Flags', 'Inventory'], '', 'inventory')).toBe('Inventory')
    expect(preferredSheetSelection(['Flags', 'Inventory'], 'flags')).toBe('Flags')
  })
})
