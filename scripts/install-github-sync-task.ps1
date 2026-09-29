[CmdletBinding()]
param(
  [int]$IntervalMinutes = 30,
  [string]$TaskName = "Zhongyan-GitHub-Sync"
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest
if ($IntervalMinutes -lt 5) { throw "IntervalMinutes 至少为 5。" }

$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$syncScript = Join-Path $PSScriptRoot "sync-github.ps1"
$powershell = (Get-Command powershell.exe -ErrorAction Stop).Source
$arguments = "-NoProfile -ExecutionPolicy Bypass -File `"$syncScript`" -ProjectRoot `"$projectRoot`""
$action = New-ScheduledTaskAction -Execute $powershell -Argument $arguments -WorkingDirectory $projectRoot
$start = (Get-Date).AddMinutes(1)
# Windows 任务计划 XML 不接受 TimeSpan::MaxValue；十年覆盖期足够长期运行，重装脚本可续期。
$trigger = New-ScheduledTaskTrigger -Once -At $start -RepetitionInterval (New-TimeSpan -Minutes $IntervalMinutes) -RepetitionDuration (New-TimeSpan -Days 3650)
$principal = New-ScheduledTaskPrincipal -UserId "$env:USERDOMAIN\$env:USERNAME" -LogonType Interactive -RunLevel Limited

Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $trigger -Principal $principal -Description "定期把终焉的世界当前分支安全同步到 GitHub；远端冲突或疑似密钥时自动停止。" -Force | Out-Null
Write-Output "已创建定时任务：$TaskName"
Write-Output "项目：$projectRoot"
Write-Output "频率：每 $IntervalMinutes 分钟"
