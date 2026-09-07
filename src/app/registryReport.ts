export interface RegistryReportValueRow {
  keyPath: string
  name: string
  left: string
  right: string
  status: string
}

export interface RegistryReportSummary {
  added: number
  removed: number
  modified: number
  unchanged: number
}

export interface BuildRegistryReportTextInput {
  leftPath: string
  rightPath: string
  summary: RegistryReportSummary
  values: RegistryReportValueRow[]
}

/** Sibling text report path next to the left export (matches picture/hex export style). */
export function defaultRegistryReportOutputPath(leftPath: string): string {
  const trimmed = leftPath.trim()

  if (!trimmed) {
    return 'registry-compare.txt'
  }

  const slash = Math.max(trimmed.lastIndexOf('/'), trimmed.lastIndexOf('\\'))

  if (slash < 0) {
    return 'registry-compare.txt'
  }

  return `${trimmed.slice(0, slash + 1)}registry-compare.txt`
}

export function buildRegistryReportText(input: BuildRegistryReportTextInput): string {
  const lines = [
    'REGISTRY-REPORT',
    `left: ${input.leftPath}`,
    `right: ${input.rightPath}`,
    `added: ${String(input.summary.added)}`,
    `removed: ${String(input.summary.removed)}`,
    `modified: ${String(input.summary.modified)}`,
    `unchanged: ${String(input.summary.unchanged)}`,
    '',
    'values:',
    ...input.values.map(
      (row) => `${row.keyPath}\t${row.name}\t${row.left}\t${row.right}\t${row.status}`,
    ),
  ]

  return `${lines.join('\n')}\n`
}
