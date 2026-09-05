#!/usr/bin/env bash
# Remove Open Diff macOS shell-compare helper + Open With .app stub.
set -euo pipefail

support_dir="$HOME/Library/Application Support/Open Diff"
rm -f "$HOME/bin/open-diff-shell-compare"
rm -f "$support_dir/open-diff-shell-compare"
rm -rf "$support_dir/Open Diff Compare.app"
echo "Removed Open Diff macOS shell helpers"
