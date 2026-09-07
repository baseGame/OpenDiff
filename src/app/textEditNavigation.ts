/** 1-based line jump helpers for Text Edit. */

export interface TextLineRange {
  /** Inclusive start offset into the full document text. */
  start: number
  /** Exclusive end offset (end of line content, before trailing newline when present). */
  end: number
  /** Clamped 1-based line number that was selected. */
  line: number
  totalLines: number
}

/**
 * Resolve a 1-based line number to character offsets.
 * Invalid / empty input returns null. Out-of-range numbers clamp to [1, totalLines].
 */
export function resolveGoToLine(text: string, lineInput: string | number): TextLineRange | null {
  const totalLines = text.length === 0 ? 0 : text.split('\n').length

  if (totalLines === 0) {
    return null
  }

  const parsed = typeof lineInput === 'number' ? lineInput : Number.parseInt(lineInput.trim(), 10)

  if (!Number.isFinite(parsed) || parsed < 1) {
    return null
  }

  const line = Math.min(Math.max(Math.trunc(parsed), 1), totalLines)
  let start = 0

  for (let index = 1; index < line; index += 1) {
    const nextBreak = text.indexOf('\n', start)

    if (nextBreak < 0) {
      break
    }

    start = nextBreak + 1
  }

  const nextBreak = text.indexOf('\n', start)
  const end = nextBreak < 0 ? text.length : nextBreak

  return { start, end, line, totalLines }
}
