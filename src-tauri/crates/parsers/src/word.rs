//! Word (.docx) document parser — reads text from .docx zip archive
use anyhow::Result;
use std::io::Read;

/// Parse a .docx file into plain text paragraphs
pub fn parse_word(path: &str) -> Result<Vec<String>> {
    let file = std::fs::File::open(path)?;
    let mut archive = zip::ZipArchive::new(std::io::BufReader::new(file))?;

    let mut xml_content = String::new();
    if let Ok(mut doc) = archive.by_name("word/document.xml") {
        doc.read_to_string(&mut xml_content)?;
    } else {
        return Ok(vec![]);
    }

    let para_pattern = regex::Regex::new(r"<w:p[ >].*?</w:p>").unwrap();
    let text_pattern = regex::Regex::new(r"<w:t[^>]*>([^<]*)</w:t>").unwrap();

    let mut paragraphs: Vec<String> = Vec::new();
    for para_cap in para_pattern.captures_iter(&xml_content) {
        let para_xml = &para_cap[0];
        let mut text = String::new();
        for text_cap in text_pattern.captures_iter(para_xml) {
            text.push_str(&text_cap[1]);
            text.push(' ');
        }
        let trimmed = text.trim().to_string();
        if !trimmed.is_empty() {
            paragraphs.push(trimmed);
        }
    }

    Ok(paragraphs)
}
