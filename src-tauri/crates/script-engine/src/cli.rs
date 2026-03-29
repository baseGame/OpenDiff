//! OpenDiff CLI — command-line interface for BCS scripts and diff operations.
//!
//! Usage examples:
//! ```bash
//! # Run a BCS script
//! opendiff script run script.bcs
//!
//! # Two-way text diff
//! opendiff diff left.txt right.txt
//!
//! # Three-way merge
//! opendiff merge left.txt base.txt right.txt -o merged.txt
//!
//! # Generate HTML diff report
//! opendiff report left.txt right.txt -o diff.html
//!
//! # Compare two folders
//! opendiff folder dir1 dir2
//!
//! # List BCS script commands
//! opendiff script --help
//! ```
//!
//! ## Environment variables
//! - `OPENDIFF_VFS_DEFAULT` — default VFS scheme (local/sftp://.../s3://...)
//! - `OPENDIFF_ALGORITHM` — default diff algorithm (myers/patience/histogram)
//! - `OPENDIFF_IGNORE_CASE` — ignore case in comparisons (0/1)

use clap::{Parser, Subcommand, ValueHint};
use std::path::PathBuf;
use anyhow::Result;
use script_engine::interpreter::ScriptInterpreter;

pub use script_engine::interpreter::DiffReport;

// ── CLI definition ────────────────────────────────────────────────────────────

#[derive(Debug, Parser)]
#[command(
    name = "opendiff",
    about = "OpenDiff — open-source file/folder diff tool (Beyond Compare clone)",
    long_about = None,
    version = "0.1.0",
)]
pub struct CliArgs {
    /// Left file or folder path (for quick diff)
    #[arg(value_hint = ValueHint::FilePath)]
    pub left: Option<PathBuf>,

    /// Right file or folder path
    #[arg(value_hint = ValueHint::FilePath)]
    pub right: Option<PathBuf>,

    /// Diff algorithm: myers | patience | histogram
    #[arg(long, env = "OPENDIFF_ALGORITHM", default_value = "histogram")]
    pub algorithm: Option<String>,

    /// Verbose output
    #[arg(short, long)]
    pub verbose: bool,

    /// Subcommands
    #[command(subcommand)]
    pub cmd: Option<Command>,
}

#[derive(Debug, Subcommand)]
pub enum Command {
    /// Run a BCS (Beyond Compare Script) script file
    Script {
        /// Path to .bcs script file (or - for stdin)
        #[arg(value_hint = ValueHint::FilePath)]
        script: Option<PathBuf>,

        /// Show all available BCS commands
        #[arg(long)]
        help_cmds: bool,

        /// Dry run — parse script but don't execute
        #[arg(long)]
        dry_run: bool,
    },

    /// Compare two files
    Diff {
        /// Left file path
        #[arg(value_hint = ValueHint::FilePath)]
        left: Option<PathBuf>,

        /// Right file path
        #[arg(value_hint = ValueHint::FilePath)]
        right: Option<PathBuf>,

        /// Output format: text | html | json | xml | csv
        #[arg(short, long, default_value = "text")]
        format: String,

        /// Ignore whitespace
        #[arg(long)]
        ignore_ws: bool,

        /// Ignore case
        #[arg(long)]
        ignore_case: bool,

        /// Output file (default: stdout)
        #[arg(short, long)]
        output: Option<PathBuf>,
    },

    /// Three-way merge
    Merge {
        /// Left version (theirs in git terms)
        #[arg(value_hint = ValueHint::FilePath)]
        left: PathBuf,

        /// Base / ancestor version
        #[arg(value_hint = ValueHint::FilePath)]
        base: PathBuf,

        /// Right version (ours in git terms)
        #[arg(value_hint = ValueHint::FilePath)]
        right: PathBuf,

        /// Output file for merged result
        #[arg(short = 'o', long, default_value = "-")]
        output: PathBuf,

        /// Conflict output file
        #[arg(long)]
        conflicts: Option<PathBuf>,

        /// Prefer left (theirs) for conflicts
        #[arg(long)]
        prefer_left: bool,

        /// Prefer right (ours) for conflicts
        #[arg(long)]
        prefer_right: bool,
    },

