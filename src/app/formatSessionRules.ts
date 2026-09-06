import type { FileFormatDefinition } from '@/app/fileFormats'

export interface TextCompareFormatOptions {
  ignoreWhitespace: boolean
  ignoreCase: boolean
  ignoreLineEndings: boolean
  ignoreRegexes: string[]
}

/** Map persisted format ignore rules onto Text Compare options that already exist. */
export function textOptionsFromFormat(
  format: FileFormatDefinition,
  current: TextCompareFormatOptions,
): TextCompareFormatOptions {
  const ignore = new Set(format.rules.ignore.map((rule) => rule.trim().toLowerCase()))
  const ignoreRegexes = [...current.ignoreRegexes]

  if (ignore.has('comments') && !ignoreRegexes.includes('^\\s*//')) {
    ignoreRegexes.push('^\\s*//')
  }

  return {
    ignoreWhitespace:
      ignore.has('whitespace-trim') || ignore.has('whitespace') || current.ignoreWhitespace,
    ignoreCase: ignore.has('case') || current.ignoreCase,
    ignoreLineEndings:
      ignore.has('line-endings') || ignore.has('formatting') || current.ignoreLineEndings,
    ignoreRegexes,
  }
}
