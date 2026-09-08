export const pictureCompareOptionsStorageKey = 'open-diff-picture-compare-options'

export const pictureBlendModes = [
  'normal',
  'difference',
  'multiply',
  'screen',
  'overlay',
  'exclusion',
  'lighten',
  'darken',
] as const

export type PictureBlendMode = (typeof pictureBlendModes)[number]

export interface PictureCompareOptionsState {
  rgbTolerance: number
  compareAlpha: boolean
  ignoreColorFrom: number[] | null
  ignoreColorTo: number[] | null
  blendEnabled: boolean
  blendOpacity: number
  blendMode: PictureBlendMode
  showMeta: boolean
  showMinor: boolean
}

export function normalizePictureBlendMode(value: unknown): PictureBlendMode {
  if (typeof value === 'string' && (pictureBlendModes as readonly string[]).includes(value)) {
    return value as PictureBlendMode
  }

  return 'normal'
}

export function defaultPictureCompareOptions(): PictureCompareOptionsState {
  return {
    rgbTolerance: 0,
    compareAlpha: true,
    ignoreColorFrom: null,
    ignoreColorTo: null,
    blendEnabled: false,
    blendOpacity: 50,
    blendMode: 'normal',
    showMeta: true,
    showMinor: false,
  }
}

function clampChannel(value: unknown, fallback = 0): number {
  const numeric = typeof value === 'number' ? value : Number(value)

  if (!Number.isFinite(numeric)) {
    return fallback
  }

  return Math.min(255, Math.max(0, Math.round(numeric)))
}

function clampPercent(value: unknown, fallback = 50): number {
  const numeric = typeof value === 'number' ? value : Number(value)

  if (!Number.isFinite(numeric)) {
    return fallback
  }

  return Math.min(100, Math.max(0, Math.round(numeric)))
}

export function normalizeRgba(value: unknown): number[] | null {
  if (!Array.isArray(value) || value.length < 3) {
    return null
  }

  return [
    clampChannel(value[0]),
    clampChannel(value[1]),
    clampChannel(value[2]),
    clampChannel(value[3], 255),
  ]
}

export function loadPictureCompareOptions(
  storage: Pick<Storage, 'getItem'> = localStorage,
): PictureCompareOptionsState {
  try {
    const raw = storage.getItem(pictureCompareOptionsStorageKey)

    if (!raw) {
      return defaultPictureCompareOptions()
    }

    const parsed = JSON.parse(raw) as Partial<PictureCompareOptionsState>
    const defaults = defaultPictureCompareOptions()

    return {
      rgbTolerance: clampChannel(parsed.rgbTolerance, 0),
      compareAlpha: parsed.compareAlpha !== false,
      ignoreColorFrom: normalizeRgba(parsed.ignoreColorFrom),
      ignoreColorTo: normalizeRgba(parsed.ignoreColorTo),
      blendEnabled: parsed.blendEnabled === true,
      blendOpacity: clampPercent(parsed.blendOpacity, defaults.blendOpacity),
      blendMode: normalizePictureBlendMode(parsed.blendMode),
      showMeta: parsed.showMeta !== false,
      showMinor: parsed.showMinor === true,
    }
  } catch {
    return defaultPictureCompareOptions()
  }
}

export function savePictureCompareOptions(
  state: PictureCompareOptionsState,
  storage: Pick<Storage, 'setItem'> = localStorage,
): void {
  storage.setItem(
    pictureCompareOptionsStorageKey,
    JSON.stringify({
      rgbTolerance: clampChannel(state.rgbTolerance, 0),
      compareAlpha: state.compareAlpha,
      ignoreColorFrom: normalizeRgba(state.ignoreColorFrom),
      ignoreColorTo: normalizeRgba(state.ignoreColorTo),
      blendEnabled: state.blendEnabled,
      blendOpacity: clampPercent(state.blendOpacity, 50),
      blendMode: normalizePictureBlendMode(state.blendMode),
      showMeta: state.showMeta,
      showMinor: state.showMinor,
    }),
  )
}

export function pictureIgnoreColors(
  state: Pick<PictureCompareOptionsState, 'ignoreColorFrom' | 'ignoreColorTo'>,
): { ignoreColorFrom?: number[]; ignoreColorTo?: number[] } {
  const from = normalizeRgba(state.ignoreColorFrom)
  const to = normalizeRgba(state.ignoreColorTo)

  if (!from || !to) {
    return {}
  }

  return {
    ignoreColorFrom: from,
    ignoreColorTo: to,
  }
}
