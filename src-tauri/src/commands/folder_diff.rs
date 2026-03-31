//! Folder / directory comparison command
use anyhow::Result;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::path::Path;
use std::time::UNIX_EPOCH;

#[derive(Debug, Deserialize)]
pub struct FolderDiffOptions {
    pub ignore_patterns: Option<Vec<String>>,
    pub compare_content: Option<bool>,
    pub compare_time:    Option<bool>,
    pub compare_size:   Option<bool>,
}

#[derive(Debug, Serialize)]
pub struct FolderDiffResult {
    pub left_root:  String,
    pub right_root: String,
    pub entries: Vec<FolderEntry>,
    pub stats: FolderDiffStats,
}

#[derive(Debug, Serialize)]
pub struct FolderEntry {
    pub path:         String,
    pub rel_path:     String,
    pub left_status:  FileStatus,
    pub right_status: FileStatus,
    pub left_meta:    Option<FileMeta>,
    pub right_meta:   Option<FileMeta>,
    pub diff_regions: Vec<DiffRegion>,
}

#[derive(Debug, Serialize, Clone, Copy, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum FileStatus {
    Same,
    Modified,
    LeftOnly,
    RightOnly,
    BinaryDiff,
}

#[derive(Debug, Serialize, Clone)]
pub struct FileMeta {
    pub size:     u64,
    pub modified: u64,
    pub is_dir:  bool,
    pub crc32:   Option<u32>,
}

#[derive(Debug, Serialize)]
pub struct DiffRegion {
    pub offset: u64,
    pub length: u64,
}

#[derive(Debug, Serialize)]
pub struct FolderDiffStats {
    pub files_same:  usize,
    pub files_diff:  usize,
    pub left_only:   usize,
    pub right_only:  usize,
    pub dirs_left:   usize,
    pub dirs_right:  usize,
    pub total_left:  usize,
    pub total_right: usize,
}

/// Recursively compare two directory trees
#[tauri::command]
pub async fn cmd_diff_folders(
    left_root:  String,
    right_root: String,
    options: Option<FolderDiffOptions>,
) -> Result<FolderDiffResult, String> {
    let opts = options.unwrap_or(FolderDiffOptions {
        ignore_patterns: Some(vec![]),
        compare_content: Some(false),
        compare_time:    Some(true),
        compare_size:    Some(true),
    });

    let patterns: &[String] = opts.ignore_patterns.as_deref().unwrap_or(&[]);
    let left_entries  = scan_dir(&left_root,  patterns)
        .map_err(|e| format!("Cannot scan left directory: {e}"))?;
    let right_entries = scan_dir(&right_root, patterns)
        .map_err(|e| format!("Cannot scan right directory: {e}"))?;

    let left_map:  HashMap<String, FileMeta> = left_entries.into_iter().map(|(p, m)| (p, m)).collect();
    let right_map: HashMap<String, FileMeta> = right_entries.into_iter().map(|(p, m)| (p, m)).collect();

    let mut entries: Vec<FolderEntry> = Vec::new();
    let mut stats = FolderDiffStats {
        files_same: 0, files_diff: 0, left_only: 0,
        right_only: 0, dirs_left: 0, dirs_right: 0, total_left: 0, total_right: 0,
    };

    let mut all_paths: Vec<String> = left_map.keys().chain(right_map.keys()).cloned().collect();
    all_paths.sort();
    all_paths.dedup();

    for rel in all_paths {
        let left_meta  = left_map.get(&rel).cloned();
        let right_meta = right_map.get(&rel).cloned();

        let (left_status, right_status) = compare_files(
            &left_meta, &right_meta,
            opts.compare_time.unwrap_or(true),
            opts.compare_size.unwrap_or(true),
        );

        match (&left_status, &right_status) {
            (FileStatus::Same,     FileStatus::Same)     => { stats.files_same  += 1; }
            (FileStatus::Modified, _)                   => { stats.files_diff  += 1; }
            (_, FileStatus::Modified)                    => { stats.files_diff  += 1; }
            (FileStatus::LeftOnly,  _)                  => { stats.left_only   += 1; stats.total_left  += 1; }
            (FileStatus::Same, FileStatus::RightOnly)  => { stats.right_only  += 1; stats.total_right += 1; }
            (FileStatus::LeftOnly, FileStatus::Same)    => { stats.right_only  += 1; stats.total_right += 1; }
            (FileStatus::Same, FileStatus::LeftOnly)    => { stats.left_only   += 1; stats.total_left  += 1; }
            (FileStatus::RightOnly, _)                  => { stats.right_only  += 1; stats.total_right += 1; }
            (FileStatus::LeftOnly, FileStatus::RightOnly) => { stats.left_only  += 1; stats.right_only += 1; }
            _ => {}
        }

        if left_meta.as_ref().map(|m| m.is_dir).unwrap_or(false) { stats.dirs_left  += 1; }
        if right_meta.as_ref().map(|m| m.is_dir).unwrap_or(false) { stats.dirs_right += 1; }

        entries.push(FolderEntry {
            path: rel.clone(),
            rel_path: rel,
            left_status,
            right_status,
            left_meta,
            right_meta,
            diff_regions: vec![],
        });
    }

    Ok(FolderDiffResult { left_root, right_root, entries, stats })
}

