param(
    [string]$BaseUrl = "http://127.0.0.1:3100"
)

$ErrorActionPreference = "Stop"
$BaseUrl = $BaseUrl.TrimEnd("/")
$promptText = "PowerShell Invoke-RestMethod runtime test"

try {
    $models = Invoke-RestMethod -Uri "$BaseUrl/v1/models" -Method Get
    $payload = [ordered]@{
        model = "local-fake-model"
        messages = @(
            [ordered]@{
                role = "user"
                content = $promptText
            }
        )
    }
    $chat = Invoke-RestMethod `
        -Uri "$BaseUrl/v1/chat/completions" `
        -Method Post `
        -ContentType "application/json" `
        -Body ($payload | ConvertTo-Json -Depth 8)

    $content = [string]$chat.choices[0].message.content
    $checks = [ordered]@{
        models = @($models.data | Where-Object { $_.id -eq "local-fake-model" }).Count -gt 0
        chat = $chat.object -eq "chat.completion" -and $chat.model -eq "local-fake-model"
        content = $content.Contains($promptText)
        fakeProvider = $content.Contains("[fake:local-fake-provider/local-fake-model]") -and `
            $chat.unified_ai.execution_mode -eq "fake"
    }
    $ok = -not ($checks.Values -contains $false)
    $result = [ordered]@{
        client = "http-powershell-invoke-restmethod"
        sdk = "PowerShell Invoke-RestMethod"
        sdkVersion = $PSVersionTable.PSVersion.ToString()
        checks = $checks
        ok = $ok
        realProviderCallsMade = $false
    }
    $result | ConvertTo-Json -Depth 8
    if (-not $ok) { exit 1 }
} catch {
    [ordered]@{
        client = "http-powershell-invoke-restmethod"
        sdk = "PowerShell Invoke-RestMethod"
        sdkVersion = $PSVersionTable.PSVersion.ToString()
        checks = [ordered]@{}
        ok = $false
        realProviderCallsMade = $false
        error = $_.Exception.Message
    } | ConvertTo-Json -Depth 8
    exit 1
}
