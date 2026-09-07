import type { TextDiffAlgorithm } from '@/types/diff'

export const textCompareSessionOptionsStorageKey = 'open-diff-text-compare-session-options'

export interface TextCompareSessionOptions {
  algorithm: TextDiffAlgorithm
  ignoreWhitespace: boolean
  ignoreCase: boolean
  ignoreLineEndings: boolean
  ignoreRegexes: string[]
}

const algorithms: TextDiffAlgorithm[] = ['myers', 'patience', 'histogram']

export function defaultTextCompareSessionOptions(): TextCompareSessionOptions {
  return {
    algorithm: 'myers',
    ignoreWhitespace: false,
    ignoreCase: false,
    ignoreLineEndings: false,
    ignoreRegexes: [],
  }
}

function normalizeAlgorithm(value: unknown): TextDiffAlgorithm {
  return typeof value === 'string' && algorithms.includes(value as TextDiffAlgorithm)
    ? (value as TextDiffAlgorithm)
    : 'myers'
}

export function loadTextCompareSessionOptions(
  storage: Pick<Storage, 'getItem'> = localStorage,
): TextCompareSessionOptions {
  try {
    const raw = storage.getItem(textCompareSessionOptionsStorageKey)

    if (!raw) {
      return defaultTextCompareSessionOptions()
    }

    const parsed = JSON.parse(raw) as Partial<TextCompareSessionOptions>
    const ignoreRegexes = Array.isArray(parsed.ignoreRegexes)
      ? parsed.ignoreRegexes.filter((item): item is string => typeof item === 'string')
      : []

    return {
      algorithm: normalizeAlgorithm(parsed.algorithm),
      ignoreWhitespace: Boolean(parsed.ignoreWhitespace),
      ignoreCase: Boolean(parsed.ignoreCase),
      ignoreLineEndings: Boolean(parsed.ignoreLineEndings),
      ignoreRegexes,
    }
  } catch {
    return defaultTextCompareSessionOptions()
  }
}

export function saveTextCompareSessionOptions(
  state: TextCompareSessionOptions,
  storage: Pick<Storage, 'setItem'> = localStorage,
): void {
  storage.setItem(
    textCompareSessionOptionsStorageKey,
    JSON.stringify({
      algorithm: normalizeAlgorithm(state.algorithm),
      ignoreWhitespace: state.ignoreWhitespace,
      ignoreCase: state.ignoreCase,
      ignoreLineEndings: state.ignoreLineEndings,
      ignoreRegexes: state.ignoreRegexes.filter((item) => item.trim().length > 0),
    }),
  )
}
