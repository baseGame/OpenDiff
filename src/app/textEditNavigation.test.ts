import { describe, expect, it } from 'vitest'
import { resolveGoToLine } from './textEditNavigation'

describe('textEditNavigation', () => {
  it('maps 1-based line numbers to character ranges', () => {
    const text = 'alpha\nbeta\ngamma'

    expect(resolveGoToLine(text, 1)).toEqual({ start: 0, end: 5, line: 1, totalLines: 3 })
    expect(resolveGoToLine(text, '2')).toEqual({ start: 6, end: 10, line: 2, totalLines: 3 })
    expect(resolveGoToLine(text, 3)).toEqual({ start: 11, end: 16, line: 3, totalLines: 3 })
  })

  it('clamps past the last line and rejects invalid input', () => {
    const text = 'one\ntwo'

    expect(resolveGoToLine(text, 99)?.line).toBe(2)
    expect(resolveGoToLine(text, 0)).toBeNull()
    expect(resolveGoToLine(text, 'nope')).toBeNull()
    expect(resolveGoToLine('', 1)).toBeNull()
  })
})
