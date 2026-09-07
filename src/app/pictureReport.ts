export interface PictureReportStatistics {
  totalPixels: number
  differentPixels: number
  differenceRatio: number
  boundingRect?: {
    x: number
    y: number
    width: number
    height: number
  } | null
}

export interface PictureReportMetadataRow {
  key: string
  left: string
  right: string
  status: string
}

export interface BuildPictureReportTextInput {
  leftPath: string
  rightPath: string
  statistics: PictureReportStatistics
  metadataRows: PictureReportMetadataRow[]
  boundingRectText?: string
}

export function formatPictureBoundingRect(
  boundingRect: PictureReportStatistics['boundingRect'],
): string {
  if (!boundingRect) {
    return '--'
  }

  return `${String(boundingRect.x)}, ${String(boundingRect.y)}, ${String(boundingRect.width)} x ${String(boundingRect.height)}`
}

/** Sibling text report path next to the left image (matches folder/text export style). */
export function defaultPictureReportOutputPath(leftPath: string): string {
  const trimmed = leftPath.trim()

  if (!trimmed) {
    return 'picture-compare.txt'
  }

  const slash = Math.max(trimmed.lastIndexOf('/'), trimmed.lastIndexOf('\\'))

  if (slash < 0) {
    return 'picture-compare.txt'
  }

  return `${trimmed.slice(0, slash + 1)}picture-compare.txt`
}

export function buildPictureReportText(input: BuildPictureReportTextInput): string {
  const boundingRectText =
    input.boundingRectText ?? formatPictureBoundingRect(input.statistics.boundingRect)

  const lines = [
    'PICTURE-REPORT',
    `left: ${input.leftPath}`,
    `right: ${input.rightPath}`,
    `totalPixels: ${String(input.statistics.totalPixels)}`,
    `differentPixels: ${String(input.statistics.differentPixels)}`,
    `differenceRatio: ${String(input.statistics.differenceRatio)}`,
    `boundingRect: ${boundingRectText}`,
    '',
    'metadata:',
    ...input.metadataRows.map((row) => `${row.key}\t${row.left}\t${row.right}\t${row.status}`),
  ]

  return lines.join('\n')
}
