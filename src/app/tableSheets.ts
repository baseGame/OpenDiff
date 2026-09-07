import type { TableCompareRequest } from '@/types/diff'
import { extensionOf } from '@/app/fileFormats'

export type TableCompareFormat = NonNullable<TableCompareRequest['format']>

export function tableFormatFromPath(path: string): TableCompareFormat {
  const extension = extensionOf(path)

  if (extension === 'tsv' || extension === 'tab') {
    return 'tsv'
  }

  if (extension === 'xlsx') {
    return 'xlsx'
  }

  if (extension === 'xls') {
    return 'xls'
  }

  if (extension === 'html' || extension === 'htm') {
    return 'html'
  }

  return 'csv'
}

export function tableFormatFromPaths(leftPath: string, rightPath: string): TableCompareFormat {
  const leftFormat = leftPath ? tableFormatFromPath(leftPath) : undefined
  const rightFormat = rightPath ? tableFormatFromPath(rightPath) : undefined

  if (leftFormat && leftFormat !== 'csv') {
    return leftFormat
  }

  if (rightFormat && rightFormat !== 'csv') {
    return rightFormat
  }

  return leftFormat ?? rightFormat ?? 'csv'
}

export function usesWorkbookSheets(format: TableCompareFormat): boolean {
  return format === 'xlsx' || format === 'xls' || format === 'html'
}

export function mergeSheetOptions(...groups: (Iterable<string> | undefined)[]): string[] {
  const seen = new Set<string>()
  const sheets: string[] = []

  for (const group of groups) {
    if (!group) {
      continue
    }

    for (const sheet of group) {
      const name = sheet.trim()

      if (!name || seen.has(name)) {
        continue
      }

      seen.add(name)
      sheets.push(name)
    }
  }

  return sheets
}

export function preferredSheetSelection(
  available: string[],
  current: string,
  fallback?: string,
): string {
  if (current && available.some((sheet) => sheet.toLowerCase() === current.toLowerCase())) {
    return available.find((sheet) => sheet.toLowerCase() === current.toLowerCase()) ?? current
  }

  if (fallback && available.some((sheet) => sheet.toLowerCase() === fallback.toLowerCase())) {
    return available.find((sheet) => sheet.toLowerCase() === fallback.toLowerCase()) ?? fallback
  }

  return available[0] ?? current
}
