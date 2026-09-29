[CmdletBinding()]
param(
  [string]$ProjectRoot = "",
  [string]$Remote = "origin",
  [switch]$DryRun
)

$ErrorActionPreference = "Stop"
if ([string]::IsNullOrWhiteSpace($ProjectRoot)) {
  $ProjectRoot = Split-Path -Parent $PSScriptRoot
}
$node = (Get-Command node.exe -ErrorAction Stop).Source
$arguments = @((Join-Path $PSScriptRoot "sync-github.mjs"), "--project-root", $ProjectRoot, "--remote", $Remote)
if ($DryRun) { $arguments += "--dry-run" }
& $node @arguments
exit $LASTEXITCODE
