export interface FolderMergeReportRow {
  path: string
  action: string
  detail: string
}

export interface FolderMergeReportSummary {
  actions: number
  automatic: number
  conflicts: number
}

export interface BuildFolderMergeReportTextInput {
  leftPath: string
  basePath: string
  rightPath: string
  outputPath: string
  summary: FolderMergeReportSummary
  rows: FolderMergeReportRow[]
}

/** Sibling text report path next to the left merge folder (matches picture/version export style). */
export function defaultFolderMergeReportOutputPath(leftPath: string): string {
  const trimmed = leftPath.trim().replace(/[/\\]+$/u, '')

  if (!trimmed) {
    return 'folder-merge.txt'
  }

  const slash = Math.max(trimmed.lastIndexOf('/'), trimmed.lastIndexOf('\\'))

  if (slash < 0) {
    return 'folder-merge.txt'
  }

  return `${trimmed.slice(0, slash + 1)}folder-merge.txt`
}

export function buildFolderMergeReportText(input: BuildFolderMergeReportTextInput): string {
  const lines = [
    'FOLDER-MERGE-REPORT',
    `left: ${input.leftPath || '--'}`,
    `base: ${input.basePath || '--'}`,
    `right: ${input.rightPath || '--'}`,
    `output: ${input.outputPath || '--'}`,
    `actions: ${String(input.summary.actions)}`,
    `automatic: ${String(input.summary.automatic)}`,
    `conflicts: ${String(input.summary.conflicts)}`,
    '',
    'rows:',
    ...input.rows.map((row) => `${row.path}\t${row.action}\t${row.detail}`),
  ]

  return lines.join('\n')
}
