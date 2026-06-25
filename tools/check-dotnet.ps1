# Test .NET SDK
Write-Host "=== .NET SDK Versions ==="
dotnet --list-sdks

Write-Host "`n=== .NET Runtime Versions ==="
dotnet --list-runtimes

Write-Host "`n=== Dotnet Path ==="
$env:PATH -split ';' | Where-Object { $_ -like '*dotnet*' }
