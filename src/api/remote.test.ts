import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  deleteRemoteProfile,
  formatRemoteUri,
  isImplementedRemoteProtocol,
  listRemoteProfiles,
  saveRemoteProfile,
  testRemoteProfile,
} from './remote'
import { invoke } from '@tauri-apps/api/core'

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn().mockResolvedValue([]),
}))

describe('remote api', () => {
  beforeEach(() => {
    vi.mocked(invoke).mockClear()
  })

  it('treats SFTP, FTP, and WebDAV as implemented protocols', () => {
    expect(isImplementedRemoteProtocol('sftp')).toBe(true)
    expect(isImplementedRemoteProtocol('ftp')).toBe(true)
    expect(isImplementedRemoteProtocol('web-dav')).toBe(true)
    expect(isImplementedRemoteProtocol('s3')).toBe(false)
    expect(formatRemoteUri('sftp', 'prod-sftp', '/var/app')).toBe(
      'sftp://profile/prod-sftp/var/app',
    )
    expect(formatRemoteUri('web-dav', 'team-webdav', '/shared/docs')).toBe(
      'webdav://profile/team-webdav/shared/docs',
    )
  })

  it('lists, saves, tests, and deletes persisted profiles', async () => {
    vi.mocked(invoke)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          id: 'prod-sftp',
          name: 'Production SFTP',
          protocol: 'sftp',
          host: 'files.example.com',
          port: 22,
          rootPath: '/deployments',
          implemented: true,
          uri: 'sftp://profile/prod-sftp/deployments',
        },
      ])
      .mockResolvedValueOnce('SFTP connected to files.example.com:22 and listed 2 entries')
      .mockResolvedValueOnce([])

    await listRemoteProfiles()
    await saveRemoteProfile({
      id: 'prod-sftp',
      name: 'Production SFTP',
      protocol: 'sftp',
      host: 'files.example.com',
      port: 22,
      rootPath: '/deployments',
      username: 'deploy',
      password: 'secret',
    })
    await testRemoteProfile('prod-sftp')
    await deleteRemoteProfile('prod-sftp')

    expect(invoke).toHaveBeenNthCalledWith(1, 'list_remote_profiles')
    expect(vi.mocked(invoke).mock.calls[1]?.[0]).toBe('save_remote_profile')
    expect(vi.mocked(invoke).mock.calls[1]?.[1]).toMatchObject({
      draft: {
        id: 'prod-sftp',
        username: 'deploy',
        password: 'secret',
      },
    })
    expect(invoke).toHaveBeenNthCalledWith(3, 'test_remote_profile', { id: 'prod-sftp' })
    expect(invoke).toHaveBeenNthCalledWith(4, 'delete_remote_profile', { id: 'prod-sftp' })
  })
})
