import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  nextSessionWindowLabel,
  openSessionWindow,
  sessionNewWindowCapability,
  sessionWindowEntryUrl,
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

  it('builds same-origin entry URLs for named session routes', () => {
    expect(sessionWindowEntryUrl('/compare/picture', 'https://app.local')).toBe(
      'https://app.local/compare/picture',
    )
    expect(sessionWindowEntryUrl('compare/folder', 'https://app.local')).toBe(
      'https://app.local/compare/folder',
    )
    expect(sessionWindowEntryUrl('', 'https://app.local')).toBe('https://app.local/')
  })

  it('opens a same-origin window outside Tauri on the requested route', async () => {
    const openBlank = vi.fn().mockReturnValue({})

    await expect(openSessionWindow(openBlank, '/compare/picture')).resolves.toBe(true)
    expect(openBlank).toHaveBeenCalledWith(
      sessionWindowEntryUrl('/compare/picture', window.location.origin),
      '_blank',
    )
  })

  it('reports failure when the browser blocks window.open', async () => {
    const openBlank = vi.fn().mockReturnValue(null)

    await expect(openSessionWindow(openBlank)).resolves.toBe(false)
  })
})
