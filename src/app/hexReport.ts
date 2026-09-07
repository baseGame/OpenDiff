export interface HexReportRowInput {
  offset: number | string
  originalHex?: string | null
  modifiedHex?: string | null
}

export interface BuildHexReportTextInput {
  leftPath: string
  rightPath: string
  originalLen: number
  modifiedLen: number
  rows: HexReportRowInput[]
}

/** Sibling text report path next to the left binary (matches picture export style). */
export function defaultHexReportOutputPath(leftPath: string): string {
  const trimmed = leftPath.trim()

  if (!trimmed) {
    return 'hex-compare.txt'
  }

  const slash = Math.max(trimmed.lastIndexOf('/'), trimmed.lastIndexOf('\\'))

  if (slash < 0) {
    return 'hex-compare.txt'
  }

  return `${trimmed.slice(0, slash + 1)}hex-compare.txt`
}

export function formatHexReportOffset(offset: number | string): string {
  const asNumber = typeof offset === 'number' ? offset : Number(offset)

  if (!Number.isFinite(asNumber) || asNumber < 0) {
    return String(offset)
  }

  return asNumber.toString(16).toUpperCase().padStart(8, '0')
}

export function buildHexReportText(input: BuildHexReportTextInput): string {
  const lines = [
    'HEX-REPORT',
    `left: ${input.leftPath}`,
    `right: ${input.rightPath}`,
    `originalLen: ${String(input.originalLen)}`,
    `modifiedLen: ${String(input.modifiedLen)}`,
    `changedRows: ${String(input.rows.length)}`,
    '',
    'rows:',
    ...input.rows.map((row) => {
      const original = row.originalHex ?? '--'
      const modified = row.modifiedHex ?? '--'

      return `${formatHexReportOffset(row.offset)}\t${original}\t${modified}`
    }),
  ]

  return `${lines.join('\n')}\n`
}

export function hexReportRowsFromDiffRanges(
  ranges: { offset: number | string; leftBytes: number[]; rightBytes: number[] }[],
): HexReportRowInput[] {
  const rows: HexReportRowInput[] = []

  for (const range of ranges) {
    const base = typeof range.offset === 'number' ? range.offset : Number(range.offset)
    const length = Math.max(range.leftBytes.length, range.rightBytes.length)

    for (let index = 0; index < length; index += 1) {
      const hasLeft = index < range.leftBytes.length
      const hasRight = index < range.rightBytes.length

      rows.push({
        offset: (Number.isFinite(base) ? base : 0) + index,
        originalHex: hasLeft
          ? range.leftBytes[index].toString(16).toUpperCase().padStart(2, '0')
          : null,
        modifiedHex: hasRight
          ? range.rightBytes[index].toString(16).toUpperCase().padStart(2, '0')
          : null,
      })
    }
  }

  return rows
}
