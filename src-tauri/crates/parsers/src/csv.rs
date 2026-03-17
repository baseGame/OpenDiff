use anyhow::Result;

/// Parse CSV/TSV into rows of cells
pub fn parse_csv(content: &str, delimiter: u8) -> Result<Vec<Vec<String>>> {
    let mut rdr = csv::ReaderBuilder::new()
        .delimiter(delimiter)
        .flexible(true)
        .has_headers(false)
        .from_reader(content.as_bytes());
    let mut rows = vec![];
    for result in rdr.records() {
        let record = result?;
        rows.push(record.iter().map(|s| s.to_string()).collect());
    }
    Ok(rows)
}
