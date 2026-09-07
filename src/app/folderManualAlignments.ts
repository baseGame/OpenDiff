/** Persist Folder Compare Align With pairs across rescans. */

export type AlignableFolderStatus = 'Same' | 'Different' | 'Left only' | 'Right only'

export interface AlignableFolderRow {
  id: string
  relativePath: string
  parentId?: string
  depth: number
  leftName?: string
  rightName?: string
  leftSize?: string
  rightSize?: string
  leftModified?: string
  rightModified?: string
  leftPath?: string
  rightPath?: string
  status: AlignableFolderStatus
  kind: 'file' | 'directory'
  manualAlignment?: boolean
  alignedLeftRelativePath?: string
  alignedRightRelativePath?: string
}

export interface ManualAlignmentPair {
  leftRelativePath: string
  rightRelativePath: string
}

export function upsertManualAlignment(
  pairs: ManualAlignmentPair[],
  leftRelativePath: string,
  rightRelativePath: string,
): ManualAlignmentPair[] {
  const left = leftRelativePath.trim()
  const right = rightRelativePath.trim()

  if (!left || !right) {
    return pairs.slice()
  }

  const next = pairs.filter(
    (pair) => pair.leftRelativePath !== left && pair.rightRelativePath !== right,
  )

  next.push({ leftRelativePath: left, rightRelativePath: right })

  return next
}

export function removeManualAlignment(
  pairs: ManualAlignmentPair[],
  leftRelativePath: string,
  rightRelativePath: string,
): ManualAlignmentPair[] {
  const left = leftRelativePath.trim()
  const right = rightRelativePath.trim()

  return pairs.filter((pair) => pair.leftRelativePath !== left || pair.rightRelativePath !== right)
}

export function mergeAlignedOrphans(
  leftSide: AlignableFolderRow,
  rightSide: AlignableFolderRow,
): AlignableFolderRow {
  return {
    id: `align-${leftSide.id}-with-${rightSide.id}`,
    relativePath: `${leftSide.relativePath} <--> ${rightSide.relativePath}`,
    parentId: leftSide.parentId ?? rightSide.parentId,
    depth: Math.min(leftSide.depth, rightSide.depth),
    leftName: leftSide.leftName,
    rightName: rightSide.rightName,
    leftSize: leftSide.leftSize,
    rightSize: rightSide.rightSize,
    leftModified: leftSide.leftModified,
    rightModified: rightSide.rightModified,
    leftPath: leftSide.leftPath,
    rightPath: rightSide.rightPath,
    status: 'Different',
    kind: leftSide.kind === 'directory' || rightSide.kind === 'directory' ? 'directory' : 'file',
    manualAlignment: true,
    alignedLeftRelativePath: leftSide.relativePath,
    alignedRightRelativePath: rightSide.relativePath,
  }
}

export function applyManualAlignments(
  rows: AlignableFolderRow[],
  pairs: ManualAlignmentPair[],
): AlignableFolderRow[] {
  let next = rows.slice()

  for (const pair of pairs) {
    const leftSide = next.find(
      (row) => row.status === 'Left only' && row.relativePath === pair.leftRelativePath,
    )
    const rightSide = next.find(
      (row) => row.status === 'Right only' && row.relativePath === pair.rightRelativePath,
    )

    if (!leftSide || !rightSide) {
      continue
    }

    const merged = mergeAlignedOrphans(leftSide, rightSide)

    next = next.filter((row) => row.id !== leftSide.id && row.id !== rightSide.id).concat(merged)
  }

  return next
}
