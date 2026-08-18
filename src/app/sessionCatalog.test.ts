import { describe, expect, it } from 'vitest'
import { sessionCatalog } from './sessionCatalog'

describe('sessionCatalog', () => {
  it('marks only sessions with a real UI path as implemented', () => {
    const implemented = sessionCatalog
      .filter((entry) => entry.implemented)
      .map((entry) => entry.type)

    expect(implemented).toEqual([
      'text-compare',
      'folder-compare',
      'folder-sync',
      'text-merge',
      'table-compare',
      'hex-compare',
      'picture-compare',
      'folder-merge',
      'text-edit',
      'text-patch',
      'clipboard-compare',
      'registry-compare',
      'media-compare',
      'version-compare',
      'archive-compare',
      'script',
    ])
    expect(sessionCatalog.every((entry) => entry.route)).toBe(true)
  })
})