    /// Compare two folders recursively
    Folder {
        /// Left folder path
        #[arg(value_hint = ValueHint::DirPath)]
        left: Option<PathBuf>,

        /// Right folder path
        #[arg(value_hint = ValueHint::DirPath)]
        right: Option<PathBuf>,

        /// Output format: text | html | json
        #[arg(short, long, default_value = "text")]
        format: String,

        /// Output file
        #[arg(short, long)]
        output: Option<PathBuf>,

        /// Ignore patterns (glob, semicolon-separated)
        #[arg(long)]
        ignore: Option<String>,

        /// Compare by time (default: by size)
        #[arg(long)]
        by_time: bool,
    },

    /// Generate a diff report
    Report {
        /// Left file or folder
        #[arg(value_hint = ValueHint::FilePath)]
        left: Option<PathBuf>,

        /// Right file or folder
        #[arg(value_hint = ValueHint::FilePath)]
        right: Option<PathBuf>,

        /// Report format: html | text | xml | csv
        #[arg(short = 'F', long, default_value = "html")]
        format: String,

        /// Output file
        #[arg(short = 'o', long)]
        output: Option<PathBuf>,

        /// Include unchanged items
        #[arg(long)]
        include_same: bool,
    },

    /// Open GUI (requires display)
    #[cfg(feature = "gui")]
    Gui {
        /// Left path to open
        #[arg(value_hint = ValueHint::FilePath)]
        left: Option<PathBuf>,

        /// Right path to open
        #[arg(value_hint = ValueHint::FilePath)]
        right: Option<PathBuf>,
    },

    /// Show version and info
    Version,
}

// ── CLI entry point ───────────────────────────────────────────────────────────

impl CliArgs {
    pub async fn run(&self) -> Result<()> {
        if let Some(ref cmd) = self.cmd {
            return self.run_cmd(cmd).await;
        }

        // No subcommand — quick diff if both paths given
        match (&self.left, &self.right) {
            (Some(l), Some(r)) => {
                self.run_diff(l, r, &"text".into(), None).await?;
            }
            (None, None) => {
                println!("{}", Self::clap().render_help());
            }
            _ => {
                eprintln!("Error: both --left and --right must be provided for quick diff.");
                std::process::exit(1);
            }
        }
        Ok(())
    }

    async fn run_cmd(&self, cmd: &Command) -> Result<()> {
        match cmd {
            Command::Script { script, help_cmds, dry_run } => {
                if *help_cmds {
                    self.print_bcs_help();
                    return Ok(());
                }
                let path = script.as_ref()
                    .ok_or_else(|| anyhow::anyhow!("Script path required. Run: opendiff script run <file.bcs>"))?;
                self.run_script(path, *dry_run).await?;
            }
            Command::Diff { left, right, format, ignore_ws, ignore_case, output } => {
                let l = left.as_ref().or(self.left.as_ref())
                    .ok_or_else(|| anyhow::anyhow!("Left path required"))?;
                let r = right.as_ref().or(self.right.as_ref())
                    .ok_or_else(|| anyhow::anyhow!("Right path required"))?;
                self.run_diff(l, r, format, *output).await?;
            }
            Command::Report { left, right, format, output, .. } => {
                let l = left.as_ref().or(self.left.as_ref())
                    .ok_or_else(|| anyhow::anyhow!("Left path required"))?;
                let r = right.as_ref().or(self.right.as_ref())
                    .ok_or_else(|| anyhow::anyhow!("Right path required"))?;
                self.run_report(l, r, format, *output).await?;
            }
            Command::Merge { left, base, right, output, conflicts, prefer_left, prefer_right } => {
                self.run_merge(left, base, right, output, conflicts.as_ref(), *prefer_left, *prefer_right).await?;
            }
            Command::Folder { left, right, format, output, ignore, by_time } => {
                let l = left.as_ref().or(self.left.as_ref())
                    .ok_or_else(|| anyhow::anyhow!("Left folder required"))?;
                let r = right.as_ref().or(self.right.as_ref())
                    .ok_or_else(|| anyhow::anyhow!("Right folder required"))?;
                self.run_folder(l, r, format, *output, ignore.as_deref(), *by_time).await?;
            }
            Command::Version => {
                println!("OpenDiff v{}", env!("CARGO_PKG_VERSION"));
                println!("{}", env!("CARGO_PKG_DESCRIPTION"));
                println!("License: Apache-2.0");
                println!("Repo: https://github.com/baseGame/OpenDiff");
            }
            #[cfg(feature = "gui")]
            Command::Gui { left, right } => {
                eprintln!("GUI not yet implemented. Track progress at: https://github.com/baseGame/OpenDiff");
            }
        }
        Ok(())
    }

