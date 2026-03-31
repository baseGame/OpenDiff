use crate::types::*;

/// Myers diff algorithm — O(ND) shortest edit script
pub fn myers(left: &[&str], right: &[&str]) -> Vec<DiffOp> {
    if left.is_empty() && right.is_empty() {
        return vec![];
    }
    if left.is_empty() {
        return vec![DiffOp::Insert { right_start: 0, count: right.len() }];
    }
    if right.is_empty() {
        return vec![DiffOp::Delete { left_start: 0, count: left.len() }];
    }

    let n = left.len();
    let m = right.len();
    let max_d = n + m;
    let size = 2 * max_d + 1;
    let mut v: Vec<isize> = vec![0; size];
    let offset = max_d as isize;
    let mut trace: Vec<Vec<isize>> = vec![];

    'outer: for d in 0..=max_d as isize {
        trace.push(v.clone());
        let mut k = -d;
        while k <= d {
            let ki = (k + offset) as usize;
            let mut x = if k == -d || (k != d && v[ki - 1] < v[ki + 1]) {
                v[ki + 1]
            } else {
                v[ki - 1] + 1
            };
            let mut y = x - k;
            while x < n as isize && y < m as isize && left[x as usize] == right[y as usize] {
                x += 1;
                y += 1;
            }
            v[ki] = x;
            if x >= n as isize && y >= m as isize {
                break 'outer;
            }
            k += 2;
        }
    }

    // Backtrack
    let mut ops = vec![];
    let mut x = n as isize;
    let mut y = m as isize;

    for (d, snapshot) in trace.iter().enumerate().rev() {
        let d = d as isize;
        let k = x - y;
        let _ki = (k + offset) as usize;

        let prev_k = if k == -d || (k != d && snapshot[(k - 1 + offset) as usize] < snapshot[(k + 1 + offset) as usize]) {
            k + 1
        } else {
            k - 1
        };
        let prev_x = snapshot[(prev_k + offset) as usize];
        let prev_y = prev_x - prev_k;

        // Snake (equal lines)
        while x > prev_x + 1 && y > prev_y + 1 {
            x -= 1;
            y -= 1;
            push_equal(&mut ops, x as usize, y as usize);
        }

        if d > 0 {
            if x == prev_x + 1 {
                // Delete from left
                x -= 1;
                push_delete(&mut ops, x as usize);
            } else {
                // Insert from right
                y -= 1;
                push_insert(&mut ops, y as usize);
            }
        }

        // More snake
        while x > prev_x && y > prev_y {
            x -= 1;
            y -= 1;
            push_equal(&mut ops, x as usize, y as usize);
        }
    }

    ops.reverse();
    merge_ops(ops)
}

/// Histogram diff — better than Myers for code, faster than Patience
pub fn histogram(left: &[&str], right: &[&str]) -> Vec<DiffOp> {
    histogram_range(left, right, 0, 0)
}

