//! PDF text extractor — basic text extraction from PDF streams
use anyhow::Result;

/// Extract plain text from a PDF file
pub fn extract_pdf_text(path: &str) -> Result<Vec<String>> {
    let data = std::fs::read(path)?;
    let content = String::from_utf8_lossy(&data);

    // Find text between BT (Begin Text) and ET (End Text) markers
    let bt_et = regex::Regex::new(r"BT\s*(.*?)\s*ET").unwrap();
    let tj_pattern = regex::Regex::new(r"\(([^)]*)\)\s*Tj").unwrap();
    let tj_array = regex::Regex::new(r"\[([^\]]+)\]\s*TJ").unwrap();

    let mut paragraphs: Vec<String> = Vec::new();
    let mut current_line = String::new();

    for bt_cap in bt_et.captures_iter(&content) {
        let text_block = &bt_cap[1];

        // Try single-string Tj
        for m in tj_pattern.captures_iter(text_block) {
            let text = unescape_pdf_string(&m[1]);
            if !text.trim().is_empty() {
                current_line.push_str(&text);
            }
        }

        // Try array TJ
        for m in tj_array.captures_iter(text_block) {
            let array_content = &m[1];
            // Extract strings in parentheses
            for paren in regex::Regex::new(r"\(([^)]*)\")?.captures_iter(array_content) {
                let text = unescape_pdf_string(&paren[1]);
                if !text.trim().is_empty() {
                    current_line.push_str(&text);
                }
            }
        }

        if !current_line.trim().is_empty() {
            paragraphs.push(current_line.trim().to_string());
            current_line = String::new();
        }
    }

    if paragraphs.is_empty() {
        paragraphs.push("[No extractable text — PDF may be scanned/image-based]".to_string());
    }

    Ok(paragraphs)
}

fn unescape_pdf_string(s: &str) -> String {
    s.replace("\\(", "(")
        .replace("\\)", ")")
        .replace("\\\\", "\\")
        .replace("\\n", "\n")
        .replace("\\r", "\r")
        .replace("\\t", "\t")
}
