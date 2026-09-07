export interface TableReportDifferenceRow {
  key: string
  text: string
}

export interface BuildTableReportTextInput {
  leftPath: string
  rightPath: string
  format: string
  keyColumns: string
  ignoredColumns: string[]
  rowCount: number
  differenceCount: number
  differences: TableReportDifferenceRow[]
}

/** Sibling text report path next to the left table (matches picture/version export style). */
export function defaultTableReportOutputPath(leftPath: string): string {
  const trimmed = leftPath.trim()

  if (!trimmed) {
    return 'table-compare.txt'
  }

  const slash = Math.max(trimmed.lastIndexOf('/'), trimmed.lastIndexOf('\\'))

  if (slash < 0) {
    return 'table-compare.txt'
  }

  return `${trimmed.slice(0, slash + 1)}table-compare.txt`
}

export function buildTableReportText(input: BuildTableReportTextInput): string {
  const ignored = input.ignoredColumns.length > 0 ? input.ignoredColumns.join(',') : '--'
  const lines = [
    'TABLE-REPORT',
    `left: ${input.leftPath || '--'}`,
    `right: ${input.rightPath || '--'}`,
    `format: ${input.format}`,
    `keyColumns: ${input.keyColumns}`,
    `ignoredColumns: ${ignored}`,
    `rowCount: ${String(input.rowCount)}`,
    `differenceCells: ${String(input.differenceCount)}`,
    '',
    'differences:',
    ...input.differences.map((row) => `${row.key}\t${row.text}`),
  ]

  return lines.join('\n')
}
