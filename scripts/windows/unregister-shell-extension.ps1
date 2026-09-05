param(
  [string]$VerbKey = 'OpenDiff'
)

$ErrorActionPreference = 'Stop'

$keys = @(
  "HKCU:\Software\Classes\*\shell\$VerbKey",
  "HKCU:\Software\Classes\Directory\shell\$VerbKey",
  "HKCU:\Software\Classes\*\shell\${VerbKey}SelectLeft",
  "HKCU:\Software\Classes\Directory\shell\${VerbKey}SelectLeft"
)

foreach ($key in $keys) {
  if (Test-Path -LiteralPath $key) {
    Remove-Item -LiteralPath $key -Recurse -Force
  }
}

Write-Host 'Removed Open Diff Explorer context menu entries for files and folders.'
