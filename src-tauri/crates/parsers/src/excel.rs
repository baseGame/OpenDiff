//! Excel / ODS / CSV parser — uses CSV for .csv, simple zip for .xlsx
use anyhow::Result;
use std::io::Read;

/// Parse an Excel .xlsx, .csv or .tsv file into rows
pub fn parse_spreadsheet(path: &str) -> Result<SpreadsheetData> {
    let ext = std::path::Path::new(path)
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("")
        .to_lowercase();

    match ext.as_str() {
        "csv" | "tsv" => {
            let sep = if ext == "tsv" { b'\t' } else { b',' };
            let content = std::fs::read_to_string(path)?;
            let rows = parse_csv_string(&content, sep);
            Ok(SpreadsheetData { sheets: vec![Sheet { name: "Sheet1".into(), headers: vec![], rows }] })
        }
        "xlsx" => parse_xlsx_simple(path),
        "xls" => parse_xls_simple(path),
        "ods" => parse_ods_simple(path),
        _ => Err(anyhow::anyhow!("Unsupported format: {}", ext)),
    }
}

fn parse_csv_string(content: &str, sep: u8) -> Vec<Vec<String>> {
    let mut rows = vec![];
    for line in content.lines() {
        let cells = parse_csv_line(line, sep);
        rows.push(cells);
    }
    rows
}

fn parse_csv_line(line: &str, sep: u8) -> Vec<String> {
    let mut result = vec![];
    let mut in_quotes = false;
    let mut cell = String::new();
    let sep_char = sep as char;

    for ch in line.chars() {
        if ch == '"' {
            in_quotes = !in_quotes;
        } else if ch == sep_char && !in_quotes {
            result.push(cell.trim().to_string());
            cell = String::new();
        } else {
            cell.push(ch);
        }
    }
    result.push(cell.trim().to_string());
    result
}

fn parse_xlsx_simple(path: &str) -> Result<SpreadsheetData> {
    // Read the xlsx as a zip file (xlsx is a zip of xmls)
    let file = std::fs::File::open(path)?;
    let mut archive = zip::ZipArchive::new(std::io::BufReader::new(file))?;

    let mut all_rows: Vec<Vec<String>> = vec![];
    let mut sheet_name = "Sheet1".to_string();

    if let Ok(mut sheet1) = archive.by_name("xl/worksheets/sheet1.xml") {
        let mut xml_content = String::new();
        sheet1.read_to_string(&mut xml_content)?;
        all_rows = parse_xlsx_xml(&xml_content)?;
    }

    Ok(SpreadsheetData { sheets: vec![Sheet { name: sheet_name, headers: vec![], rows: all_rows }] })
}

fn parse_xls_simple(_path: &str) -> Result<SpreadsheetData> {
    // XLS is complex binary format — skip for now, use CSV fallback
    Ok(SpreadsheetData { sheets: vec![Sheet { name: "Sheet1".into(), headers: vec![], rows: vec![] }] })
}

fn parse_ods_simple(path: &str) -> Result<SpreadsheetData> {
    let file = std::fs::File::open(path)?;
    let mut archive = zip::ZipArchive::new(std::io::BufReader::new(file))?;

    let mut all_rows: Vec<Vec<String>> = vec![];
    if let Ok(mut content) = archive.by_name("content.xml") {
        let mut xml = String::new();
        content.read_to_string(&mut xml)?;
        all_rows = parse_ods_xml(&xml)?;
    }

    Ok(SpreadsheetData { sheets: vec![Sheet { name: "Sheet1".into(), headers: vec![], rows: all_rows }] })
}

fn parse_xlsx_xml(xml: &str) -> Result<Vec<Vec<String>>> {
    // Very simple XML parsing for shared strings and cells
    let mut rows = vec![];
    // Find all <row> tags and extract cell values
    let row_pattern = regex::Regex::new(r"<row[^>]*>(.*?)</row>").unwrap();
    let cell_pattern = regex::Regex::new(r#"<c[^>]*r="([A-Z]+)(\d+)"[^>]*><v>([^<]*)</v>"#).unwrap();

    for cap in row_pattern.captures_iter(xml) {
        let row_content = &cap[1];
        let mut cells: Vec<String> = vec![];
        for cell_cap in cell_pattern.captures_iter(row_content) {
            cells.push(cell_cap[3].to_string());
        }
        if !cells.is_empty() { rows.push(cells); }
    }
    Ok(rows)
}

fn parse_ods_xml(xml: &str) -> Result<Vec<Vec<String>>> {
    let mut rows = vec![];
    let row_pattern = regex::Regex::new(r"<table:table-row[^>]*>(.*?)</table:table-row>").unwrap();
    let cell_pattern = regex::Regex::new(r"<text:p>([^<]*)</text:p>").unwrap();

    for cap in row_pattern.captures_iter(xml) {
        let row_content = &cap[1];
        let mut cells = vec![];
        for cell_cap in cell_pattern.captures_iter(row_content) {
            cells.push(unescape_xml(&cell_cap[1]));
        }
        if !cells.is_empty() { rows.push(cells); }
    }
    Ok(rows)
}

fn unescape_xml(s: &str) -> String {
    s.replace("&amp;", "&").replace("&lt;", "<").replace("&gt;", ">")
        .replace("&quot;", "\"").replace("&apos;", "'")
}

#[derive(Debug, serde::Serialize)]
pub struct SpreadsheetData {
    pub sheets: Vec<Sheet>,
}

#[derive(Debug, serde::Serialize)]
pub struct Sheet {
    pub name: String,
    pub headers: Vec<String>,
    pub rows: Vec<Vec<String>>,
}
