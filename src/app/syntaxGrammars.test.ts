import { beforeEach, describe, expect, it } from 'vitest'
import { fileFormatsStorageKey, saveFileFormats, builtInFileFormats } from '@/app/fileFormats'
import { grammarForPath } from './syntaxGrammars'

describe('syntaxGrammars', () => {
  beforeEach(() => {
    localStorage.removeItem(fileFormatsStorageKey)
  })

  it('uses format-core style comments and keywords instead of a hardcoded four-word list', () => {
    const rust = grammarForPath('src/main.rs')
    const source = grammarForPath('app.ts')
    const plain = grammarForPath('notes.txt')

    expect(rust.id).toBe('rust-grammar')
    expect(rust.items.some((item) => item.kind === 'comment')).toBe(true)
    expect(rust.items.some((item) => item.kind === 'keyword')).toBe(true)
    expect(source.id).toBe('source')
    expect(plain.id).toBe('plain-text')
    expect(
      rust.items.find((item) => item.kind === 'keyword')?.matcher.type === 'keywords' &&
        rust.items.find((item) => item.kind === 'keyword')?.matcher,
    ).toEqual({
      type: 'keywords',
      values: ['fn', 'let', 'mut', 'pub', 'struct', 'enum', 'impl', 'use', 'async', 'match'],
    })
  })

  it('uses persisted file format grammar ids when present', () => {
    saveFileFormats(
      builtInFileFormats.map((format) =>
        format.id === 'source-code'
          ? {
              ...format,
              matcher: { ...format.matcher, extensions: ['ts'] },
              rules: { ...format.rules, grammar: 'plain-text' },
            }
          : format,
      ),
    )

    expect(grammarForPath('app.ts').id).toBe('plain-text')
  })
})
