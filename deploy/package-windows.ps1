param(
  [string]$OutputDir = "release\windows",
  [switch]$SkipBuild,
  [switch]$KeepStaging
)

$ErrorActionPreference = "Stop"
$repo = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$appDir = Join-Path $repo "app"
$output = Join-Path $repo $OutputDir
$displayName = [string]([char]0x7EC8) + [string]([char]0x7109)
$packageDir = Join-Path $output $displayName
$seaDir = Join-Path $output ".sea"

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  throw "Node.js 20 or newer is required."
}
$nodeMajor = [int]((node --version).TrimStart('v').Split('.')[0])
if ($nodeMajor -lt 20) { throw "Node.js 20 or newer is required." }

if (-not $SkipBuild) {
  Push-Location $appDir
  try {
    pnpm build
    if ($LASTEXITCODE -ne 0) { throw "Application production build failed." }
  } finally { Pop-Location }
}

$boot = Join-Path $appDir "dist\boot.js"
$seaBoot = Join-Path $appDir "dist\boot.cjs"
$publicDir = Join-Path $appDir "dist\public"
if (-not (Test-Path $boot)) { throw "Missing app\dist\boot.js." }
if (-not (Test-Path $publicDir)) { throw "Missing app\dist\public." }

Push-Location $appDir
try {
  pnpm exec esbuild api/boot.ts --platform=node --bundle --format=cjs --outfile=dist/boot.cjs
  if ($LASTEXITCODE -ne 0) { throw "SEA CommonJS entry build failed." }
} finally { Pop-Location }
if (-not (Test-Path $seaBoot)) { throw "Missing app\dist\boot.cjs." }

Remove-Item -LiteralPath $seaDir -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item -LiteralPath $packageDir -Recurse -Force -ErrorAction SilentlyContinue
New-Item -ItemType Directory -Force $seaDir, $packageDir | Out-Null

$seaConfig = [ordered]@{
  main = $seaBoot
  output = (Join-Path $seaDir "endgame-prep.blob")
  disableExperimentalSEAWarning = $true
  useSnapshot = $false
  useCodeCache = $false
}
$seaConfigPath = Join-Path $seaDir "sea-config.json"
$seaConfig | ConvertTo-Json | Set-Content -LiteralPath $seaConfigPath -Encoding utf8
node --experimental-sea-config $seaConfigPath
if ($LASTEXITCODE -ne 0) { throw "Node SEA blob generation failed." }

$nodeExe = (Get-Command node).Source
$appExe = Join-Path $packageDir ($displayName + ".exe")
Copy-Item -LiteralPath $nodeExe -Destination $appExe -Force

$postjectArgs = @(
  "--yes", "postject", $appExe, "NODE_SEA_BLOB", (Join-Path $seaDir "endgame-prep.blob"),
  "--sentinel-fuse", "NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2"
)
npx @postjectArgs
if ($LASTEXITCODE -ne 0) { throw "Windows executable packaging failed." }

New-Item -ItemType Directory -Force (Join-Path $packageDir "dist") | Out-Null
Copy-Item -LiteralPath $publicDir -Destination (Join-Path $packageDir "dist\public") -Recurse -Force
Copy-Item -LiteralPath (Join-Path $repo "cli") -Destination (Join-Path $packageDir "cli") -Recurse -Force
Copy-Item -LiteralPath (Join-Path $repo "docker-compose.local.yml") -Destination (Join-Path $packageDir "docker-compose.local.yml") -Force
$envExample = Join-Path $repo "deploy\.env.local.example"
if (Test-Path $envExample) {
  Copy-Item -LiteralPath $envExample -Destination (Join-Path $packageDir ".env.local.example") -Force
}
Copy-Item -LiteralPath (Join-Path $repo "DEPLOY.md") -Destination (Join-Path $packageDir "DEPLOY.md") -Force
Copy-Item -LiteralPath (Join-Path $repo "docs\EXTERNAL-AGENT-HANDBOOK.md") -Destination (Join-Path $packageDir "EXTERNAL-AGENT-HANDBOOK.md") -Force

@'
@echo off
setlocal
cd /d "%~dp0"
set NODE_ENV=production
if "%PORT%"=="" set PORT=3000
echo Endgame service: http://127.0.0.1:%PORT%/
echo Agent gateway: http://127.0.0.1:%PORT%/world/v1
endgame.exe
pause
'@ | Set-Content -LiteralPath (Join-Path $packageDir "start-endgame.cmd") -Encoding ascii

@'
# Endgame Windows package

## Start

1. Prepare MySQL 8 or MariaDB and set production environment variables.
2. Copy \`.env.local.example\` to \`.env\` and fill in \`APP_SECRET\`, \`DATABASE_URL\`, and \`AGENT_REGISTRATION_CODE\`.
3. Run \`start-endgame.cmd\` or run the executable directly.
4. Open \`http://127.0.0.1:3000/\` in a browser.

## Agent access

\`\`\`powershell
node .\cli\tdg-agent.mjs register --url http://127.0.0.1:3000 --name "External Agent" --invite-code YOUR_INVITE
node .\cli\tdg-agent.mjs doctor --url http://127.0.0.1:3000
node .\cli\tdg-agent.mjs rooms
\`\`\`

The registration key is saved in \`%USERPROFILE%\.tdg\agent.json\` and is shown only once. Keep it out of the repository, URLs, and chat.
'@ | Set-Content -LiteralPath (Join-Path $packageDir "README-WINDOWS.md") -Encoding utf8

$zipPath = Join-Path $output ($displayName + "-windows.zip")
Remove-Item -LiteralPath $zipPath -Force -ErrorAction SilentlyContinue
Compress-Archive -Path $packageDir -DestinationPath $zipPath -CompressionLevel Optimal

if (-not $KeepStaging) {
  Remove-Item -LiteralPath $seaDir -Recurse -Force -ErrorAction SilentlyContinue
}

Write-Host "Windows package: $zipPath"
Write-Host "Executable: $appExe"

