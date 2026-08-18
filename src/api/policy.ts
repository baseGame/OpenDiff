import { invoke } from '@tauri-apps/api/core'

export interface PolicyFlags {
  savePasswords: boolean
  remoteProfiles: boolean
  updateChecks: boolean
}

export interface AppRuntimeInfo {
  os: string
  family: string
}

export function loadAdminPolicy(): Promise<PolicyFlags> {
  return invoke<PolicyFlags>('load_admin_policy')
}

export function getAppRuntimeInfo(): Promise<AppRuntimeInfo> {
  return invoke<AppRuntimeInfo>('app_runtime_info')
}

export function queryLiveWindowsRegistry(key: string): Promise<string> {
  return invoke<string>('query_live_windows_registry', { key })
}
