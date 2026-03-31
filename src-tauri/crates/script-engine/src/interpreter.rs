//! BCS — Beyond Compare Script — interpreter.
use diff_engine::{DiffResult, DiffAlgorithm, IgnoreRules, diff_texts};
use anyhow::{anyhow, Result};
use serde::Serialize;
use std::path::PathBuf;

// ── Report types (re-exported from here for CLI use) ──────────────────────────

#[derive(Debug, Default, Serialize)]
pub struct DiffReport {
    pub left_path:  String,
    pub right_path: String,
    pub items:     Vec<DiffReportItem>,
    pub stats:     DiffStats,
}

#[derive(Debug, Clone, Serialize)]
pub enum DiffReportItem {
    Modified { left_label: String, right_label: String, hunks: Vec<DiffHunk> },
    LeftOnly { label: String, size: Option<u64> },
    RightOnly { label: String, size: Option<u64> },
}

#[derive(Debug, Clone, Serialize)]
pub struct DiffHunk { pub left_lines: Vec<String>, pub right_lines: Vec<String> }

#[derive(Debug, Default, Serialize)]
pub struct DiffStats {
    pub equal_lines:   usize,
    pub added_lines:  usize,
    pub deleted_lines: usize,
    pub modified_lines: usize,
}

/// BCS script interpreter.
#[derive(Debug)]
pub struct ScriptInterpreter {
    pub left_path:  Option<PathBuf>,
    pub right_path: Option<PathBuf>,
    pub base_path:  Option<PathBuf>,
    pub options:    ScriptOptions,
}

#[derive(Debug)]
pub struct ScriptOptions {
    pub algorithm:         DiffAlgorithm,
    pub ignore_whitespace: bool,
    pub ignore_case:       bool,
    pub ignore_comments:   bool,
    pub expand_all:        bool,
    pub filter:            Option<String>,
    pub report_format:     ReportFormat,
    pub report_dest:       Option<PathBuf>,
    pub sync_direction:    Option<SyncDirection>,
}

impl Default for ScriptOptions {
    fn default() -> Self {
        Self {
            algorithm: DiffAlgorithm::Histogram,
            ignore_whitespace: false,
            ignore_case: false,
            ignore_comments: false,
            expand_all: false,
            filter: None,
            report_format: ReportFormat::Text,
            report_dest: None,
            sync_direction: None,
        }
    }
}

#[derive(Debug, Clone, Copy, Default, Serialize)]
pub enum ReportFormat {
    #[default]
    Text, Html, Csv, Xml,
}
#[derive(Debug, Clone, Copy, Default, Serialize)]
pub enum SyncDirection {
    #[default]
    LeftToRight, RightToLeft, Both,
}

impl ScriptInterpreter {
    pub fn new() -> Self {
        Self { left_path: None, right_path: None, base_path: None, options: ScriptOptions::default() }
    }

    /// Parse and execute a BCS script line
    pub fn execute_line(&mut self, line: &str) -> Result<Option<String>> {
        let line = line.trim();
        if line.is_empty() || line.starts_with('#') || line.starts_with("//") {
            return Ok(None);
        }

        let (cmd, rest) = line.split_once(char::is_whitespace).unwrap_or((line, ""));
        let rest = rest.trim();

        match cmd.to_lowercase().as_str() {
            "load"       => self.cmd_load(rest),
            "option"     => self.cmd_option(rest),
            "expand"     => self.cmd_expand(rest),
            "filter"     => { self.options.filter = Some(rest.to_string()); Ok(None) }
            "select"     => Ok(None), // handled by UI
            "text-report" => self.cmd_text_report(rest),
            "folder-report" => self.cmd_folder_report(rest),
            "sync"       => self.cmd_sync(rest),
            "data-report" => Ok(None), // handled by table view
            _            => Ok(Some(format!("Unknown command: {}", cmd))),
        }
    }

    fn cmd_load(&mut self, args: &str) -> Result<Option<String>> {
        let mut left = None;
        let mut right = None;
        let mut base = None;
        for part in args.split_whitespace() {
            if let Some(val) = part.strip_prefix("left:") {
                left = Some(val.trim_matches('"').into());
            } else if let Some(val) = part.strip_prefix("right:") {
                right = Some(val.trim_matches('"').into());
            } else if let Some(val) = part.strip_prefix("base:") {
                base = Some(val.trim_matches('"').into());
            }
        }
        self.left_path  = left.or(self.left_path.clone());
        self.right_path = right.or(self.right_path.clone());
        self.base_path  = base.or(self.base_path.clone());
        Ok(None)
    }

    fn cmd_option(&mut self, args: &str) -> Result<Option<String>> {
        match args.split_whitespace().next() {
            Some("ignore whitespace") => { self.options.ignore_whitespace = true; }
            Some("ignore case")      => { self.options.ignore_case = true; }
            Some(s) => return Ok(Some(format!("Unknown option: {}", s))),
            None => {}
        }
        Ok(None)
    }

    fn cmd_expand(&mut self, args: &str) -> Result<Option<String>> {
        if args == "all" { self.options.expand_all = true; }
        Ok(None)
    }

    fn cmd_text_report(&mut self, args: &str) -> Result<Option<String>> {
        let mut format = ReportFormat::Html;
        let mut dest: Option<PathBuf> = None;

        for part in args.split_whitespace() {
            if let Some(f) = part.strip_prefix("output-type:") {
                format = match f.trim_matches('"') {
                    "text" => ReportFormat::Text,
                    "html" => ReportFormat::Html,
                    "csv"  => ReportFormat::Csv,
                    "xml"  => ReportFormat::Xml,
                    _      => ReportFormat::Html,
                };
            } else if let Some(d) = part.strip_prefix("destination:") {
                dest = Some(d.trim_matches('"').into());
            }
        }
        self.options.report_format = format;
        self.options.report_dest   = dest.or(self.options.report_dest.clone());
        Ok(None)
    }

    fn cmd_folder_report(&mut self, args: &str) -> Result<Option<String>> {
        self.cmd_text_report(args)
    }

    fn cmd_sync(&mut self, args: &str) -> Result<Option<String>> {
        self.options.sync_direction = match args.trim_matches('"') {
            "update:left->right"  => Some(SyncDirection::LeftToRight),
            "update:right->left"  => Some(SyncDirection::RightToLeft),
            "update:both"         => Some(SyncDirection::Both),
            _                     => None,
        };
        Ok(None)
    }

    /// Run the full text comparison
    pub fn run_text_diff(&self) -> Result<DiffResult> {
        let left  = self.left_path.as_ref().ok_or_else(|| anyhow!("left path not set"))?;
        let right = self.right_path.as_ref().ok_or_else(|| anyhow!("right path not set"))?;

        let left_content  = std::fs::read_to_string(left)?;
        let right_content = std::fs::read_to_string(right)?;

        let rules = IgnoreRules {
            case: self.options.ignore_case,
            whitespace: if self.options.ignore_whitespace { diff_engine::WhitespaceMode::All } else { diff_engine::WhitespaceMode::None },
            comments: if self.options.ignore_comments { diff_engine::CommentStyle::All } else { diff_engine::CommentStyle::None },
            ..Default::default()
        };

        Ok(diff_texts(&left_content, &right_content, self.options.algorithm, &rules))
    }
}

impl Default for ScriptInterpreter {
    fn default() -> Self { Self::new() }
}
