param(
  [string]$OutputFile = ".tmp/growth/star-growth-latest.md"
)

$ErrorActionPreference = "Stop"
$previousOutputEncoding = [Console]::OutputEncoding
$OutputEncoding = [System.Text.UTF8Encoding]::new()
[Console]::OutputEncoding = $OutputEncoding

function Resolve-NodeExists {
  return [bool](Get-Command node -ErrorAction SilentlyContinue)
}
try {
  if (Resolve-NodeExists) {
    if (Test-Path "tools/star-growth-check.mjs") {
      node ./tools/star-growth-check.mjs evidence --output $OutputFile
      Write-Output "Growth evidence generated via node: $OutputFile"
      return
    }
    throw "Growth Node script not found: tools/star-growth-check.mjs"
  }

  if (Test-Path "tools/star-growth-snapshot.ps1") {
    & powershell -NoProfile -ExecutionPolicy Bypass -File ./tools/star-growth-snapshot.ps1 -OutputFile $OutputFile
    Write-Output "Growth snapshot generated via PowerShell fallback: $OutputFile"
    return
  }

  throw "No growth snapshot script found. Please run star-growth-check.ps1 and star-growth-snapshot.ps1 manually."
}
catch {
  throw $_.Exception.Message
}
finally {
  [Console]::OutputEncoding = $previousOutputEncoding
}
