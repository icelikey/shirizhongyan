param(
  [string]$EnvFile = "deploy/.env.local",
  [switch]$Seed,
  [switch]$Down
)

$ErrorActionPreference = "Stop"

if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
  throw "未找到 Docker。请先启动 Docker Desktop。"
}
if (-not (Test-Path $EnvFile)) {
  throw "找不到 $EnvFile。请先复制 deploy/.env.local.example。"
}

$compose = @("compose", "--env-file", $EnvFile, "-f", "docker-compose.local.yml")
if ($Down) {
  & docker @compose down
  exit $LASTEXITCODE
}

& docker @compose up -d --wait mysql
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

$envLines = Get-Content -LiteralPath $EnvFile | Where-Object { $_ -match '^[A-Za-z_][A-Za-z0-9_]*=' }
foreach ($line in $envLines) {
  $name, $value = $line -split '=', 2
  if ($name -eq 'DATABASE_URL') { $env:DATABASE_URL = $value }
}

Push-Location (Join-Path $PSScriptRoot "..\app")
try {
  pnpm db:push
  if ($Seed) { pnpm db:seed }
} finally {
  Pop-Location
}

Write-Host "本地数据库已就绪：$env:DATABASE_URL"
Write-Host "开发服务：在 app 目录运行 pnpm dev"
