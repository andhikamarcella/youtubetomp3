@echo off
setlocal EnableExtensions
set "VERSION=1.3.0"
echo YTConv %VERSION% installer untuk CMD
where node.exe >nul 2>nul || (echo Node.js 18+ belum terpasang.& exit /b 1)
where npm.cmd >nul 2>nul || (echo npm.cmd tidak ditemukan.& exit /b 1)
for /f "tokens=1 delims=." %%V in ('node -p "process.versions.node"') do set "NODE_MAJOR=%%V"
if %NODE_MAJOR% LSS 18 (echo Node.js terlalu lama. Minimal versi 18.& exit /b 1)

if /I "%~1"=="--local" goto LOCAL
call npm.cmd uninstall -g ytconv >nul 2>nul
call npm.cmd cache verify || exit /b 1
call npm.cmd install -g ytconv@%VERSION% --force || exit /b 1
goto VERIFY

:LOCAL
if not exist package.json (echo Gunakan --local dari folder cli repository YTConv.& exit /b 1)
call npm.cmd install || exit /b 1
call npm.cmd run check || exit /b 1
call npm.cmd test || exit /b 1
call npm.cmd install -g . --force || exit /b 1

:VERIFY
call ytconv.cmd --version || exit /b 1
call ytconv.cmd --self-test
call ytconv.cmd --shell-info
echo.
echo Selesai. Jalankan: ytconv.cmd atau ytconv
endlocal
