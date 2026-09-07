export interface FolderSyncReportRow {
  path: string
  action: string
  planned: string
  override: string
  detail: string
}

export interface FolderSyncReportSummary {
  total: number
  copy: number
  delete: number
  leave: number
  conflict: number
  overridden: number
}

export interface BuildFolderSyncReportTextInput {
  leftPath: string
  rightPath: string
  strategy: string
  planName: string
  summary: FolderSyncReportSummary
  rows: FolderSyncReportRow[]
}

/** Sibling text report path next to the left sync folder (matches folder-merge export style). */
export function defaultFolderSyncReportOutputPath(leftPath: string): string {
  const trimmed = leftPath.trim().replace(/[/\\]+$/u, '')

  if (!trimmed) {
    return 'folder-sync.txt'
  }

  const slash = Math.max(trimmed.lastIndexOf('/'), trimmed.lastIndexOf('\\'))

  if (slash < 0) {
    return 'folder-sync.txt'
  }

  return `${trimmed.slice(0, slash + 1)}folder-sync.txt`
}

export function buildFolderSyncReportText(input: BuildFolderSyncReportTextInput): string {
  const lines = [
    'FOLDER-SYNC-REPORT',
    `left: ${input.leftPath || '--'}`,
    `right: ${input.rightPath || '--'}`,
    `strategy: ${input.strategy || '--'}`,
    `plan: ${input.planName || '--'}`,
    `total: ${String(input.summary.total)}`,
    `copy: ${String(input.summary.copy)}`,
    `delete: ${String(input.summary.delete)}`,
    `leave: ${String(input.summary.leave)}`,
    `conflict: ${String(input.summary.conflict)}`,
    `overridden: ${String(input.summary.overridden)}`,
    '',
    'rows:',
    ...input.rows.map(
      (row) => `${row.path}\t${row.action}\t${row.planned}\t${row.override}\t${row.detail}`,
    ),
  ]

  return lines.join('\n')
}
