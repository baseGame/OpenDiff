//! Three-way text merge using Myers diff
use crate::algorithm::myers;
use crate::types::{DiffOp, MergeLine, MergeResult};

/// Two-way merge (left wins on conflict — for internal use)
pub fn merge_two(left: &str, right: &str) -> MergeResult {
    let left_lines: Vec<&str> = split_lines(left);
    let right_lines: Vec<&str> = split_lines(right);
    let ops = myers(
        &left_lines.iter().map(|s| *s).collect::<Vec<_>>(),
        &right_lines.iter().map(|s| *s).collect::<Vec<_>>(),
    );
    build_merge_output(&left_lines, &right_lines, &ops)
}

/// Three-way merge: base + left + right → output with conflicts
pub fn merge_three(base: &str, left: &str, right: &str) -> MergeResult {
    let base_lines = split_lines(base);
    let left_lines = split_lines(left);
    let right_lines = split_lines(right);

    let ops_l = myers(
        &base_lines.iter().map(|s| *s).collect::<Vec<_>>(),
        &left_lines.iter().map(|s| *s).collect::<Vec<_>>(),
    );
    let ops_r = myers(
        &base_lines.iter().map(|s| *s).collect::<Vec<_>>(),
        &right_lines.iter().map(|s| *s).collect::<Vec<_>>(),
    );

    let base_to_left  = build_line_map(&ops_l);
    let base_to_right = build_line_map(&ops_r);

    let mut output: Vec<MergeLine> = Vec::new();
    let mut conflict_count = 0usize;

    for (base_i, base_line) in base_lines.iter().enumerate() {
        let l_idx = base_to_left.get(&base_i).copied();
        let r_idx = base_to_right.get(&base_i).copied();

        match (l_idx, r_idx) {
            (Some(li), Some(ri)) => {
                let l_text = left_lines[li].to_string();
                let r_text = right_lines[ri].to_string();
                if l_text == r_text {
                    output.push(MergeLine::Resolved(l_text));
                } else {
                    output.push(MergeLine::Conflict {
                        base: vec![(*base_line).to_string()],
                        left: vec![l_text],
                        right: vec![r_text],
                    });
                    conflict_count += 1;
                }
            }
            (Some(li), None) => {
                output.push(MergeLine::Resolved(left_lines[li].to_string()));
            }
            (None, Some(ri)) => {
                output.push(MergeLine::Resolved(right_lines[ri].to_string()));
            }
            (None, None) => {
                output.push(MergeLine::Resolved((*base_line).to_string()));
            }
        }
    }

    MergeResult { output_lines: output, conflict_count }
}

fn build_line_map(ops: &[DiffOp]) -> std::collections::HashMap<usize, usize> {
    let mut map = std::collections::HashMap::new();
    let mut base_idx = 0usize;
    let mut other_idx = 0usize;
    for op in ops {
        match op {
            DiffOp::Equal { left_start, right_start, count } => {
                for i in 0..*count {
                    map.insert(base_idx + i, right_start + i);
                }
                base_idx = *left_start + count;
                other_idx = *right_start + count;
            }
            DiffOp::Delete { left_start, count } => {
                base_idx = *left_start + count;
            }
            DiffOp::Insert { right_start, count } => {
                other_idx = *right_start + count;
            }
            DiffOp::Replace { left_start, left_count, right_start, right_count } => {
                base_idx = *left_start + left_count;
                other_idx = *right_start + right_count;
            }
        }
    }
    map
}

fn split_lines(text: &str) -> Vec<&str> {
    if text.is_empty() { return vec![]; }
    let mut lines = vec![];
    let mut start = 0;
    for (i, c) in text.char_indices() {
        if c == '\n' {
            let end = if i > 0 && text.as_bytes()[i - 1] == b'\r' { i - 1 } else { i };
            lines.push(&text[start..end]);
            start = i + 1;
        }
    }
    if start <= text.len() { lines.push(&text[start..]); }
    lines
}

fn build_merge_output(
    left_lines: &[&str],
    right_lines: &[&str],
    ops: &[DiffOp],
) -> MergeResult {
    let mut output: Vec<MergeLine> = Vec::new();
    let mut conflict_count = 0usize;
    for op in ops {
        match op {
            DiffOp::Equal { left_start, right_start, count } => {
                for i in 0..*count {
                    output.push(MergeLine::Resolved(left_lines[*left_start + i].to_string()));
                }
            }
            DiffOp::Delete { left_start, count } => {
                for i in 0..*count {
                    output.push(MergeLine::Resolved(left_lines[*left_start + i].to_string()));
                }
            }
            DiffOp::Insert { right_start, count } => {
                for i in 0..*count {
                    output.push(MergeLine::Resolved(right_lines[*right_start + i].to_string()));
                }
            }
            DiffOp::Replace { left_start, left_count, right_start, right_count } => {
                let l_end = *left_start + left_count;
                let r_end = *right_start + right_count;
                let left_block: Vec<_>  = left_lines[*left_start..l_end].iter().map(|s| (*s).to_string()).collect();
                let right_block: Vec<_> = right_lines[*right_start..r_end].iter().map(|s| (*s).to_string()).collect();
                if left_block == right_block {
                    for line in left_block { output.push(MergeLine::Resolved(line)); }
                } else {
                    output.push(MergeLine::Conflict { base: vec![], left: left_block, right: right_block });
                    conflict_count += 1;
                }
            }
        }
    }
    MergeResult { output_lines: output, conflict_count }
}
