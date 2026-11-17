param([Parameter(Mandatory=$true)][string]$UnitDirectory,[switch]$Submit,[string]$ResumeTaskId)
$ErrorActionPreference='Stop'
$unitRoot=(Resolve-Path -LiteralPath $UnitDirectory).Path
$invocation=Get-Content -LiteralPath (Join-Path $unitRoot 'invocation.json') -Raw | ConvertFrom-Json
$entry=$invocation.entry
$outputDir=Join-Path $unitRoot 'api'
if($ResumeTaskId){
  & $entry -TaskId $ResumeTaskId -OutputDirectory $outputDir -PollSeconds 20 -TimeoutMinutes 30
}else{
  $urls=@($invocation.urls)
  $params=@{PromptFile=(Join-Path $unitRoot 'prompt.txt');ReferenceImageUrls=$urls;Resolution='768P';Duration=[int]$invocation.duration;OutputDirectory=$outputDir;PollSeconds=20;TimeoutMinutes=30}
  if($Submit){$params.Submit=$true}
  & $entry @params
}


