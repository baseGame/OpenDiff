/// BCS-compatible script interpreter stub
/// Full implementation: Phase 5
pub struct ScriptInterpreter {
    pub verbose: bool,
}

impl ScriptInterpreter {
    pub fn new() -> Self { Self { verbose: false } }

    pub async fn run_file(&self, path: &std::path::Path) -> anyhow::Result<()> {
        let script = tokio::fs::read_to_string(path).await?;
        self.run_source(&script).await
    }

    pub async fn run_source(&self, source: &str) -> anyhow::Result<()> {
        for line in source.lines() {
            let line = line.trim();
            if line.is_empty() || line.starts_with('#') { continue; }
            if self.verbose { eprintln!(">> {line}"); }
            // TODO: full BCS command dispatch in Phase 5
        }
        Ok(())
    }
}
