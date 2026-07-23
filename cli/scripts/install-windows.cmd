@echo off
setlocal EnableExtensions
set "VERSION=1.5.0-beta.2"
set "CHANNEL=beta"
echo YTConv %VERSION% installer for CMD
where node.exe >nul 2>nul || (echo Node.js 18 or newer is not installed.& exit /b 1)
where npm.cmd >nul 2>nul || (echo npm.cmd was not found.& exit /b 1)
for /f "tokens=1 delims=." %%V in ('node -p "process.versions.node"') do set "NODE_MAJOR=%%V"
if %NODE_MAJOR% LSS 18 (echo Node.js is too old. Version 18 or newer is required.& exit /b 1)

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
echo Beta installation completed. Run: ytconv.cmd or ytconv
echo Return to stable: npm.cmd install -g ytconv@latest --force
endlocal
