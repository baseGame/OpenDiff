param(
  [string] $Configuration = "release",
  [string] $Version = "",
  [switch] $SkipBuild
)

$ErrorActionPreference = "Stop"

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..\..")

if ([string]::IsNullOrWhiteSpace($Version)) {
  $packageJson = Get-Content -LiteralPath (Join-Path $repoRoot "package.json") -Raw | ConvertFrom-Json
  $Version = [string] $packageJson.version
  if ([string]::IsNullOrWhiteSpace($Version)) {
    throw "Could not read version from package.json"
  }
}

$releaseRoot = Join-Path $repoRoot "src-tauri\target\$Configuration"
$portableRoot = Join-Path $repoRoot "src-tauri\target\$Configuration\bundle\portable"
$stagingRoot = Join-Path $portableRoot "OpenDiff"
$archivePath = Join-Path $portableRoot "OpenDiff_${Version}_windows_x64_portable.zip"

if (-not $SkipBuild) {
  corepack pnpm tauri:build
}

$appExe = Join-Path $releaseRoot "open-diff-app.exe"
$cliExe = Join-Path $releaseRoot "open-diff-cli.exe"
if (-not (Test-Path -LiteralPath $appExe)) {
  throw "Missing $appExe (build first or omit -SkipBuild)"
}
if (-not (Test-Path -LiteralPath $cliExe)) {
  throw "Missing $cliExe (build first or omit -SkipBuild)"
}

if (Test-Path -LiteralPath $stagingRoot) {
  Remove-Item -LiteralPath $stagingRoot -Recurse -Force
}

New-Item -ItemType Directory -Path $stagingRoot -Force | Out-Null

Copy-Item -LiteralPath $appExe -Destination (Join-Path $stagingRoot "open-diff-app.exe") -Force
Copy-Item -LiteralPath $cliExe -Destination (Join-Path $stagingRoot "open-diff-cli.exe") -Force
Copy-Item -LiteralPath (Join-Path $repoRoot "README.md") -Destination (Join-Path $stagingRoot "README.md") -Force
Copy-Item -LiteralPath (Join-Path $repoRoot "LICENSE") -Destination (Join-Path $stagingRoot "LICENSE") -Force

if (Test-Path -LiteralPath $archivePath) {
  Remove-Item -LiteralPath $archivePath -Force
}

Compress-Archive -Path (Join-Path $stagingRoot "*") -DestinationPath $archivePath -CompressionLevel Optimal

Write-Output $archivePath
