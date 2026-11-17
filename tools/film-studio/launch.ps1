$ErrorActionPreference = 'Stop'
$studioRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '../..')).Path
$studioUrl = 'http://127.0.0.1:8926/'
$studioRunning = $false
try {
    $studioResponse = Invoke-RestMethod -Uri ($studioUrl + 'api/catalog') -TimeoutSec 2
    $studioRunning = $null -ne $studioResponse.clips
} catch {}
if (-not $studioRunning) {
    $studioNode = (Get-Command node -ErrorAction Stop).Source
    $studioServer = Join-Path $PSScriptRoot 'server.mjs'
    Start-Process -FilePath $studioNode -ArgumentList ('"' + $studioServer + '"') -WorkingDirectory $studioRoot -WindowStyle Hidden
    for ($studioAttempt = 0; $studioAttempt -lt 30; $studioAttempt++) {
        Start-Sleep -Milliseconds 300
        try { $studioResponse = Invoke-RestMethod -Uri ($studioUrl + 'api/catalog') -TimeoutSec 1; if ($null -ne $studioResponse.clips) { $studioRunning = $true; break } } catch {}
    }
}
if (-not $studioRunning) { throw '片场服务没有启动，请检查8926端口或运行 node tools/film-studio/server.mjs。' }
Start-Process $studioUrl
