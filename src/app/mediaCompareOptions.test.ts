import { beforeEach, describe, expect, it } from 'vitest'
import {
  buildMediaRulesCatalog,
  defaultMediaCompareOptions,
  isMediaFieldImportant,
  loadMediaCompareOptions,
  mediaCompareOptionsStorageKey,
  resetMediaCompareOptions,
  saveMediaCompareOptions,
  toggleMediaFieldImportance,
} from './mediaCompareOptions'

describe('mediaCompareOptions', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('loads defaults and persists unimportant fields', () => {
    expect(loadMediaCompareOptions().unimportantFields).toContain('Comment')

    saveMediaCompareOptions({ unimportantFields: ['Comment', 'Title'] })

    expect(localStorage.getItem(mediaCompareOptionsStorageKey)).toContain('Title')
    expect(loadMediaCompareOptions().unimportantFields).toEqual(['Comment', 'Title'])
  })

  it('toggles field importance', () => {
    const base = defaultMediaCompareOptions()

    expect(isMediaFieldImportant('Title', base)).toBe(true)
    expect(isMediaFieldImportant('Comment', base)).toBe(false)

    const demoted = toggleMediaFieldImportance('Title', base)

    expect(isMediaFieldImportant('Title', demoted)).toBe(false)

    const promoted = toggleMediaFieldImportance('Comment', demoted)

    expect(isMediaFieldImportant('Comment', promoted)).toBe(true)
  })
})

it('builds a rules catalog with known fields and extras', () => {
  const catalog = buildMediaRulesCatalog(['CustomTag'])

  expect(catalog.some((row) => row.field === 'Title')).toBe(true)
  expect(catalog.some((row) => row.field === 'Comment')).toBe(true)
  expect(catalog.some((row) => row.field === 'CustomTag')).toBe(true)
})

it('resets importance rules to defaults', () => {
  saveMediaCompareOptions({ unimportantFields: ['Title'] })
  const reset = resetMediaCompareOptions()

  saveMediaCompareOptions(reset)

  expect(loadMediaCompareOptions().unimportantFields).toEqual(
    defaultMediaCompareOptions().unimportantFields,
  )
})
