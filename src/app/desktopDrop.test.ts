import { beforeEach, describe, expect, it, vi } from 'vitest'

describe('desktopDrop', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.unstubAllGlobals()
    vi.doUnmock('@tauri-apps/api/webview')
    vi.doUnmock('@tauri-apps/api/event')
    Reflect.deleteProperty(window, '__TAURI_INTERNALS__')
  })

  it('detects non-Tauri runtimes', async () => {
    const { isTauriRuntime } = await import('./desktopDrop')

    expect(isTauriRuntime()).toBe(false)
  })

  it('returns a no-op unlisten outside Tauri', async () => {
    const { listenDesktopPathDrop } = await import('./desktopDrop')
    const onPaths = vi.fn()
    const onPhase = vi.fn()
    const stop = await listenDesktopPathDrop(onPaths, onPhase)

    expect(typeof stop).toBe('function')
    stop()
    expect(onPaths).not.toHaveBeenCalled()
    expect(onPhase).toHaveBeenCalledWith('unavailable', 'not-tauri')
  })

  it('falls back to path heuristics when classify_paths is unavailable', async () => {
    const { resolveDropInputsFromPaths } = await import('./desktopDrop')
    const inputs = await resolveDropInputsFromPaths(['/tmp/left.txt', '/tmp/right.txt'])

    expect(inputs).toEqual([
      { path: '/tmp/left.txt', kind: 'file' },
      { path: '/tmp/right.txt', kind: 'file' },
    ])
  })

  it('registers webview drag-drop and Linux desktop-drop bridge listeners', async () => {
    Object.defineProperty(window, '__TAURI_INTERNALS__', {
      configurable: true,
      value: {},
    })

    const unlistenDrag = vi.fn()
    const unlistenDrop = vi.fn()
    const unlistenEnter = vi.fn()
    const unlistenLeave = vi.fn()
    const onDragDropEvent = vi.fn(() => Promise.resolve(unlistenDrag))
    const listen = vi.fn((event: string) => {
      if (event === 'open-diff://desktop-drop') {
        return Promise.resolve(unlistenDrop)
      }
      if (event === 'open-diff://desktop-drag-enter') {
        return Promise.resolve(unlistenEnter)
      }

      return Promise.resolve(unlistenLeave)
    })

    vi.doMock('@tauri-apps/api/webview', () => ({
      getCurrentWebview: () => ({ onDragDropEvent }),
    }))
    vi.doMock('@tauri-apps/api/event', () => ({ listen }))

    const { listenDesktopPathDrop } = await import('./desktopDrop')
    const onPaths = vi.fn()
    const onPhase = vi.fn()
    const stop = await listenDesktopPathDrop(onPaths, onPhase)

    expect(onDragDropEvent).toHaveBeenCalledTimes(1)
    expect(listen).toHaveBeenCalledWith('open-diff://desktop-drop', expect.any(Function))
    expect(listen).toHaveBeenCalledWith('open-diff://desktop-drag-enter', expect.any(Function))
    expect(listen).toHaveBeenCalledWith('open-diff://desktop-drag-leave', expect.any(Function))
    expect(onPhase).toHaveBeenCalledWith('listening', 'webview')

    stop()
    expect(unlistenDrag).toHaveBeenCalledTimes(1)
    expect(unlistenDrop).toHaveBeenCalledTimes(1)
    expect(unlistenEnter).toHaveBeenCalledTimes(1)
    expect(unlistenLeave).toHaveBeenCalledTimes(1)

    Reflect.deleteProperty(window, '__TAURI_INTERNALS__')
  })
})
