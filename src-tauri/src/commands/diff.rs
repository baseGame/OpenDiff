use diff_engine::{diff_texts, merge_three, DiffAlgorithm, DiffResult, IgnoreRules, MergeResult, WhitespaceMode, CommentStyle};
use serde::Deserialize;
use tokio::fs;

/// Diff options — front-end sends camelCase keys, we accept them via aliases
#[derive(Debug, Deserialize)]
pub struct DiffOptions {
    pub algorithm: Option<DiffAlgorithm>,
    #[serde(alias = "ignoreWhitespace")]
    pub ignore_whitespace: Option<bool>,
    #[serde(alias = "ignoreCase")]
    pub ignore_case: Option<bool>,
    #[serde(alias = "ignoreComments")]
    pub ignore_comments: Option<bool>,
}

impl DiffOptions {
    fn to_algo(&self) -> DiffAlgorithm {
        self.algorithm.unwrap_or_default()
    }

    fn to_rules(&self) -> IgnoreRules {
        let whitespace = if self.ignore_whitespace.unwrap_or(false) {
            WhitespaceMode::All
        } else {
            WhitespaceMode::None
        };
        let case = self.ignore_case.unwrap_or(false);
        let comments = if self.ignore_comments.unwrap_or(false) {
            CommentStyle::All
        } else {
            CommentStyle::None
        };
        IgnoreRules { whitespace, case, comments, ..Default::default() }
    }
}

/// Diff two in-memory strings
#[tauri::command]
pub async fn cmd_diff_texts(
    left: String,
    right: String,
    options: Option<DiffOptions>,
) -> Result<DiffResult, String> {
    let opts = options.unwrap_or(DiffOptions {
        algorithm: None,
        ignore_whitespace: None,
        ignore_case: None,
        ignore_comments: None,
    });
    let result = tokio::task::spawn_blocking(move || {
        diff_texts(&left, &right, opts.to_algo(), &opts.to_rules())
    })
    .await
    .map_err(|e| e.to_string())?;
    Ok(result)
}

/// Diff two files on disk
#[tauri::command]
pub async fn cmd_diff_files(
    left_path: String,
    right_path: String,
    options: Option<DiffOptions>,
) -> Result<DiffResult, String> {
    let left = fs::read_to_string(&left_path)
        .await.map_err(|e| format!("Cannot read left file: {e}"))?;
    let right = fs::read_to_string(&right_path)
        .await.map_err(|e| format!("Cannot read right file: {e}"))?;

    let opts = options.unwrap_or(DiffOptions {
        algorithm: None,
        ignore_whitespace: None,
        ignore_case: None,
        ignore_comments: None,
    });
    let result = tokio::task::spawn_blocking(move || {
        diff_texts(&left, &right, opts.to_algo(), &opts.to_rules())
    })
    .await
    .map_err(|e| e.to_string())?;
    Ok(result)
}

/// Three-way text merge
#[tauri::command]
pub async fn cmd_merge_three(
    base_path: String,
    left_path: String,
    right_path: String,
) -> Result<MergeResult, String> {
    let base = fs::read_to_string(&base_path)
        .await.map_err(|e| format!("Cannot read base: {e}"))?;
    let left = fs::read_to_string(&left_path)
        .await.map_err(|e| format!("Cannot read left: {e}"))?;
    let right = fs::read_to_string(&right_path)
        .await.map_err(|e| format!("Cannot read right: {e}"))?;

    let result = tokio::task::spawn_blocking(move || {
        merge_three(&base, &left, &right)
    })
    .await
    .map_err(|e| e.to_string())?;
    Ok(result)
}