fn histogram_range(left: &[&str], right: &[&str], left_off: usize, right_off: usize) -> Vec<DiffOp> {
    // Trim common prefix
    let common_prefix = left.iter().zip(right.iter()).take_while(|(a, b)| a == b).count();
    let left = &left[common_prefix..];
    let right = &right[common_prefix..];
    let lo = left_off + common_prefix;
    let ro = right_off + common_prefix;

    // Trim common suffix
    let common_suffix = left.iter().rev().zip(right.iter().rev()).take_while(|(a, b)| a == b).count();
    let left = &left[..left.len() - common_suffix];
    let right = &right[..right.len() - common_suffix];

    let mut result = vec![];

    if common_prefix > 0 {
        result.push(DiffOp::Equal {
            left_start: left_off,
            right_start: right_off,
            count: common_prefix,
        });
    }

    if left.is_empty() && right.is_empty() {
        // nothing
    } else if left.is_empty() {
        result.push(DiffOp::Insert { right_start: ro, count: right.len() });
    } else if right.is_empty() {
        result.push(DiffOp::Delete { left_start: lo, count: left.len() });
    } else {
        // Build histogram of right side
        let mut right_hist: std::collections::HashMap<&str, Vec<usize>> =
            std::collections::HashMap::new();
        for (i, line) in right.iter().enumerate() {
            right_hist.entry(line).or_default().push(i);
        }

        // Find best anchor: line in left that appears least in right (unique first)
        let mut best: Option<(usize, usize, usize)> = None; // (left_idx, right_idx, count)
        for (li, line) in left.iter().enumerate() {
            if let Some(right_positions) = right_hist.get(line) {
                let cnt = right_positions.len();
                if best.is_none() || cnt < best.unwrap().2 {
                    // pick first occurrence in right
                    best = Some((li, right_positions[0], cnt));
                    if cnt == 1 {
                        break;
                    }
                }
            }
        }

        if let Some((li, ri, _)) = best {
            // Recurse on left side of anchor
            let left_sub = histogram_range(&left[..li], &right[..ri], lo, ro);
            result.extend(left_sub);

            // The anchor line itself
            result.push(DiffOp::Equal {
                left_start: lo + li,
                right_start: ro + ri,
                count: 1,
            });

            // Recurse on right side of anchor
            let right_sub = histogram_range(
                &left[li + 1..],
                &right[ri + 1..],
                lo + li + 1,
                ro + ri + 1,
            );
            result.extend(right_sub);
        } else {
            // No common lines found — fall back to replace
            result.push(DiffOp::Replace {
                left_start: lo,
                left_count: left.len(),
                right_start: ro,
                right_count: right.len(),
            });
        }
    }

    if common_suffix > 0 {
        result.push(DiffOp::Equal {
            left_start: lo + left.len(),
            right_start: ro + right.len(),
            count: common_suffix,
        });
    }

    result
}

/// Patience diff — aligns unique lines first
pub fn patience(left: &[&str], right: &[&str]) -> Vec<DiffOp> {
    // Find unique lines in both sides
    let mut left_count: std::collections::HashMap<&str, usize> = std::collections::HashMap::new();
    let mut right_count: std::collections::HashMap<&str, usize> = std::collections::HashMap::new();
    for line in left { *left_count.entry(line).or_insert(0) += 1; }
    for line in right { *right_count.entry(line).or_insert(0) += 1; }

    // Unique anchors: appear exactly once in both
    let left_unique: Vec<(usize, &str)> = left.iter().enumerate()
        .filter(|(_, l)| left_count.get(*l).copied().unwrap_or(0) == 1 && right_count.get(*l).copied().unwrap_or(0) == 1)
        .map(|(i, l)| (i, *l))
        .collect();
    let right_unique: Vec<(usize, &str)> = right.iter().enumerate()
        .filter(|(_, r)| right_count.get(*r).copied().unwrap_or(0) == 1 && left_count.get(*r).copied().unwrap_or(0) == 1)
        .map(|(i, r)| (i, *r))
        .collect();

    if left_unique.is_empty() || right_unique.is_empty() {
        // Fall back to histogram
        return histogram(left, right);
    }

    // Match unique anchors and recurse between them
    let mut ops = vec![];
    let mut prev_l = 0usize;
    let mut prev_r = 0usize;

    // Build right_index for unique lines
    let right_idx: std::collections::HashMap<&str, usize> =
        right_unique.iter().map(|(i, l)| (*l, *i)).collect();

    // LCS of unique anchors
    let anchors: Vec<(usize, usize)> = left_unique.iter()
        .filter_map(|(li, l)| right_idx.get(l).map(|ri| (*li, *ri)))
        .collect();

    let lcs_anchors = lcs_anchors(&anchors);

    for (li, ri) in &lcs_anchors {
        // Between previous anchor and this one
        let sub = histogram(&left[prev_l..*li], &right[prev_r..*ri]);
        for op in sub { ops.push(offset_op(op, prev_l, prev_r)); }

        ops.push(DiffOp::Equal { left_start: *li, right_start: *ri, count: 1 });
        prev_l = li + 1;
        prev_r = ri + 1;
    }

    // After last anchor
    let sub = histogram(&left[prev_l..], &right[prev_r..]);
    for op in sub { ops.push(offset_op(op, prev_l, prev_r)); }

    merge_ops(ops)
}

