param(
    [string]$OutputDirectory = ""
)

$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$Cli = Join-Path $Root 'cli'
$Version = '1.6.5'
$NodeVersion = '24.18.0'
$NodeArchive = "node-v$NodeVersion-win-x64.zip"
$NodeBase = "https://nodejs.org/dist/v$NodeVersion"
if (-not $OutputDirectory) { $OutputDirectory = Join-Path $Root 'dist\windows' }
$OutputDirectory = [IO.Path]::GetFullPath($OutputDirectory)
$Work = Join-Path $env:TEMP ("ytconv-windows-build-" + [guid]::NewGuid().ToString('N'))

try {
    Remove-Item -LiteralPath $OutputDirectory -Recurse -Force -ErrorAction SilentlyContinue
    New-Item -ItemType Directory -Path $OutputDirectory, $Work -Force | Out-Null

    $ManifestVersion = (& node.exe -p "require('$($Cli.Replace('\','/'))/package.json').version").Trim()
    if ($ManifestVersion -ne $Version) { throw "Expected $Version, got $ManifestVersion" }

    $Checksums = Join-Path $Work 'SHASUMS256.txt'
    $NodeZip = Join-Path $Work $NodeArchive
    Invoke-WebRequest -UseBasicParsing -Uri "$NodeBase/SHASUMS256.txt" -OutFile $Checksums
    Invoke-WebRequest -UseBasicParsing -Uri "$NodeBase/$NodeArchive" -OutFile $NodeZip
    $Expected = ((Get-Content -LiteralPath $Checksums) | Where-Object { $_ -match "  $([regex]::Escape($NodeArchive))$" } | Select-Object -First 1).Split(' ')[0]
    if (-not $Expected) { throw "Node checksum was not found for $NodeArchive" }
    $Actual = (Get-FileHash -Algorithm SHA256 -LiteralPath $NodeZip).Hash.ToLowerInvariant()
    if ($Actual -ne $Expected.ToLowerInvariant()) { throw "Node SHA-256 mismatch." }

    $PackJson = Join-Path $Work 'pack.json'
    Push-Location $Cli
    try {
        & npm.cmd pack --ignore-scripts --json --pack-destination $Work | Set-Content -LiteralPath $PackJson -Encoding utf8
        if ($LASTEXITCODE -ne 0) { throw 'npm pack failed.' }
    } finally {
        Pop-Location
    }
    $Pack = (Get-Content -LiteralPath $PackJson -Raw | ConvertFrom-Json)[0]
    $Tarball = Join-Path $Work $Pack.filename

    $Payload = Join-Path $Work 'payload'
    $App = Join-Path $Payload 'app'
    $Node = Join-Path $Payload 'node'
    New-Item -ItemType Directory -Path $App, $Node -Force | Out-Null
    & tar.exe -xzf $Tarball -C $App --strip-components=1
    if ($LASTEXITCODE -ne 0) { throw 'Could not extract npm tarball.' }
    Push-Location $App
    try {
        & npm.cmd install --omit=dev --ignore-scripts --no-audit --no-fund --no-package-lock
        if ($LASTEXITCODE -ne 0) { throw 'Production dependency installation failed.' }
    } finally {
        Pop-Location
    }

    $NodeExtract = Join-Path $Work 'node-extract'
    Expand-Archive -LiteralPath $NodeZip -DestinationPath $NodeExtract -Force
    $ExtractedNode = Join-Path $NodeExtract "node-v$NodeVersion-win-x64"
    Copy-Item -Path (Join-Path $ExtractedNode '*') -Destination $Node -Recurse -Force

    @"
@echo off
setlocal EnableExtensions
set "YTCONV_DISTRIBUTION_PACKAGE=windows-exe"
"%~dp0node\node.exe" "%~dp0app\bin\ytconv-auth.js" %*
exit /b %ERRORLEVEL%
"@ | Set-Content -LiteralPath (Join-Path $Payload 'ytconv.cmd') -Encoding ascii

    @'
$env:YTCONV_DISTRIBUTION_PACKAGE = 'windows-exe'
& "$PSScriptRoot\node\node.exe" "$PSScriptRoot\app\bin\ytconv-auth.js" @args
exit $LASTEXITCODE
'@ | Set-Content -LiteralPath (Join-Path $Payload 'ytconv.ps1') -Encoding utf8

    Copy-Item -LiteralPath (Join-Path $Root 'packaging\windows\uninstall.ps1') -Destination (Join-Path $Payload 'uninstall.ps1')
    Set-Content -LiteralPath (Join-Path $Payload 'VERSION') -Value $Version -Encoding ascii

    $PortableZip = Join-Path $OutputDirectory "YTConv-$Version-portable-win-x64.zip"
    Compress-Archive -Path (Join-Path $Payload '*') -DestinationPath $PortableZip -CompressionLevel Optimal -Force
    $PayloadZip = Join-Path $Work 'payload.zip'
    Copy-Item -LiteralPath $PortableZip -Destination $PayloadZip
    Copy-Item -LiteralPath (Join-Path $Root 'packaging\windows\install.ps1') -Destination (Join-Path $Work 'install.ps1')
    Copy-Item -LiteralPath (Join-Path $Root 'packaging\windows\install.cmd') -Destination (Join-Path $Work 'install.cmd')

    $SetupExe = Join-Path $OutputDirectory "YTConv-$Version-Setup-x64.exe"
    $Sed = Join-Path $Work 'ytconv.sed'
    $SourceDir = $Work.TrimEnd('\') + '\'
    @"
[Version]
Class=IEXPRESS
SEDVersion=3
[Options]
PackagePurpose=InstallApp
ShowInstallProgramWindow=1
HideExtractAnimation=1
UseLongFileName=1
InsideCompressed=0
CAB_FixedSize=0
CAB_ResvCodeSigning=0
RebootMode=N
InstallPrompt=
DisplayLicense=
FinishMessage=
TargetName=$SetupExe
FriendlyName=YTConv $Version
AppLaunched=cmd.exe /d /c install.cmd
PostInstallCmd=<None>
AdminQuietInstCmd=cmd.exe /d /c install.cmd
UserQuietInstCmd=cmd.exe /d /c install.cmd
SourceFiles=SourceFiles
[Strings]
FILE0=payload.zip
FILE1=install.cmd
FILE2=install.ps1
[SourceFiles]
SourceFiles0=$SourceDir
[SourceFiles0]
%FILE0%=
%FILE1%=
%FILE2%=
"@ | Set-Content -LiteralPath $Sed -Encoding ascii

    & (Join-Path $env:SystemRoot 'System32\iexpress.exe') /N /Q $Sed
    if ($LASTEXITCODE -ne 0 -or -not (Test-Path -LiteralPath $SetupExe)) { throw 'IExpress failed to create the installer.' }

    $InstallTarget = Join-Path $env:LOCALAPPDATA 'Programs\YTConv'
    Remove-Item -LiteralPath $InstallTarget -Recurse -Force -ErrorAction SilentlyContinue
    $Process = Start-Process -FilePath $SetupExe -ArgumentList '/Q' -Wait -PassThru
    if ($Process.ExitCode -ne 0) { throw "Installer exited with $($Process.ExitCode)." }
    $Installed = (& (Join-Path $InstallTarget 'ytconv.cmd') --version).Trim()
    if ($Installed -ne $Version) { throw "Installed EXE package reported $Installed." }

    $ChecksumsOut = Join-Path $OutputDirectory 'SHA256SUMS-windows.txt'
    @($SetupExe, $PortableZip) | ForEach-Object {
        $Hash = (Get-FileHash -Algorithm SHA256 -LiteralPath $_).Hash.ToLowerInvariant()
        "$Hash  $([IO.Path]::GetFileName($_))"
    } | Set-Content -LiteralPath $ChecksumsOut -Encoding ascii

    Write-Host $SetupExe
    Write-Host $PortableZip
} finally {
    Remove-Item -LiteralPath $Work -Recurse -Force -ErrorAction SilentlyContinue
}
