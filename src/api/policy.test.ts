import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getAppRuntimeInfo, loadAdminPolicy, queryLiveWindowsRegistry } from './policy'
import { invoke } from '@tauri-apps/api/core'

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn().mockResolvedValue({}),
}))

describe('policy api', () => {
  beforeEach(() => {
    vi.mocked(invoke).mockClear()
  })

  it('loads admin policy flags and platform info', async () => {
    vi.mocked(invoke)
      .mockResolvedValueOnce({
        savePasswords: false,
        remoteProfiles: false,
        updateChecks: true,
      })
      .mockResolvedValueOnce({ os: 'linux', family: 'unix' })
      .mockResolvedValueOnce('HKLM\\Software\\Policies\\OpenDiff')

    await expect(loadAdminPolicy()).resolves.toEqual({
      savePasswords: false,
      remoteProfiles: false,
      updateChecks: true,
    })
    await expect(getAppRuntimeInfo()).resolves.toEqual({ os: 'linux', family: 'unix' })
    await queryLiveWindowsRegistry('HKLM\\Software\\Policies\\OpenDiff')

    expect(invoke).toHaveBeenNthCalledWith(1, 'load_admin_policy')
    expect(invoke).toHaveBeenNthCalledWith(2, 'app_runtime_info')
    expect(invoke).toHaveBeenNthCalledWith(3, 'query_live_windows_registry', {
      key: 'HKLM\\Software\\Policies\\OpenDiff',
    })
  })
})