fn lcs_anchors(pairs: &[(usize, usize)]) -> Vec<(usize, usize)> {
    // LCS by right index (patience sorting)
    let mut tails: Vec<(usize, usize)> = vec![];
    let mut predecessors: Vec<Option<usize>> = vec![];
    let mut indices: Vec<usize> = vec![];

    for &(li, ri) in pairs {
        let pos = tails.partition_point(|&(_, r)| r < ri);
        if pos == tails.len() {
            tails.push((li, ri));
        } else {
            tails[pos] = (li, ri);
        }
        predecessors.push(if pos > 0 { Some(indices[pos - 1]) } else { None });
        if pos < indices.len() {
            indices[pos] = predecessors.len() - 1;
        } else {
            indices.push(predecessors.len() - 1);
        }
    }

    // Backtrack
    let result = vec![];
    if indices.is_empty() { return result; }
    let idx = Some(indices[indices.len() - 1]);
    while let Some(i) = idx {
        // find pair at index i
        // we need to re-trace — simplified: just return pairs as-is for now
        // (full implementation would store the pair at each step)
        let _ = i;
        break;
    }

    // Simplified: return sorted subset that forms increasing sequence in both dims
    let mut res: Vec<(usize, usize)> = vec![];
    for &(li, ri) in pairs {
        if res.is_empty() || (li > res.last().unwrap().0 && ri > res.last().unwrap().1) {
            res.push((li, ri));
        }
    }
    res
}

fn offset_op(op: DiffOp, lo: usize, ro: usize) -> DiffOp {
    match op {
        DiffOp::Equal { left_start, right_start, count } =>
            DiffOp::Equal { left_start: left_start + lo, right_start: right_start + ro, count },
        DiffOp::Delete { left_start, count } =>
            DiffOp::Delete { left_start: left_start + lo, count },
        DiffOp::Insert { right_start, count } =>
            DiffOp::Insert { right_start: right_start + ro, count },
        DiffOp::Replace { left_start, left_count, right_start, right_count } =>
            DiffOp::Replace { left_start: left_start + lo, left_count, right_start: right_start + ro, right_count },
    }
}

fn push_equal(ops: &mut Vec<DiffOp>, x: usize, y: usize) {
    if let Some(DiffOp::Equal { left_start, right_start, count }) = ops.last_mut() {
        if *left_start + *count == x && *right_start + *count == y {
            *count += 1;
            return;
        }
    }
    ops.push(DiffOp::Equal { left_start: x, right_start: y, count: 1 });
}

fn push_delete(ops: &mut Vec<DiffOp>, x: usize) {
    if let Some(DiffOp::Delete { left_start, count }) = ops.last_mut() {
        if *left_start + *count == x {
            *count += 1;
            return;
        }
    }
    ops.push(DiffOp::Delete { left_start: x, count: 1 });
}

fn push_insert(ops: &mut Vec<DiffOp>, y: usize) {
    if let Some(DiffOp::Insert { right_start, count }) = ops.last_mut() {
        if *right_start + *count == y {
            *count += 1;
            return;
        }
    }
    ops.push(DiffOp::Insert { right_start: y, count: 1 });
}

/// Merge adjacent Delete+Insert into Replace
pub fn merge_ops(ops: Vec<DiffOp>) -> Vec<DiffOp> {
    let mut result: Vec<DiffOp> = vec![];
    for op in ops {
        match (result.last_mut(), &op) {
            (
                Some(DiffOp::Delete { left_start, count: lc }),
                DiffOp::Insert { right_start, count: rc },
            ) => {
                let ls = *left_start;
                let lc = *lc;
                let rs = *right_start;
                let rc = *rc;
                result.pop();
                result.push(DiffOp::Replace {
                    left_start: ls, left_count: lc,
                    right_start: rs, right_count: rc,
                });
            }
            _ => result.push(op),
        }
    }
    result
}
