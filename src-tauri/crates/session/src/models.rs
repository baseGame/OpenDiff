use serde::{Deserialize, Serialize};
use chrono::{DateTime, Utc};
use diff_engine::DiffAlgorithm;

/// A saved comparison session
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Session {
    pub id: String,           // UUID
    pub name: String,
    pub kind: SessionKind,
    #[serde(alias = "leftPath")]
    pub left_path: String,
    #[serde(alias = "rightPath")]
    pub right_path: String,
    #[serde(alias = "basePath")]
    pub base_path: Option<String>, // for 3-way
    pub config: SessionConfig,
    #[serde(alias = "createdAt")]
    pub created_at: DateTime<Utc>,
    #[serde(alias = "updatedAt")]
    pub updated_at: DateTime<Utc>,
    #[serde(alias = "lastOpened")]
    pub last_opened: Option<DateTime<Utc>>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum SessionKind {
    TextDiff,
    FolderDiff,
    TableDiff,
    HexDiff,
    ImageDiff,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SessionConfig {
    pub algorithm: DiffAlgorithm,
    #[serde(alias = "ignoreWhitespace")]
    pub ignore_whitespace: bool,
    #[serde(alias = "ignoreCase")]
    pub ignore_case: bool,
    #[serde(alias = "ignoreComments")]
    pub ignore_comments: bool,
    pub extra: serde_json::Value, // view-specific extra config
}

impl Default for SessionConfig {
    fn default() -> Self {
        Self {
            algorithm: DiffAlgorithm::Histogram,
            ignore_whitespace: false,
            ignore_case: false,
            ignore_comments: false,
            extra: serde_json::Value::Null,
        }
    }
}

/// Application workspace (all open tabs layout)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Workspace {
    pub id: String,
    pub tabs: Vec<WorkspaceTab>,
    pub active_tab_id: Option<String>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorkspaceTab {
    pub id: String,
    pub session_id: Option<String>,
    pub title: String,
    pub kind: SessionKind,
    pub left_path: String,
    pub right_path: String,
    pub is_dirty: bool,
}

/// App-wide settings
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AppSettings {
    pub theme: ThemeMode,
    pub font_family: String,
    pub font_size: u32,
    pub diff_algorithm: DiffAlgorithm,
    pub show_line_numbers: bool,
    pub show_whitespace: bool,
    pub word_wrap: bool,
    pub auto_save_sessions: bool,
}

impl Default for AppSettings {
    fn default() -> Self {
        Self {
            theme: ThemeMode::Auto,
            font_family: "JetBrains Mono, Cascadia Code, Consolas, monospace".to_string(),
            font_size: 13,
            diff_algorithm: DiffAlgorithm::Histogram,
            show_line_numbers: true,
            show_whitespace: false,
            word_wrap: false,
            auto_save_sessions: true,
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ThemeMode {
    Light,
    Dark,
    Auto,
}
