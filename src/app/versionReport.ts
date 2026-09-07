export interface VersionReportFieldRow {
  group: string
  field: string
  left: string
  right: string
  status: string
  important: boolean
}

export interface VersionReportSummary {
  added: number
  removed: number
  modified: number
  unchanged: number
}

export interface BuildVersionReportTextInput {
  leftPath: string
  rightPath: string
  summary: VersionReportSummary
  fields: VersionReportFieldRow[]
}

/** Sibling text report path next to the left binary (matches picture export style). */
export function defaultVersionReportOutputPath(leftPath: string): string {
  const trimmed = leftPath.trim()

  if (!trimmed) {
    return 'version-compare.txt'
  }

  const slash = Math.max(trimmed.lastIndexOf('/'), trimmed.lastIndexOf('\\'))

  if (slash < 0) {
    return 'version-compare.txt'
  }

  return `${trimmed.slice(0, slash + 1)}version-compare.txt`
}

export function buildVersionReportText(input: BuildVersionReportTextInput): string {
  const lines = [
    'VERSION-REPORT',
    `left: ${input.leftPath}`,
    `right: ${input.rightPath}`,
    `added: ${String(input.summary.added)}`,
    `removed: ${String(input.summary.removed)}`,
    `modified: ${String(input.summary.modified)}`,
    `unchanged: ${String(input.summary.unchanged)}`,
    '',
    'fields:',
    ...input.fields.map(
      (row) =>
        `${row.group}\t${row.field}\t${row.left}\t${row.right}\t${row.status}\t${row.important ? 'important' : 'unimportant'}`,
    ),
  ]

  return lines.join('\n')
}
