import { describe, expect, it } from 'vitest'
import { formatCompareError } from './compareError'

const t = (key: string): string => key

describe('formatCompareError', () => {
  it('maps empty and undefined noise to a readable compare failure', () => {
    expect(formatCompareError(undefined, t)).toBe('error.compare.failed')
    expect(formatCompareError('undefined', t)).toBe('error.compare.failed')
    expect(formatCompareError({}, t)).toBe('error.compare.failed')
  })

  it('maps missing-path and cancel patterns', () => {
    expect(formatCompareError(new Error('ENOENT: no such file'), t)).toBe(
      'error.compare.pathMissing',
    )
    expect(formatCompareError('cancelled by user', t)).toBe('error.compare.cancelled')
  })

  it('keeps short concrete messages', () => {
    expect(formatCompareError(new Error('Folder locked'), t)).toBe('Folder locked')
  })
})
