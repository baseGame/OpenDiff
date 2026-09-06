import { describe, expect, it } from 'vitest'
import { createLaunchFromDrop, resolveDropLaunch } from './dropLaunch'

describe('resolveDropLaunch', () => {
  it('builds a text-compare launch for matching text files', () => {
    const result = resolveDropLaunch(
      [
        { path: 'C:/work/left.txt', kind: 'file' },
        { path: 'C:/work/right.txt', kind: 'file' },
      ],
      { autoRun: true, id: 'drop-1' },
    )

    expect(result.ok).toBe(true)
    if (!result.ok) {
      return
    }

    expect(result.selection).toMatchObject({
      sessionType: 'text-compare',
      route: '/compare/text',
      enabled: true,
    })
    expect(result.payload).toMatchObject({
      id: 'drop-1',
      source: 'drop',
      sessionType: 'text-compare',
      route: '/compare/text',
      autoRun: true,
      title: 'left.txt vs right.txt',
      locations: {
        left: { uri: 'C:/work/left.txt', kind: 'file', displayName: 'left.txt' },
        right: { uri: 'C:/work/right.txt', kind: 'file', displayName: 'right.txt' },
      },
    })
  })

  it('builds a folder-compare launch for two directories', () => {
    const result = resolveDropLaunch([
      { path: 'C:/work/left', kind: 'directory' },
      { path: 'C:/work/right', kind: 'directory' },
    ])

    expect(result.ok).toBe(true)
    if (!result.ok) {
      return
    }

    expect(result.selection.sessionType).toBe('folder-compare')
    expect(result.payload.locations.left?.kind).toBe('directory')
    expect(result.payload.autoRun).toBe(true)
  })

  it('builds a text-patch launch for a single patch file without a right location', () => {
    const result = resolveDropLaunch([{ path: 'C:/work/change.patch', kind: 'file' }])

    expect(result.ok).toBe(true)
    if (!result.ok) {
      return
    }

    expect(result.selection.sessionType).toBe('text-patch')
    expect(result.payload.route).toBe('/patch/text')
    expect(result.payload.locations.left?.uri).toBe('C:/work/change.patch')
    expect(result.payload.locations.right).toBeUndefined()
  })

  it('falls back to hex-compare when file types mismatch', () => {
    const result = resolveDropLaunch([
      { path: 'C:/work/left.txt', kind: 'file' },
      { path: 'C:/work/right.png', kind: 'file' },
    ])

    expect(result.ok).toBe(true)
    if (!result.ok) {
      return
    }

    expect(result.selection.sessionType).toBe('hex-compare')
    expect(result.payload.route).toBe('/compare/hex')
  })

  it('rejects invalid drop counts with a status reason', () => {
    const result = resolveDropLaunch([{ path: 'C:/work/only.txt', kind: 'file' }])

    expect(result).toMatchObject({
      ok: false,
      reason: 'Drop exactly two files or folders.',
      classification: { kind: 'invalid' },
    })
  })
})

describe('createLaunchFromDrop', () => {
  it('mirrors HomeView launch payload shape', () => {
    const classification = {
      kind: 'files' as const,
      left: {
        path: 'C:/a.ts',
        kind: 'file' as const,
        sourceKind: 'file' as const,
        displayName: 'a.ts',
      },
      right: {
        path: 'C:/b.ts',
        kind: 'file' as const,
        sourceKind: 'file' as const,
        displayName: 'b.ts',
      },
    }
    const selection = {
      sessionType: 'text-compare' as const,
      title: 'Text Compare',
      titleKey: 'ui.textCompare',
      enabled: true,
      route: '/compare/text',
    }

    expect(
      createLaunchFromDrop(classification, selection, { autoRun: false, id: 'fixed' }),
    ).toEqual({
      id: 'fixed',
      source: 'drop',
      sessionType: 'text-compare',
      title: 'a.ts vs b.ts',
      route: '/compare/text',
      locations: {
        left: { uri: 'C:/a.ts', displayName: 'a.ts', kind: 'file', readOnly: false },
        right: { uri: 'C:/b.ts', displayName: 'b.ts', kind: 'file', readOnly: false },
      },
      autoRun: false,
    })
  })
})
