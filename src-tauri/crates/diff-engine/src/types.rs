use serde::{Deserialize, Serialize};

/// Diff algorithm selection
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Default)]
#[serde(rename_all = "lowercase")]
pub enum DiffAlgorithm {
    Myers,
    Patience,
    #[default]
    Histogram,
}

/// A single operation in the edit script
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub enum DiffOp {
    /// Lines equal in both sides
    Equal {
        left_start: usize,
        right_start: usize,
        count: usize,
    },
    /// Lines only in left (deleted)
    Delete {
        left_start: usize,
        count: usize,
    },
    /// Lines only in right (inserted)
    Insert {
        right_start: usize,
        count: usize,
    },
    /// Lines replaced (different in both sides)
    Replace {
        left_start: usize,
        left_count: usize,
        right_start: usize,
        right_count: usize,
    },
}

/// Character-level difference within a line
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct CharRange {
    pub start: usize,
    pub end: usize,
}

/// Intra-line character diff for a Replace op
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IntraLineDiff {
    pub left_changes: Vec<CharRange>,
    pub right_changes: Vec<CharRange>,
}

/// Full diff result between two texts
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DiffResult {
    pub left_lines: Vec<String>,
    pub right_lines: Vec<String>,
    pub ops: Vec<DiffOp>,
    pub intra_line: Vec<Option<IntraLineDiff>>, // parallel to ops, Some for Replace
    pub stats: DiffStats,
    pub algorithm: DiffAlgorithm,
}

/// Summary statistics
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct DiffStats {
    pub added: usize,
    pub deleted: usize,
    pub modified: usize,
    pub equal: usize,
    pub total_left: usize,
    pub total_right: usize,
}

impl DiffStats {
    pub fn has_differences(&self) -> bool {
        self.added > 0 || self.deleted > 0 || self.modified > 0
    }
}

/// Ignore rules for text comparison
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct IgnoreRules {
    pub whitespace: WhitespaceMode,
    pub case: bool,
    pub line_endings: bool,
    pub comments: CommentStyle,
    pub regex_patterns: Vec<String>,
    pub column_ranges: Vec<ColumnRange>,
}

#[derive(Debug, Clone, PartialEq, Eq, Default, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum WhitespaceMode {
    #[default]
    None,
    LeadingAndTrailing,
    All,
}

#[derive(Debug, Clone, PartialEq, Eq, Default, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum CommentStyle {
    #[default]
    None,
    CStyle,   // // and /* */
    Python,   // #
    All,      // all of the above
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ColumnRange {
    pub start: usize, // inclusive, 0-indexed
    pub end: usize,   // exclusive
}

/// Three-way merge result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MergeResult {
    pub output_lines: Vec<MergeLine>,
    pub conflict_count: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum MergeLine {
    Resolved(String),
    Conflict {
        base: Vec<String>,
        left: Vec<String>,
        right: Vec<String>,
    },
}
