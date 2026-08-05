$ErrorActionPreference = 'Stop'
$Version = '1.7.0'
$Source = Split-Path -Parent $MyInvocation.MyCommand.Path
$Payload = Join-Path $Source 'payload.zip'
$Target = Join-Path $env:LOCALAPPDATA 'Programs\YTConv'

if (-not (Test-Path -LiteralPath $Payload)) {
    throw "Installer payload is missing: $Payload"
}

$Stage = Join-Path $env:TEMP ("ytconv-install-" + [guid]::NewGuid().ToString('N'))
try {
    New-Item -ItemType Directory -Path $Stage -Force | Out-Null
    Expand-Archive -LiteralPath $Payload -DestinationPath $Stage -Force
    $VersionFile = Join-Path $Stage 'VERSION'
    if (-not (Test-Path -LiteralPath $VersionFile)) { throw 'Payload version file is missing.' }
    if ((Get-Content -LiteralPath $VersionFile -Raw).Trim() -ne $Version) { throw 'Payload version mismatch.' }

    if (Test-Path -LiteralPath $Target) {
        Remove-Item -LiteralPath $Target -Recurse -Force
    }
    New-Item -ItemType Directory -Path (Split-Path -Parent $Target) -Force | Out-Null
    Move-Item -LiteralPath $Stage -Destination $Target
    $Stage = $null

    $UserPath = [Environment]::GetEnvironmentVariable('Path', 'User')
    $Parts = @($UserPath -split ';' | Where-Object { $_ -and $_.Trim() })
    if ($Parts -notcontains $Target) {
        $NewPath = (@($Parts) + $Target) -join ';'
        [Environment]::SetEnvironmentVariable('Path', $NewPath, 'User')
    }

    $StartMenu = Join-Path $env:APPDATA 'Microsoft\Windows\Start Menu\Programs'
    $ShortcutPath = Join-Path $StartMenu 'YTConv.lnk'
    $Shell = New-Object -ComObject WScript.Shell
    $Shortcut = $Shell.CreateShortcut($ShortcutPath)
    $Shortcut.TargetPath = Join-Path $env:SystemRoot 'System32\cmd.exe'
    $Shortcut.Arguments = '/K ""' + (Join-Path $Target 'ytconv.cmd') + '""'
    $Shortcut.WorkingDirectory = [Environment]::GetFolderPath('UserProfile')
    $Shortcut.Description = 'YTConv 1.7.0 social-media downloader and converter'
    $Shortcut.Save()

    $InstalledVersion = (& (Join-Path $Target 'ytconv.cmd') --version).Trim()
    if ($InstalledVersion -ne $Version) { throw "Installed version is $InstalledVersion; expected $Version." }
    Write-Host "YTConv $Version installed successfully."
    Write-Host "Open a new CMD or PowerShell window, then run: ytconv --version"
} finally {
    if ($Stage -and (Test-Path -LiteralPath $Stage)) {
        Remove-Item -LiteralPath $Stage -Recurse -Force -ErrorAction SilentlyContinue
    }
}
