@echo off
setlocal EnableExtensions
set "VERSION=1.6.4"
set "CHANNEL=latest"
echo YTConv %VERSION% installer for CMD
where node.exe >nul 2>nul || (echo Node.js 22.14 or newer is not installed.& exit /b 1)
where npm.cmd >nul 2>nul || (echo npm.cmd was not found.& exit /b 1)
node -e "const [a,b]=process.versions.node.split('.').map(Number);process.exit(a>22||(a===22&&b>=14)?0:1)" || (echo Node.js 22.14 or newer is required.& exit /b 1)

if /I "%~1"=="--local" goto LOCAL
call npm.cmd uninstall -g ytconv >nul 2>nul
call npm.cmd cache verify || exit /b 1
call npm.cmd install -g ytconv@%CHANNEL% --force || exit /b 1
goto VERIFY

:LOCAL
if not exist package.json (echo Run --local from the YTConv cli directory.& exit /b 1)
call npm.cmd install || exit /b 1
call npm.cmd run check || exit /b 1
call npm.cmd test || exit /b 1
call npm.cmd install -g . --force || exit /b 1

:VERIFY
for /f "delims=" %%V in ('ytconv.cmd --version') do set "INSTALLED=%%V"
if /I not "%INSTALLED%"=="%VERSION%" (echo Installed version is %INSTALLED%; expected %VERSION%.& exit /b 1)
call ytconv.cmd --self-test || exit /b 1
call ytconv.cmd --shell-info
call ytconv.cmd doctor
call ytconv.cmd quickstart
echo.
echo Retry hotfix: nested HTTP/fragment/file-access retry prefixes are normalized.
echo AUTO policy: music.youtube.com becomes MP3; regular YouTube becomes MP4.
echo Explicit audio/video mode and MP4/MKV/WebM selections remain authoritative.
echo Stable installation completed. Run: ytconv.cmd or ytconv
echo Public links are ready. If a site asks for login: ytconv.cmd login instagram
endlocal
