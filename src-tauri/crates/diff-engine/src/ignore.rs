use crate::types::*;
use regex::Regex;

/// Apply ignore rules to a line, returning the normalized version for comparison
pub fn normalize_line(line: &str, rules: &IgnoreRules) -> String {
    let mut s = line.to_string();

    // Line ending normalization
    if rules.line_endings {
        s = s.replace("\r\n", "\n").replace('\r', "\n");
        if s.ends_with('\n') { s.pop(); }
    }

    // Case
    if rules.case {
        s = s.to_lowercase();
    }

    // Whitespace
    s = match rules.whitespace {
        WhitespaceMode::None => s,
        WhitespaceMode::LeadingAndTrailing => s.trim().to_string(),
        WhitespaceMode::All => {
            // Collapse all whitespace runs to single space, then trim
            let mut out = String::with_capacity(s.len());
            let mut last_space = true;
            for c in s.chars() {
                if c.is_whitespace() {
                    if !last_space { out.push(' '); }
                    last_space = true;
                } else {
                    out.push(c);
                    last_space = false;
                }
            }
            out.trim().to_string()
        }
    };

    // Comments
    s = strip_comments(&s, &rules.comments);

    // Column ranges (mask out specified columns)
    for range in &rules.column_ranges {
        let chars: Vec<char> = s.chars().collect();
        let start = range.start.min(chars.len());
        let end = range.end.min(chars.len());
        let masked: String = chars[..start].iter()
            .chain(std::iter::repeat(&' ').take(end - start))
            .chain(chars[end..].iter())
            .collect();
        s = masked;
    }

    // Regex patterns
    for pattern in &rules.regex_patterns {
        if let Ok(re) = Regex::new(pattern) {
            s = re.replace_all(&s, "").to_string();
        }
    }

    s
}

fn strip_comments(line: &str, style: &CommentStyle) -> String {
    match style {
        CommentStyle::None => line.to_string(),
        CommentStyle::CStyle | CommentStyle::All => {
            // Strip // single-line comment (simple heuristic: not inside strings)
            let stripped = if let Some(idx) = line.find("//") {
                line[..idx].trim_end().to_string()
            } else {
                line.to_string()
            };
            // Note: block comments /* */ handled at multi-line level (not here)
            stripped
        }
        CommentStyle::Python => {
            if let Some(idx) = line.find('#') {
                line[..idx].trim_end().to_string()
            } else {
                line.to_string()
            }
        }
    }
}

/// Normalize a slice of lines, returning owned strings
pub fn normalize_lines(lines: &[&str], rules: &IgnoreRules) -> Vec<String> {
    lines.iter().map(|l| normalize_line(l, rules)).collect()
}
