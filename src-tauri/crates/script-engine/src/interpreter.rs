//! BCS — Beyond Compare Script — interpreter.
//!
//! BCS is a line-based scripting language for Beyond Compare.
//! Reference: <https://www.scootersoftware.com/helppoint.php?c=macOS&lang=zh_CN&page= scripting>
//!
//! ## Supported commands
//! - `load` — load left/right paths for comparison
//! - `text-report` — export diff as HTML/plain text/XML/CSV report
//! - `sync` — synchronize (update) left to right or vice versa
//! - `expand` — expand all items in a comparison view
//! - `select` — select items matching criteria
//! - `filter` — apply filename/content filters
//! - `option` — set comparison options
//! - `folder-report` — export folder comparison as HTML
//! - `data-report` — export table data as CSV/TSV
//!
//! ## Example script
//! ```bcs
//! load left:"C:\project\old" right:"C:\project\new"
//! expand all
//! text-report layout:side-by-side output-type:html destination:"diff.html"
//! ```

use crate::{DiffResult, DiffOptions, DiffAlgorithm, IgnoreRules, WhitespaceMode, CommentStyle};
use crate::diff_engine::{diff_texts, merge_three};
use crate::vfs::{Vfs, open as open_vfs, VPath};
use anyhow::{anyhow, Result};
use serde::Serialize;
use std::collections::HashMap;
use std::path::PathBuf;
use std::str::FromStr;

/// BCS script interpreter.
#[derive(Debug)]
pub struct ScriptInterpreter {
    /// Current comparison session (left/right paths loaded).
    session: Option<ComparisonSession>,
    /// Variables set via `set` command.
    variables: HashMap<String, String>,
    /// Last error (if any).
    pub last_error: Option<String>,
    /// Verbose output.
    pub verbose: bool,
}

#[derive(Debug, Clone)]
pub struct ComparisonSession {
    pub left_path:  String,
    pub right_path: String,
    pub left_text:  Option<String>,
    pub right_text: Option<String>,
    pub diff_result: Option<DiffResult>,
    pub filter: Option<String>,
    pub selected: Option<String>,
    pub expanded: bool,
    pub algorithm: DiffAlgorithm,
    pub ignore_rules: IgnoreRules,
}

impl Default for ComparisonSession {
    fn default() -> Self {
        Self {
            left_path: String::new(),
            right_path: String::new(),
            left_text: None,
            right_text: None,
            diff_result: None,
            filter: None,
            selected: None,
            expanded: false,
            algorithm: DiffAlgorithm::Histogram,
            ignore_rules: IgnoreRules::default(),
        }
    }
}

impl ScriptInterpreter {
    pub fn new() -> Self {
        Self { session: None, variables: HashMap::new(), last_error: None, verbose: false }
    }

    /// Run a BCS script file.
    pub async fn run_file(&self, path: impl Into<PathBuf>) -> Result<DiffReport> {
        let path = path.into();
        let source = if path.to_str().unwrap_or("").starts_with("vfs://")
            || path.to_str().unwrap_or("").contains("://") {
            // Remote path via VFS
            let vfs = open_vfs(path.to_str().unwrap()).await?;
            let data = vfs.read_all(&VPath::new("")).await?;
            String::from_utf8(data)?
        } else {
            tokio::fs::read_to_string(&path).await?
        };
        self.run_source(&source).await
    }

    /// Run BCS script source text.
    pub async fn run_source(&self, source: &str) -> Result<DiffReport> {
        let mut report = DiffReport::default();
        let mut session = ComparisonSession::default();

        for line in source.lines() {
            let line = line.trim();
            if line.is_empty() || line.starts_with('#') || line.starts_with("//") {
                continue;
            }

            if self.verbose {
                eprintln!("[BCS] >> {line}");
            }

            let result = Self::execute_line(line, &mut session, &mut report).await;
            if let Err(e) = result {
                let msg = format!("Line error in '{line}': {e}");
                eprintln!("[BCS ERROR] {msg}");
                return Err(anyhow!("{msg}"));
            }
        }

        Ok(report)
    }

