param([Parameter(Mandatory=$true)][string]$InstallerPath,[string]$ValidationRoot)
$ErrorActionPreference='Stop'
$workspaceRoot=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../../..'))
$installer=[IO.Path]::GetFullPath($InstallerPath)
$releaseOutput=Split-Path -Parent $installer
$outputsRoot=[IO.Path]::GetFullPath((Join-Path $workspaceRoot 'outputs'))
if (-not $releaseOutput.StartsWith($outputsRoot+[IO.Path]::DirectorySeparatorChar) -or (Split-Path -Leaf $releaseOutput) -notmatch '^windows-release-\d{8}-\d{4}.*$' -or -not (Test-Path -LiteralPath $installer)) { throw 'Expected a generated installer in a dated workspace release output' }
$allowedValidationRoot=[IO.Path]::GetFullPath((Join-Path $env:LOCALAPPDATA 'WuzhangyuanReleaseTests'))
if (-not $ValidationRoot) { $ValidationRoot=Join-Path $allowedValidationRoot ((Split-Path -Leaf $releaseOutput) -replace '^windows-release-','') }
$validationRoot=[IO.Path]::GetFullPath($ValidationRoot)
if (-not $validationRoot.StartsWith($allowedValidationRoot+[IO.Path]::DirectorySeparatorChar)) { throw 'Validation must use an isolated LOCALAPPDATA/WuzhangyuanReleaseTests child directory' }
$installRoot=[IO.Path]::GetFullPath((Join-Path $validationRoot 'app'))
if (-not $installRoot.StartsWith($validationRoot+[IO.Path]::DirectorySeparatorChar)) { throw 'Unexpected test install target' }
$output=Join-Path $releaseOutput 'validation'
if (Test-Path -LiteralPath (Join-Path $output 'installation-verification.json')) { throw 'Existing installation evidence must not be overwritten; use a new release output' }
New-Item -ItemType Directory -Path $output -Force | Out-Null
function Find-Installation {
  @('HKCU:/Software/Microsoft/Windows/CurrentVersion/Uninstall/*','HKLM:/Software/Microsoft/Windows/CurrentVersion/Uninstall/*','HKLM:/Software/WOW6432Node/Microsoft/Windows/CurrentVersion/Uninstall/*') | ForEach-Object {
    Get-ItemProperty $_ -ErrorAction SilentlyContinue | Where-Object { $_.DisplayName -match '逆转五丈原|Wuzhangyuan' }
  }
}
$existing=@(Find-Installation)
if ($existing.Count) { throw 'An existing Wuzhangyuan installation is present; do not overwrite or uninstall it during testing.' }
$shortcutPaths=@((Join-Path ([Environment]::GetFolderPath('Desktop')) '逆转五丈原.lnk'),(Join-Path ([Environment]::GetFolderPath('StartMenu')) 'Programs/逆转五丈原.lnk'))
foreach ($shortcut in $shortcutPaths) { if (Test-Path -LiteralPath $shortcut) { throw "An existing shortcut must be preserved: $shortcut" } }
if (Test-Path -LiteralPath (Join-Path $installRoot 'Wuzhangyuan.exe')) { throw 'Previous test install still exists; inspect it before another installation.' }
$beforePorts=@(Get-NetTCPConnection -LocalPort 8812,8787 -State Listen -ErrorAction SilentlyContinue | Select-Object LocalAddress,LocalPort,OwningProcess)
$result=[ordered]@{installer=$installer;installRoot=$installRoot;startedAt=[DateTime]::UtcNow.ToString('o');installExitCode=$null;appVerificationExitCode=$null;uninstallExitCode=$null;installed=$false;uninstalled=$false;userDataRetained=$false;developmentListenersPreserved=$false;passed=$false}
try {
  $installation=Start-Process -FilePath $installer -ArgumentList @('/S','--currentuser',"/D=$installRoot") -WindowStyle Hidden -PassThru -Wait
  $result.installExitCode=$installation.ExitCode
  if ($installation.ExitCode -ne 0) { throw "Installer exited with $($installation.ExitCode)" }
  $app=Join-Path $installRoot 'Wuzhangyuan.exe'
  if (-not (Test-Path -LiteralPath $app)) { throw 'Installer did not create the game executable at the test location' }
  $installed=@(Find-Installation)
  if ($installed.Count -ne 1) { throw 'Expected exactly one new test uninstall registration' }
  # NSIS may omit InstallLocation; its uninstaller path still identifies the installation.
  $uninstallCommand=[string]$installed[0].UninstallString
  $registeredUninstaller=if ($uninstallCommand -match '^"([^"]+)"') { $Matches[1] } elseif ($uninstallCommand -match '^(.+?\.exe)(?:\s|$)') { $Matches[1] } else { throw 'Uninstall registration has no executable path' }
  $registered=[IO.Path]::GetFullPath((Split-Path -Parent $registeredUninstaller)).TrimEnd('\')
  if ($registered -ne $installRoot.TrimEnd('\')) { throw 'Installer registration does not match the isolated test location' }
  $result.installed=$true
  $result.registration=[ordered]@{displayName=$installed[0].DisplayName;displayVersion=$installed[0].DisplayVersion;installLocation=$installed[0].InstallLocation;uninstallString=$uninstallCommand;key=$installed[0].PSChildName}
  $result.shortcuts=@($shortcutPaths | ForEach-Object { [ordered]@{path=$_;exists=(Test-Path -LiteralPath $_)} })
  Push-Location $workspaceRoot
  try { & node (Join-Path $PSScriptRoot 'test-installed.mjs') $app "--release-output=$releaseOutput" "--validation-root=$validationRoot" *> (Join-Path $output 'installed-app.log'); $result.appVerificationExitCode=$LASTEXITCODE }
  finally { Pop-Location }
  if ($result.appVerificationExitCode -ne 0) { throw "Installed app verification failed; see validation/installed-app.log" }
} catch { $result.failure=$_.Exception.Message }
finally {
  $uninstallers=@(Get-ChildItem -LiteralPath $installRoot -Filter 'Uninstall*.exe' -File -ErrorAction SilentlyContinue)
  if ($uninstallers.Count -eq 1) {
    $uninstaller=$uninstallers[0].FullName
    # Only this exact executable inside the verified test installation may uninstall.
    $resolvedUninstaller=[IO.Path]::GetFullPath($uninstaller)
    if (-not $resolvedUninstaller.StartsWith($installRoot+[IO.Path]::DirectorySeparatorChar)) { throw 'Unsafe uninstall target' }
    $uninstall=Start-Process -FilePath $resolvedUninstaller -ArgumentList '/S' -WindowStyle Hidden -PassThru -Wait
    $result.uninstallExitCode=$uninstall.ExitCode
    $deadline=[DateTime]::UtcNow.AddSeconds(45)
    do { Start-Sleep -Milliseconds 250 } while ((Test-Path -LiteralPath (Join-Path $installRoot 'Wuzhangyuan.exe')) -and [DateTime]::UtcNow -lt $deadline)
    $result.uninstalled=(-not (Test-Path -LiteralPath (Join-Path $installRoot 'Wuzhangyuan.exe'))) -and @(Find-Installation).Count -eq 0
    $appReportPath=Join-Path $output 'installed-app-verification.json'
    if (Test-Path -LiteralPath $appReportPath) {
      $appReport=Get-Content -Raw -LiteralPath $appReportPath | ConvertFrom-Json
      $result.userData=$appReport.userData
      $result.userDataRetained=Test-Path -LiteralPath (Join-Path $appReport.userData 'Local Storage/leveldb')
    }
    $result.shortcutsRemoved=@($shortcutPaths | Where-Object { Test-Path -LiteralPath $_ }).Count -eq 0
  }
  $afterPorts=@(Get-NetTCPConnection -LocalPort 8812,8787 -State Listen -ErrorAction SilentlyContinue | Select-Object LocalAddress,LocalPort,OwningProcess)
  $result.developmentListenersPreserved=($beforePorts | ConvertTo-Json -Compress) -eq ($afterPorts | ConvertTo-Json -Compress)
  $result.passed=$result.installed -and $result.appVerificationExitCode -eq 0 -and $result.uninstallExitCode -eq 0 -and $result.uninstalled -and $result.shortcutsRemoved -and $result.userDataRetained -and $result.developmentListenersPreserved
  $result.finishedAt=[DateTime]::UtcNow.ToString('o')
  [IO.File]::WriteAllText((Join-Path $output 'installation-verification.json'),($result | ConvertTo-Json -Depth 8),[Text.UTF8Encoding]::new($false))
  $result | ConvertTo-Json -Depth 8
}
if (-not $result.passed) { exit 1 }