    // ── Diff ──────────────────────────────────────────────────────────────────

    async fn run_diff(&self, left: &PathBuf, right: &PathBuf, format: &str, output: Option<PathBuf>) -> Result<()> {
        use script_engine::diff_engine::{diff_texts, DiffAlgorithm, IgnoreRules};
        use std::io::Write;

        let left_text  = tokio::fs::read_to_string(left).await
            .map_err(|e| anyhow::anyhow!("Cannot read left file '{}': {e}", left.display()))?;
        let right_text = tokio::fs::read_to_string(right).await
            .map_err(|e| anyhow::anyhow!("Cannot read right file '{}': {e}", right.display()))?;

        let alg = match self.algorithm.as_deref() {
            Some("myers")    => DiffAlgorithm::Myers,
            Some("patience") => DiffAlgorithm::Patience,
            _               => DiffAlgorithm::Histogram,
        };

        let result = diff_texts(&left_text, &right_text, alg, &IgnoreRules::default());

        let output_str = match format {
            "json" => serde_json::to_string_pretty(&result)?,
            "xml"  => format!("<?xml version=\"1.0\"?>\n<diff left=\"{}\" right=\"{}\">\n{}\n</diff>",
                Self::escape_xml(&left.to_string_lossy()),
                Self::escape_xml(&right.to_string_lossy()),
                Self::diff_to_xml(&result)),
            "html" => {
                let report = DiffReport::default();
                script_engine::interpreter::ScriptInterpreter::generate_html_report("side-by-side", &report, 3)
            }
            _ => {
                // Plain text
                result.ops.iter().map(|op| {
                    match op {
                        script_engine::DiffOp::Equal { lines } =>
                            lines.iter().map(|l| format!("  {l}")).collect::<Vec<_>>().join("\n"),
                        script_engine::DiffOp::Delete { lines } =>
                            lines.iter().map(|l| format!("- {l}")).collect::<Vec<_>>().join("\n"),
                        script_engine::DiffOp::Insert { lines } =>
                            lines.iter().map(|l| format!("+ {l}")).collect::<Vec<_>>().join("\n"),
                        script_engine::DiffOp::Replace { left_lines, right_lines } => {
                            let mut out = Vec::new();
                            for l in left_lines { out.push(format!("- {l}")); }
                            for l in right_lines { out.push(format!("+ {l}")); }
                            out.join("\n")
                        }
                    }
                }).collect::<Vec<_>>().join("\n")
            }
        };

        if let Some(ref path) = output {
            if path.as_os_str() == "-" {
                println!("{output_str}");
            } else {
                let mut f = std::fs::File::create(path)?;
                f.write_all(output_str.as_bytes())?;
                eprintln!("Diff written to: {}", path.display());
            }
        } else {
            println!("{output_str}");
        }

        Ok(())
    }

    async fn run_merge(&self, left: &PathBuf, base: &PathBuf, right: &PathBuf,
                       output: &PathBuf, conflicts: Option<&PathBuf>,
                       prefer_left: bool, prefer_right: bool) -> Result<()> {
        use script_engine::diff_engine::merge_three;

        let left_text  = tokio::fs::read_to_string(left).await?;
        let base_text  = tokio::fs::read_to_string(base).await?;
        let right_text = tokio::fs::read_to_string(right).await?;

        let result = merge_three(&base_text, &left_text, &right_text);

        if let Some(path) = conflicts {
            let conflict_text = result.output_lines.iter()
                .filter(|l| matches!(l, script_engine::MergeLine::Conflict { .. }))
                .map(|l| format!("{l}"))
                .collect::<Vec<_>>()
                .join("\n");
            tokio::fs::write(path, conflict_text).await?;
        }

        let merged = result.output_lines.iter().map(|l| l.content()).collect::<Vec<_>>().join("\n");
        if output.as_os_str() == "-" {
            println!("{merged}");
        } else {
            tokio::fs::write(output, &merged).await?;
            eprintln!("Merged output written to: {}", output.display());
        }

        if result.conflict_count > 0 {
            eprintln!("Warning: {} conflicts in output (resolved with base)", result.conflict_count);
        }

        Ok(())
    }

