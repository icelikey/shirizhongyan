param(
  [Parameter(Mandatory = $true)]
  [string]$ProjectId,
  [string]$Region = "asia-east1",
  [string]$ServiceName = "ten-days-gambit",
  [string]$Repository = "tdg",
  [string]$ImageTag = "latest",
  [string]$EnvVarsFile = "deploy/cloud-run.env.yaml",
  [string]$FrontendAppId = "tdg-cloud",
  [string]$KimiAuthUrl = "https://auth.kimi.com",
  [string]$CloudSqlInstance = "",
  [switch]$AllowUnauthenticated
)

$ErrorActionPreference = "Stop"

if (-not (Get-Command gcloud -ErrorAction SilentlyContinue)) {
  throw "未找到 gcloud。请先安装 Google Cloud CLI 并完成 gcloud auth login。"
}
if (-not (Test-Path $EnvVarsFile)) {
  throw "找不到 $EnvVarsFile。请复制 deploy/cloud-run.env.example.yaml 并填写部署环境。"
}

gcloud config set project $ProjectId | Out-Host
gcloud services enable run.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com | Out-Host

gcloud artifacts repositories describe $Repository --location=$Region 2>$null
if ($LASTEXITCODE -ne 0) {
  gcloud artifacts repositories create $Repository --repository-format=docker --location=$Region --description="Ten Days Gambit images" | Out-Host
}

$image = "$Region-docker.pkg.dev/$ProjectId/$Repository/$ServiceName`:$ImageTag"

Write-Host "构建镜像：$image"
gcloud builds submit . --config deploy/cloudbuild.yaml --substitutions "_IMAGE=$image,_VITE_APP_ID=$FrontendAppId,_VITE_KIMI_AUTH_URL=$KimiAuthUrl" | Out-Host

$deployArgs = @(
  "run", "deploy", $ServiceName,
  "--image", $image,
  "--region", $Region,
  "--platform", "managed",
  "--min", "1",
  "--max", "1",
  "--cpu", "1",
  "--memory", "1Gi",
  "--env-vars-file", $EnvVarsFile
)
if ($AllowUnauthenticated) {
  $deployArgs += "--allow-unauthenticated"
}
if ($CloudSqlInstance) {
  $deployArgs += @("--add-cloudsql-instances", $CloudSqlInstance)
}

Write-Host "部署 Cloud Run：$ServiceName（单实例）"
& gcloud @deployArgs
