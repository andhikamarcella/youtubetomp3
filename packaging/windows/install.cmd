@echo off
setlocal EnableExtensions
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0install.ps1"
set "STATUS=%ERRORLEVEL%"
if not "%STATUS%"=="0" pause
exit /b %STATUS%