    async fn run_report(&self, left: &PathBuf, right: &PathBuf, format: &str, output: Option<PathBuf>) -> Result<()> {
        let report = self.build_diff_report(left, right).await?;

        let content = match format {
            "html" => script_engine::interpreter::ScriptInterpreter::generate_html_report("side-by-side", &report, 3),
            "xml"  => script_engine::interpreter::ScriptInterpreter::generate_xml_report(&report),
            "csv"  => script_engine::interpreter::ScriptInterpreter::generate_csv_report(&report),
            _ => script_engine::interpreter::ScriptInterpreter::generate_text_report(&report),
        };

        let path = output.ok_or_else(|| anyhow::anyhow!("--output required for report"))?;
        tokio::fs::write(&path, content).await?;
        eprintln!("Report written to: {}", path.display());

        Ok(())
    }

    async fn run_folder(&self, left: &PathBuf, right: &PathBuf, format: &str,
                        output: Option<PathBuf>, _ignore: Option<&str>, _by_time: bool) -> Result<()> {
        use script_engine::vfs::{LocalVfs, Vfs, VPath};

        let vfs = LocalVfs;
        let left_entries = vfs.list(&VPath::new(left.to_string_lossy().as_ref())).await
            .map_err(|e| anyhow::anyhow!("Cannot list left folder '{}': {e}", left.display()))?;
        let right_entries = vfs.list(&VPath::new(right.to_string_lossy().as_ref())).await
            .map_err(|e| anyhow::anyhow!("Cannot list right folder '{}': {e}", right.display()))?;

        let mut report = DiffReport::default();
        report.left_path = left.to_string_lossy().to_string();
        report.right_path = right.to_string_lossy().to_string();

        // Simple pairwise comparison
        let right_map: std::collections::HashMap<_, _> = right_entries.iter()
            .map(|e| (e.name.as_str(), e)).collect();

        for l_entry in &left_entries {
            if let Some(r_entry) = right_map.get(l_entry.name.as_str()) {
                use script_engine::diff_engine::DiffResult;
                if l_entry.metadata.size != r_entry.metadata.size {
                    report.items.push(DiffReportItem::Modified {
                        left_label: l_entry.path.as_str().to_string(),
                        right_label: r_entry.path.as_str().to_string(),
                        hunks: vec![],
                    });
                }
            } else {
                report.items.push(DiffReportItem::LeftOnly {
                    label: l_entry.path.as_str().to_string(),
                    size: l_entry.metadata.size,
                });
            }
        }

        for r_entry in &right_entries {
            if !left_entries.iter().any(|l| l.name == r_entry.name) {
                report.items.push(DiffReportItem::RightOnly {
                    label: r_entry.path.as_str().to_string(),
                    size: r_entry.metadata.size,
                });
            }
        }

        let content = match format {
            "html" => script_engine::interpreter::ScriptInterpreter::generate_folder_html_report(&report),
            "json" => serde_json::to_string_pretty(&report)?,
            _ => {
                let mut txt = format!("Folder comparison:\n  Left:  {}\n  Right: {}\n\n", left.display(), right.display());
                for item in &report.items {
                    match item {
                        DiffReportItem::Modified { left_label, right_label, .. } =>
                            txt.push_str(&format!("~ {left_label} ↔ {right_label}\n")),
                        DiffReportItem::LeftOnly { label, .. } =>
                            txt.push_str(&format!("- {label} (left only)\n")),
                        DiffReportItem::RightOnly { label, .. } =>
                            txt.push_str(&format!("+ {label} (right only)\n")),
                    }
                }
                txt
            }
        };

        if let Some(path) = output {
            tokio::fs::write(path, content).await?;
        } else {
            println!("{content}");
        }

        Ok(())
    }

