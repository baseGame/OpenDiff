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
        id: `${fileIndex}:${hunkIndex}:${hunk.oldStart}:${hunk.newStart}`,
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
    } else if (line.kind === 'added') {
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

export function clampSectionIndex(index: number, total: number): number {
  if (total <= 0) {
    return 0
  }

  return ((index % total) + total) % total
}
