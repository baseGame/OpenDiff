param(
  [Parameter(Mandatory = $true)]
  [string]$AppPath,

  [string]$ProductName = 'Open Diff',

  [string]$VerbKey = 'OpenDiff'
)

$ErrorActionPreference = 'Stop'

if (-not (Test-Path -LiteralPath $AppPath -PathType Leaf)) {
  throw "Application executable not found: $AppPath"
}

$compareLabel = "Compare with $ProductName"
$selectFileLabel = 'Select Left File for Compare'
$selectFolderLabel = 'Select Left Folder for Compare'
$compareCommand = "`"$AppPath`" --shell-compare `"%1`""
$selectLeftCommand = "`"$AppPath`" --shell-compare --select-left `"%1`""
$entries = @(
  @{
    Key = "HKCU:\Software\Classes\*\shell\$VerbKey"
    Label = $compareLabel
    Command = $compareCommand
  },
  @{
    Key = "HKCU:\Software\Classes\Directory\shell\$VerbKey"
    Label = $compareLabel
    Command = $compareCommand
  },
  @{
    Key = "HKCU:\Software\Classes\*\shell\${VerbKey}SelectLeft"
    Label = $selectFileLabel
    Command = $selectLeftCommand
  },
  @{
    Key = "HKCU:\Software\Classes\Directory\shell\${VerbKey}SelectLeft"
    Label = $selectFolderLabel
    Command = $selectLeftCommand
  }
)

foreach ($entry in $entries) {
  New-Item -Path $entry.Key -Force | Out-Null
  New-ItemProperty -Path $entry.Key -Name 'MUIVerb' -Value $entry.Label -PropertyType String -Force |
    Out-Null
  New-ItemProperty -Path $entry.Key -Name 'Icon' -Value $AppPath -PropertyType String -Force |
    Out-Null
  New-Item -Path "$($entry.Key)\command" -Force | Out-Null
  Set-ItemProperty -Path "$($entry.Key)\command" -Name '(default)' -Value $entry.Command
}

Write-Host "Registered $ProductName Explorer context menu entries (Compare + Select Left)."