    async fn run_script(&self, script_path: &PathBuf, dry_run: bool) -> Result<()> {
        let source = if script_path.as_os_str() == "-" {
            use std::io::Read;
            let mut buf = String::new();
            std::io::stdin().read_to_string(&mut buf)?;
            buf
        } else {
            tokio::fs::read_to_string(script_path).await?
        };

        if dry_run {
            println!("[DRY RUN] Would execute BCS script ({} lines):", source.lines().count());
            for (i, line) in source.lines().enumerate() {
                println!("  {:3}: {}", i + 1, line);
            }
            return Ok(());
        }

        let interp = ScriptInterpreter { verbose: self.verbose, ..Default::default() };
        let report = interp.run_source(&source).await?;
        eprintln!("[OK] Script executed. {} items compared.", report.items.len());

        Ok(())
    }

    fn print_bcs_help(&self) {
        println!(r#"
OpenDiff BCS Script — supported commands:

  load left:<path> right:<path>    Load two paths for comparison
  text-report layout:<mode>        Generate text diff report (html/xml/csv/plain)
        output-type:<type>           (side-by-side | unified)
        destination:<path>           Output file path
        context:<N>                  Lines of context around diffs

  folder-report                     Generate folder comparison report
        destination:<path>           Output HTML file

  data-report                       Generate CSV table report
        format:<csv|tsv>
        destination:<path>

  sync                              Synchronize left/right
        direction:<left->right|right->left|center|mirror>
        preview:<yes|no>

  expand all                        Expand all folders
  select <criteria>                Select items matching criteria
  filter <glob>                    Apply filename filter

  option <name>=<value>            Set comparison option
    algorithm=myers|patience|histogram
    ignore-case=true|false
    ignore-whitespace=true|false
    ignore-blank-lines=true|false

Environment variables:
  OPENDIFF_ALGORITHM   Default diff algorithm
  OPENDIFF_IGNORE_CASE Ignore case in comparisons (0/1)
"#);
    }

    async fn build_diff_report(&self, left: &PathBuf, right: &PathBuf) -> Result<DiffReport> {
        use script_engine::diff_engine::{diff_texts, DiffAlgorithm, IgnoreRules};
        use script_engine::vfs::{LocalVfs, Vfs, VPath};

        let left_text = tokio::fs::read_to_string(left).await?;
        let right_text = tokio::fs::read_to_string(right).await?;

        let alg = match self.algorithm.as_deref() {
            Some("myers")    => DiffAlgorithm::Myers,
            Some("patience") => DiffAlgorithm::Patience,
            _               => DiffAlgorithm::Histogram,
        };

        let result = diff_texts(&left_text, &right_text, alg, &IgnoreRules::default());

        let mut report = DiffReport::default();
        report.left_path = left.to_string_lossy().to_string();
        report.right_path = right.to_string_lossy().to_string();
        report.stats.equal_lines = result.stats.equal;
        report.stats.added_lines = result.stats.inserted;
        report.stats.deleted_lines = result.stats.deleted;
        report.stats.modified_lines = result.stats.changed;

        // Convert ops to report items
        for op in &result.ops {
            match op {
                script_engine::DiffOp::Equal { lines } => {
                    for line in lines {
                        report.items.push(DiffReportItem::Modified {
                            left_label: line.to_string(),
                            right_label: line.to_string(),
                            hunks: vec![],
                        });
                    }
                }
                _ => {}
            }
        }

        Ok(report)
    }

    fn escape_xml(s: &str) -> String {
        s.replace('&', "&amp;").replace('<', "&lt;").replace('>', "&gt;").replace('"', "&quot;")
    }

    fn diff_to_xml(result: &script_engine::DiffResult) -> String {
        let mut xml = String::new();
        for op in &result.ops {
            match op {
                script_engine::DiffOp::Equal { lines } => {
                    for l in lines { xml.push_str(&format!("  <equal>{l}</equal>\n")); }
                }
                script_engine::DiffOp::Delete { lines } => {
                    for l in lines { xml.push_str(&format!("  <delete>{l}</delete>\n")); }
                }
                script_engine::DiffOp::Insert { lines } => {
                    for l in lines { xml.push_str(&format!("  <insert>{l}</insert>\n")); }
                }
                script_engine::DiffOp::Replace { left_lines, right_lines } => {
                    xml.push_str("  <replace>\n");
                    for l in left_lines { xml.push_str(&format!("    <left>{l}</left>\n")); }
                    for l in right_lines { xml.push_str(&format!("    <right>{l}</right>\n")); }
                    xml.push_str("  </replace>\n");
                }
            }
        }
        xml
    }
}
