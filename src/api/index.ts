import type { Session, AppSettings, DiffOptions, FolderDiffOptions, TableDiffOptions, DiffResult, FolderDiffResult, TableDiffResult, VfsEntry } from '@/types'

async function invoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  const { invoke: tauriInvoke } = await import('@tauri-apps/api/core')
  return tauriInvoke<T>(cmd, args)
}

export async function listRecentSessions(limit = 10): Promise<Session[]> {
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

export async function exportAllSessions(): Promise<string> {
  return invoke('cmd_export_all_sessions')
}

export async function exportSession(id: string): Promise<string> {
  return invoke('cmd_export_session', { id })
}

export async function importSessions(json: string): Promise<number> {
  return invoke('cmd_import_sessions', { json })
}

// ── Text Diff ──────────────────────────────────────────────────────
export async function diffTexts(leftContent: string, rightContent: string, options?: DiffOptions): Promise<DiffResult> {
  return invoke('cmd_diff_texts', { leftContent, rightContent, options })
}

export async function diffFiles(leftPath: string, rightPath: string, options?: DiffOptions): Promise<DiffResult> {
  return invoke('cmd_diff_files', { leftPath, rightPath, options })
}

export async function mergeThree(basePath: string, leftPath: string, rightPath: string) {
  return invoke('cmd_merge_three', { basePath, leftPath, rightPath })
}

// ── Folder / VFS operations ────────────────────────────────────────
export async function listDir(path: string): Promise<VfsEntry[]> {
  return invoke('cmd_list_dir', { path })
}

export async function statPath(path: string) {
  return invoke('cmd_stat', { path })
}

export async function copyFile(src: string, dst: string) {
  return invoke('cmd_copy_file', { src, dst })
}

export async function deletePath(path: string, recursive = false) {
  return invoke('cmd_delete_path', { path, recursive })
}

export async function renamePath(src: string, dst: string) {
  return invoke('cmd_rename_path', { src, dst })
}

export async function diffFolders(left: string, right: string, options?: FolderDiffOptions): Promise<FolderDiffResult> {
  return invoke('cmd_diff_folders', { left, right, options })
}

// ── Table Diff ────────────────────────────────────────────────────
export async function diffTables(leftPath: string, rightPath: string, options?: TableDiffOptions): Promise<TableDiffResult> {
  return invoke('cmd_diff_tables', { leftPath, rightPath, options })
}

// ── General file operations ─────────────────────────────────────────
export async function readFileText(path: string): Promise<string> {
  return invoke('cmd_read_file_text', { path })
}

export async function readFileBytes(path: string): Promise<number[]> {
  return invoke('cmd_read_file_bytes', { path })
}

export async function readFileBase64(path: string): Promise<string> {
  return invoke('cmd_read_file_base64', { path })
}
