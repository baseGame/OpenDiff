export interface MediaReportFieldRow {
  field: string
  left: string
  right: string
  status: string
  important: boolean
}

export interface MediaReportSummary {
  added: number
  removed: number
  modified: number
  unchanged: number
}

export interface BuildMediaReportTextInput {
  leftPath: string
  rightPath: string
  summary: MediaReportSummary
  fields: MediaReportFieldRow[]
}

/** Sibling text report path next to the left media file (matches picture/version export style). */
export function defaultMediaReportOutputPath(leftPath: string): string {
  const trimmed = leftPath.trim()

  if (!trimmed) {
    return 'media-compare.txt'
  }

  const slash = Math.max(trimmed.lastIndexOf('/'), trimmed.lastIndexOf('\\'))

  if (slash < 0) {
    return 'media-compare.txt'
  }

  return `${trimmed.slice(0, slash + 1)}media-compare.txt`
}

export function buildMediaReportText(input: BuildMediaReportTextInput): string {
  const lines = [
    'MEDIA-REPORT',
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
        `${row.field}\t${row.left}\t${row.right}\t${row.status}\t${row.important ? 'important' : 'unimportant'}`,
    ),
  ]

  return lines.join('\n')
}
