import { invoke } from '@tauri-apps/api/core'

export type GitIntegrationKind = 'difftool' | 'mergetool'
export type GitIntegrationScope = 'global' | 'local'

export function writeGitIntegration(
  kind: GitIntegrationKind,
  executablePath: string,
  scope: GitIntegrationScope = 'global',
): Promise<string> {
  return invoke<string>('write_git_integration', {
    kind,
    executablePath,
    scope,
  })
}

export function writeSvnIntegration(executablePath: string, wrapperPath: string): Promise<string> {
  return invoke<string>('write_svn_integration', {
    executablePath,
    wrapperPath,
  })
}

export interface ShellRegistrationResult {
  windows: boolean
  applied: boolean
  script: string
  message: string
}

export function registerWindowsShellExtension(
  executablePath?: string,
): Promise<ShellRegistrationResult> {
  return invoke<ShellRegistrationResult>('register_windows_shell_extension', {
    executablePath,
  })
}

export function unregisterWindowsShellExtension(
  executablePath?: string,
): Promise<ShellRegistrationResult> {
  return invoke<ShellRegistrationResult>('unregister_windows_shell_extension', {
    executablePath,
  })
}

export interface ShellCompareLaunchPayload {
  left: string
  right: string
  route: string
  sessionType: string
}

export function takeShellCompareLaunch(): Promise<ShellCompareLaunchPayload | null> {
  return invoke<ShellCompareLaunchPayload | null>('take_shell_compare_launch')
}
