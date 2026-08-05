param(
  [switch]$Local,
  [switch]$SkipTests
)

$ErrorActionPreference = "Stop"
$Version = "1.6.6"
$Channel = "latest"
Write-Host "YTConv $Version installer for PowerShell"

if (-not (Get-Command node.exe -ErrorAction SilentlyContinue)) {
  throw "Node.js 22.14 or newer is not installed. Install a supported Node.js LTS release, reopen PowerShell, and run this installer again."
}
if (-not (Get-Command npm.cmd -ErrorAction SilentlyContinue)) {
  throw "npm.cmd was not found. The Node.js installation may be incomplete."
}

$nodeParts = (node.exe --version).TrimStart('v').Split('.')
$major = [int]$nodeParts[0]
$minor = [int]$nodeParts[1]
if (($major -lt 22) -or (($major -eq 22) -and ($minor -lt 14))) { throw "YTConv requires Node.js 22.14 or newer." }

if ($Local) {
  if (-not (Test-Path .\package.json)) { throw "Run -Local from the YTConv cli directory." }
  if (-not $SkipTests) {
    & npm.cmd ci --ignore-scripts
    if ($LASTEXITCODE -ne 0) { throw "npm ci failed." }
    & npm.cmd run check
    if ($LASTEXITCODE -ne 0) { throw "Syntax checks failed." }
    & npm.cmd run typecheck
    if ($LASTEXITCODE -ne 0) { throw "Type checking failed." }
    & npm.cmd test
    if ($LASTEXITCODE -ne 0) { throw "Unit tests failed; global installation was cancelled." }
  }
  & npm.cmd install -g . --ignore-scripts --force
} else {
  & npm.cmd uninstall -g ytconv 2>$null
  & npm.cmd cache verify
  & npm.cmd install -g "ytconv@$Channel" --ignore-scripts --force
}
if ($LASTEXITCODE -ne 0) { throw "npm could not install YTConv." }

Write-Host "`nVerification:"
$installed = (& ytconv.cmd --version).Trim()
if ($installed -ne $Version) { throw "Installed version is $installed; expected $Version." }
& ytconv.cmd --self-test
& ytconv.cmd --shell-info
& ytconv.cmd doctor
& ytconv.cmd quickstart
Write-Host "`nAUTO policy: music.youtube.com becomes MP3; regular YouTube becomes MP4."
Write-Host "Explicit audio/video mode and MP4/MKV/WebM selections remain authoritative."
Write-Host "Stable installation completed. Run: ytconv.cmd or ytconv"
Write-Host "A standalone EXE installer is also provided in the GitHub 1.6.6 release."
