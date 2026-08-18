import { invoke } from '@tauri-apps/api/core'

export type RemoteProtocol =
  'ftp' | 'ftps' | 'sftp' | 'web-dav' | 's3' | 'dropbox' | 'one-drive' | 'subversion'

export interface RemoteProfileDraft {
  id: string
  name: string
  protocol: RemoteProtocol
  host: string
  port: number | null
  rootPath: string
  username?: string
  password?: string
}

export interface RemoteProfileView {
  id: string
  name: string
  protocol: RemoteProtocol
  host: string
  port: number | null
  rootPath: string
  implemented: boolean
  uri: string
  username?: string | null
}

export interface RemoteEntry {
  path: string
  kind: 'file' | 'directory'
  size: number
}

export function isImplementedRemoteProtocol(protocol: RemoteProtocol): boolean {
  return protocol === 'sftp' || protocol === 'ftp'
}

export function formatRemoteUri(
  protocol: RemoteProtocol,
  profileRef: string,
  remotePath = '/',
): string {
  const scheme = protocol === 'web-dav' ? 'webdav' : protocol === 'subversion' ? 'svn' : protocol
  const normalized = remotePath.startsWith('/') ? remotePath : `/${remotePath}`

  return `${scheme}://profile/${profileRef}${normalized}`
}

export function listRemoteProfiles(): Promise<RemoteProfileView[]> {
  return invoke<RemoteProfileView[]>('list_remote_profiles')
}

export function saveRemoteProfile(draft: RemoteProfileDraft): Promise<RemoteProfileView[]> {
  return invoke<RemoteProfileView[]>('save_remote_profile', { draft })
}

export function deleteRemoteProfile(id: string): Promise<RemoteProfileView[]> {
  return invoke<RemoteProfileView[]>('delete_remote_profile', { id })
}

export function testRemoteProfile(id: string): Promise<string> {
  return invoke<string>('test_remote_profile', { id })
}

export function listRemotePath(profileId: string, path: string): Promise<RemoteEntry[]> {
  return invoke<RemoteEntry[]>('list_remote_path', { profileId, path })
}
