import { describe, expect, it } from 'vitest'
import {
  defaultPictureCompareOptions,
  loadPictureCompareOptions,
  normalizeRgba,
  pictureIgnoreColors,
  savePictureCompareOptions,
} from './pictureCompareOptions'

function memoryStorage(initial: Record<string, string> = {}): Pick<Storage, 'getItem' | 'setItem'> {
  const data = new Map<string, string>(Object.entries(initial))

  return {
    getItem(key: string) {
      return data.has(key) ? (data.get(key) ?? null) : null
    },
    setItem(key: string, value: string) {
      data.set(key, value)
    },
  }
}

describe('pictureCompareOptions', () => {
  it('defaults to strict RGB compare with alpha on', () => {
    expect(defaultPictureCompareOptions()).toEqual({
      rgbTolerance: 0,
      compareAlpha: true,
      ignoreColorFrom: null,
      ignoreColorTo: null,
    })
  })

  it('normalizes RGBA channels and clamps out-of-range values', () => {
    expect(normalizeRgba([300, -1, 12.4, 40])).toEqual([255, 0, 12, 40])
    expect(normalizeRgba([1, 2])).toBeNull()
    expect(normalizeRgba([10, 20, 30])).toEqual([10, 20, 30, 255])
  })

  it('persists and reloads tolerance plus ignore colors', () => {
    const storage = memoryStorage()

    savePictureCompareOptions(
      {
        rgbTolerance: 8,
        compareAlpha: false,
        ignoreColorFrom: [255, 0, 0, 255],
        ignoreColorTo: [0, 255, 0],
      },
      storage,
    )

    expect(loadPictureCompareOptions(storage)).toEqual({
      rgbTolerance: 8,
      compareAlpha: false,
      ignoreColorFrom: [255, 0, 0, 255],
      ignoreColorTo: [0, 255, 0, 255],
    })
  })

  it('only emits ignore colors when both ends are set', () => {
    expect(
      pictureIgnoreColors({
        ignoreColorFrom: [255, 0, 0, 255],
        ignoreColorTo: null,
      }),
    ).toEqual({})
    expect(
      pictureIgnoreColors({
        ignoreColorFrom: [255, 0, 0, 255],
        ignoreColorTo: [0, 255, 0, 255],
      }),
    ).toEqual({
      ignoreColorFrom: [255, 0, 0, 255],
      ignoreColorTo: [0, 255, 0, 255],
    })
  })
})
