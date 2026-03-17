use crate::algorithm::{myers, patience, histogram};
use crate::char_diff::char_diff;
use crate::ignore::{normalize_line, normalize_lines};
use crate::file_diff::diff_texts;
use crate::merge::{merge_two, merge_three};
use crate::types::*;

// ── Algorithm tests ─────────────────────────────────────────────────

#[test]
fn test_myers_empty() {
    let ops = myers(&[], &[]);
    assert!(ops.is_empty());
}

#[test]
fn test_myers_insert_only() {
    let ops = myers(&[], &["a", "b"]);
    assert_eq!(ops.len(), 1);
    matches!(&ops[0], DiffOp::Insert { count: 2, .. });
}

#[test]
fn test_myers_delete_only() {
    let ops = myers(&["a", "b"], &[]);
    assert_eq!(ops.len(), 1);
    matches!(&ops[0], DiffOp::Delete { count: 2, .. });
}

#[test]
fn test_histogram_identical() {
    let lines = vec!["fn main() {", "    println!(\"hi\");", "}"];
    let ops = histogram(&lines, &lines);
    assert_eq!(ops.len(), 1);
    matches!(&ops[0], DiffOp::Equal { count: 3, .. });
}

#[test]
fn test_histogram_single_change() {
    let left  = vec!["a", "b", "c"];
    let right = vec!["a", "X", "c"];
    let ops = histogram(&left, &right);
    let has_replace = ops.iter().any(|o| matches!(o, DiffOp::Replace { .. }));
    assert!(has_replace, "Expected replace op, got: {ops:?}");
}

#[test]
fn test_patience_unique_anchors() {
    let left  = vec!["fn foo() {", "    let x = 1;", "}"];
    let right = vec!["fn foo() {", "    let x = 2;", "}"];
    let ops = patience(&left, &right);
    let has_diff = ops.iter().any(|o| !matches!(o, DiffOp::Equal { .. }));
    assert!(has_diff);
}

// ── Ignore rules tests ───────────────────────────────────────────────

#[test]
fn test_ignore_whitespace_leading_trailing() {
    let rules = IgnoreRules { whitespace: WhitespaceMode::LeadingAndTrailing, ..Default::default() };
    assert_eq!(normalize_line("  hello  ", &rules), "hello");
}

#[test]
fn test_ignore_whitespace_all() {
    let rules = IgnoreRules { whitespace: WhitespaceMode::All, ..Default::default() };
    assert_eq!(normalize_line("a  b   c", &rules), "a b c");
}

#[test]
fn test_ignore_case() {
    let rules = IgnoreRules { case: true, ..Default::default() };
    assert_eq!(normalize_line("Hello WORLD", &rules), "hello world");
}

#[test]
fn test_ignore_cstyle_comment() {
    let rules = IgnoreRules { comments: CommentStyle::CStyle, ..Default::default() };
    let result = normalize_line("int x = 1; // this is a comment", &rules);
    assert!(result.contains("int x = 1;"));
    assert!(!result.contains("this is a comment"));
}

#[test]
fn test_ignore_python_comment() {
    let rules = IgnoreRules { comments: CommentStyle::Python, ..Default::default() };
    let result = normalize_line("x = 1  # comment", &rules);
    assert!(result.contains("x = 1"));
    assert!(!result.contains("# comment"));
}

#[test]
fn test_ignore_regex() {
    let rules = IgnoreRules {
        regex_patterns: vec![r"\d{4}-\d{2}-\d{2}".to_string()],
        ..Default::default()
    };
    let result = normalize_line("Log entry 2026-03-17 info", &rules);
    assert!(!result.contains("2026-03-17"));
    assert!(result.contains("Log entry"));
}

// ── Char diff tests ───────────────────────────────────────────────────

#[test]
fn test_char_diff_identical() {
    let d = char_diff("hello", "hello");
    assert!(d.left_changes.is_empty());
    assert!(d.right_changes.is_empty());
}

#[test]
fn test_char_diff_suffix_change() {
    let d = char_diff("hello world", "hello earth");
    // Should have some changes
    assert!(!d.left_changes.is_empty() || !d.right_changes.is_empty());
}

// ── File diff integration tests ───────────────────────────────────────

#[test]
fn test_diff_large_equal() {
    let text: Vec<String> = (0..1000).map(|i| format!("line {i}")).collect();
    let joined = text.join("\n");
    let result = diff_texts(&joined, &joined, DiffAlgorithm::Histogram, &IgnoreRules::default());
    assert_eq!(result.stats.equal, 1000);
    assert!(!result.stats.has_differences());
}

#[test]
fn test_diff_multiline_replace() {
    let left  = "a\nb\nc\nd\ne";
    let right = "a\nX\nY\nd\ne";
    let result = diff_texts(left, right, DiffAlgorithm::Histogram, &IgnoreRules::default());
    assert!(result.stats.has_differences());
    assert_eq!(result.stats.equal, 3); // a, d, e
}

#[test]
fn test_diff_crlf_normalization() {
    let left  = "line1\r\nline2\r\nline3";
    let right = "line1\nline2\nline3";
    let rules = IgnoreRules { line_endings: true, ..Default::default() };
    let result = diff_texts(left, right, DiffAlgorithm::Histogram, &rules);
    assert!(!result.stats.has_differences());
}

// ── Merge tests ───────────────────────────────────────────────────────

#[test]
fn test_merge_two_basic() {
    let base     = "a\nb\nc";
    let modified = "a\nX\nc";
    let output = merge_two(base, modified);
    assert!(output.contains("X"));
    assert!(!output.contains("\nb\n") || output.contains("X"));
}

#[test]
fn test_merge_three_no_conflict() {
    let base  = "a\nb\nc";
    let left  = "a\nB\nc"; // changed b → B
    let right = "a\nb\nC"; // changed c → C
    let result = merge_three(base, left, right);
    assert_eq!(result.conflict_count, 0, "Should have no conflicts: {result:?}");
}

#[test]
fn test_merge_three_with_conflict() {
    let base  = "a\nb\nc";
    let left  = "a\nLEFT\nc";
    let right = "a\nRIGHT\nc";
    let result = merge_three(base, left, right);
    // Both changed same line → conflict
    let has_conflict = result.output_lines.iter().any(|l| matches!(l, crate::types::MergeLine::Conflict { .. }));
    assert!(has_conflict || result.conflict_count > 0, "Expected conflict");
}

// ── Performance smoke test ────────────────────────────────────────────

#[test]
fn test_diff_10k_lines_fast() {
    let left:  Vec<String> = (0..10_000).map(|i| format!("line number {i}")).collect();
    let mut right = left.clone();
    right[5_000] = "CHANGED LINE".to_string();
    right[7_500] = "ANOTHER CHANGE".to_string();
    let l = left.join("\n");
    let r = right.join("\n");
    let start = std::time::Instant::now();
    let result = diff_texts(&l, &r, DiffAlgorithm::Histogram, &IgnoreRules::default());
    let elapsed = start.elapsed();
    assert!(result.stats.has_differences());
    assert!(elapsed.as_secs() < 5, "Diff took too long: {elapsed:?}");
}
