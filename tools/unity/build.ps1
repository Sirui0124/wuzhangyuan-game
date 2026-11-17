param([string]$Editor=$env:UNITY_EDITOR)
$ErrorActionPreference='Stop'
Set-Location (Join-Path $PSScriptRoot '../..')
if(!$Editor -or !(Test-Path -LiteralPath $Editor)){throw '请设置 UNITY_EDITOR 为已激活的 Unity 6 Editor/Unity.exe 绝对路径。'}
node tools/unity/export-slice.mjs
if($LASTEXITCODE -ne 0){exit $LASTEXITCODE}
$project=(Resolve-Path UnityPort).Path
$log=Join-Path (Get-Location) 'outputs/unity-build.log'
& $Editor -batchmode -quit -projectPath $project -executeMethod Wuzhangyuan.PortBuild.Windows -logFile $log
exit $LASTEXITCODE
