import type { PatchFile, PatchHunk, PatchLine } from '@/types/diff'

export interface PatchSection {
  id: string
  fileIndex: number
  hunkIndex: number
  oldPath: string
  newPath: string
  heading: string
  oldStart: number
  newStart: number
}

export interface ReconstructedPatchSides {
  left: string
  right: string
  leftSource: string
  rightSource: string
}

export function flattenPatchSections(files: PatchFile[]): PatchSection[] {
  const sections: PatchSection[] = []

  files.forEach((file, fileIndex) => {
    file.hunks.forEach((hunk, hunkIndex) => {
      sections.push({
        id: `${String(fileIndex)}:${String(hunkIndex)}:${String(hunk.oldStart)}:${String(hunk.newStart)}`,
        fileIndex,
        hunkIndex,
        oldPath: file.oldPath,
        newPath: file.newPath,
        heading: hunk.heading,
        oldStart: hunk.oldStart,
        newStart: hunk.newStart,
      })
    })
  })

  return sections
}

export function reconstructSidesFromLines(
  lines: PatchLine[],
  oldPath: string,
  newPath: string,
): ReconstructedPatchSides {
  const leftLines: string[] = []
  const rightLines: string[] = []

  for (const line of lines) {
    if (line.kind === 'context') {
      leftLines.push(line.text)
      rightLines.push(line.text)
    } else if (line.kind === 'removed') {
      leftLines.push(line.text)
    } else {
      rightLines.push(line.text)
    }
  }

  return {
    left: leftLines.join('\n'),
    right: rightLines.join('\n'),
    leftSource: oldPath,
    rightSource: newPath,
  }
}

export function reconstructSidesFromHunk(
  file: PatchFile,
  hunk: PatchHunk,
): ReconstructedPatchSides {
  return reconstructSidesFromLines(hunk.lines, file.oldPath, file.newPath)
}

export function reconstructSidesFromFile(file: PatchFile): ReconstructedPatchSides {
  const lines = file.hunks.flatMap((hunk) => hunk.lines)

  return reconstructSidesFromLines(lines, file.oldPath, file.newPath)
}

export type ReconstructedPatchSideKind = 'context' | 'added' | 'removed' | 'empty'

export interface ReconstructedPatchSideCell {
  text: string
  kind: ReconstructedPatchSideKind
  lineNumber: number | null
}

export interface ReconstructedPatchRow {
  left: ReconstructedPatchSideCell
  right: ReconstructedPatchSideCell
}

function emptySideCell(): ReconstructedPatchSideCell {
  return { text: '', kind: 'empty', lineNumber: null }
}

/** Align unified hunk lines into side-by-side rows (pairs remove+add as one row). */
export function reconstructAlignedRows(lines: PatchLine[]): ReconstructedPatchRow[] {
  const rows: ReconstructedPatchRow[] = []
  let index = 0

  while (index < lines.length) {
    const line = lines[index]

    if (line.kind === 'context') {
      rows.push({
        left: { text: line.text, kind: 'context', lineNumber: line.oldNumber },
        right: { text: line.text, kind: 'context', lineNumber: line.newNumber },
      })
      index += 1
      continue
    }

    if (line.kind === 'removed' && index + 1 < lines.length && lines[index + 1].kind === 'added') {
      const next = lines[index + 1]

      rows.push({
        left: { text: line.text, kind: 'removed', lineNumber: line.oldNumber },
        right: { text: next.text, kind: 'added', lineNumber: next.newNumber },
      })
      index += 2
      continue
    }

    if (line.kind === 'removed') {
      rows.push({
        left: { text: line.text, kind: 'removed', lineNumber: line.oldNumber },
        right: emptySideCell(),
      })
      index += 1
      continue
    }

    rows.push({
      left: emptySideCell(),
      right: { text: line.text, kind: 'added', lineNumber: line.newNumber },
    })
    index += 1
  }

  return rows
}

export function reconstructAlignedRowsFromHunk(
  file: PatchFile,
  hunk: PatchHunk,
): { rows: ReconstructedPatchRow[]; leftSource: string; rightSource: string } {
  return {
    rows: reconstructAlignedRows(hunk.lines),
    leftSource: file.oldPath,
    rightSource: file.newPath,
  }
}

export function clampSectionIndex(index: number, total: number): number {
  if (total <= 0) {
    return 0
  }

  return ((index % total) + total) % total
}
