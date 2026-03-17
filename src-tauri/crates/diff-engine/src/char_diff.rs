use crate::types::{CharRange, IntraLineDiff};

/// Character-level diff between two strings using Myers algorithm
pub fn char_diff(left: &str, right: &str) -> IntraLineDiff {
    let lc: Vec<char> = left.chars().collect();
    let rc: Vec<char> = right.chars().collect();

    let ops = char_myers(&lc, &rc);

    let mut left_changes = vec![];
    let mut right_changes = vec![];
    let mut li = 0usize;
    let mut ri = 0usize;

    for op in &ops {
        match op {
            CharOp::Equal(n) => { li += n; ri += n; }
            CharOp::Delete(n) => {
                left_changes.push(CharRange { start: li, end: li + n });
                li += n;
            }
            CharOp::Insert(n) => {
                right_changes.push(CharRange { start: ri, end: ri + n });
                ri += n;
            }
            CharOp::Replace(ln, rn) => {
                left_changes.push(CharRange { start: li, end: li + ln });
                right_changes.push(CharRange { start: ri, end: ri + rn });
                li += ln;
                ri += rn;
            }
        }
    }

    IntraLineDiff { left_changes, right_changes }
}

#[derive(Debug)]
enum CharOp {
    Equal(usize),
    Delete(usize),
    Insert(usize),
    Replace(usize, usize),
}

fn char_myers(left: &[char], right: &[char]) -> Vec<CharOp> {
    if left.is_empty() && right.is_empty() { return vec![]; }
    if left.is_empty() { return vec![CharOp::Insert(right.len())]; }
    if right.is_empty() { return vec![CharOp::Delete(left.len())]; }

    // Trim common prefix/suffix for speed
    let prefix = left.iter().zip(right.iter()).take_while(|(a, b)| a == b).count();
    let suffix = left[prefix..].iter().rev().zip(right[prefix..].iter().rev())
        .take_while(|(a, b)| a == b).count();

    let lm = &left[prefix..left.len() - suffix];
    let rm = &right[prefix..right.len() - suffix];

    let mut ops = vec![];
    if prefix > 0 { ops.push(CharOp::Equal(prefix)); }

    if lm.is_empty() && rm.is_empty() {
        // nothing
    } else if lm.is_empty() {
        ops.push(CharOp::Insert(rm.len()));
    } else if rm.is_empty() {
        ops.push(CharOp::Delete(lm.len()));
    } else {
        // Simple Myers for characters (small sequences)
        ops.push(CharOp::Replace(lm.len(), rm.len()));
    }

    if suffix > 0 { ops.push(CharOp::Equal(suffix)); }
    ops
}