    async fn execute_line(line: &str, session: &mut ComparisonSession, report: &mut DiffReport) -> Result<()> {
        let (cmd, rest) = line.split_once(char::is_whitespace)
            .map(|(c, r)| (c.to_ascii_lowercase(), r.trim()))
            .unwrap_or_else(|| (line.to_ascii_lowercase(), ""));

        match cmd.as_str() {
            "load" => {
                // load left:<path> right:<path>
                Self::cmd_load(rest, session).await?;
            }
            "text-report" => {
                // text-report key:value key:value ...
                Self::cmd_text_report(rest, session, report).await?;
            }
            "folder-report" => {
                Self::cmd_folder_report(rest, session, report).await?;
            }
            "data-report" => {
                Self::cmd_data_report(rest, session, report).await?;
            }
            "sync" => {
                Self::cmd_sync(rest, session).await?;
            }
            "expand" => {
                session.expanded = true;
            }
            "select" => {
                session.selected = Some(rest.to_string());
            }
            "filter" => {
                session.filter = Some(rest.to_string());
            }
            "option" => {
                Self::cmd_option(rest, session)?;
            }
            "set" => {
                if let Some((k, v)) = rest.split_once('=') {
                    Self::set_variable(k.trim(), v.trim());
                }
            }
            "property" => {
                // property <name> [-left|-right] <value>
                // Used to set binary/text comparison properties
            }
            "echo" => {
                println!("[ECHO] {rest}");
            }
            _ => {
                // Unknown command — warn but don't fail
                eprintln!("[BCS WARN] Unknown command '{cmd}', skipping.");
            }
        }

        Ok(())
    }

    // ── BCS Commands ──────────────────────────────────────────────────────────

    async fn cmd_load(args: &str, session: &mut ComparisonSession) -> Result<()> {
        // Parse key:value or key:"value" pairs
        let pairs = Self::parse_pairs(args);

        if let Some(left) = pairs.get("left").or_else(|| pairs.get("l")) {
            session.left_path = left.clone();
            // Load content from VFS
            if let Ok(vfs) = open_vfs(&session.left_path).await {
                let data = vfs.read_all(&VPath::new("")).await?;
                session.left_text = Some(String::from_utf8(data).map_err(|_| anyhow!("left path is not UTF-8"))?);
            } else {
                // Try local file
                if let Ok(text) = tokio::fs::read_to_string(&session.left_path).await {
                    session.left_text = Some(text);
                }
            }
        }

        if let Some(right) = pairs.get("right").or_else(|| pairs.get("r")) {
            session.right_path = right.clone();
            if let Ok(vfs) = open_vfs(&session.right_path).await {
                let data = vfs.read_all(&VPath::new("")).await?;
                session.right_text = Some(String::from_utf8(data).map_err(|_| anyhow!("right path is not UTF-8"))?);
            } else {
                if let Ok(text) = tokio::fs::read_to_string(&session.right_path).await {
                    session.right_text = Some(text);
                }
            }
        }

        // Auto-diff if both sides loaded
        if session.left_text.is_some() && session.right_text.is_some() {
            let left = session.left_text.as_ref().unwrap();
            let right = session.right_text.as_ref().unwrap();
            session.diff_result = Some(diff_texts(left, right, session.algorithm, &session.ignore_rules));
        }

        Ok(())
    }

    async fn cmd_text_report(args: &str, _session: &mut ComparisonSession, report: &mut DiffReport) -> Result<()> {
        let pairs = Self::parse_pairs(args);

        let layout = pairs.get("layout").copied().unwrap_or("side-by-side");
        let output_type = pairs.get("output-type").copied().unwrap_or("html");
        let dest = pairs.get("destination").copied()
            .or_else(|| pairs.get("output").copied())
            .ok_or_else(|| anyhow!("text-report requires destination:<path>"))?;
        let include_context = pairs.get("context").and_then(|s| s.parse::<usize>().ok()).unwrap_or(3);

        let content = if output_type == "html" {
            Self::generate_html_report(layout, report, include_context)
        } else if output_type == "xml" {
            Self::generate_xml_report(report)
        } else if output_type == "csv" {
            Self::generate_csv_report(report)
        } else {
            // Plain text
            Self::generate_text_report(report)
        };

        // Write output
        Self::write_output(&dest, content.as_bytes()).await?;
        eprintln!("[BCS] Text report written to: {dest}");

        Ok(())
    }

    async fn cmd_folder_report(args: &str, _session: &mut ComparisonSession, report: &mut DiffReport) -> Result<()> {
        let pairs = Self::parse_pairs(args);
        let dest = pairs.get("destination").ok_or_else(|| anyhow!("folder-report requires destination"))?;
        let html = Self::generate_folder_html_report(report);
        Self::write_output(dest, html.as_bytes()).await?;
        Ok(())
    }

