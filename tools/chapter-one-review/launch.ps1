$ErrorActionPreference = 'Stop'
$reviewAddress = 'http://127.0.0.1:8941'
$reviewReady = $false
$reviewHealth = $null
try {
    $reviewHealth = Invoke-RestMethod "$reviewAddress/health" -TimeoutSec 2
} catch { }
if ($null -ne $reviewHealth) {
    if ($reviewHealth.app -ne 'chapter-one-review') { throw 'Port 8941 is used by another application.' }
    $reviewReady = $true
}
if (-not $reviewReady) {
    $reviewNode = (Get-Command node -ErrorAction Stop).Source
    Start-Process -FilePath $reviewNode -ArgumentList 'server.mjs' -WorkingDirectory $PSScriptRoot -WindowStyle Hidden -RedirectStandardOutput (Join-Path $PSScriptRoot 'server.log') -RedirectStandardError (Join-Path $PSScriptRoot 'server-error.log')
    for ($reviewAttempt = 0; $reviewAttempt -lt 40; $reviewAttempt++) {
        Start-Sleep -Milliseconds 250
        try {
            $reviewHealth = Invoke-RestMethod "$reviewAddress/health" -TimeoutSec 1
            if ($reviewHealth.app -eq 'chapter-one-review') { $reviewReady = $true; break }
        } catch { }
    }
}
if (-not $reviewReady) { throw "Review failed to start. See $PSScriptRoot\server-error.log" }
Start-Process $reviewAddress
