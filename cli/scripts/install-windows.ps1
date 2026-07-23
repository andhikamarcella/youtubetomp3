param(
  [switch]$Local,
  [switch]$SkipTests
)

$ErrorActionPreference = "Stop"
$Version = "1.3.0"
Write-Host "YTConv $Version installer untuk PowerShell" -ForegroundColor Cyan

if (-not (Get-Command node.exe -ErrorAction SilentlyContinue)) {
  throw "Node.js 18+ belum terpasang. Pasang Node.js LTS, tutup PowerShell, lalu jalankan installer lagi."
}
if (-not (Get-Command npm.cmd -ErrorAction SilentlyContinue)) {
  throw "npm.cmd tidak ditemukan. Instalasi Node.js kemungkinan tidak lengkap."
}

$major = [int]((node.exe --version).TrimStart('v').Split('.')[0])
if ($major -lt 18) { throw "Node.js terlalu lama. YTConv memerlukan Node.js 18 atau lebih baru." }

if ($Local) {
  if (-not (Test-Path .\package.json)) { throw "Gunakan -Local dari folder cli repository YTConv." }
  if (-not $SkipTests) {
    & npm.cmd install
    & npm.cmd run check
    & npm.cmd test
    if ($LASTEXITCODE -ne 0) { throw "Pemeriksaan repository gagal; instalasi global dibatalkan." }
  }
  & npm.cmd install -g . --force
} else {
  & npm.cmd uninstall -g ytconv 2>$null
  & npm.cmd cache verify
  & npm.cmd install -g "ytconv@$Version" --force
}
if ($LASTEXITCODE -ne 0) { throw "npm gagal memasang YTConv." }

Write-Host "`nVerifikasi:" -ForegroundColor Cyan
& ytconv.cmd --version
& ytconv.cmd --self-test
& ytconv.cmd --shell-info
Write-Host "`nSelesai. Jalankan: ytconv.cmd atau ytconv" -ForegroundColor Green
Write-Host "Bila PowerShell memblokir ytconv.ps1, gunakan ytconv.cmd. Untuk mengizinkannya:" -ForegroundColor Yellow
Write-Host "Set-ExecutionPolicy -Scope CurrentUser RemoteSigned"