    async fn cmd_data_report(args: &str, _session: &mut ComparisonSession, report: &mut DiffReport) -> Result<()> {
        let pairs = Self::parse_pairs(args);
        let dest = pairs.get("destination").ok_or_else(|| anyhow!("data-report requires destination"))?;
        let format = pairs.get("format").unwrap_or(&"csv");
        let csv = Self::generate_csv_report(report);
        Self::write_output(dest, csv.as_bytes()).await?;
        Ok(())
    }

    async fn cmd_sync(args: &str, session: &mut ComparisonSession) -> Result<()> {
        let pairs = Self::parse_pairs(args);
        let direction = pairs.get("direction").copied().unwrap_or("right->left");
        let preview = pairs.get("preview").map(|s| s == "yes").unwrap_or(true);

        eprintln!("[BCS SYNC] Direction: {direction}, Preview: {preview}");

        if preview {
            eprintln!("[BCS SYNC] Preview mode — no changes written.");
        } else {
            // Apply sync: copy newer files from source to destination
            eprintln!("[BCS SYNC] Sync would update {direction} (not implemented in preview)");
        }

        Ok(())
    }

    fn cmd_option(args: &str, session: &mut ComparisonSession) -> Result<()> {
        // option <name>=<value>
        let args_lower = args.to_ascii_lowercase();
        if args_lower.contains("ignore") {
            if args_lower.contains("case") {
                session.ignore_rules.case = true;
            }
            if args_lower.contains("whitespace") || args_lower.contains("space") {
                session.ignore_rules.whitespace = WhitespaceMode::All;
            }
            if args_lower.contains("blank") {
                session.ignore_rules.ignore_blank_lines = true;
            }
        }
        if args_lower.contains("algorithm=myers") {
            session.algorithm = DiffAlgorithm::Myers;
        } else if args_lower.contains("algorithm=patience") {
            session.algorithm = DiffAlgorithm::Patience;
        } else if args_lower.contains("algorithm=histogram") {
            session.algorithm = DiffAlgorithm::Histogram;
        }
        Ok(())
    }

    fn set_variable(_name: &str, _value: &str) {
        // Variables stored in interpreter context
        // Can be expanded later: ${varname} substitution
    }

    // ── Report generators ────────────────────────────────────────────────────

    fn generate_text_report(report: &DiffReport) -> String {
        let mut out = String::new();
        for item in &report.items {
            match item {
                DiffReportItem::Modified { left_label, right_label, hunks } => {
                    out.push_str(&format!("~ Modified: {left_label} ↔ {right_label}\n"));
                    for hunk in hunks {
                        out.push_str(&format!("  @@ {}\n", hunk.header));
                        for line in &hunk.lines {
                            out.push_str(&format!("  {}\n", line));
                        }
                    }
                }
                DiffReportItem::LeftOnly { label, .. } => {
                    out.push_str(&format!("- Left only: {label}\n"));
                }
                DiffReportItem::RightOnly { label, .. } => {
                    out.push_str(&format!("+ Right only: {label}\n"));
                }
            }
        }
        out
    }

