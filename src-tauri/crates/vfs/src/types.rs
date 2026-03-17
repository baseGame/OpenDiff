use serde::{Deserialize, Serialize};
use std::time::SystemTime;

/// A path within a VFS (always uses forward slashes)
#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub struct VPath(pub String);

impl VPath {
    pub fn new(s: impl Into<String>) -> Self {
        Self(s.into().replace('\\', "/"))
    }
    pub fn as_str(&self) -> &str { &self.0 }
    pub fn parent(&self) -> Option<VPath> {
        let p = self.0.rfind('/').map(|i| &self.0[..i])?;
        Some(VPath(p.to_string()))
    }
    pub fn file_name(&self) -> &str {
        self.0.rfind('/').map(|i| &self.0[i+1..]).unwrap_or(&self.0)
    }
    pub fn extension(&self) -> Option<&str> {
        let name = self.file_name();
        name.rfind('.').map(|i| &name[i+1..])
    }
    pub fn join(&self, child: &str) -> VPath {
        VPath(format!("{}/{}", self.0.trim_end_matches('/'), child))
    }
}

impl std::fmt::Display for VPath {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}", self.0)
    }
}

/// A directory entry
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Entry {
    pub path: VPath,
    pub name: String,
    pub kind: EntryKind,
    pub metadata: Metadata,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum EntryKind {
    File,
    Directory,
    Symlink,
    Other,
}

/// File metadata
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Metadata {
    pub size: Option<u64>,
    pub modified: Option<u64>, // Unix timestamp milliseconds
    pub created: Option<u64>,
    pub is_dir: bool,
    pub is_symlink: bool,
    pub readonly: bool,
    pub permissions: Option<u32>, // Unix mode
}

impl Metadata {
    pub fn from_std(m: &std::fs::Metadata) -> Self {
        let modified = m.modified().ok()
            .and_then(|t| t.duration_since(SystemTime::UNIX_EPOCH).ok())
            .map(|d| d.as_millis() as u64);
        let created = m.created().ok()
            .and_then(|t| t.duration_since(SystemTime::UNIX_EPOCH).ok())
            .map(|d| d.as_millis() as u64);
        Self {
            size: if m.is_file() { Some(m.len()) } else { None },
            modified,
            created,
            is_dir: m.is_dir(),
            is_symlink: m.file_type().is_symlink(),
            readonly: m.permissions().readonly(),
            #[cfg(unix)]
            permissions: {
                use std::os::unix::fs::PermissionsExt;
                Some(m.permissions().mode())
            },
            #[cfg(not(unix))]
            permissions: None,
        }
    }
}

/// File change event (from watch)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VfsEvent {
    pub kind: VfsEventKind,
    pub path: VPath,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum VfsEventKind {
    Created,
    Modified,
    Deleted,
    Renamed { to: VPath },
}

/// Identifier for VFS backend type
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum VfsKind {
    Local,
    Sftp,
    Ftp,
    S3,
    WebDav,
    OneDrive,
    Dropbox,
    Archive,
    Snapshot,
}
