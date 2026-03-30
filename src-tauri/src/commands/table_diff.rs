//! Table / CSV / Spreadsheet diff command
use anyhow::Result;
use parsers::{parse_csv, parse_spreadsheet};
use serde::{Deserialize, Serialize};
use std::path::Path;

#[derive(Debug, Deserialize)]
pub struct TableDiffOptions {
    pub delimiter:           Option<String>,
    pub has_headers:        Option<bool>,
    pub ignore_whitespace:  Option<bool>,
    pub ignore_patterns:    Option<Vec<String>>,
}

#[derive(Debug, Serialize)]
pub struct TableDiffResult {
    pub sheets: Vec<SheetDiff>,
    pub stats: TableDiffStats,
}

#[derive(Debug, Serialize)]
pub struct SheetDiff {
    pub name: String,
    pub rows: Vec<RowDiff>,
}

#[derive(Debug, Serialize)]
pub struct RowDiff {
    pub left_idx:  Option<usize>,
    pub right_idx: Option<usize>,
    pub cells: Vec<CellDiff>,
    pub status: RowStatus,
}

#[derive(Debug, Serialize, Clone)]
pub enum RowStatus { Equal, Added, Deleted, Modified }

#[derive(Debug, Serialize)]
pub struct CellDiff {
    pub col:     usize,
    pub left:   Option<String>,
    pub right:  Option<String>,
    pub changed: bool,
}

#[derive(Debug, Serialize)]
pub struct TableDiffStats {
    pub added:    usize,
    pub deleted:  usize,
    pub modified: usize,
    pub equal:    usize,
}

/// Compare two CSV / TSV / XLSX / ODS files
#[tauri::command]
pub async fn cmd_diff_tables(
    left_path: String,
    right_path: String,
    options: Option<TableDiffOptions>,
) -> Result<TableDiffResult, String> {
    let opts = options.unwrap_or(TableDiffOptions {
        delimiter: None,
        has_headers: Some(true),
        ignore_whitespace: Some(true),
        ignore_patterns: None,
    });

    let sep = opts.delimiter.as_deref()
        .or(Some(","))
        .unwrap()
        .chars().next().unwrap_or(',') as u8;

    let ignore_ws = opts.ignore_whitespace.unwrap_or(true);
    let has_headers = opts.has_headers.unwrap_or(true);

    let left_rows = read_table_rows(&left_path, sep, ignore_ws)
        .map_err(|e| format!("Cannot read left file '{left_path}': {e}"))?;
    let right_rows = read_table_rows(&right_path, sep, ignore_ws)
        .map_err(|e| format!("Cannot read right file '{right_path}': {e}"))?;

    let diff = diff_tables(&left_rows, &right_rows, has_headers);

    Ok(TableDiffResult {
        sheets: vec![SheetDiff {
            name: Path::new(&left_path)
                .file_name()
                .and_then(|n| n.to_str())
                .unwrap_or("Sheet1")
                .to_string(),
            rows: diff,
        }],
        stats: TableDiffStats {
            added: 0,
            deleted: 0,
            modified: 0,
            equal: 0,
        },
    })
}

fn read_table_rows(path: &str, sep: u8, ignore_ws: bool) -> Result<Vec<Vec<String>>> {
    let ext = Path::new(path)
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("")
        .to_lowercase();

    match ext.as_str() {
        "csv" | "tsv" | "ssv" => {
            let content = std::fs::read_to_string(path)?;
            parse_csv(&content, sep)
                .map(|rows| {
                    if ignore_ws {
                        rows.into_iter()
                            .map(|row| row.into_iter().map(|c| c.trim().to_string()).collect())
                            .collect()
                    } else { rows }
                })
        }
        "xlsx" | "xls" | "ods" => {
            let data = parsers::parse_spreadsheet(path)?;
            Ok(data.sheets.first()
                .map(|s| s.rows.clone())
                .unwrap_or_default())
        }
        _ => Err(anyhow::anyhow!("Unsupported table format: {}", ext)),
    }
}

