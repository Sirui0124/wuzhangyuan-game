$ErrorActionPreference = 'Stop'
$workspace = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\..'))
$auditRoot = Join-Path $workspace 'outputs\media-cleanup-20261104'
$plan = Get-Content -LiteralPath (Join-Path $auditRoot 'deletion-plan.json') -Raw | ConvertFrom-Json
if ([IO.Path]::GetFullPath($plan.root) -ne $workspace) { throw 'Plan root mismatch' }
Add-Type -AssemblyName Microsoft.VisualBasic
$logPath = Join-Path $auditRoot 'recycle-results.jsonl'
if (Test-Path -LiteralPath $logPath) { throw 'Results already exist; inspect before retrying' }
# Validate every absolute path before the first mutation. No directory deletion.
foreach ($entry in $plan.files) {
    $target = [IO.Path]::GetFullPath((Join-Path $workspace $entry.path))
    if (-not $target.StartsWith($workspace + '\', [StringComparison]::OrdinalIgnoreCase)) { throw "Outside workspace: $target" }
    if ($entry.path -match '(^|/)(node_modules|\.git|\.build|\.cache|library|temp)(/|$)') { throw "Generated/protected path: $target" }
    if ($plan.protected.PSObject.Properties.Name -contains $entry.path) { throw "Protected target: $target" }
    $item = Get-Item -LiteralPath $target
    if ($item.PSIsContainer -or ($item.Attributes -band [IO.FileAttributes]::ReparsePoint)) { throw "Not a regular file: $target" }
}
$count = 0; $removedBytes = [long]0; $skipped = 0
foreach ($entry in $plan.files) {
    $target = [IO.Path]::GetFullPath((Join-Path $workspace $entry.path))
    $item = Get-Item -LiteralPath $target
    if ($item.Length -ne $entry.bytes -or [string]$item.LastWriteTimeUtc.Ticks -ne $entry.mtimeTicks) {
        $record = @{path=$entry.path;status='skipped-changed-since-plan';bytes=$item.Length}; $skipped++
    } else {
        try {
            [Microsoft.VisualBasic.FileIO.FileSystem]::DeleteFile($target,[Microsoft.VisualBasic.FileIO.UIOption]::OnlyErrorDialogs,[Microsoft.VisualBasic.FileIO.RecycleOption]::SendToRecycleBin,[Microsoft.VisualBasic.FileIO.UICancelOption]::ThrowException)
            if (Test-Path -LiteralPath $target) { throw 'File still present' }
            $record = @{path=$entry.path;status='recycled';bytes=$entry.bytes;kind=$entry.kind}; $count++; $removedBytes += $entry.bytes
        } catch {
            $record = @{path=$entry.path;status='failed';error=$_.Exception.Message};
            ($record | ConvertTo-Json -Compress) | Add-Content -LiteralPath $logPath -Encoding utf8
            throw
        }
    }
    ($record | ConvertTo-Json -Compress) | Add-Content -LiteralPath $logPath -Encoding utf8
    if ((($count+$skipped) % 250) -eq 0) { Write-Output "Processed $($count+$skipped)/$($plan.files.Count); recycled $count; skipped $skipped" }
}
$summary = @{recycled=$count;bytes=$removedBytes;skipped=$skipped;recycleBinEmptied=$false}
$summary | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $auditRoot 'recycle-summary.json') -Encoding utf8
$summary | ConvertTo-Json
