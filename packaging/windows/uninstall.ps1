$ErrorActionPreference = 'Stop'
$Target = Join-Path $env:LOCALAPPDATA 'Programs\YTConv'
$Launcher = Join-Path $env:LOCALAPPDATA 'Microsoft\WindowsApps\ytconv.cmd'
Remove-Item -LiteralPath $Launcher -Force -ErrorAction SilentlyContinue
$Shortcut = Join-Path $env:APPDATA 'Microsoft\Windows\Start Menu\Programs\YTConv.lnk'
Remove-Item -LiteralPath $Shortcut -Force -ErrorAction SilentlyContinue
$Command = 'timeout /t 2 /nobreak >nul & rmdir /s /q "' + $Target + '"'
Start-Process -FilePath (Join-Path $env:SystemRoot 'System32\cmd.exe') -ArgumentList '/d', '/c', $Command -WindowStyle Hidden
Write-Host 'YTConv was removed. Open a new terminal if it is still cached.'