fn diff_tables(left: &[Vec<String>], right: &[Vec<String>], has_headers: bool) -> Vec<RowDiff> {
    use RowStatus::*;
    let skip = if has_headers { 1 } else { 0 };
    let l = &left[skip..];
    let r = &right[skip..];

    let mut result: Vec<RowDiff> = Vec::new();
    let mut stats = (0usize, 0usize, 0usize, 0usize);

    // LCS-based diff
    let lcs = lcs_map(l, r);
    let mut li = 0usize;
    let mut ri = 0usize;

    // Header row if present
    if has_headers && !left.is_empty() && !right.is_empty() {
        result.push(RowDiff {
            left_idx: Some(0),
            right_idx: Some(0),
            cells: left[0].iter().enumerate().map(|(i, c)| CellDiff {
                col: i, left: Some(c.clone()), right: right[0].get(i).cloned(), changed: right[0].get(i) != Some(c)
            }).collect(),
            status: if left[0] == right[0] { Equal } else { Modified },
        });
    }

    while li < l.len() || ri < r.len() {
        if li < l.len() && ri < r.len() && l[li] == r[ri] {
            // Equal row
            result.push(RowDiff {
                left_idx: Some(li + skip),
                right_idx: Some(ri + skip),
                cells: l[li].iter().enumerate().map(|(i, c)| CellDiff {
                    col: i, left: Some(c.clone()), right: Some(c.clone()), changed: false,
                }).collect(),
                status: Equal,
            });
            stats.3 += 1;
            li += 1; ri += 1;
        } else if ri < r.len() && !lcs.contains(&li) {
            // Right-only row
            result.push(RowDiff {
                left_idx: None,
                right_idx: Some(ri + skip),
                cells: r[ri].iter().enumerate().map(|(i, c)| CellDiff {
                    col: i, left: None, right: Some(c.clone()), changed: true,
                }).collect(),
                status: Added,
            });
            stats.0 += 1;
            ri += 1;
        } else if li < l.len() {
            // Left-only row
            result.push(RowDiff {
                left_idx: Some(li + skip),
                right_idx: None,
                cells: l[li].iter().enumerate().map(|(i, c)| CellDiff {
                    col: i, left: Some(c.clone()), right: None, changed: true,
                }).collect(),
                status: Deleted,
            });
            stats.1 += 1;
            li += 1;
        } else {
            // Remaining right rows
            result.push(RowDiff {
                left_idx: None,
                right_idx: Some(ri + skip),
                cells: r[ri].iter().enumerate().map(|(i, c)| CellDiff {
                    col: i, left: None, right: Some(c.clone()), changed: true,
                }).collect(),
                status: Added,
            });
            stats.0 += 1;
            ri += 1;
        }
    }

    result
}

/// Build a map of matched (LCS) indices
fn lcs_map(left: &[Vec<String>], right: &[Vec<String>]) -> std::collections::HashSet<usize> {
    let m = left.len();
    let n = right.len();
    if m == 0 || n == 0 { return Default::default(); }

    let mut dp = vec![vec![0usize; n + 1]; m + 1];
    for i in 1..=m {
        for j in 1..=n {
            if left[i-1] == right[j-1] {
                dp[i][j] = dp[i-1][j-1] + 1;
            } else {
                dp[i][j] = dp[i-1][j].max(dp[i][j-1]);
            }
        }
    }

    let mut matched = std::collections::HashSet::new();
    let mut i = m; let mut j = n;
    while i > 0 && j > 0 {
        if left[i-1] == right[j-1] {
            matched.insert(i - 1);
            i -= 1; j -= 1;
        } else if dp[i-1][j] > dp[i][j-1] {
            i -= 1;
        } else {
            j -= 1;
        }
    }
    matched
}
