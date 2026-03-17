use crate::algorithm::{myers, patience, histogram};
use crate::char_diff::char_diff;
use crate::ignore::normalize_lines;
use crate::types::*;

/// Main entry point: diff two text strings
pub fn diff_texts(left: &str, right: &str, algorithm: DiffAlgorithm, rules: &IgnoreRules) -> DiffResult {
    let left_lines: Vec<&str> = split_lines(left);
    let right_lines: Vec<&str> = split_lines(right);

    let norm_left = normalize_lines(&left_lines, rules);
    let norm_right = normalize_lines(&right_lines, rules);

    let nl_refs: Vec<&str> = norm_left.iter().map(|s| s.as_str()).collect();
    let nr_refs: Vec<&str> = norm_right.iter().map(|s| s.as_str()).collect();

    let ops = match algorithm {
        DiffAlgorithm::Myers => myers(&nl_refs, &nr_refs),
        DiffAlgorithm::Patience => patience(&nl_refs, &nr_refs),
        DiffAlgorithm::Histogram => histogram(&nl_refs, &nr_refs),
    };

    // Compute intra-line char diffs for Replace ops
    let intra_line: Vec<Option<IntraLineDiff>> = ops.iter().map(|op| {
        if let DiffOp::Replace { left_start, left_count, right_start, right_count } = op {
            // Only do char diff for single-line replacements (more meaningful)
            if *left_count == 1 && *right_count == 1 {
                let l = left_lines.get(*left_start).copied().unwrap_or("");
                let r = right_lines.get(*right_start).copied().unwrap_or("");
                return Some(char_diff(l, r));
            }
        }
        None
    }).collect();

    // Compute stats
    let mut stats = DiffStats {
        total_left: left_lines.len(),
        total_right: right_lines.len(),
        ..Default::default()
    };
    for op in &ops {
        match op {
            DiffOp::Equal { count, .. } => stats.equal += count,
            DiffOp::Delete { count, .. } => stats.deleted += count,
            DiffOp::Insert { count, .. } => stats.added += count,
            DiffOp::Replace { left_count, right_count, .. } => {
                stats.modified += (*left_count).max(*right_count);
            }
        }
    }

    DiffResult {
        left_lines: left_lines.iter().map(|s| s.to_string()).collect(),
        right_lines: right_lines.iter().map(|s| s.to_string()).collect(),
        ops,
        intra_line,
        stats,
        algorithm,
    }
}

fn split_lines(text: &str) -> Vec<&str> {
    if text.is_empty() {
        return vec![];
    }
    // Preserve lines but handle \r\n
    let mut lines = vec![];
    let mut start = 0;
    for (i, c) in text.char_indices() {
        if c == '\n' {
            let end = if i > 0 && text.as_bytes()[i - 1] == b'\r' { i - 1 } else { i };
            lines.push(&text[start..end]);
            start = i + 1;
        }
    }
    if start <= text.len() {
        let last = &text[start..];
        // Don't push trailing empty line if file ends with newline
        if !last.is_empty() || lines.is_empty() {
            lines.push(last);
        }
    }
    lines
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_identical_files() {
        let text = "line1\nline2\nline3";
        let result = diff_texts(text, text, DiffAlgorithm::Histogram, &IgnoreRules::default());
        assert!(!result.stats.has_differences());
        assert_eq!(result.stats.equal, 3);
    }

    #[test]
    fn test_single_line_change() {
        let left = "line1\nline2\nline3";
        let right = "line1\nLINE2\nline3";
        let result = diff_texts(left, right, DiffAlgorithm::Histogram, &IgnoreRules::default());
        assert!(result.stats.has_differences());
        assert_eq!(result.stats.equal, 2);
    }

    #[test]
    fn test_ignore_case() {
        let left = "Hello World\n";
        let right = "hello world\n";
        let rules = IgnoreRules { case: true, ..Default::default() };
        let result = diff_texts(left, right, DiffAlgorithm::Histogram, &rules);
        assert!(!result.stats.has_differences());
    }

    #[test]
    fn test_empty_left() {
        let result = diff_texts("", "line1\nline2", DiffAlgorithm::Histogram, &IgnoreRules::default());
        assert_eq!(result.stats.added, 2);
    }

    #[test]
    fn test_all_algorithms() {
        let left = "a\nb\nc\nd\n";
        let right = "a\nX\nc\nd\n";
        for algo in [DiffAlgorithm::Myers, DiffAlgorithm::Patience, DiffAlgorithm::Histogram] {
            let result = diff_texts(left, right, algo, &IgnoreRules::default());
            assert!(result.stats.has_differences());
        }
    }
}