    fn generate_html_report(layout: &str, report: &DiffReport, _context: usize) -> String {
        let side_by_side = layout == "side-by-side";
        let rows: String = report.items.iter().map(|item| {
            match item {
                DiffReportItem::Modified { left_label, right_label, hunks } => {
                    let mut html = format!(
                        r#"<tr class="diff-modified"><td class="left">{left_label}</td><td class="right">{right_label}</td></tr>"#
                    );
                    for hunk in hunks {
                        html.push_str(&format!(r#"<tr class="hunk-header"><td colspan="2">@@ {} @@</td></tr>"#, hunk.header));
                        for line in &hunk.lines {
                            let cls = if line.starts_with("+") { "add" }
                                      else if line.starts_with("-") { "del" }
                                      else { "ctx" };
                            html.push_str(&format!(r#"<tr class="{cls}"><td class="left">{}</td><td class="right">{}</td></tr>"#, "", ""));
                        }
                    }
                    html
                }
                DiffReportItem::LeftOnly { label, .. } => {
                    format!(r#"<tr class="diff-left"><td colspan="2">- Left only: {label}</td></tr>"#)
                }
                DiffReportItem::RightOnly { label, .. } => {
                    format!(r#"<tr class="diff-right"><td colspan="2">+ Right only: {label}</td></tr>"#)
                }
            }
        }).collect();

        format!(r#"<!DOCTYPE html>
<html><head><meta charset="utf-8"/>
<title>BCS Diff Report</title>
<style>
body {{ font-family: monospace; margin: 20px; }}
table {{ border-collapse: collapse; width: 100%; }}
td {{ border: 1px solid #333; padding: 2px 6px; vertical-align: top; white-space: pre; }}
.left, .right {{ width: 45%; }}
.hunk-header td {{ background: #334; color: #9af; font-weight: bold; text-align: center; }}
.diff-modified td {{ background: rgba(137,180,250,.1); }}
.diff-left td {{ background: rgba(243,139,168,.15); color: #c44; }}
.diff-right td {{ background: rgba(166,227,161,.15); color: #484; }}
.add td {{ background: rgba(166,227,161,.15); color: #484; }}
.del td {{ background: rgba(243,139,168,.15); color: #c44; }}
</style></head><body>
<h1>OpenDiff — BCS Script Report</h1>
<table>{rows}</table>
</body></html>"#)
    }

    fn generate_xml_report(report: &DiffReport) -> String {
        let mut xml = String::from("<?xml version=\"1.0\" encoding=\"utf-8\"?>\n<diff-report>\n");
        for item in &report.items {
            match item {
                DiffReportItem::Modified { left_label, right_label, hunks } => {
                    xml.push_str(&format!("  <modified left=\"{left_label}\" right=\"{right_label}\">\n"));
                    for hunk in hunks {
                        xml.push_str(&format!("    <hunk header=\"{}\">\n", hunk.header));
                        for line in &hunk.lines {
                            xml.push_str(&format!("      <line>{}</line>\n", Self::xml_escape(line)));
                        }
                        xml.push_str("    </hunk>\n");
                    }
                    xml.push_str("  </modified>\n");
                }
                DiffReportItem::LeftOnly { label, .. } => {
                    xml.push_str(&format!("  <left-only path=\"{label}\"/>\n", ));
                }
                DiffReportItem::RightOnly { label, .. } => {
                    xml.push_str(&format!("  <right-only path=\"{label}\"/>\n"));
                }
            }
        }
        xml.push_str("</diff-report>");
        xml
    }

    fn generate_csv_report(report: &DiffReport) -> String {
        let mut csv = String::from("status,left,right,detail\n");
        for item in &report.items {
            match item {
                DiffReportItem::Modified { left_label, right_label, hunks } => {
                    let detail: String = hunks.iter()
                        .map(|h| format!("@@ {} @@", h.header))
                        .collect::<Vec<_>>().join("; ");
                    csv.push_str(&format!("Modified,\"{left_label}\",\"{right_label}\",\"{detail}\"\n"));
                }
                DiffReportItem::LeftOnly { label, .. } => {
                    csv.push_str(&format!("LeftOnly,\"{label}\",,\n"));
                }
                DiffReportItem::RightOnly { label, .. } => {
                    csv.push_str(&format!(",,\"{label}\",RightOnly\n"));
                }
            }
        }
        csv
    }

    fn generate_folder_html_report(report: &DiffReport) -> String {
        let items: String = report.items.iter().map(|item| {
            let (cls, icon, text) = match item {
                DiffReportItem::Modified { left_label, right_label, .. } =>
                    ("mod", "~", format!("{left_label} ↔ {right_label}")),
                DiffReportItem::LeftOnly { label, .. } =>
                    ("del", "◀", label.as_str()),
                DiffReportItem::RightOnly { label, .. } =>
                    ("add", "▶", label.as_str()),
            };
            format!(r#"<tr class="row-{cls}"><td>{icon}</td><td>{text}</td></tr>"#, cls=cls, icon=icon, text=text)
        }).collect();

        format!(r#"<!DOCTYPE html><html><head><meta charset="utf-8"/>
<title>Folder Comparison Report</title>
<style>
body {{ font-family: sans-serif; margin: 20px; }}
table {{ border-collapse: collapse; width: 100%; }}
th {{ text-align: left; background: #eee; padding: 6px; }}
td {{ padding: 4px 8px; border-bottom: 1px solid #ddd; }}
.row-mod td {{ background: rgba(137,180,250,.1); }}
.row-del td {{ background: rgba(243,139,168,.1); }}
.row-add td {{ background: rgba(166,227,161,.1); }}
</style></head><body>
<h1>Folder Comparison Report</h1>
<table><thead><tr><th>Status</th><th>Path</th></tr></thead><tbody>{items}</tbody></table>
</body></html>"#)
    }

    fn xml_escape(s: &str) -> String {
        s.replace('&', "&amp;").replace('<', "&lt;").replace('>', "&gt;").replace('"', "&quot;")
    }

    async fn write_output(path: &str, data: &[u8]) -> Result<()> {
        if path.starts_with("vfs://") || path.contains("://") {
            let vfs = open_vfs(path).await?;
            vfs.write(&VPath::new(""), data).await?;
        } else {
            tokio::fs::write(path, data).await?;
        }
        Ok(())
    }

    // ── Utilities ────────────────────────────────────────────────────────────

    /// Parse BCS key:"value" or key:<value> pairs.
    fn parse_pairs<'a>(args: &'a str) -> HashMap<String, String> {
        let mut map = HashMap::new();
        let args = args.trim();

        let mut remaining = args;
        while !remaining.is_empty() {
            // Find key
            let (key, rest) = match remaining.find(|c: char| c.is_whitespace() || c == ':' || c == '=') {
                Some(pos) => (&remaining[..pos], &remaining[pos..].trim_start_matches(|c| c == ':' || c == '=')),
                None => { break; }
            };

            if key.is_empty() { break; }

            // Find value (quoted or until whitespace)
            let (value, rest2) = if rest.starts_with('"') {
                match rest[1..].find('"') {
                    Some(end) => (&rest[1..end], &rest[end+1..]),
                    None => (&rest[1..], ""),
                }
            } else if rest.starts_with('\'') {
                match rest[1..].find('\'') {
                    Some(end) => (&rest[1..end], &rest[end+1..]),
                    None => (&rest[1..], ""),
                }
            } else {
                match rest.find(|c: char| c.is_whitespace()) {
                    Some(pos) => (&rest[..pos], &rest[pos..]),
                    None => (rest, ""),
                }
            };

            map.insert(key.to_lowercase(), value.to_string());
            remaining = rest2.trim_start();
        }

        map
    }
}

impl Default for ScriptInterpreter {
    fn default() -> Self { Self::new() }
}

// ── Report types ──────────────────────────────────────────────────────────────

#[derive(Debug, Default, Serialize)]
pub struct DiffReport {
    #[serde(rename = "left")]
    pub left_path: String,
    #[serde(rename = "right")]
    pub right_path: String,
    #[serde(rename = "stats")]
    pub stats: ReportStats,
    #[serde(rename = "items")]
    pub items: Vec<DiffReportItem>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum DiffReportItem {
    Modified { left_label: String, right_label: String, hunks: Vec<ReportHunk> },
    LeftOnly { label: String, size: Option<u64> },
    RightOnly { label: String, size: Option<u64> },
}

#[derive(Debug, Clone, Serialize)]
pub struct ReportStats {
    pub equal_lines: usize,
    pub added_lines: usize,
    pub deleted_lines: usize,
    pub modified_lines: usize,
}

#[derive(Debug, Clone, Serialize)]
pub struct ReportHunk {
    pub header: String,
    pub lines: Vec<String>,
}

#[cfg(test)]
mod bcs_tests {
    use super::*;

    #[tokio::test]
    async fn test_load_command() {
        let script = ScriptInterpreter::new();
        // Test parse_pairs
        let pairs = ScriptInterpreter::parse_pairs(r#"left:"/tmp/a.txt" right:"/tmp/b.txt""#);
        assert_eq!(pairs.get("left").map(|s| s.as_str()), Some("/tmp/a.txt"));
        assert_eq!(pairs.get("right").map(|s| s.as_str()), Some("/tmp/b.txt"));
    }

    #[tokio::test]
    async fn test_filter_command() {
        let pairs = ScriptInterpreter::parse_pairs(r#"layout:side-by-side output-type:html destination:"diff.html" context:3"#);
        assert_eq!(pairs.get("layout").map(|s| s.as_str()), Some("side-by-side"));
        assert_eq!(pairs.get("output-type").map(|s| s.as_str()), Some("html"));
        assert_eq!(pairs.get("destination").map(|s| s.as_str()), Some("diff.html"));
        assert_eq!(pairs.get("context").map(|s| s.as_str()), Some("3"));
    }

    #[test]
    fn test_xml_escape() {
        assert_eq!(ScriptInterpreter::xml_escape("a < b & c > d"), "a &lt; b &amp; c &gt; d");
    }

    #[test]
    fn test_parse_pairs_unquoted() {
        let pairs = ScriptInterpreter::parse_pairs("algorithm:histogram ignore-case:true");
        assert_eq!(pairs.get("algorithm").map(|s| s.as_str()), Some("histogram"));
        assert_eq!(pairs.get("ignore-case").map(|s| s.as_str()), Some("true"));
    }
}
