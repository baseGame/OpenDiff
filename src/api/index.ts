import { invoke } from '@tauri-apps/api/core'
import type { DiffResult, DiffOptions, MergeResult, Session, AppSettings } from '@/types'

// ── Diff ──────────────────────────────────────────────────────────────

export async function diffTexts(
  left: string,
  right: string,
  options?: DiffOptions,
): Promise<DiffResult> {
  return invoke('cmd_diff_texts', { left, right, options })
}

export async function diffFiles(
  leftPath: string,
  rightPath: string,
  options?: DiffOptions,
): Promise<DiffResult> {
  return invoke('cmd_diff_files', { leftPath, rightPath, options })
}

export async function mergeThree(
  basePath: string,
  leftPath: string,
  rightPath: string,
): Promise<MergeResult> {
  return invoke('cmd_merge_three', { basePath, leftPath, rightPath })
}

// ── VFS ───────────────────────────────────────────────────────────────

export async function listDir(path: string) {
  return invoke<any[]>('cmd_list_dir', { path })
}

export async function readFileText(path: string): Promise<string> {
  return invoke('cmd_read_file_text', { path })
}

export async function statPath(path: string) {
  return invoke<any>('cmd_stat', { path })
}

export async function copyFile(src: string, dst: string): Promise<void> {
  return invoke('cmd_copy_file', { src, dst })
}

export async function deletePath(path: string, recursive = false): Promise<void> {
  return invoke('cmd_delete_path', { path, recursive })
}

export async function renamePath(src: string, dst: string): Promise<void> {
  return invoke('cmd_rename_path', { src, dst })
}

export async function readFileBytes(path: string): Promise<number[]> {
  return invoke('cmd_read_file_bytes', { path })
}

export async function diffImages(leftPath: string, rightPath: string, threshold?: number): Promise<{ diff_png: string }> {
  return invoke('cmd_diff_images', { leftPath, rightPath, threshold })
}

// ── Session ───────────────────────────────────────────────────────────

export async function listRecentSessions(limit = 20): Promise<Session[]> {
  return invoke('cmd_list_recent_sessions', { limit })
}

export async function saveSession(session: Session): Promise<void> {
  return invoke('cmd_save_session', { session })
}

export async function deleteSession(id: string): Promise<void> {
  return invoke('cmd_delete_session', { id })
}

export async function getSettings(): Promise<AppSettings> {
  return invoke('cmd_get_settings')
}

export async function saveSettings(settings: AppSettings): Promise<void> {
  return invoke('cmd_save_settings', { settings })
}
