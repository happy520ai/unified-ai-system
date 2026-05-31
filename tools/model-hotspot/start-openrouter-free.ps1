# OpenRouter Free Model Gateway Launcher
# Usage: .\tools\model-hotspot\start-openrouter-free.ps1

param(
    [string]$Model = "deepseek/deepseek-v4-flash:free"
)

Write-Host "=== OpenRouter Free Model Gateway ===" -ForegroundColor Cyan
Write-Host "Model: $Model" -ForegroundColor Yellow
Write-Host ""

# Check API Key
if (-not $env:OPENROUTER_API_KEY) {
    Write-Host "[ERROR] OPENROUTER_API_KEY not set!" -ForegroundColor Red
    Write-Host "Set it with: `$env:OPENROUTER_API_KEY='your-key-here'" -ForegroundColor Yellow
    exit 1
}

# Set environment
$env:AI_GATEWAY_PROVIDER_MODE = "real"
$env:AI_GATEWAY_REAL_PROVIDER_ENABLED = "true"
$env:AI_GATEWAY_ROUTE_MODE = "fixed"
$env:AI_GATEWAY_DEFAULT_PROVIDER = "openrouter"
$env:AI_GATEWAY_ENABLED_PROVIDERS = "openrouter"
$env:OPENROUTER_MODEL = $Model
$env:OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1"

# Remove NVIDIA if present (avoid conflict)
Remove-Item Env:NVIDIA_API_KEY -ErrorAction SilentlyContinue
Remove-Item Env:NVIDIA_MODEL -ErrorAction SilentlyContinue

Write-Host "Starting service..." -ForegroundColor Green
Write-Host "  Provider: OpenRouter" -ForegroundColor Gray
Write-Host "  Model: $Model" -ForegroundColor Gray
Write-Host "  Base URL: https://openrouter.ai/api/v1" -ForegroundColor Gray
Write-Host ""

# Start service
pnpm dev:phase7b
