use clap::{Parser, Subcommand};
use std::path::PathBuf;

#[derive(Debug, Parser)]
#[command(name = "opendiff", about = "OpenDiff CLI — Beyond Compare open-source clone")]
pub struct CliArgs {
    /// Left file/folder
    pub left: Option<PathBuf>,
    /// Right file/folder  
    pub right: Option<PathBuf>,

    #[command(subcommand)]
    pub command: Option<CliCommand>,
}

#[derive(Debug, Subcommand)]
pub enum CliCommand {
    /// Three-way merge
    Merge {
        left: PathBuf,
        base: PathBuf,
        right: PathBuf,
        #[arg(short, long)]
        output: Option<PathBuf>,
    },
    /// Sync folders
    Sync {
        src: PathBuf,
        dst: PathBuf,
        #[arg(long)]
        dry_run: bool,
    },
    /// Run a BCS script
    Script { path: PathBuf },
    /// Generate HTML report
    Report {
        left: PathBuf,
        right: PathBuf,
        #[arg(short, long)]
        output: PathBuf,
    },
}
