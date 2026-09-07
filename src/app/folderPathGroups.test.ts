import { describe, expect, it } from 'vitest'
import {
  collectExpandablePrefixes,
  isPathHiddenByCollapse,
  parentPathPrefix,
} from './folderPathGroups'

describe('folderPathGroups', () => {
  it('derives parent prefixes and expandable folders', () => {
    expect(parentPathPrefix('a/b/c.txt')).toBe('a/b')
    expect(parentPathPrefix('root.txt')).toBe('')
    expect(collectExpandablePrefixes(['a/b/c.txt', 'a/d.txt', 'alone.txt'])).toEqual(['a', 'a/b'])
  })

  it('hides nested rows under collapsed prefixes', () => {
    const collapsed = new Set(['a/b'])

    expect(isPathHiddenByCollapse('a/b/c.txt', collapsed)).toBe(true)
    expect(isPathHiddenByCollapse('a/d.txt', collapsed)).toBe(false)
    expect(isPathHiddenByCollapse('a/b', collapsed)).toBe(false)
  })
})
