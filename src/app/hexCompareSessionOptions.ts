export const hexCompareSessionOptionsStorageKey = 'open-diff-hex-compare-session-options'

export interface HexCompareSessionOptions {
  windowLength: number
  diffOnly: boolean
}

export function defaultHexCompareSessionOptions(): HexCompareSessionOptions {
  return {
    windowLength: 256,
    diffOnly: false,
  }
}

function clampWindowLength(value: unknown): number {
  const numeric = typeof value === 'number' ? value : Number(value)

  if (!Number.isFinite(numeric)) {
    return 256
  }

  return Math.min(4096, Math.max(16, Math.floor(numeric)))
}

export function loadHexCompareSessionOptions(
  storage: Pick<Storage, 'getItem'> = localStorage,
): HexCompareSessionOptions {
  try {
    const raw = storage.getItem(hexCompareSessionOptionsStorageKey)

    if (!raw) {
      return defaultHexCompareSessionOptions()
    }

    const parsed = JSON.parse(raw) as Partial<HexCompareSessionOptions>

    return {
      windowLength: clampWindowLength(parsed.windowLength),
      diffOnly: Boolean(parsed.diffOnly),
    }
  } catch {
    return defaultHexCompareSessionOptions()
  }
}

export function saveHexCompareSessionOptions(
  state: HexCompareSessionOptions,
  storage: Pick<Storage, 'setItem'> = localStorage,
): void {
  storage.setItem(
    hexCompareSessionOptionsStorageKey,
    JSON.stringify({
      windowLength: clampWindowLength(state.windowLength),
      diffOnly: state.diffOnly,
    }),
  )
}
