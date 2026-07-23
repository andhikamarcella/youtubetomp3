@echo off
setlocal
echo YTConv 1.2.3 installer untuk CMD
where node >nul 2>nul || (echo Node.js 18+ belum terpasang.& exit /b 1)
where npm.cmd >nul 2>nul || (echo npm.cmd tidak ditemukan.& exit /b 1)
for /f "tokens=1 delims=." %%V in ('node -p "process.versions.node"') do set NODE_MAJOR=%%V
if %NODE_MAJOR% LSS 18 (echo Node.js terlalu lama. Minimal versi 18.& exit /b 1)
call npm.cmd uninstall -g ytconv >nul 2>nul
call npm.cmd cache verify
call npm.cmd install -g ytconv@1.2.3 --force || exit /b 1
call ytconv.cmd --version
call ytconv.cmd --self-test
echo Selesai. Jalankan: ytconv
endlocal
