use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum TextMergeRole {
    Base,
    Left,
    Right,
    Output,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TextMergeSide {
    pub role: TextMergeRole,
    pub path: Option<String>,
    pub text: String,
    pub lines: Vec<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TextMergeInput {
    pub base: TextMergeSide,
    pub left: TextMergeSide,
    pub right: TextMergeSide,
    pub output_path: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TextMergeDocument {
    pub base: TextMergeSide,
    pub left: TextMergeSide,
    pub right: TextMergeSide,
    pub output: TextMergeSide,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TextMergeResult {
    pub output_text: String,
    pub conflicts: usize,
    pub sections: Vec<TextMergeSection>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TextMergeOptions {
    pub conflict_policy: TextMergeConflictPolicy,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum TextMergeConflictPolicy {
    MarkConflict,
    FavorLeft,
    FavorRight,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TextMergeSection {
    pub line_index: usize,
    pub kind: TextMergeSectionKind,
    pub output: Vec<String>,
    pub conflict: Option<TextMergeConflict>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TextMergeConflict {
    pub base: Vec<String>,
    pub left: Vec<String>,
    pub right: Vec<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum TextMergeSectionKind {
    Unchanged,
    AcceptedLeft,
    AcceptedRight,
    Conflict,
}

#[derive(Debug, Clone, PartialEq, Eq)]
struct Hunk {
    base_start: usize,
    base_end: usize,
    result: Vec<String>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
enum Edit {
    Equal {
        left_index: usize,
        right_index: usize,
    },
    Delete {
        left_index: usize,
    },
    Add {
        right_index: usize,
    },
}

impl TextMergeSide {
    pub fn new(path: impl Into<String>, text: impl Into<String>) -> Self {
        let text = text.into();

        Self {
            role: TextMergeRole::Base,
            path: Some(path.into()),
            lines: split_lines(&text),
            text,
        }
    }

    fn with_role(mut self, role: TextMergeRole) -> Self {
        self.role = role;
        self
    }
}

impl TextMergeDocument {
    pub fn from_inputs(input: TextMergeInput) -> Self {
        let base = input.base.with_role(TextMergeRole::Base);
        let output_text = base.text.clone();

        Self {
            left: input.left.with_role(TextMergeRole::Left),
            right: input.right.with_role(TextMergeRole::Right),
            output: TextMergeSide {
                role: TextMergeRole::Output,
                path: input.output_path,
                lines: split_lines(&output_text),
                text: output_text,
            },
            base,
        }
    }
}

impl Default for TextMergeOptions {
    fn default() -> Self {
        Self {
            conflict_policy: TextMergeConflictPolicy::MarkConflict,
        }
    }
}

pub fn auto_merge_text(document: &TextMergeDocument) -> TextMergeResult {
    auto_merge_text_with_options(document, TextMergeOptions::default())
}

pub fn auto_merge_text_with_options(
    document: &TextMergeDocument,
    options: TextMergeOptions,
) -> TextMergeResult {
    let base = &document.base.lines;
    let left_hunks = change_hunks(base, &document.left.lines);
    let right_hunks = change_hunks(base, &document.right.lines);
    let mut sections = Vec::new();
    let mut output_lines = Vec::new();
    let mut conflicts = 0usize;
    let mut base_pos = 0usize;
    let mut left_index = 0usize;
    let mut right_index = 0usize;

    while left_index < left_hunks.len() || right_index < right_hunks.len() {
        let left = left_hunks.get(left_index);
        let right = right_hunks.get(right_index);
        let next_start = match (left, right) {
            (Some(left_hunk), Some(right_hunk)) => left_hunk.base_start.min(right_hunk.base_start),
            (Some(left_hunk), None) => left_hunk.base_start,
            (None, Some(right_hunk)) => right_hunk.base_start,
            (None, None) => break,
        };

        push_unchanged(base, base_pos, next_start, &mut output_lines, &mut sections);

        let (region_start, region_end, saw_left, saw_right, next_left, next_right) =
            next_region(&left_hunks, &right_hunks, left_index, right_index);
        let base_slice = base[region_start..region_end.min(base.len())].to_vec();
        left_index = next_left;
        right_index = next_right;

        let left_changed = saw_left;
        let right_changed = saw_right;
        let left_lines = if saw_left {
            reconstruct_side_span(base, &left_hunks, region_start, region_end)
        } else {
            base_slice.clone()
        };
        let right_lines = if saw_right {
            reconstruct_side_span(base, &right_hunks, region_start, region_end)
        } else {
            base_slice.clone()
        };

        match (left_changed, right_changed) {
            (false, false) => {}
            (true, false) => {
                push_section(
                    TextMergeSectionKind::AcceptedLeft,
                    left_lines,
                    None,
                    &mut output_lines,
                    &mut sections,
                );
            }
            (false, true) => {
                push_section(
                    TextMergeSectionKind::AcceptedRight,
                    right_lines,
                    None,
                    &mut output_lines,
                    &mut sections,
                );
            }
            (true, true) if left_lines == right_lines => {
                push_section(
                    TextMergeSectionKind::AcceptedLeft,
                    left_lines,
                    None,
                    &mut output_lines,
                    &mut sections,
                );
            }
            (true, true) if options.conflict_policy == TextMergeConflictPolicy::FavorLeft => {
                push_section(
                    TextMergeSectionKind::AcceptedLeft,
                    left_lines,
                    None,
                    &mut output_lines,
                    &mut sections,
                );
            }
            (true, true) if options.conflict_policy == TextMergeConflictPolicy::FavorRight => {
                push_section(
                    TextMergeSectionKind::AcceptedRight,
                    right_lines,
                    None,
                    &mut output_lines,
                    &mut sections,
                );
            }
            (true, true) => {
                conflicts += 1;
                let conflict = TextMergeConflict {
                    base: base_slice.clone(),
                    left: left_lines.clone(),
                    right: right_lines.clone(),
                };
                let marker_output = conflict_marker_lines(&conflict);
                push_section(
                    TextMergeSectionKind::Conflict,
                    marker_output,
                    Some(conflict),
                    &mut output_lines,
                    &mut sections,
                );
            }
        }

        base_pos = region_end;
    }

    push_unchanged(base, base_pos, base.len(), &mut output_lines, &mut sections);

    TextMergeResult {
        output_text: output_lines.join("\n"),
        conflicts,
        sections,
    }
}

fn next_region(
    left_hunks: &[Hunk],
    right_hunks: &[Hunk],
    mut left_index: usize,
    mut right_index: usize,
) -> (usize, usize, bool, bool, usize, usize) {
    let left = left_hunks.get(left_index);
    let right = right_hunks.get(right_index);

    match (left, right) {
        (Some(left_hunk), Some(right_hunk)) if ranges_overlap(left_hunk, right_hunk) => {
            let mut region_start = left_hunk.base_start.min(right_hunk.base_start);
            let mut region_end = left_hunk.base_end.max(right_hunk.base_end);
            let mut saw_left = false;
            let mut saw_right = false;
            let mut expanded = true;

            while expanded {
                expanded = false;
                while left_index < left_hunks.len()
                    && hunk_touches_region(&left_hunks[left_index], region_start, region_end)
                {
                    let hunk = &left_hunks[left_index];
                    region_start = region_start.min(hunk.base_start);
                    region_end = region_end.max(hunk.base_end);
                    saw_left = true;
                    left_index += 1;
                    expanded = true;
                }
                while right_index < right_hunks.len()
                    && hunk_touches_region(&right_hunks[right_index], region_start, region_end)
                {
                    let hunk = &right_hunks[right_index];
                    region_start = region_start.min(hunk.base_start);
                    region_end = region_end.max(hunk.base_end);
                    saw_right = true;
                    right_index += 1;
                    expanded = true;
                }
            }

            (
                region_start,
                region_end,
                saw_left,
                saw_right,
                left_index,
                right_index,
            )
        }
        (Some(left_hunk), Some(right_hunk)) if left_hunk.base_start <= right_hunk.base_start => (
            left_hunk.base_start,
            left_hunk.base_end,
            true,
            false,
            left_index + 1,
            right_index,
        ),
        (Some(_), Some(right_hunk)) => (
            right_hunk.base_start,
            right_hunk.base_end,
            false,
            true,
            left_index,
            right_index + 1,
        ),
        (Some(left_hunk), None) => (
            left_hunk.base_start,
            left_hunk.base_end,
            true,
            false,
            left_index + 1,
            right_index,
        ),
        (None, Some(right_hunk)) => (
            right_hunk.base_start,
            right_hunk.base_end,
            false,
            true,
            left_index,
            right_index + 1,
        ),
        (None, None) => (0, 0, false, false, left_index, right_index),
    }
}

fn hunk_touches_region(hunk: &Hunk, region_start: usize, region_end: usize) -> bool {
    hunk.base_start < region_end && region_start < hunk.base_end
        || (hunk.base_start == region_start
            && hunk.base_end == hunk.base_start
            && region_end == region_start)
}

fn reconstruct_side_span(
    base: &[String],
    hunks: &[Hunk],
    region_start: usize,
    region_end: usize,
) -> Vec<String> {
    let mut output = Vec::new();
    let mut cursor = region_start;

    for hunk in hunks {
        if hunk.base_end < region_start || hunk.base_start > region_end {
            continue;
        }
        if hunk.base_start > region_end {
            break;
        }
        if !hunk_touches_region(hunk, region_start, region_end)
            && !(hunk.base_start == region_start && hunk.base_end == region_start)
        {
            continue;
        }

        let copy_end = hunk.base_start.min(region_end).max(cursor);
        if cursor < copy_end {
            output.extend(base[cursor..copy_end].iter().cloned());
        }
        if hunk.base_start >= region_start && hunk.base_start <= region_end {
            output.extend(hunk.result.iter().cloned());
        }
        cursor = hunk.base_end.max(cursor);
    }

    if cursor < region_end {
        output.extend(base[cursor..region_end.min(base.len())].iter().cloned());
    }

    output
}

fn ranges_overlap(left: &Hunk, right: &Hunk) -> bool {
    left.base_start < right.base_end && right.base_start < left.base_end
        || (left.base_start == right.base_start
            && left.base_end == left.base_start
            && right.base_end == right.base_start)
}

fn push_unchanged(
    base: &[String],
    start: usize,
    end: usize,
    output_lines: &mut Vec<String>,
    sections: &mut Vec<TextMergeSection>,
) {
    if start >= end || start >= base.len() {
        return;
    }

    let end = end.min(base.len());
    let output = base[start..end].to_vec();
    push_section(
        TextMergeSectionKind::Unchanged,
        output,
        None,
        output_lines,
        sections,
    );
}

fn push_section(
    kind: TextMergeSectionKind,
    output: Vec<String>,
    conflict: Option<TextMergeConflict>,
    output_lines: &mut Vec<String>,
    sections: &mut Vec<TextMergeSection>,
) {
    let line_index = output_lines.len();
    output_lines.extend(output.iter().cloned());
    sections.push(TextMergeSection {
        line_index,
        kind,
        output,
        conflict,
    });
}

fn conflict_marker_lines(conflict: &TextMergeConflict) -> Vec<String> {
    let mut lines =
        Vec::with_capacity(conflict.left.len() + conflict.right.len() + conflict.base.len() + 4);
    lines.push("<<<<<<< Left".to_owned());
    lines.extend(conflict.left.iter().cloned());
    lines.push("||||||| Base".to_owned());
    lines.extend(conflict.base.iter().cloned());
    lines.push("=======".to_owned());
    lines.extend(conflict.right.iter().cloned());
    lines.push(">>>>>>> Right".to_owned());
    lines
}

fn change_hunks(base: &[String], side: &[String]) -> Vec<Hunk> {
    let edits = diff_edits(base, side);
    let mut hunks = Vec::new();
    let mut pending: Option<Hunk> = None;
    let mut base_at = 0usize;

    for edit in edits {
        match edit {
            Edit::Equal { left_index, .. } => {
                if let Some(hunk) = pending.take() {
                    hunks.push(hunk);
                }
                base_at = left_index + 1;
            }
            Edit::Delete { left_index } => {
                let hunk = pending.get_or_insert_with(|| Hunk {
                    base_start: left_index,
                    base_end: left_index,
                    result: Vec::new(),
                });
                hunk.base_end = left_index + 1;
                base_at = left_index + 1;
            }
            Edit::Add { right_index } => {
                let hunk = pending.get_or_insert_with(|| Hunk {
                    base_start: base_at,
                    base_end: base_at,
                    result: Vec::new(),
                });
                hunk.result.push(side[right_index].clone());
            }
        }
    }

    if let Some(hunk) = pending {
        hunks.push(hunk);
    }

    hunks
}

fn diff_edits(left_lines: &[String], right_lines: &[String]) -> Vec<Edit> {
    let table = lcs_table(left_lines, right_lines);
    let mut edits = Vec::new();
    let mut left_index = 0usize;
    let mut right_index = 0usize;

    while left_index < left_lines.len() && right_index < right_lines.len() {
        if left_lines[left_index] == right_lines[right_index] {
            edits.push(Edit::Equal {
                left_index,
                right_index,
            });
            left_index += 1;
            right_index += 1;
            continue;
        }

        if table[left_index + 1][right_index] >= table[left_index][right_index + 1] {
            edits.push(Edit::Delete { left_index });
            left_index += 1;
        } else {
            edits.push(Edit::Add { right_index });
            right_index += 1;
        }
    }

    while left_index < left_lines.len() {
        edits.push(Edit::Delete { left_index });
        left_index += 1;
    }

    while right_index < right_lines.len() {
        edits.push(Edit::Add { right_index });
        right_index += 1;
    }

    edits
}

fn lcs_table(left_lines: &[String], right_lines: &[String]) -> Vec<Vec<usize>> {
    let mut table = vec![vec![0usize; right_lines.len() + 1]; left_lines.len() + 1];

    for left_index in (0..left_lines.len()).rev() {
        for right_index in (0..right_lines.len()).rev() {
            table[left_index][right_index] = if left_lines[left_index] == right_lines[right_index] {
                table[left_index + 1][right_index + 1] + 1
            } else {
                table[left_index + 1][right_index].max(table[left_index][right_index + 1])
            };
        }
    }

    table
}

fn split_lines(input: &str) -> Vec<String> {
    if input.is_empty() {
        return Vec::new();
    }

    input
        .replace("\r\n", "\n")
        .replace('\r', "\n")
        .trim_end_matches('\n')
        .split('\n')
        .map(ToOwned::to_owned)
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn builds_three_way_text_merge_document_with_output() {
        let document = TextMergeDocument::from_inputs(TextMergeInput {
            base: TextMergeSide::new("base.txt", "one\ntwo\n"),
            left: TextMergeSide::new("left.txt", "one\nleft\n"),
            right: TextMergeSide::new("right.txt", "one\nright\n"),
            output_path: Some("merged.txt".to_owned()),
        });

        assert_eq!(document.base.role, TextMergeRole::Base);
        assert_eq!(document.left.role, TextMergeRole::Left);
        assert_eq!(document.right.role, TextMergeRole::Right);
        assert_eq!(document.output.role, TextMergeRole::Output);
        assert_eq!(document.output.path.as_deref(), Some("merged.txt"));
        assert_eq!(document.output.text, "one\ntwo\n");
        assert_eq!(
            document.base.lines,
            vec!["one".to_owned(), "two".to_owned()]
        );
        assert_eq!(
            document.left.lines,
            vec!["one".to_owned(), "left".to_owned()]
        );
        assert_eq!(
            document.right.lines,
            vec!["one".to_owned(), "right".to_owned()]
        );
    }

    #[test]
    fn builds_text_merge_document_without_output_path() {
        let document = TextMergeDocument::from_inputs(TextMergeInput {
            base: TextMergeSide::new("base.txt", "base"),
            left: TextMergeSide::new("left.txt", "left"),
            right: TextMergeSide::new("right.txt", "right"),
            output_path: None,
        });

        assert_eq!(document.output.path, None);
        assert_eq!(document.output.text, "base");
        assert_eq!(document.output.lines, vec!["base".to_owned()]);
    }

    #[test]
    fn automatically_merges_non_overlapping_left_and_right_changes() {
        let document = TextMergeDocument::from_inputs(TextMergeInput {
            base: TextMergeSide::new("base.txt", "one\ntwo\nthree"),
            left: TextMergeSide::new("left.txt", "ONE\ntwo\nthree"),
            right: TextMergeSide::new("right.txt", "one\ntwo\nTHREE"),
            output_path: Some("merged.txt".to_owned()),
        });

        let result = auto_merge_text(&document);

        assert_eq!(result.conflicts, 0);
        assert_eq!(result.output_text, "ONE\ntwo\nTHREE");
        assert_eq!(result.sections[0].kind, TextMergeSectionKind::AcceptedLeft);
        assert_eq!(result.sections[1].kind, TextMergeSectionKind::Unchanged);
        assert_eq!(result.sections[2].kind, TextMergeSectionKind::AcceptedRight);
    }

    #[test]
    fn merges_shifted_insertions_without_false_conflicts() {
        let document = TextMergeDocument::from_inputs(TextMergeInput {
            base: TextMergeSide::new("base.txt", "A\nB\nC"),
            left: TextMergeSide::new("left.txt", "A\nX\nB\nC"),
            right: TextMergeSide::new("right.txt", "A\nB\nY\nC"),
            output_path: None,
        });

        let result = auto_merge_text(&document);

        assert_eq!(result.conflicts, 0);
        assert_eq!(result.output_text, "A\nX\nB\nY\nC");
    }

    #[test]
    fn detects_conflict_sections_with_diff3_markers() {
        let document = TextMergeDocument::from_inputs(TextMergeInput {
            base: TextMergeSide::new("base.txt", "one\ntwo\nthree"),
            left: TextMergeSide::new("left.txt", "one\nleft change\nthree"),
            right: TextMergeSide::new("right.txt", "one\nright change\nthree"),
            output_path: None,
        });

        let result = auto_merge_text(&document);

        assert_eq!(result.conflicts, 1);
        assert!(result.output_text.contains("<<<<<<< Left"));
        assert!(result.output_text.contains("left change"));
        assert!(result.output_text.contains("right change"));
        assert!(result.output_text.contains(">>>>>>> Right"));
        assert_eq!(
            result.sections[1].conflict,
            Some(TextMergeConflict {
                base: vec!["two".to_owned()],
                left: vec!["left change".to_owned()],
                right: vec!["right change".to_owned()],
            })
        );
    }

    #[test]
    fn favors_left_when_both_sides_change_the_same_line() {
        let document = TextMergeDocument::from_inputs(TextMergeInput {
            base: TextMergeSide::new("base.txt", "one\ntwo\nthree"),
            left: TextMergeSide::new("left.txt", "one\nleft change\nthree"),
            right: TextMergeSide::new("right.txt", "one\nright change\nthree"),
            output_path: None,
        });

        let result = auto_merge_text_with_options(
            &document,
            TextMergeOptions {
                conflict_policy: TextMergeConflictPolicy::FavorLeft,
            },
        );

        assert_eq!(result.conflicts, 0);
        assert_eq!(result.output_text, "one\nleft change\nthree");
        assert_eq!(result.sections[1].kind, TextMergeSectionKind::AcceptedLeft);
    }

    #[test]
    fn favors_right_when_both_sides_change_the_same_line() {
        let document = TextMergeDocument::from_inputs(TextMergeInput {
            base: TextMergeSide::new("base.txt", "one\ntwo\nthree"),
            left: TextMergeSide::new("left.txt", "one\nleft change\nthree"),
            right: TextMergeSide::new("right.txt", "one\nright change\nthree"),
            output_path: None,
        });

        let result = auto_merge_text_with_options(
            &document,
            TextMergeOptions {
                conflict_policy: TextMergeConflictPolicy::FavorRight,
            },
        );

        assert_eq!(result.conflicts, 0);
        assert_eq!(result.output_text, "one\nright change\nthree");
        assert_eq!(result.sections[1].kind, TextMergeSectionKind::AcceptedRight);
    }

    #[test]
    fn accepts_identical_both_side_changes_without_conflict() {
        let document = TextMergeDocument::from_inputs(TextMergeInput {
            base: TextMergeSide::new("base.txt", "one\ntwo\nthree"),
            left: TextMergeSide::new("left.txt", "one\nshared\nthree"),
            right: TextMergeSide::new("right.txt", "one\nshared\nthree"),
            output_path: None,
        });

        let result = auto_merge_text(&document);

        assert_eq!(result.conflicts, 0);
        assert_eq!(result.output_text, "one\nshared\nthree");
    }

    #[test]
    fn merges_deletion_on_one_side_cleanly() {
        let document = TextMergeDocument::from_inputs(TextMergeInput {
            base: TextMergeSide::new("base.txt", "A\nB\nC"),
            left: TextMergeSide::new("left.txt", "A\nC"),
            right: TextMergeSide::new("right.txt", "A\nB\nC"),
            output_path: None,
        });

        let result = auto_merge_text(&document);

        assert_eq!(result.conflicts, 0);
        assert_eq!(result.output_text, "A\nC");
    }
}
