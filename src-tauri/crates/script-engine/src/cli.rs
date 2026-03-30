//! OpenDiff CLI — command-line interface for file diff and merge operations.
use clap::{Parser, Subcommand, ValueHint};
use std::path::PathBuf;
use anyhow::Result;

pub use crate::interpreter::{DiffReport, DiffReportItem, ScriptInterpreter};

#[derive(Debug, Parser)]
#[command(name = "opendiff", version = "0.1.0")]
pub struct CliArgs {
    #[arg(value_hint = ValueHint::FilePath)]
    pub left: Option<PathBuf>,
    #[arg(value_hint = ValueHint::FilePath)]
    pub right: Option<PathBuf>,
    #[arg(long, default_value = "histogram")]
    pub algorithm: Option<String>,
    #[arg(short, long)]
    pub verbose: bool,
    #[command(subcommand)]
    pub cmd: Option<Command>,
}

#[derive(Debug, Subcommand)]
pub enum Command {
    Diff {
        #[arg(value_hint = ValueHint::FilePath)]
        left: Option<PathBuf>,
        #[arg(value_hint = ValueHint::FilePath)]
        right: Option<PathBuf>,
        #[arg(short, long, default_value = "text")]
        format: String,
        #[arg(short, long)]
        output: Option<PathBuf>,
    },
    Merge {
        #[arg(value_hint = ValueHint::FilePath)]
        left: PathBuf,
        #[arg(value_hint = ValueHint::FilePath)]
        base: PathBuf,
        #[arg(value_hint = ValueHint::FilePath)]
        right: PathBuf,
        #[arg(short = 'o', long, default_value = "-")]
        output: PathBuf,
    },
    Script {
        #[arg(value_hint = ValueHint::FilePath)]
        script: Option<PathBuf>,
        #[arg(long)]
        help_cmds: bool,
    },
    Version,
}

impl CliArgs {
    pub async fn run(&self) -> Result<()> {
        match &self.cmd {
            Some(Command::Diff { left, right, format, output }) => {
                let l = left.clone().or(self.left.clone())
                    .ok_or_else(|| anyhow::anyhow!("left path required"))?;
                let r = right.clone().or(self.right.clone())
                    .ok_or_else(|| anyhow::anyhow!("right path required"))?;
                self.run_diff(&l, &r, format, output.as_ref()).await?;
            }
            Some(Command::Merge { left, base, right, output }) => {
                self.run_merge(left, base, right, output).await?;
            }
            Some(Command::Version) | None => {
                println!("OpenDiff v{}", env!("CARGO_PKG_VERSION"));
                println!("{}", env!("CARGO_PKG_DESCRIPTION"));
            }
            Some(Command::Script { help_cmds: true, .. }) => {
                self.print_bcs_help();
            }
            Some(Command::Script { script: None, .. }) => {
                eprintln!("Script path required: opendiff script run <file.bcs>");
            }
            Some(Command::Script { script: Some(path), .. }) => {
                let source = tokio::fs::read_to_string(path).await?;
                let mut interp = ScriptInterpreter::new();
                for line in source.lines() {
                    interp.execute_line(line)?;
                }
                eprintln!("[OK] Script '{}' executed", path.display());
            }
        }
        Ok(())
    }

    async fn run_diff(&self, left: &PathBuf, right: &PathBuf, format: &str, output: Option<&PathBuf>) -> Result<()> {
        use diff_engine::{diff_texts, DiffAlgorithm, IgnoreRules, DiffResult};
        use std::io::Write;

        let left_text  = tokio::fs::read_to_string(left).await?;
        let right_text = tokio::fs::read_to_string(right).await?;

        let alg = match self.algorithm.as_deref() {
            Some("myers")    => DiffAlgorithm::Myers,
            Some("patience") => DiffAlgorithm::Patience,
            _               => DiffAlgorithm::Histogram,
        };

        let result = diff_texts(&left_text, &right_text, alg, &IgnoreRules::default());

        let output_str = match format {
            "json" => serde_json::to_string_pretty(&result)?,
            _ => {
                let mut s = String::new();
                for op in &result.ops {
                    match op {
                        diff_engine::DiffOp::Equal { left_start, right_start, count } => {
                            let rs = *right_start;
                            for i in 0..*count {
                                let l = result.left_lines.get(*left_start + i).map(|sl| sl.as_str()).unwrap_or("");
                                s.push_str(&format!("  {l}\n"));
                                let _ = rs + i; // silence unused warning
                            }
                        }
                        diff_engine::DiffOp::Delete { left_start, count } => {
                            for i in 0..*count {
                                let l = result.left_lines.get(*left_start + i).map(|sl| sl.as_str()).unwrap_or("");
                                s.push_str(&format!("- {l}\n"));
                            }
                        }
                        diff_engine::DiffOp::Insert { right_start, count } => {
                            for i in 0..*count {
                                let r = result.right_lines.get(*right_start + i).map(|sl| sl.as_str()).unwrap_or("");
                                s.push_str(&format!("+ {r}\n"));
                            }
                        }
                        diff_engine::DiffOp::Replace { left_start, left_count, right_start, right_count } => {
                            for i in 0..*left_count {
                                let l = result.left_lines.get(*left_start + i).map(|sl| sl.as_str()).unwrap_or("");
                                s.push_str(&format!("- {l}\n"));
                            }
                            for i in 0..*right_count {
                                let r = result.right_lines.get(*right_start + i).map(|sl| sl.as_str()).unwrap_or("");
                                s.push_str(&format!("+ {r}\n"));
                            }
                        }
                    }
                }
                s
            }
        };

        if let Some(path) = output {
            let mut f = std::fs::File::create(path)?;
            f.write_all(output_str.as_bytes())?;
            eprintln!("Diff written to: {}", path.display());
        } else {
            println!("{output_str}");
        }
        Ok(())
    }

    async fn run_merge(&self, left: &PathBuf, base: &PathBuf, right: &PathBuf, output: &PathBuf) -> Result<()> {
        use diff_engine::merge_three;
        use std::io::Write;

        let left_text  = tokio::fs::read_to_string(left).await?;
        let base_text  = tokio::fs::read_to_string(base).await?;
        let right_text = tokio::fs::read_to_string(right).await?;

        let result = merge_three(&base_text, &left_text, &right_text);
        let merged = result.output_lines.iter().map(|l| l.content()).collect::<Vec<_>>().join("\n");

        let mut f = std::fs::File::create(output)?;
        f.write_all(merged.as_bytes())?;
        eprintln!("Merged output written to: {}", output.display());

        if result.conflict_count > 0 {
            eprintln!("Warning: {} conflicts in output", result.conflict_count);
        }
        Ok(())
    }

    fn print_bcs_help(&self) {
        println!(r#"OpenDiff BCS Script — supported commands:
  load left:<path> right:<path>    Load two paths
  text-report destination:<path>   Generate HTML/text diff report
  expand all                      Expand all folders
  filter <glob>                  Apply filename filter
  option algorithm=histogram      Set diff algorithm
"#);
    }
}
