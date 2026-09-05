#!/usr/bin/env bash
# Remove Open Diff Linux file-manager Open With / shell-compare integration.
set -euo pipefail

apps_dir="${XDG_DATA_HOME:-$HOME/.local/share}/applications"
rm -f "$apps_dir/open-diff-compare.desktop"
if command -v update-desktop-database >/dev/null 2>&1; then
  update-desktop-database "$apps_dir" >/dev/null 2>&1 || true
fi
echo "Removed $apps_dir/open-diff-compare.desktop"
