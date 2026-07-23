@echo off
setlocal EnableExtensions
set "VERSION=1.5.0-beta.1"
echo YTConv %VERSION% installer untuk CMD
where node.exe >nul 2>nul || (echo Node.js 18+ belum terpasang.& exit /b 1)
where npm.cmd >nul 2>nul || (echo npm.cmd tidak ditemukan.& exit /b 1)
for /f "tokens=1 delims=." %%V in ('node -p "process.versions.node"') do set "NODE_MAJOR=%%V"
if %NODE_MAJOR% LSS 18 (echo Node.js terlalu lama. Minimal versi 18.& exit /b 1)

if /I "%~1"=="--local" goto LOCAL
call npm.cmd uninstall -g ytconv >nul 2>nul
call npm.cmd cache verify || exit /b 1
call npm.cmd install -g ytconv@beta --force || exit /b 1
goto VERIFY

:LOCAL
if not exist package.json (echo Gunakan --local dari folder cli repository YTConv.& exit /b 1)
call npm.cmd install || exit /b 1
call npm.cmd run check || exit /b 1
call npm.cmd test || exit /b 1
call npm.cmd install -g . --force || exit /b 1

:VERIFY
for /f "delims=" %%V in ('ytconv.cmd --version') do set "INSTALLED=%%V"
if /I not "%INSTALLED%"=="%VERSION%" (echo Versi terpasang %INSTALLED%, seharusnya %VERSION%.& exit /b 1)
call ytconv.cmd --self-test || exit /b 1
call ytconv.cmd --shell-info
call ytconv.cmd doctor
echo.
echo Default beta: subtitle ON, SponsorBlock mark ON, archive ON.
echo Matikan: --no-subtitles --no-sponsorblock --no-archive
echo Selesai. Jalankan: ytconv.cmd atau ytconv
endlocal
