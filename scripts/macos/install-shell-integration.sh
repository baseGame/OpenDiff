#!/usr/bin/env bash
# Install Open Diff macOS shell-compare helper + Open With .app stub.
# Prefer shared CLI --shell-compare over a full Finder Service extension.
set -euo pipefail

APP_PATH="${1:-}"
if [[ -z "$APP_PATH" ]]; then
  if [[ -x "/Applications/OpenDiff.app/Contents/MacOS/open-diff-app" ]]; then
    APP_PATH="/Applications/OpenDiff.app/Contents/MacOS/open-diff-app"
  elif command -v open-diff-app >/dev/null 2>&1; then
    APP_PATH="$(command -v open-diff-app)"
  else
    echo "usage: $0 <open-diff-app-path>" >&2
    exit 2
  fi
fi

support_dir="$HOME/Library/Application Support/Open Diff"
bin_dir="$HOME/bin"
mkdir -p "$support_dir" "$bin_dir"

helper="$support_dir/open-diff-shell-compare"
cat > "$helper" <<HELPER
#!/usr/bin/env bash
set -euo pipefail
APP=$(printf '%q' "$APP_PATH")
MODE="compare"
PATH_ARG=""
while [[ \$# -gt 0 ]]; do
  case "\$1" in
    --select-left) MODE="select-left"; shift ;;
    *) PATH_ARG="\$1"; shift ;;
  esac
done
if [[ -z "\$PATH_ARG" ]]; then
  echo "usage: open-diff-shell-compare [--select-left] <path>" >&2
  exit 2
fi
if [[ "\$MODE" == "select-left" ]]; then
  exec "\$APP" --shell-compare --select-left "\$PATH_ARG"
fi
exec "\$APP" --shell-compare "\$PATH_ARG"
HELPER
chmod 755 "$helper"
ln -sfn "$helper" "$bin_dir/open-diff-shell-compare"

app_dir="$support_dir/Open Diff Compare.app"
macos_dir="$app_dir/Contents/MacOS"
mkdir -p "$macos_dir"
cat > "$app_dir/Contents/Info.plist" <<'PLIST'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleExecutable</key>
  <string>open-diff-compare</string>
  <key>CFBundleIdentifier</key>
  <string>io.github.kygo8.open-diff.compare</string>
  <key>CFBundleName</key>
  <string>Open Diff Compare</string>
  <key>CFBundlePackageType</key>
  <string>APPL</string>
  <key>CFBundleShortVersionString</key>
  <string>1.0</string>
  <key>LSMinimumSystemVersion</key>
  <string>11.0</string>
  <key>CFBundleDocumentTypes</key>
  <array>
    <dict>
      <key>CFBundleTypeName</key>
      <string>All Files</string>
      <key>CFBundleTypeRole</key>
      <string>Viewer</string>
      <key>LSHandlerRank</key>
      <string>Alternate</string>
      <key>LSItemContentTypes</key>
      <array>
        <string>public.item</string>
        <string>public.folder</string>
      </array>
    </dict>
  </array>
</dict>
</plist>
PLIST

quoted_app=$(printf '%q' "$APP_PATH")
cat > "$macos_dir/open-diff-compare" <<APP
#!/usr/bin/env bash
set -euo pipefail
APP_BIN=$quoted_app
if [[ \$# -eq 0 ]]; then
  echo "Drop a file/folder on this app, or: open-diff-cli shell-compare <path>" >&2
  exit 2
fi
exec "\$APP_BIN" --shell-compare "\$1"
APP
chmod 755 "$macos_dir/open-diff-compare"

echo "Installed helper: $bin_dir/open-diff-shell-compare"
echo "Installed Open With app: $app_dir"
echo "CLI: open-diff-cli shell-compare [--select-left] <path>"