fn compare_files(
    left:  &Option<FileMeta>,
    right: &Option<FileMeta>,
    compare_time: bool,
    compare_size: bool,
) -> (FileStatus, FileStatus) {
    match (left, right) {
        (None, None) => (FileStatus::Same, FileStatus::Same),
        (Some(l), None) | (Some(l), Some(_)) if !right.as_ref().map(|r| r.is_dir).unwrap_or(false) && l.is_dir => {
            (FileStatus::LeftOnly, FileStatus::RightOnly)
        }
        (None, Some(r)) | (Some(_), Some(r)) if !left.as_ref().map(|l| l.is_dir).unwrap_or(false) && r.is_dir => {
            (FileStatus::LeftOnly, FileStatus::RightOnly)
        }
        (Some(l), Some(r)) if l.is_dir && r.is_dir => (FileStatus::Same, FileStatus::Same),
        (Some(l), None) if !l.is_dir => (FileStatus::LeftOnly, FileStatus::RightOnly),
        (None, Some(r)) if !r.is_dir => (FileStatus::LeftOnly, FileStatus::RightOnly),
        (Some(_l), None) => (FileStatus::LeftOnly, FileStatus::RightOnly),
        (None, Some(_r)) => (FileStatus::LeftOnly, FileStatus::RightOnly),
        (Some(l), Some(r)) => {
            let size_diff = compare_size && l.size != r.size;
            let crc_diff  = l.crc32 != r.crc32;
            if size_diff || (compare_time && crc_diff) {
                (FileStatus::Modified, FileStatus::Modified)
            } else {
                (FileStatus::Same, FileStatus::Same)
            }
        }
    }
}

fn scan_dir(root: &str, ignore_patterns: &[String]) -> Result<Vec<(String, FileMeta)>> {
    let mut results = Vec::new();
    scan_recursive(Path::new(root), Path::new(root), ignore_patterns, &mut results)?;
    Ok(results)
}

fn scan_recursive(
    root: &Path,
    current: &Path,
    ignore_patterns: &[String],
    results: &mut Vec<(String, FileMeta)>,
) -> Result<()> {
    let entries = fs::read_dir(current)?;
    for entry in entries {
        let entry = entry?;
        let path = entry.path();
        let rel = path.strip_prefix(root)
            .map(|p| p.to_string_lossy().replace('\\', "/"))
            .unwrap_or_default();

        let name = path.file_name()
            .and_then(|n| n.to_str())
            .unwrap_or_default();

        if should_ignore(&rel, name, ignore_patterns) { continue; }

        let meta = entry.metadata()?;
        let is_dir = meta.is_dir();

        let modified = meta.modified()
            .ok()
            .and_then(|t| t.duration_since(UNIX_EPOCH).ok())
            .map(|d| d.as_secs())
            .unwrap_or(0);

        let size = if is_dir { 0 } else { meta.len() };
        let crc32 = if !is_dir { compute_crc32(&path).ok() } else { None };

        results.push((rel, FileMeta { size, modified, is_dir, crc32 }));

        if is_dir {
            scan_recursive(root, &path, ignore_patterns, results)?;
        }
    }
    Ok(())
}

fn should_ignore(path: &str, name: &str, patterns: &[String]) -> bool {
    if name.starts_with('.') { return true; }
    for pat in patterns {
        if glob_match(pat.as_str(), path) || glob_match(pat.as_str(), name) {
            return true;
        }
    }
    false
}

fn glob_match(pat: &str, text: &str) -> bool {
    if pat.is_empty() { return false; }
    if pat == "*" { return true; }
    if pat.starts_with("*") && pat.ends_with("*") {
        let inner = &pat[1..pat.len()-1];
        return text.contains(inner);
    }
    if pat.ends_with("*") {
        return text.starts_with(&pat[..pat.len()-1]);
    }
    if pat.starts_with("*") {
        return text.ends_with(&pat[1..]);
    }
    pat == text
}

fn compute_crc32(path: &Path) -> Result<u32> {
    use std::io::Read;
    let mut file = fs::File::open(path)?;
    let mut hasher = crc32fast::Hasher::new();
    let mut buf = [0u8; 65536];
    loop {
        let n = file.read(&mut buf)?;
        if n == 0 { break; }
        hasher.update(&buf[..n]);
    }
    Ok(hasher.finalize())
}
