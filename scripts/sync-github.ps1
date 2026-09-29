[CmdletBinding()]
param(
  [string]$ProjectRoot = "",
  [string]$Remote = "origin",
  [switch]$DryRun
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

if ([string]::IsNullOrWhiteSpace($ProjectRoot)) {
  $ProjectRoot = Split-Path -Parent $PSScriptRoot
}
$ProjectRoot = (Resolve-Path -LiteralPath $ProjectRoot).Path

function Invoke-Git([string[]]$Arguments) {
  $output = & git -C $ProjectRoot @Arguments 2>&1
  if ($LASTEXITCODE -ne 0) {
    throw "Git 操作失败：$($Arguments -join ' ')`n$($output -join "`n")"
  }
  return @($output)
}

$lockHandle = $null
$lockPath = Join-Path $ProjectRoot ".git\zhongyan-sync.lock"
try {
  try {
    $lockHandle = [System.IO.File]::Open($lockPath, [System.IO.FileMode]::CreateNew, [System.IO.FileAccess]::Write, [System.IO.FileShare]::None)
  } catch [System.IO.IOException] {
    Write-Output "同步任务已在运行，跳过本轮。"
    exit 0
  }

  $gitRoot = (Invoke-Git @("rev-parse", "--show-toplevel") | Select-Object -First 1).Trim()
  if ((Resolve-Path -LiteralPath $gitRoot).Path -ne $ProjectRoot) {
    throw "ProjectRoot 不是 Git 仓库根目录：$ProjectRoot"
  }
  $branch = (Invoke-Git @("branch", "--show-current") | Select-Object -First 1).Trim()
  if ([string]::IsNullOrWhiteSpace($branch)) { throw "当前处于 detached HEAD，停止自动同步。" }

  # 先验证远端，不执行 pull，避免定时任务悄悄覆盖本地工作。
  Invoke-Git @("ls-remote", "--exit-code", $Remote, "HEAD") | Out-Null
  $status = @(Invoke-Git @("status", "--porcelain=v1", "--untracked-files=all"))
  if ($status.Count -eq 0) {
    Write-Output "[$(Get-Date -Format s)] 工作区没有待同步改动。"
    exit 0
  }

  $changedPaths = $status | ForEach-Object {
    $line = [string]$_
    if ($line.Length -gt 3) { $line.Substring(3).Trim('"') }
  } | Where-Object { $_ }
  $blockedName = $changedPaths | Where-Object {
    $_ -match '(^|[\\/])\.env(?:\.|$)|\.pem$|\.key$|(^|[\\/])(auth|credentials|secrets?)(?:\.|$)|(^|[\\/])agent\.json$|(^|[\\/])app\.tmp-'
  }
  if ($blockedName) {
    throw "检测到不应自动上传的文件，停止同步：$($blockedName -join ', ')"
  }

  # 只扫描仓库当前可见文件名，输出不包含匹配文本，避免把密钥写入任务日志。
  $trackedAndUntracked = @(git -C $ProjectRoot ls-files --cached --others --exclude-standard)
  $secretFiles = @()
  foreach ($relative in $trackedAndUntracked) {
    $full = Join-Path $ProjectRoot $relative
    if (-not (Test-Path -LiteralPath $full -PathType Leaf)) { continue }
    if ($relative -match '\.(test|spec)\.[^.]+$') { continue }
    $matches = Select-String -LiteralPath $full -Pattern '-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----','sk-[A-Za-z0-9]{20,}','tdg_[A-Za-z0-9_-]{24,}','AIza[0-9A-Za-z_-]{30,}' -AllMatches -Quiet -ErrorAction SilentlyContinue
    if ($matches) { $secretFiles += $relative }
  }
  if ($secretFiles.Count -gt 0) {
    throw "检测到疑似密钥内容，停止同步：$($secretFiles -join ', ')"
  }

  $check = @(git -C $ProjectRoot diff --check 2>&1)
  if ($LASTEXITCODE -ne 0) { throw "diff 检查失败：$($check -join "`n")" }
  if ($DryRun) {
    Write-Output "[$(Get-Date -Format s)] DryRun：将同步分支 $branch，改动 $($status.Count) 项。"
    exit 0
  }

  Invoke-Git @("add", "-A") | Out-Null
  $message = "sync: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
  Invoke-Git @("commit", "-m", $message) | Out-Null
  Invoke-Git @("push", $Remote, $branch) | Out-Null
  Write-Output "[$(Get-Date -Format s)] 已同步分支 $branch 到 GitHub。"
} finally {
  if ($lockHandle) { $lockHandle.Dispose() }
  Remove-Item -LiteralPath $lockPath -Force -ErrorAction SilentlyContinue
}
