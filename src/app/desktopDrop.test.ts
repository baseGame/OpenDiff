import { beforeEach, describe, expect, it, vi } from 'vitest'
import { isTauriRuntime, listenDesktopPathDrop, resolveDropInputsFromPaths } from './desktopDrop'

describe('desktopDrop', () => {
  beforeEach(() => {
    vi.unstubAllGlobals()
    Reflect.deleteProperty(window, '__TAURI_INTERNALS__')
  })

  it('detects non-Tauri runtimes', () => {
    expect(isTauriRuntime()).toBe(false)
  })

  it('returns a no-op unlisten outside Tauri', async () => {
    const onPaths = vi.fn()
    const onPhase = vi.fn()
    const stop = await listenDesktopPathDrop(onPaths, onPhase)

    expect(typeof stop).toBe('function')
    stop()
    expect(onPaths).not.toHaveBeenCalled()
    expect(onPhase).toHaveBeenCalledWith('unavailable', 'not-tauri')
  })

  it('falls back to path heuristics when classify_paths is unavailable', async () => {
    const inputs = await resolveDropInputsFromPaths(['/tmp/left.txt', '/tmp/right.txt'])

    expect(inputs).toEqual([
      { path: '/tmp/left.txt', kind: 'file' },
      { path: '/tmp/right.txt', kind: 'file' },
    ])
  })
})
