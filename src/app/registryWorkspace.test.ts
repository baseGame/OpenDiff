import { describe, expect, it } from 'vitest'
import {
  applyRegistryValueSide,
  collectExpandableKeyPaths,
  registryValueMatchesFilter,
} from './registryWorkspace'

describe('registryWorkspace', () => {
  it('filters values by all/diffs/same', () => {
    expect(registryValueMatchesFilter('modified', 'diffs')).toBe(true)
    expect(registryValueMatchesFilter('unchanged', 'diffs')).toBe(false)
    expect(registryValueMatchesFilter('unchanged', 'same')).toBe(true)
    expect(registryValueMatchesFilter('added', 'all')).toBe(true)
  })

  it('applies one side onto the other in the compare workspace', () => {
    const applied = applyRegistryValueSide(
      {
        keyPath: 'HKCU/Software/OpenDiff',
        name: 'Theme',
        status: 'modified',
        left: { kind: 'REG_SZ', data: 'dark' },
        right: { kind: 'REG_SZ', data: 'light' },
      },
      'right',
    )

    expect(applied.left).toEqual({ kind: 'REG_SZ', data: 'light' })
    expect(applied.status).toBe('unchanged')
  })

  it('collects expandable key paths', () => {
    expect(
      collectExpandableKeyPaths([
        {
          path: 'HKCU',
          children: [{ path: 'HKCU/Software', children: [] }],
        },
      ]),
    ).toEqual(['HKCU'])
  })
})
