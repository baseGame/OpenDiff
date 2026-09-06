import { describe, expect, it } from 'vitest'
import { builtInFileFormats } from './fileFormats'
import { textOptionsFromFormat } from './formatSessionRules'

describe('formatSessionRules', () => {
  it('applies whitespace and comment ignore rules from a file format', () => {
    const plain = builtInFileFormats.find((format) => format.id === 'plain-text')
    const source = builtInFileFormats.find((format) => format.id === 'source-code')

    expect(plain).toBeDefined()
    expect(source).toBeDefined()

    if (!plain || !source) {
      return
    }

    const fromPlain = textOptionsFromFormat(plain, {
      ignoreWhitespace: false,
      ignoreCase: false,
      ignoreLineEndings: false,
      ignoreRegexes: [],
    })

    expect(fromPlain.ignoreWhitespace).toBe(true)

    const fromSource = textOptionsFromFormat(source, {
      ignoreWhitespace: false,
      ignoreCase: false,
      ignoreLineEndings: false,
      ignoreRegexes: [],
    })

    expect(fromSource.ignoreRegexes).toContain('^\\s*//')
  })
})
