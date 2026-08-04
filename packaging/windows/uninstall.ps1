$ErrorActionPreference = 'Stop'
$Target = Join-Path $env:LOCALAPPDATA 'Programs\YTConv'
$UserPath = [Environment]::GetEnvironmentVariable('Path', 'User')
$Parts = @($UserPath -split ';' | Where-Object { $_ -and $_.Trim() -and $_ -ne $Target })
[Environment]::SetEnvironmentVariable('Path', ($Parts -join ';'), 'User')
$Shortcut = Join-Path $env:APPDATA 'Microsoft\Windows\Start Menu\Programs\YTConv.lnk'
Remove-Item -LiteralPath $Shortcut -Force -ErrorAction SilentlyContinue
$Command = 'timeout /t 2 /nobreak >nul & rmdir /s /q "' + $Target + '"'
Start-Process -FilePath (Join-Path $env:SystemRoot 'System32\cmd.exe') -ArgumentList '/d', '/c', $Command -WindowStyle Hidden
Write-Host 'YTConv was removed. Open a new terminal to refresh PATH.'
