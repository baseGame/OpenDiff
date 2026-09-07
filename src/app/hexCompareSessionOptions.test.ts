import { describe, expect, it } from 'vitest'
import {
  defaultHexCompareSessionOptions,
  loadHexCompareSessionOptions,
  saveHexCompareSessionOptions,
} from './hexCompareSessionOptions'

describe('hexCompareSessionOptions', () => {
  it('clamps window length and persists diff-only', () => {
    const storage = {
      store: {} as Record<string, string>,
      getItem(key: string) {
        return this.store[key] ?? null
      },
      setItem(key: string, value: string) {
        this.store[key] = value
      },
    }

    expect(loadHexCompareSessionOptions(storage)).toEqual(defaultHexCompareSessionOptions())

    saveHexCompareSessionOptions({ windowLength: 8, diffOnly: true }, storage)
    expect(loadHexCompareSessionOptions(storage)).toEqual({
      windowLength: 16,
      diffOnly: true,
    })
  })
})
