// ── Diff Engine Types ──────────────────────────────────────────────
export type DiffAlgorithm = 'myers' | 'patience' | 'histogram'

export interface DiffOptions {
  algorithm?: DiffAlgorithm
  ignoreWhitespace?: boolean
  ignoreCase?: boolean
  ignoreComments?: boolean
}

export interface CharRange {
  start: number
  end: number
}

export interface IntraLineDiff {
  leftChanges: CharRange[]
  rightChanges: CharRange[]
}

export type DiffOp =
  | { Equal: { left_start: number; right_start: number; count: number } }
  | { Delete: { left_start: number; count: number } }
  | { Insert: { right_start: number; count: number } }
  | { Replace: { left_start: number; left_count: number; right_start: number; right_count: number } }

export interface DiffStats {
  added: number; deleted: number; modified: number; equal: number
  total_left: number; total_right: number
}

export interface DiffResult {
  left_lines: string[]; right_lines: string[]; ops: DiffOp[]
  intra_line: (IntraLineDiff | null)[]
  stats: DiffStats; algorithm: DiffAlgorithm
}

export type MergeLine = { Resolved: string } | { Conflict: { base: string[]; left: string[]; right: string[] } }
export interface MergeResult { output_lines: MergeLine[]; conflict_count: number }

// ── Table / CSV Diff Types ─────────────────────────────────────────
export type RowStatus = 'Equal' | 'Added' | 'Deleted' | 'Modified'

export interface TableDiffOptions {
  delimiter?: string; has_headers?: boolean; ignore_whitespace?: boolean
}

export interface CellDiff {
  col: number; left: string|null; right: string|null; changed: boolean
}

export interface TableRow {
  left_idx: number|null; right_idx: number|null
  cells: CellDiff[]; status: RowStatus
}

export interface TableSheet { name: string; rows: TableRow[] }
export interface TableDiffStats { added: number; deleted: number; modified: number; equal: number }
export interface TableDiffResult { sheets: TableSheet[]; stats: TableDiffStats }

// ── Folder Diff Types ───────────────────────────────────────────────
export type FileStatus = 'Same' | 'Modified' | 'LeftOnly' | 'RightOnly' | 'BinaryDiff'

export interface FolderDiffOptions {
  ignore_patterns?: string[]; compare_content?: boolean; compare_time?: boolean; compare_size?: boolean
}

export interface FolderMeta { size: number; modified: number; is_dir: boolean; crc32: number|null }
export interface FolderDiffRegion { offset: number; length: number }

export interface FolderEntry {
  path: string; rel_path: string
  left_status: FileStatus; right_status: FileStatus
  left_meta: FolderMeta|null; right_meta: FolderMeta|null
  diff_regions: FolderDiffRegion[]
}

export interface FolderDiffStats {
  files_same: number; files_diff: number; left_only: number; right_only: number
  dirs_left: number; dirs_right: number; total_left: number; total_right: number
}

export interface FolderDiffResult {
  left_root: string; right_root: string; entries: FolderEntry[]; stats: FolderDiffStats
}

// ── Session Types ──────────────────────────────────────────────────
export type SessionKind = 'text_diff' | 'folder_diff' | 'table_diff' | 'hex_diff' | 'image_diff' | 'folder_sync'

export interface Session {
  id: string; name: string; kind: SessionKind; left_path: string; right_path: string
  base_path?: string; config: SessionConfig; created_at: string; updated_at: string; last_opened?: string
}

export interface SessionConfig {
  algorithm: DiffAlgorithm; ignore_whitespace: boolean; ignore_case: boolean
  ignore_comments: boolean; extra: unknown
}

export type ThemeMode = 'light' | 'dark' | 'auto'

export interface AppSettings {
  theme: ThemeMode; font_family: string; font_size: number
  diff_algorithm: DiffAlgorithm; show_line_numbers: boolean
  show_whitespace: boolean; word_wrap: boolean; auto_save_sessions: boolean
}

// ── VFS Types ──────────────────────────────────────────────────────
export type EntryKind = 'file' | 'directory' | 'symlink' | 'other'

export interface VfsEntry {
  path: { '0': string }; name: string; kind: EntryKind; metadata: VfsMetadata
}

export interface VfsMetadata {
  size?: number; modified?: number; created?: number
  is_dir: boolean; is_symlink: boolean; readonly: boolean
}

// ── UI Types ──────────────────────────────────────────────────────
export interface Tab {
  id: string; title: string; kind: SessionKind
  leftPath: string; rightPath: string; isDirty: boolean
}
