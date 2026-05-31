param()

$ErrorActionPreference = "Stop"
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path

Set-Location -LiteralPath $repoRoot

cmd /c pnpm run preflight:phase632-token-saving
if ($LASTEXITCODE -ne 0) {
  exit $LASTEXITCODE
}

cmd /c pnpm run nightly:phase638-safe-runner
exit $LASTEXITCODE

