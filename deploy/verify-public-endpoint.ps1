param(
  [Parameter(Mandatory = $true)]
  [string]$BaseUrl,
  [switch]$RequireReady
)

$ErrorActionPreference = "Stop"
$normalized = $BaseUrl.TrimEnd('/')

function Probe([string]$Path) {
  try {
    $response = Invoke-WebRequest -Uri "$normalized$Path" -UseBasicParsing -TimeoutSec 20
    $body = $response.Content | ConvertFrom-Json
    return [pscustomobject]@{ path = $Path; status = [int]$response.StatusCode; ok = ($body.ok -eq $true) }
  } catch {
    return [pscustomobject]@{ path = $Path; status = 0; ok = $false; error = $_.Exception.Message }
  }
}

$results = @(
  (Probe "/api/health"),
  (Probe "/api/ready"),
  (Probe "/.well-known/tdg-world.json")
)
$results | ConvertTo-Json -Depth 4

if (-not ($results | Where-Object { $_.path -eq "/api/health" -and $_.ok })) {
  throw "公网进程健康探针失败"
}
if ($RequireReady -and -not ($results | Where-Object { $_.path -eq "/api/ready" -and $_.ok })) {
  throw "公网数据库就绪探针失败"
}
