import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  nextSessionWindowLabel,
  openSessionWindow,
  sessionNewWindowCapability,
} from './sessionWindow'

describe('sessionWindow', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it('documents multi-window capability as supported with create permission', () => {
    expect(sessionNewWindowCapability.supported).toBe(true)
    expect(sessionNewWindowCapability.requiresCreateWebviewPermission).toBe(true)
  })

  it('builds alphanumeric session window labels', () => {
    expect(nextSessionWindowLabel(1_700_000_000_000)).toBe('session-1700000000000')
  })

  it('opens a same-origin window outside Tauri', async () => {
    const openBlank = vi.fn().mockReturnValue({})

    await expect(openSessionWindow(openBlank)).resolves.toBe(true)
    expect(openBlank).toHaveBeenCalledWith(window.location.href, '_blank')
  })

  it('reports failure when the browser blocks window.open', async () => {
    const openBlank = vi.fn().mockReturnValue(null)

    await expect(openSessionWindow(openBlank)).resolves.toBe(false)
  })
})
