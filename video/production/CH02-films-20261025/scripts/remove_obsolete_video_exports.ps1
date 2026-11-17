$ErrorActionPreference = 'Stop'
$productionRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$endingRoot = [IO.Path]::GetFullPath((Join-Path $productionRoot '../ENDINGS-20261025/chapter-two'))
$auditDir = Join-Path $productionRoot 'audit/current-library-cleanup'
$planPath = Join-Path $auditDir 'deletion-plan.json'
$plan = Get-Content -LiteralPath $planPath -Raw -Encoding UTF8 | ConvertFrom-Json
$library = Get-Content -LiteralPath (Join-Path $productionRoot 'deliveries/最新成片/manifest.json') -Raw -Encoding UTF8 | ConvertFrom-Json
$allowedRoots = @($productionRoot, $endingRoot)
$protected = [Collections.Generic.HashSet[string]]::new([StringComparer]::OrdinalIgnoreCase)
foreach ($row in $plan.protected) { [void]$protected.Add([IO.Path]::GetFullPath($row.path)) }
$verified = [Collections.Generic.List[object]]::new()
$logPath = Join-Path $auditDir 'deleted-video-files.jsonl'
if (Test-Path -LiteralPath $logPath) { throw 'Deletion journal already exists; inspect it before resuming, do not repeat blindly.' }

# Check every current film and link before touching any historical export.
foreach ($row in $library.rows) {
    foreach ($mediaPath in @($row.file, $row.libraryPath)) {
        if ((Get-FileHash -LiteralPath $mediaPath -Algorithm SHA256).Hash.ToLowerInvariant() -ne $row.sha256) { throw "Current film changed: $mediaPath" }
    }
}
foreach ($row in $plan.delete) {
    $target = [IO.Path]::GetFullPath($row.path)
    $containingRoot = $allowedRoots | Where-Object { $target.StartsWith($_ + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase) }
    if (@($containingRoot).Count -ne 1) { throw "Target is outside exact chapter roots: $target" }
    if ($protected.Contains($target)) { throw "Protected target: $target" }
    if ([IO.Path]::GetExtension($target).ToLowerInvariant() -notin @('.mp4','.mov','.mkv','.webm','.avi')) { throw "Not a video: $target" }
    $item = Get-Item -LiteralPath $target -Force
    if ($item.PSIsContainer -or ($item.Attributes -band [IO.FileAttributes]::ReparsePoint)) { throw "Not an ordinary video file: $target" }
    $ancestor = $item.Directory
    while ($null -ne $ancestor) {
        if ($ancestor.Attributes -band [IO.FileAttributes]::ReparsePoint) { throw "Reparse parent not allowed: $($ancestor.FullName)" }
        if ($ancestor.FullName.Equals($containingRoot, [StringComparison]::OrdinalIgnoreCase)) { break }
        $ancestor = $ancestor.Parent
    }
    if ($item.Length -ne $row.bytes) { throw "Video changed size: $target" }
    $ticksSinceEpoch = $item.LastWriteTimeUtc.Ticks - [DateTime]::new(1970,1,1,0,0,0,[DateTimeKind]::Utc).Ticks
    if ([decimal]$ticksSinceEpoch * 100 -ne [decimal]$row.mtimeNs) { throw "Video changed timestamp: $target" }
    if ((Get-FileHash -LiteralPath $target -Algorithm SHA256).Hash.ToLowerInvariant() -ne $row.sha256) { throw "Video changed SHA256: $target" }
    $verified.Add($row)
}

# Only individually verified files are removed. No directory or recursive deletion.
$removed = [Collections.Generic.List[object]]::new()
foreach ($row in $verified) {
    Remove-Item -LiteralPath $row.path -Force
    $record = [ordered]@{path=$row.path;bytes=$row.bytes;sha256=$row.sha256;reason=$row.reason;deletedAt=[DateTimeOffset]::Now.ToString('o')}
    $line = $record | ConvertTo-Json -Compress
    Add-Content -LiteralPath $logPath -Value $line -Encoding UTF8
    $removed.Add($record)
}
$removedBytes = [long]0
foreach ($record in $removed) { $removedBytes += [long]$record['bytes'] }
$result = [ordered]@{completedAt=[DateTimeOffset]::Now.ToString('o');deletedCount=$removed.Count;deletedLogicalBytes=$removedBytes;roots=$allowedRoots;plan=$planPath;journal=$logPath;method='Native PowerShell Remove-Item -LiteralPath, ordinary files only; exact root, dependency, SHA256, size and timestamp preflight';physicalDiskFreeSpaceClaimed=$false}
$result | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath (Join-Path $auditDir 'deletion-result.json') -Encoding UTF8
$result | ConvertTo-Json -Depth 5
