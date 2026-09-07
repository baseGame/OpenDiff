import { beforeEach, describe, expect, it } from 'vitest'
import {
  buildVersionRulesCatalog,
  defaultVersionCompareOptions,
  isVersionFieldImportant,
  loadVersionCompareOptions,
  resetVersionCompareOptions,
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

  it('builds a rules catalog with known fields and extras', () => {
    const catalog = buildVersionRulesCatalog(['CustomField'])

    expect(catalog.some((row) => row.field === 'FileVersion')).toBe(true)
    expect(catalog.some((row) => row.field === 'Comments')).toBe(true)
    expect(catalog.some((row) => row.field === 'CustomField')).toBe(true)
  })

  it('resets importance rules to defaults', () => {
    saveVersionCompareOptions({ unimportantFields: ['FileVersion'] })
    const reset = resetVersionCompareOptions()
    saveVersionCompareOptions(reset)

    expect(loadVersionCompareOptions().unimportantFields).toEqual(
      defaultVersionCompareOptions().unimportantFields,
    )
  })
