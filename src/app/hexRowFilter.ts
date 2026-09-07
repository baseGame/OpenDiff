export type HexRowFilter = 'all' | 'diffs' | 'same'

export interface HexRowLike {
  cells: { different: boolean }[]
}

export function filterHexRows<T extends HexRowLike>(rows: T[], filter: HexRowFilter): T[] {
  if (filter === 'all') {
    return rows
  }

  if (filter === 'diffs') {
    return rows.filter((row) => row.cells.some((cell) => cell.different))
  }

  return rows.filter((row) => row.cells.length > 0 && row.cells.every((cell) => !cell.different))
}
