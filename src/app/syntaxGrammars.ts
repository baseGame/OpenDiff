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

export interface SyntaxToken {
  start: number
  end: number
  kind: string
  scope: string
}

export const syntaxLanguageOptions = [
  { id: 'auto', labelKey: 'ui.syntaxAuto' },
  { id: 'plain-text', labelKey: 'ui.plainText' },
  { id: 'source', labelKey: 'ui.sourceCode' },
  { id: 'rust-grammar', labelKey: 'ui.rust' },
]

export function resolveSyntaxGrammar(languageId: string, path: string): SyntaxGrammar {
  if (languageId === 'auto' || !languageId.trim()) {
    return grammarForPath(path)
  }

  return syntaxGrammars[languageId] ?? defaultSyntaxGrammar
}

export function tokenizeSyntaxLine(text: string, grammar: SyntaxGrammar): SyntaxToken[] {
  if (!text) {
    return []
  }

  for (const item of grammar.items) {
    const range = getSyntaxRange(text, item.matcher)

    if (range) {
      return [
        {
          ...range,
          kind: item.kind,
          scope: item.styleScope,
        },
      ]
    }
  }

  return []
}

export function splitLineBySyntaxTokens(
  text: string,
  tokens: SyntaxToken[],
): { text: string; kind?: string }[] {
  if (tokens.length === 0) {
    return [{ text }]
  }

  const parts: { text: string; kind?: string }[] = []
  let cursor = 0

  for (const token of tokens) {
    if (token.start > cursor) {
      parts.push({ text: text.slice(cursor, token.start) })
    }

    parts.push({
      text: text.slice(token.start, token.end),
      kind: token.kind,
    })
    cursor = token.end
  }

  if (cursor < text.length) {
    parts.push({ text: text.slice(cursor) })
  }

  return parts
}

function getSyntaxRange(
  text: string,
  matcher: SyntaxGrammarItem['matcher'],
): Pick<SyntaxToken, 'start' | 'end'> | null {
  if (matcher.type === 'linePrefix') {
    const start = text.indexOf(matcher.value)

    if (start < 0) {
      return null
    }

    return { start, end: text.length }
  }

  for (const keyword of matcher.values) {
    const start = text.indexOf(keyword)

    if (start < 0) {
      continue
    }

    const before = start === 0 ? '' : text[start - 1]
    const after = text[start + keyword.length] ?? ''
    const boundary = /[a-zA-Z0-9_]/

    if (before && boundary.test(before)) {
      continue
    }

    if (after && boundary.test(after)) {
      continue
    }

    return { start, end: start + keyword.length }
  }

  return null
}
