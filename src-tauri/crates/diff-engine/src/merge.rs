use crate::algorithm::histogram;
use crate::types::*;

/// Two-way merge: produce output that incorporates changes from left relative to base
pub fn merge_two(base: &str, modified: &str) -> String {
    let base_lines: Vec<&str> = base.lines().collect();
    let mod_lines: Vec<&str> = modified.lines().collect();

    let bl: Vec<&str> = base_lines.iter().copied().collect();
    let ml: Vec<&str> = mod_lines.iter().copied().collect();
    let ops = histogram(&bl, &ml);

    let mut out = vec![];
    for op in &ops {
        match op {
            DiffOp::Equal { left_start, count, .. } => {
                for i in 0..*count {
                    out.push(base_lines[left_start + i].to_string());
                }
            }
            DiffOp::Delete { .. } => {} // remove from base
            DiffOp::Insert { right_start, count } => {
                for i in 0..*count {
                    out.push(mod_lines[right_start + i].to_string());
                }
            }
            DiffOp::Replace { right_start, right_count, .. } => {
                for i in 0..*right_count {
                    out.push(mod_lines[right_start + i].to_string());
                }
            }
        }
    }
    out.join("\n")
}

/// Three-way merge: merge left and right changes relative to base
pub fn merge_three(base: &str, left: &str, right: &str) -> MergeResult {
    let base_lines: Vec<&str> = base.lines().collect();
    let left_lines: Vec<&str> = left.lines().collect();
    let right_lines: Vec<&str> = right.lines().collect();

    let bl: Vec<&str> = base_lines.iter().copied().collect();
    let ll: Vec<&str> = left_lines.iter().copied().collect();
    let rl: Vec<&str> = right_lines.iter().copied().collect();

    let left_ops = histogram(&bl, &ll);
    let right_ops = histogram(&bl, &rl);

    // Build change masks over base lines
    let n = base_lines.len();
    let mut left_changes: Vec<Option<(usize, usize)>> = vec![None; n + 1]; // base_idx -> (left_start, count)
    let mut right_changes: Vec<Option<(usize, usize)>> = vec![None; n + 1];

    for op in &left_ops {
        match op {
            DiffOp::Delete { left_start, count } => {
                left_changes[*left_start] = Some((*left_start, 0));
                let _ = count;
            }
            DiffOp::Replace { left_start, left_count: _, right_start, right_count } => {
                left_changes[*left_start] = Some((*right_start, *right_count));
            }
            DiffOp::Insert { right_start, count } => {
                // Insert before current base position
                if let Some(pos) = find_insert_pos(&left_ops, *right_start) {
                    left_changes[pos] = Some((*right_start, *count));
                }
            }
            _ => {}
        }
    }

    for op in &right_ops {
        match op {
            DiffOp::Replace { left_start, left_count: _, right_start, right_count } => {
                right_changes[*left_start] = Some((*right_start, *right_count));
            }
            DiffOp::Insert { right_start, count } => {
                if let Some(pos) = find_insert_pos(&right_ops, *right_start) {
                    right_changes[pos] = Some((*right_start, *count));
                }
            }
            _ => {}
        }
    }

    // Build output using simple chunk-based approach
    let mut output_lines = vec![];
    let mut conflict_count = 0usize;

    let mut bi = 0;
    while bi <= n {
        let lc = left_changes.get(bi).and_then(|x| *x);
        let rc = right_changes.get(bi).and_then(|x| *x);

        match (lc, rc) {
            (None, None) => {
                if bi < n {
                    output_lines.push(MergeLine::Resolved(base_lines[bi].to_string()));
                }
                bi += 1;
            }
            (Some((ls, lc)), None) => {
                for i in 0..lc {
                    output_lines.push(MergeLine::Resolved(left_lines[ls + i].to_string()));
                }
                bi += 1;
            }
            (None, Some((rs, rc))) => {
                for i in 0..rc {
                    output_lines.push(MergeLine::Resolved(right_lines[rs + i].to_string()));
                }
                bi += 1;
            }
            (Some((ls, lc)), Some((rs, rc))) => {
                // Both changed same area — conflict
                let base_chunk: Vec<String> = if bi < n { vec![base_lines[bi].to_string()] } else { vec![] };
                let left_chunk: Vec<String> = (0..lc).map(|i| left_lines[ls + i].to_string()).collect();
                let right_chunk: Vec<String> = (0..rc).map(|i| right_lines[rs + i].to_string()).collect();

                // If both sides made identical changes, auto-resolve
                if left_chunk == right_chunk {
                    for l in &left_chunk {
                        output_lines.push(MergeLine::Resolved(l.clone()));
                    }
                } else {
                    conflict_count += 1;
                    output_lines.push(MergeLine::Conflict {
                        base: base_chunk,
                        left: left_chunk,
                        right: right_chunk,
                    });
                }
                bi += 1;
            }
        }
    }

    MergeResult { output_lines, conflict_count }
}

fn find_insert_pos(ops: &[DiffOp], right_start: usize) -> Option<usize> {
    let mut base_pos = 0usize;
    let mut right_pos = 0usize;
    for op in ops {
        match op {
            DiffOp::Equal { left_start: _, right_start: rs, count } => {
                if right_start >= *rs && right_start < rs + count {
                    return Some(base_pos + (right_start - rs));
                }
                base_pos += count;
                right_pos += count;
            }
            DiffOp::Delete { count, .. } => { base_pos += count; }
            DiffOp::Insert { right_start: rs, count } => {
                if right_start >= *rs && right_start < rs + count {
                    return Some(base_pos);
                }
                right_pos += count;
            }
            DiffOp::Replace { left_count, right_start: rs, right_count, .. } => {
                if right_start >= *rs && right_start < rs + right_count {
                    return Some(base_pos);
                }
                base_pos += left_count;
                right_pos += right_count;
            }
        }
    }
    None
}
