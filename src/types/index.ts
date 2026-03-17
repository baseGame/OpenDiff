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
  added: number
  deleted: number
  modified: number
  equal: number
  total_left: number
  total_right: number
}

export interface DiffResult {
  left_lines: string[]
  right_lines: string[]
  ops: DiffOp[]
  intra_line: (IntraLineDiff | null)[]
  stats: DiffStats
  algorithm: DiffAlgorithm
}

export type MergeLine =
  | { Resolved: string }
  | { Conflict: { base: string[]; left: string[]; right: string[] } }

export interface MergeResult {
  output_lines: MergeLine[]
  conflict_count: number
}

// ── Session Types ──────────────────────────────────────────────────

export type SessionKind =
  | 'text_diff'
  | 'folder_diff'
  | 'table_diff'
  | 'hex_diff'
  | 'image_diff'

export interface Session {
  id: string
  name: string
  kind: SessionKind
  left_path: string
  right_path: string
  base_path?: string
  config: SessionConfig
  created_at: string
  updated_at: string
  last_opened?: string
}

export interface SessionConfig {
  algorithm: DiffAlgorithm
  ignore_whitespace: boolean
  ignore_case: boolean
  ignore_comments: boolean
  extra: unknown
}

export type ThemeMode = 'light' | 'dark' | 'auto'

export interface AppSettings {
  theme: ThemeMode
  font_family: string
  font_size: number
  diff_algorithm: DiffAlgorithm
  show_line_numbers: boolean
  show_whitespace: boolean
  word_wrap: boolean
  auto_save_sessions: boolean
}

// ── VFS Types ──────────────────────────────────────────────────────

export type EntryKind = 'file' | 'directory' | 'symlink' | 'other'

export interface VfsEntry {
  path: { '0': string }
  name: string
  kind: EntryKind
  metadata: VfsMetadata
}

export interface VfsMetadata {
  size?: number
  modified?: number
  created?: number
  is_dir: boolean
  is_symlink: boolean
  readonly: boolean
}

// ── UI Types ──────────────────────────────────────────────────────

export interface Tab {
  id: string
  title: string
  kind: SessionKind
  leftPath: string
  rightPath: string
  isDirty: boolean
}
