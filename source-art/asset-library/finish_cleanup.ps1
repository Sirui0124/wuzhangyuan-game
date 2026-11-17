$ErrorActionPreference = 'Stop'
$workspace = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\..'))
$auditRoot = Join-Path $workspace 'outputs\media-cleanup-20261104'
if (-not (Test-Path -LiteralPath (Join-Path $auditRoot 'recycle-summary.json'))) { throw 'Primary cleanup must finish first' }
if (Test-Path -LiteralPath (Join-Path $auditRoot 'supplement-results.json')) { throw 'Supplement already executed' }
$latest = Join-Path $workspace 'source-art\opening-20261104\诸葛亮-上方谷雨火-v9.png'
if (-not (Test-Path -LiteralPath $latest)) { throw 'Latest delivered opening image missing' }
$targets = @(
    'source-art/asset-library/inspection-contact.jpg',
    'source-art/asset-library/page-preview.png',
    'source-art/opening-20261104/诸葛亮-上方谷雨火-v8.png',
    'source-art/opening-20261104/诸葛亮-上方谷雨火-v8.prompt.txt'
)
$smokeRoot = Join-Path $workspace 'outputs\ch1-six-clues-20261025\browser'
foreach ($item in (Get-ChildItem -LiteralPath $smokeRoot -File -Filter '*.png')) {
    $targets += [IO.Path]::GetRelativePath($workspace,$item.FullName).Replace('\','/')
}
$snapshot = @()
foreach ($path in $targets) {
    $absolute = [IO.Path]::GetFullPath((Join-Path $workspace $path))
    if (-not $absolute.StartsWith($workspace + '\',[StringComparison]::OrdinalIgnoreCase)) { throw 'Outside workspace' }
    if (-not (Test-Path -LiteralPath $absolute)) { continue }
    $item = Get-Item -LiteralPath $absolute
    if ($item.PSIsContainer -or ($item.Attributes -band [IO.FileAttributes]::ReparsePoint)) { throw 'Not a regular file' }
    $snapshot += @{path=$path;bytes=$item.Length;sha256=(Get-FileHash -LiteralPath $absolute -Algorithm SHA256).Hash.ToLower();ticks=[string]$item.LastWriteTimeUtc.Ticks}
}
$snapshot | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath (Join-Path $auditRoot 'supplement-plan.json') -Encoding utf8
Add-Type -AssemblyName Microsoft.VisualBasic
$results = @()
foreach ($entry in $snapshot) {
    $absolute = [IO.Path]::GetFullPath((Join-Path $workspace $entry.path))
    $item = Get-Item -LiteralPath $absolute
    if ([string]$item.LastWriteTimeUtc.Ticks -ne $entry.ticks) { throw 'Changed since plan' }
    [Microsoft.VisualBasic.FileIO.FileSystem]::DeleteFile($absolute,[Microsoft.VisualBasic.FileIO.UIOption]::OnlyErrorDialogs,[Microsoft.VisualBasic.FileIO.RecycleOption]::SendToRecycleBin,[Microsoft.VisualBasic.FileIO.UICancelOption]::ThrowException)
    if (Test-Path -LiteralPath $absolute) { throw 'File still exists' }
    $results += @{path=$entry.path;bytes=$entry.bytes;status='recycled'}
}
$results | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath (Join-Path $auditRoot 'supplement-results.json') -Encoding utf8
Write-Output "Supplement recycled $($results.Count) files"
