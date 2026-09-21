#Requires -Version 5.1
<#
  WWS 4시간 로컬 스케줄러 (Windows 작업 스케줄러)
  등록:   powershell -ExecutionPolicy Bypass -File scripts/register-4h-task.ps1
  해제:   powershell -ExecutionPolicy Bypass -File scripts/register-4h-task.ps1 -Unregister
  4시간마다 node scripts/run-4h.mjs 실행 → reports/4h-*.json
#>
param([switch]$Unregister)
$TaskName = "WWS-4H-Check"
$Repo = Split-Path (Split-Path $MyInvocation.MyCommand.Path -Parent) -Parent
$Node = (Get-Command node -ErrorAction SilentlyContinue).Source
if (-not $Node) { Write-Error "node를 찾을 수 없음 (PATH 확인)"; exit 1 }
$Log = Join-Path $Repo "reports\4h-task.log"

if ($Unregister) {
  Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false -ErrorAction SilentlyContinue
  Write-Host "🗑️ $TaskName 해제됨"
  exit 0
}

$Action = New-ScheduledTaskAction -Execute $Node -Argument "scripts/run-4h.mjs" -WorkingDirectory $Repo
$Trigger = New-ScheduledTaskTrigger -Once -At (Get-Date).AddMinutes(5) -RepetitionInterval (New-TimeSpan -Hours 4) -RepetitionDuration ([TimeSpan]::MaxValue)
$Settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -ExecutionTimeLimit (New-TimeSpan -Hours 1)
Register-ScheduledTask -TaskName $TaskName -Action $Action -Trigger $Trigger -Settings $Settings -Description "WWS 4시간 자동화 BE+FE+LiveLike" -Force | Out-Null
Write-Host "✅ $TaskName 등록됨 (4시간 간격)"
Write-Host "   repo: $Repo"
Write-Host "   log : $Log"
Write-Host "   수동 실행: node scripts/run-4h.mjs"
