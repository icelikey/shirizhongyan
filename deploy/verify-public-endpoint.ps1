param(
  [Parameter(Mandatory = $true)]
  [string]$BaseUrl,
  [switch]$RequireReady,
  [switch]$BypassProxy
)

$ErrorActionPreference = "Stop"
$normalized = $BaseUrl.TrimEnd('/')

function Probe([string]$Path, [bool]$ExpectJson = $true) {
  try {
    if ($BypassProxy) {
      if (-not (Get-Command curl.exe -ErrorAction SilentlyContinue)) {
        throw "-BypassProxy 需要 curl.exe"
      }
      $raw = & curl.exe --noproxy "*" --silent --show-error --max-time 20 --write-out "`n__TDG_STATUS__%{http_code}" "$normalized$Path"
      $text = [string]::Join("`n", @($raw))
      $marker = "`n__TDG_STATUS__"
      $index = $text.LastIndexOf($marker, [System.StringComparison]::Ordinal)
      if ($index -lt 0) { throw "直连探针没有返回 HTTP 状态码" }
      $content = $text.Substring(0, $index)
      $status = [int]$text.Substring($index + $marker.Length)
      $body = if ($ExpectJson) { $content | ConvertFrom-Json } else { $null }
      return [pscustomobject]@{ path = $Path; status = $status; ok = if ($ExpectJson) { $body.ok -eq $true } else { $status -ge 200 -and $status -lt 400 }; transport = "direct" }
    }
    $response = Invoke-WebRequest -Uri "$normalized$Path" -UseBasicParsing -TimeoutSec 20
    $body = if ($ExpectJson) { $response.Content | ConvertFrom-Json } else { $null }
    return [pscustomobject]@{ path = $Path; status = [int]$response.StatusCode; ok = if ($ExpectJson) { $body.ok -eq $true } else { $response.StatusCode -ge 200 -and $response.StatusCode -lt 400 }; transport = "system" }
  } catch {
    return [pscustomobject]@{ path = $Path; status = 0; ok = $false; error = $_.Exception.Message; transport = if ($BypassProxy) { "direct" } else { "system" } }
  }
}

$results = @(
  (Probe "/api/health"),
  (Probe "/api/ready"),
  # 协议发现返回 WorldNode 描述对象，不是 { ok: true } 健康对象；只检查 HTTP 成功。
  (Probe "/.well-known/tdg-world.json" $false),
  (Probe "/" $false),
  (Probe "/agent-portal" $false),
  (Probe "/world" $false)
)
$results | ConvertTo-Json -Depth 4

if (-not ($results | Where-Object { $_.path -eq "/api/health" -and $_.ok })) {
  throw "公网进程健康探针失败"
}
if ($RequireReady -and -not ($results | Where-Object { $_.path -eq "/api/ready" -and $_.ok })) {
  throw "公网数据库就绪探针失败"
}
