import { beforeEach, describe, expect, it } from 'vitest'
import {
  defaultVersionCompareOptions,
  isVersionFieldImportant,
  loadVersionCompareOptions,
  saveVersionCompareOptions,
  toggleVersionFieldImportance,
  versionCompareOptionsStorageKey,
} from './versionCompareOptions'

describe('versionCompareOptions', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('loads defaults and persists unimportant fields', () => {
    expect(loadVersionCompareOptions().unimportantFields).toContain('Comments')

    saveVersionCompareOptions({ unimportantFields: ['Comments', 'FileVersion'] })

    expect(localStorage.getItem(versionCompareOptionsStorageKey)).toContain('FileVersion')
    expect(loadVersionCompareOptions().unimportantFields).toEqual(['Comments', 'FileVersion'])
  })

  it('toggles field importance', () => {
    const base = defaultVersionCompareOptions()

    expect(isVersionFieldImportant('FileVersion', base)).toBe(true)
    expect(isVersionFieldImportant('Comments', base)).toBe(false)

    const demoted = toggleVersionFieldImportance('FileVersion', base)

    expect(isVersionFieldImportant('FileVersion', demoted)).toBe(false)

    const promoted = toggleVersionFieldImportance('Comments', demoted)

    expect(isVersionFieldImportant('Comments', promoted)).toBe(true)
  })
})
