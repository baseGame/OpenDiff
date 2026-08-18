import { matchFileFormat } from '@/app/fileFormats'

export interface SyntaxGrammarItem {
  id: string
  kind: string
  matcher: { type: 'linePrefix'; value: string } | { type: 'keywords'; values: string[] }
  styleScope: string
}

export interface SyntaxGrammar {
  id: string
  items: SyntaxGrammarItem[]
}

export const syntaxGrammars: Record<string, SyntaxGrammar> = {
  'plain-text': {
    id: 'plain-text',
    items: [
      {
        id: 'hash-comment',
        kind: 'comment',
        matcher: { type: 'linePrefix', value: '#' },
        styleScope: 'comment.line',
      },
      {
        id: 'marker',
        kind: 'keyword',
        matcher: { type: 'keywords', values: ['TODO', 'FIXME'] },
        styleScope: 'keyword.control',
      },
    ],
  },
  source: {
    id: 'source',
    items: [
      {
        id: 'line-comment',
        kind: 'comment',
        matcher: { type: 'linePrefix', value: '//' },
        styleScope: 'comment.line',
      },
      {
        id: 'keyword',
        kind: 'keyword',
        matcher: {
          type: 'keywords',
          values: ['function', 'const', 'let', 'class', 'export', 'import', 'return'],
        },
        styleScope: 'keyword.control',
      },
    ],
  },
  'rust-grammar': {
    id: 'rust-grammar',
    items: [
      {
        id: 'line-comment',
        kind: 'comment',
        matcher: { type: 'linePrefix', value: '//' },
        styleScope: 'comment.line',
      },
      {
        id: 'keyword',
        kind: 'keyword',
        matcher: {
          type: 'keywords',
          values: ['fn', 'let', 'mut', 'pub', 'struct', 'enum', 'impl', 'use', 'async', 'match'],
        },
        styleScope: 'keyword.control',
      },
    ],
  },
}

export const defaultSyntaxGrammar = syntaxGrammars.source

export function grammarForPath(path: string): SyntaxGrammar {
  if (!path.trim()) {
    return defaultSyntaxGrammar
  }

  const format = matchFileFormat(path)
  const grammarId = format?.rules.grammar
  const matched = Object.entries(syntaxGrammars).find(([id]) => id === grammarId)?.[1]

  return matched ?? defaultSyntaxGrammar
}
