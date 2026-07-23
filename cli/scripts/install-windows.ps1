$ErrorActionPreference = "Stop"
Write-Host "YTConv 1.2.3 installer untuk PowerShell" -ForegroundColor Cyan

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  throw "Node.js 18+ belum terpasang. Pasang Node.js LTS, tutup PowerShell, lalu jalankan installer lagi."
}
if (-not (Get-Command npm.cmd -ErrorAction SilentlyContinue)) {
  throw "npm.cmd tidak ditemukan. Instalasi Node.js kemungkinan tidak lengkap."
}

$major = [int]((node --version).TrimStart('v').Split('.')[0])
if ($major -lt 18) { throw "Node.js terlalu lama. YTConv memerlukan Node.js 18 atau lebih baru." }

& npm.cmd uninstall -g ytconv 2>$null
& npm.cmd cache verify
& npm.cmd install -g ytconv@1.2.3 --force
if ($LASTEXITCODE -ne 0) { throw "npm gagal memasang YTConv." }

Write-Host "`nVerifikasi:" -ForegroundColor Cyan
& ytconv.cmd --version
& ytconv.cmd --self-test
Write-Host "`nSelesai. Jalankan: ytconv atau ytconv.cmd" -ForegroundColor Green
Write-Host "Bila PowerShell memblokir ytconv.ps1, gunakan ytconv.cmd atau jalankan:" -ForegroundColor Yellow
Write-Host "Set-ExecutionPolicy -Scope CurrentUser RemoteSigned"
