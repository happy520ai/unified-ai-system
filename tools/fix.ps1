$file = 'E:\AI-Data\AI网关系统\unified-ai-system\src\OwlMTY.Infrastructure.Implementations\Exchanges\HuobiAdapter.cs'
$c = [System.IO.File]::ReadAllText($file)
$c = $c.Replace('result?.Data.== null', 'result?.Data == null')
$c = $c.Replace('var t = result.Data.', 'var t = result.Data')
[System.IO.File]::WriteAllText($file, $c)
Write-Host "Fixed HuobiAdapter.cs"
