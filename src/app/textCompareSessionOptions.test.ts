import { beforeEach, describe, expect, it } from 'vitest'
import {
  defaultTextCompareSessionOptions,
  loadTextCompareSessionOptions,
  saveTextCompareSessionOptions,
  textCompareSessionOptionsStorageKey,
} from './textCompareSessionOptions'

describe('textCompareSessionOptions', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('defaults when storage is empty', () => {
    expect(loadTextCompareSessionOptions()).toEqual(defaultTextCompareSessionOptions())
  })

  it('persists importance and alignment options', () => {
    saveTextCompareSessionOptions({
      algorithm: 'histogram',
      ignoreWhitespace: true,
      ignoreCase: true,
      ignoreLineEndings: false,
      ignoreRegexes: ['^\\s*//'],
    })

    expect(localStorage.getItem(textCompareSessionOptionsStorageKey)).toContain('histogram')
    expect(loadTextCompareSessionOptions()).toEqual({
      algorithm: 'histogram',
      ignoreWhitespace: true,
      ignoreCase: true,
      ignoreLineEndings: false,
      ignoreRegexes: ['^\\s*//'],
    })
  })
})
