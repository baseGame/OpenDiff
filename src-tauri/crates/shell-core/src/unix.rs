#[derive(Debug, Clone, PartialEq, Eq)]
pub struct UnixShellIntegrationConfig {
    pub product_name: String,
    pub executable_path: String,
    pub desktop_id: String,
}

impl UnixShellIntegrationConfig {
    pub fn new(product_name: impl Into<String>, executable_path: impl Into<String>) -> Self {
        Self {
            product_name: product_name.into(),
            executable_path: executable_path.into(),
            desktop_id: "open-diff-compare".to_owned(),
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct LinuxDesktopIntegrationBuilder {
    config: UnixShellIntegrationConfig,
}

impl LinuxDesktopIntegrationBuilder {
    pub fn new(config: UnixShellIntegrationConfig) -> Self {
        Self { config }
    }

    pub fn desktop_file(&self) -> String {
        let name = &self.config.product_name;
        let exec = shell_escape_for_desktop(&self.config.executable_path);

        format!(
            "\
[Desktop Entry]\n\
Type=Application\n\
Version=1.0\n\
Name=Compare with {name}\n\
GenericName=File Compare\n\
Comment=Open paths with {name} via shell-compare\n\
Exec={exec} --shell-compare %f\n\
Icon=utilities-file-compare\n\
Terminal=false\n\
Categories=Utility;Development;FileTools;\n\
MimeType=text/plain;text/markdown;text/html;application/json;application/xml;inode/directory;\n\
Keywords=diff;compare;open-diff;\n\
Actions=SelectLeft;\n\
StartupNotify=false\n\
\n\
[Desktop Action SelectLeft]\n\
Name=Select Left for Compare\n\
Exec={exec} --shell-compare --select-left %f\n\
"
        )
    }

    pub fn install_script(&self) -> String {
        let desktop = self.desktop_file();
        let desktop_id = &self.config.desktop_id;
        let product = &self.config.product_name;

        format!(
            "#!/usr/bin/env bash\n\
# Install {product} Linux file-manager Open With / shell-compare integration.\n\
set -euo pipefail\n\
\n\
apps_dir=\"${{XDG_DATA_HOME:-$HOME/.local/share}}/applications\"\n\
mkdir -p \"$apps_dir\"\n\
cat > \"$apps_dir/{desktop_id}.desktop\" <<'DESKTOP'\n\
{desktop}\
DESKTOP\n\
chmod 644 \"$apps_dir/{desktop_id}.desktop\"\n\
if command -v update-desktop-database >/dev/null 2>&1; then\n\
  update-desktop-database \"$apps_dir\" >/dev/null 2>&1 || true\n\
fi\n\
echo \"Installed $apps_dir/{desktop_id}.desktop\"\n\
echo \"CLI: open-diff-cli shell-compare [--select-left] <path>\"\n\
"
        )
    }

    pub fn uninstall_script(&self) -> String {
        let desktop_id = &self.config.desktop_id;
        let product = &self.config.product_name;

        format!(
            "#!/usr/bin/env bash\n\
# Remove {product} Linux file-manager Open With / shell-compare integration.\n\
set -euo pipefail\n\
\n\
apps_dir=\"${{XDG_DATA_HOME:-$HOME/.local/share}}/applications\"\n\
rm -f \"$apps_dir/{desktop_id}.desktop\"\n\
if command -v update-desktop-database >/dev/null 2>&1; then\n\
  update-desktop-database \"$apps_dir\" >/dev/null 2>&1 || true\n\
fi\n\
echo \"Removed $apps_dir/{desktop_id}.desktop\"\n\
"
        )
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct MacOsShellIntegrationBuilder {
    config: UnixShellIntegrationConfig,
}

impl MacOsShellIntegrationBuilder {
    pub fn new(config: UnixShellIntegrationConfig) -> Self {
        Self { config }
    }

    pub fn helper_script(&self) -> String {
        let exec = shell_single_quote(&self.config.executable_path);
        let product = &self.config.product_name;

        format!(
            "#!/usr/bin/env bash\n\
# {product} shell-compare helper for Finder / Open With.\n\
set -euo pipefail\n\
APP={exec}\n\
MODE=\"compare\"\n\
PATH_ARG=\"\"\n\
while [[ $# -gt 0 ]]; do\n\
  case \"$1\" in\n\
    --select-left) MODE=\"select-left\"; shift ;;\n\
    *) PATH_ARG=\"$1\"; shift ;;\n\
  esac\n\
done\n\
if [[ -z \"$PATH_ARG\" ]]; then\n\
  echo \"usage: open-diff-shell-compare [--select-left] <path>\" >&2\n\
  exit 2\n\
fi\n\
if [[ \"$MODE\" == \"select-left\" ]]; then\n\
  exec \"$APP\" --shell-compare --select-left \"$PATH_ARG\"\n\
fi\n\
exec \"$APP\" --shell-compare \"$PATH_ARG\"\n\
"
        )
    }

    pub fn install_script(&self) -> String {
        let helper = self.helper_script();
        let exec = shell_single_quote(&self.config.executable_path);
        let product = &self.config.product_name;

        format!(
            "#!/usr/bin/env bash\n\
# Install {product} macOS shell-compare helper (CLI + Open With .app stub).\n\
set -euo pipefail\n\
\n\
support_dir=\"$HOME/Library/Application Support/Open Diff\"\n\
bin_dir=\"$HOME/bin\"\n\
mkdir -p \"$support_dir\" \"$bin_dir\"\n\
cat > \"$support_dir/open-diff-shell-compare\" <<'HELPER'\n\
{helper}\
HELPER\n\
chmod 755 \"$support_dir/open-diff-shell-compare\"\n\
ln -sfn \"$support_dir/open-diff-shell-compare\" \"$bin_dir/open-diff-shell-compare\"\n\
\n\
app_dir=\"$support_dir/Open Diff Compare.app\"\n\
macos_dir=\"$app_dir/Contents/MacOS\"\n\
mkdir -p \"$macos_dir\"\n\
cat > \"$app_dir/Contents/Info.plist\" <<'PLIST'\n\
<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n\
<!DOCTYPE plist PUBLIC \"-//Apple//DTD PLIST 1.0//EN\" \"http://www.apple.com/DTDs/PropertyList-1.0.dtd\">\n\
<plist version=\"1.0\">\n\
<dict>\n\
  <key>CFBundleExecutable</key>\n\
  <string>open-diff-compare</string>\n\
  <key>CFBundleIdentifier</key>\n\
  <string>io.github.kygo8.open-diff.compare</string>\n\
  <key>CFBundleName</key>\n\
  <string>Open Diff Compare</string>\n\
  <key>CFBundlePackageType</key>\n\
  <string>APPL</string>\n\
  <key>CFBundleShortVersionString</key>\n\
  <string>1.0</string>\n\
  <key>LSMinimumSystemVersion</key>\n\
  <string>11.0</string>\n\
  <key>CFBundleDocumentTypes</key>\n\
  <array>\n\
    <dict>\n\
      <key>CFBundleTypeName</key>\n\
      <string>All Files</string>\n\
      <key>CFBundleTypeRole</key>\n\
      <string>Viewer</string>\n\
      <key>LSHandlerRank</key>\n\
      <string>Alternate</string>\n\
      <key>LSItemContentTypes</key>\n\
      <array>\n\
        <string>public.item</string>\n\
        <string>public.folder</string>\n\
      </array>\n\
    </dict>\n\
  </array>\n\
</dict>\n\
</plist>\n\
PLIST\n\
cat > \"$macos_dir/open-diff-compare\" <<APP\n\
#!/usr/bin/env bash\n\
set -euo pipefail\n\
APP_BIN={exec}\n\
if [[ $# -eq 0 ]]; then\n\
  echo \"Drop a file/folder on this app, or: open-diff-cli shell-compare <path>\" >&2\n\
  exit 2\n\
fi\n\
exec \"$APP_BIN\" --shell-compare \"$1\"\n\
APP\n\
chmod 755 \"$macos_dir/open-diff-compare\"\n\
\n\
echo \"Installed helper: $bin_dir/open-diff-shell-compare\"\n\
echo \"Installed Open With app: $app_dir\"\n\
echo \"CLI: open-diff-cli shell-compare [--select-left] <path>\"\n\
"
        )
    }

    pub fn uninstall_script(&self) -> String {
        let product = &self.config.product_name;

        format!(
            "#!/usr/bin/env bash\n\
# Remove {product} macOS shell-compare helper.\n\
set -euo pipefail\n\
\n\
support_dir=\"$HOME/Library/Application Support/Open Diff\"\n\
rm -f \"$HOME/bin/open-diff-shell-compare\"\n\
rm -f \"$support_dir/open-diff-shell-compare\"\n\
rm -rf \"$support_dir/Open Diff Compare.app\"\n\
echo \"Removed Open Diff macOS shell helpers\"\n\
"
        )
    }
}

fn shell_single_quote(value: &str) -> String {
    format!("'{}'", value.replace('\'', "'\"'\"'"))
}

fn shell_escape_for_desktop(value: &str) -> String {
    if value
        .chars()
        .any(|ch| ch.is_whitespace() || matches!(ch, '"' | '\\' | '\'' | '$' | '`'))
    {
        format!("\"{}\"", value.replace('\\', "\\\\").replace('"', "\\\""))
    } else {
        value.to_owned()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn builds_linux_desktop_file_with_shell_compare_exec() {
        let config = UnixShellIntegrationConfig::new("Open Diff", "/opt/OpenDiff/open-diff-app");
        let desktop = LinuxDesktopIntegrationBuilder::new(config).desktop_file();

        assert!(desktop.contains("Name=Compare with Open Diff"));
        assert!(desktop.contains("Exec=/opt/OpenDiff/open-diff-app --shell-compare %f"));
        assert!(desktop.contains("--select-left %f"));
        assert!(desktop.contains("MimeType="));
        assert!(desktop.contains("inode/directory"));
        assert!(desktop.contains("Actions=SelectLeft"));
    }

    #[test]
    fn builds_linux_install_and_uninstall_scripts() {
        let config = UnixShellIntegrationConfig::new("Open Diff", "/usr/bin/open-diff-app");
        let builder = LinuxDesktopIntegrationBuilder::new(config);

        let install = builder.install_script();
        let uninstall = builder.uninstall_script();

        assert!(install.contains("open-diff-compare.desktop"));
        assert!(install.contains("--shell-compare"));
        assert!(install.contains("update-desktop-database"));
        assert!(uninstall.contains("rm -f"));
        assert!(uninstall.contains("open-diff-compare.desktop"));
    }

    #[test]
    fn builds_macos_shell_helper_and_install_script() {
        let config = UnixShellIntegrationConfig::new(
            "Open Diff",
            "/Applications/Open Diff.app/Contents/MacOS/open-diff-app",
        );
        let builder = MacOsShellIntegrationBuilder::new(config);

        let helper = builder.helper_script();
        let install = builder.install_script();
        let uninstall = builder.uninstall_script();

        assert!(helper.contains("--shell-compare"));
        assert!(helper.contains("--select-left"));
        assert!(install.contains("Open Diff Compare.app"));
        assert!(install.contains("CFBundleDocumentTypes"));
        assert!(install.contains("open-diff-shell-compare"));
        assert!(uninstall.contains("Open Diff Compare.app"));
    }
}
