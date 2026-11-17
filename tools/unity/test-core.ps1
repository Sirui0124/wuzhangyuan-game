$ErrorActionPreference='Stop'
Set-Location (Join-Path $PSScriptRoot '../..')
node tools/unity/export-slice.mjs
if($LASTEXITCODE -ne 0){exit $LASTEXITCODE}
$compiler=Join-Path $env:WINDIR 'Microsoft.NET/Framework64/v4.0.30319/csc.exe'
& $compiler /nologo /target:exe /out:outputs\UnityPortTests.exe /reference:System.Web.Extensions.dll UnityPort\Assets\Scripts\StorySession.cs UnityPort\Tests\PortTests.cs
if($LASTEXITCODE -ne 0){exit $LASTEXITCODE}
& ./outputs/UnityPortTests.exe UnityPort/Assets/Resources/chapter-one-slice.json
exit $LASTEXITCODE
