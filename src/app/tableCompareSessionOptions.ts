export const tableCompareSessionOptionsStorageKey = 'open-diff-table-compare-session-options'

export interface TableCompareSessionOptions {
  keyColumns: string
  delimiter: string
  ignoredColumns: string[]
}

export function defaultTableCompareSessionOptions(): TableCompareSessionOptions {
  return {
    keyColumns: '0',
    delimiter: '',
    ignoredColumns: [],
  }
}

export function loadTableCompareSessionOptions(
  storage: Pick<Storage, 'getItem'> = localStorage,
): TableCompareSessionOptions {
  try {
    const raw = storage.getItem(tableCompareSessionOptionsStorageKey)

    if (!raw) {
      return defaultTableCompareSessionOptions()
    }

    const parsed = JSON.parse(raw) as Partial<TableCompareSessionOptions>
    const ignoredColumns = Array.isArray(parsed.ignoredColumns)
      ? parsed.ignoredColumns.filter((item): item is string => typeof item === 'string')
      : []

    return {
      keyColumns:
        typeof parsed.keyColumns === 'string' && parsed.keyColumns.trim()
          ? parsed.keyColumns.trim()
          : '0',
      delimiter: typeof parsed.delimiter === 'string' ? parsed.delimiter : '',
      ignoredColumns,
    }
  } catch {
    return defaultTableCompareSessionOptions()
  }
}

export function saveTableCompareSessionOptions(
  state: TableCompareSessionOptions,
  storage: Pick<Storage, 'setItem'> = localStorage,
): void {
  storage.setItem(
    tableCompareSessionOptionsStorageKey,
    JSON.stringify({
      keyColumns: state.keyColumns.trim() || '0',
      delimiter: state.delimiter,
      ignoredColumns: state.ignoredColumns.filter((item) => item.trim().length > 0),
    }),
  )
}
