export type FolderSelectableStatus = 'Same' | 'Different' | 'Left only' | 'Right only'
export type FolderSelectableKind = 'file' | 'directory'

export interface FolderSelectableRow {
  id: string
  kind: FolderSelectableKind
  status: FolderSelectableStatus
  relativePath: string
  leftName?: string
  rightName?: string
}

export function rowDisplayName(row: FolderSelectableRow): string {
  return row.leftName ?? row.rightName ?? row.relativePath
}

export function selectAllRowIds(rows: FolderSelectableRow[]): string[] {
  return rows.map((row) => row.id)
}

export function selectFileRowIds(rows: FolderSelectableRow[]): string[] {
  return rows.filter((row) => row.kind === 'file').map((row) => row.id)
}

export function selectRowIdsByStatuses(
  rows: FolderSelectableRow[],
  statuses: FolderSelectableStatus[],
): string[] {
  const wanted = new Set(statuses)

  return rows.filter((row) => wanted.has(row.status)).map((row) => row.id)
}

export function selectRowIdsByNameFilter(rows: FolderSelectableRow[], query: string): string[] {
  const normalized = query.trim().toLowerCase()

  if (!normalized) {
    return []
  }

  return rows
    .filter((row) => rowDisplayName(row).toLowerCase().includes(normalized))
    .map((row) => row.id)
}

export function invertRowIds(rows: FolderSelectableRow[], selectedIds: Iterable<string>): string[] {
  const selected = new Set(selectedIds)

  return rows.filter((row) => !selected.has(row.id)).map((row) => row.id)
}
