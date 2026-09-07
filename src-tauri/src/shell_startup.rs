use cli_core::{parse_cli_args, CliCommand};
use serde::{Deserialize, Serialize};
use shell_core::{
    ShellCompareAction, ShellCompareOutcome, ShellCompareSessionType, ShellCompareStateStore,
};

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ShellStartupDecision {
    /// No shell-compare args; start the normal UI.
    Continue,
    /// Left side recorded; exit without opening a window (Explorer dual-select / Select Left).
    ExitQuiet,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ShellCompareLaunchPayload {
    pub left: String,
    pub right: String,
    pub route: String,
    pub session_type: String,
}

pub fn prepare_shell_startup(args: impl IntoIterator<Item = String>) -> ShellStartupDecision {
    let invocation = match parse_cli_args(args) {
        Ok(invocation) => invocation,
        Err(_) => return ShellStartupDecision::Continue,
    };

    match invocation.command {
        CliCommand::ShellCompare { path, select_left } => {
            let store = ShellCompareStateStore::new(shell_compare_state_path());
            let outcome = if select_left {
                store.select_left_only(&path)
            } else {
                store.select_path(&path)
            };

            match outcome {
                Ok(ShellCompareOutcome::PendingLeft { left }) => {
                    let _ = left;
                    ShellStartupDecision::ExitQuiet
                }
                Ok(ShellCompareOutcome::Ready(action)) => {
                    if let Err(error) = write_shell_compare_launch(&action) {
                        eprintln!("Open Diff: failed to stage shell compare launch: {error}");
                    }
                    ShellStartupDecision::Continue
                }
                Err(error) => {
                    eprintln!("Open Diff: shell compare failed: {error:?}");
                    ShellStartupDecision::ExitQuiet
                }
            }
        }
        CliCommand::OpenCompare {
            session_type,
            left,
            right,
            route,
            options: _,
        } => {
            let payload = ShellCompareLaunchPayload {
                left,
                right,
                route,
                session_type,
            };
            if let Err(error) = write_open_compare_launch(&payload) {
                eprintln!("Open Diff: failed to stage open compare launch: {error}");
            }
            ShellStartupDecision::Continue
        }
        _ => ShellStartupDecision::Continue,
    }
}

pub fn take_shell_compare_launch() -> Result<Option<ShellCompareLaunchPayload>, String> {
    let path = shell_compare_launch_path();
    match std::fs::read_to_string(&path) {
        Ok(raw) => {
            let _ = std::fs::remove_file(&path);
            Ok(Some(parse_shell_compare_launch(&raw)?))
        }
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(None),
        Err(error) => Err(error.to_string()),
    }
}

fn write_shell_compare_launch(action: &ShellCompareAction) -> Result<(), String> {
    let payload = ShellCompareLaunchPayload {
        left: action.left.clone(),
        right: action.right.clone(),
        route: action.route.clone(),
        session_type: session_type_name(action.session_type).to_owned(),
    };
    write_open_compare_launch(&payload)
}

fn write_open_compare_launch(payload: &ShellCompareLaunchPayload) -> Result<(), String> {
    let path = shell_compare_launch_path();
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent).map_err(|error| error.to_string())?;
    }
    std::fs::write(path, encode_shell_compare_launch(payload)).map_err(|error| error.to_string())
}

fn encode_shell_compare_launch(payload: &ShellCompareLaunchPayload) -> String {
    // Four-line payload avoids a direct serde_json dependency in the app crate.
    format!(
        "{}\n{}\n{}\n{}\n",
        escape_launch_line(&payload.left),
        escape_launch_line(&payload.right),
        escape_launch_line(&payload.route),
        escape_launch_line(&payload.session_type)
    )
}

fn parse_shell_compare_launch(raw: &str) -> Result<ShellCompareLaunchPayload, String> {
    let mut lines = raw.lines();
    let left = unescape_launch_line(lines.next().ok_or("missing left path")?);
    let right = unescape_launch_line(lines.next().ok_or("missing right path")?);
    let route = unescape_launch_line(lines.next().ok_or("missing route")?);
    let session_type = unescape_launch_line(lines.next().ok_or("missing session type")?);

    Ok(ShellCompareLaunchPayload {
        left,
        right,
        route,
        session_type,
    })
}

fn escape_launch_line(value: &str) -> String {
    value.replace('\\', "\\\\").replace('\n', "\\n")
}

fn unescape_launch_line(value: &str) -> String {
    let mut out = String::with_capacity(value.len());
    let mut chars = value.chars();
    while let Some(ch) = chars.next() {
        if ch == '\\' {
            match chars.next() {
                Some('n') => out.push('\n'),
                Some('\\') => out.push('\\'),
                Some(other) => {
                    out.push('\\');
                    out.push(other);
                }
                None => out.push('\\'),
            }
        } else {
            out.push(ch);
        }
    }
    out
}

fn session_type_name(session_type: ShellCompareSessionType) -> &'static str {
    match session_type {
        ShellCompareSessionType::Text => "text-compare",
        ShellCompareSessionType::Folder => "folder-compare",
        ShellCompareSessionType::Hex => "hex-compare",
    }
}

pub fn shell_compare_state_path() -> std::path::PathBuf {
    open_diff_config_dir().join("shell-compare-pending")
}

pub fn shell_compare_launch_path() -> std::path::PathBuf {
    open_diff_config_dir().join("shell-compare-launch.txt")
}

fn open_diff_config_dir() -> std::path::PathBuf {
    if let Ok(path) = std::env::var("OPEN_DIFF_CONFIG_DIR") {
        return std::path::PathBuf::from(path);
    }

    let home = std::env::var("HOME")
        .or_else(|_| std::env::var("USERPROFILE"))
        .unwrap_or_else(|_| std::env::temp_dir().display().to_string());

    std::path::PathBuf::from(home)
        .join(".config")
        .join("open-diff")
}
