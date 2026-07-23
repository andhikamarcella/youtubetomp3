param(
  [switch]$Local,
  [switch]$SkipTests
)

$ErrorActionPreference = "Stop"
$Version = "1.4.0"
Write-Host "YTConv $Version installer for PowerShell" -ForegroundColor Cyan

if (-not (Get-Command node.exe -ErrorAction SilentlyContinue)) {
  throw "Node.js 18 or newer is not installed. Install Node.js LTS, reopen PowerShell, and run this installer again."
}
if (-not (Get-Command npm.cmd -ErrorAction SilentlyContinue)) {
  throw "npm.cmd was not found. The Node.js installation may be incomplete."
}

$major = [int]((node.exe --version).TrimStart('v').Split('.')[0])
if ($major -lt 18) { throw "Node.js is too old. YTConv requires Node.js 18 or newer." }

if ($Local) {
  if (-not (Test-Path .\package.json)) { throw "Run -Local from the YTConv cli directory." }
  if (-not $SkipTests) {
    & npm.cmd install
    if ($LASTEXITCODE -ne 0) { throw "npm install failed." }
    & npm.cmd run check
    if ($LASTEXITCODE -ne 0) { throw "Syntax checks failed." }
    & npm.cmd test
    if ($LASTEXITCODE -ne 0) { throw "Unit tests failed; global installation was cancelled." }
  }
  & npm.cmd install -g . --force
} else {
  & npm.cmd uninstall -g ytconv 2>$null
  & npm.cmd cache verify
  & npm.cmd install -g "ytconv@$Version" --force
}
if ($LASTEXITCODE -ne 0) { throw "npm could not install YTConv." }

Write-Host "`nVerification:" -ForegroundColor Cyan
$installed = (& ytconv.cmd --version).Trim()
if ($installed -ne $Version) { throw "Installed version is $installed; expected $Version." }
& ytconv.cmd --self-test
& ytconv.cmd --shell-info
& ytconv.cmd doctor
Write-Host "`nInstallation completed. Run: ytconv.cmd or ytconv" -ForegroundColor Green
Write-Host "If PowerShell blocks ytconv.ps1, keep using ytconv.cmd. Optional current-user policy:" -ForegroundColor Yellow
Write-Host "Set-ExecutionPolicy -Scope CurrentUser RemoteSigned"
