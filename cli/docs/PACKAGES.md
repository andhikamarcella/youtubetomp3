# Native packages and installers

YTConv 1.6.6 provides direct, installable artifacts for Windows, Android, Termux, iSH, and major Linux package families. Every release artifact is built from the same tested source and is accompanied by `SHA256SUMS.txt` and a CycloneDX SBOM.

Official distribution repositories and stores have separate review, signing, and account requirements. The commands below install the artifacts attached to the GitHub release; they do not claim that YTConv is already accepted into Debian, Fedora, Flathub, Snap Store, Google Play, or Microsoft Store.

## Check the download

Download `SHA256SUMS.txt` from the same release and verify before installing.

Linux and macOS:

```sh
sha256sum -c SHA256SUMS.txt --ignore-missing
```

Windows PowerShell:

```powershell
Get-FileHash .\YTConv-1.6.6-Setup-x64.exe -Algorithm SHA256
```

Compare the printed value with the matching entry in `SHA256SUMS.txt`.

## Windows 10 and 11

Download and open:

```text
YTConv-1.6.6-Setup-x64.exe
```

The installer is user-level and installs into:

```text
%LOCALAPPDATA%\Programs\YTConv
```

It bundles a verified Node.js runtime, so a separate Node.js installation is not required. The first community release is not Authenticode-signed and Windows SmartScreen can show an unknown-publisher warning. Verify SHA-256 before continuing.

After installation, open a new CMD or PowerShell window:

```cmd
ytconv --version
ytconv doctor
```

Portable alternative:

```text
YTConv-1.6.6-portable-win-x64.zip
```

Extract the ZIP and run `ytconv.cmd` from that folder.

## Debian, Ubuntu, Linux Mint, Pop!_OS, Kali, and related systems

AMD64:

```sh
sudo apt install ./ytconv_1.6.6_amd64.deb
ytconv --version
```

ARM64:

```sh
sudo apt install ./ytconv_1.6.6_arm64.deb
ytconv --version
```

The DEB includes the supported Node.js runtime. Python, FFmpeg, yt-dlp, and gallery-dl remain recommended system tools and can also be repaired by YTConv.

## Fedora, RHEL, CentOS Stream, Rocky Linux, AlmaLinux, and Nobara

AMD64/x86_64:

```sh
sudo dnf install ./ytconv-1.6.6-1.x86_64.rpm
ytconv --version
```

ARM64/aarch64:

```sh
sudo dnf install ./ytconv-1.6.6-1.aarch64.rpm
ytconv --version
```

## openSUSE Leap and Tumbleweed

```sh
sudo zypper install ./ytconv-1.6.6-1.x86_64.rpm
ytconv --version
```

Use the `.aarch64.rpm` artifact on ARM64.

## Arch Linux, Manjaro, EndeavourOS, CachyOS, and Garuda

```sh
sudo pacman -U ./ytconv-1.6.6-1-x86_64.pkg.tar.zst
ytconv --version
```

Use the `aarch64` package on supported ARM64 Arch systems.

## Alpine Linux

The Alpine package uses the maintained Python frontend and the distribution packages for Python, yt-dlp, gallery-dl, FFmpeg, and CA certificates. It does not require Node.js.

```sh
sudo apk add --allow-untrusted ./ytconv-1.6.6-r0.apk
ytconv --version
ytconv --diagnose
```

`--allow-untrusted` is required for a direct release package that is not yet signed by an Alpine repository key. Verify SHA-256 first.

The same frontend is used by iSH and fixes the stale 1.6.2 installer path present in earlier releases.

## AppImage

```sh
chmod +x YTConv-1.6.6-x86_64.AppImage
./YTConv-1.6.6-x86_64.AppImage --version
./YTConv-1.6.6-x86_64.AppImage
```

AppImage currently targets x86_64 Linux. ARM64 users should use DEB, RPM, Arch, Alpine, Nix, or the portable ARM64 archive.

## Snap

Install the locally downloaded classic snap:

```sh
sudo snap install ./ytconv_1.6.6_amd64.snap --dangerous --classic
ytconv --version
```

`--dangerous` means locally installed and not Snap Store-signed; it does not disable application security checks. The package uses classic confinement because a terminal downloader must access user-selected files, external media tools, and browser handoff.

## Flatpak

Install the local bundle:

```sh
flatpak install --user ./YTConv-1.6.6.flatpak
flatpak run io.github.andhikamarcella.YTConv --version
flatpak run io.github.andhikamarcella.YTConv
```

The Flatpak manifest grants network access, home-directory file access, and desktop portals required by the downloader. This is a direct bundle, not yet a Flathub listing.

## NixOS and Nix

Run directly from the release branch:

```sh
nix run github:andhikamarcella/youtubetomp3/release/ytconv-1.6.6-socket-hardening -- --version
```

Install into the current profile:

```sh
nix profile install github:andhikamarcella/youtubetomp3/release/ytconv-1.6.6-socket-hardening
```

## Void Linux and Gentoo

The release contains reviewed packaging templates:

```text
packaging/void/template
packaging/gentoo/ytconv-1.6.6.ebuild
```

They install the verified portable runtime archives. Repository maintainers can place these files in a local overlay and replace the release checksum placeholders with values from `SHA256SUMS.txt`.

## Universal Linux portable archives

Available for x86_64 and aarch64:

```text
YTConv-1.6.6-linux-x86_64.tar.gz
YTConv-1.6.6-linux-x86_64.tar.zst
YTConv-1.6.6-linux-aarch64.tar.gz
YTConv-1.6.6-linux-aarch64.tar.zst
```

Extract and run without installing system-wide:

```sh
mkdir -p "$HOME/.local/opt/ytconv"
tar -xzf YTConv-1.6.6-linux-x86_64.tar.gz -C "$HOME/.local/opt/ytconv"
YTCONV_INSTALL_ROOT="$HOME/.local/opt/ytconv/opt/ytconv" \
  "$HOME/.local/opt/ytconv/usr/bin/ytconv" --version
```

## Homebrew on macOS and Linux

The release contains a formula generated with the exact npm tarball SHA-256:

```sh
brew install ./ytconv.rb
```

The formula uses Homebrew Node.js, Python, FFmpeg, yt-dlp, and gallery-dl packages.

## Termux on Android

Direct Termux package:

```sh
pkg update
pkg install -y ./ytconv_1.6.6_all-termux.deb
termux-setup-storage
ytconv --version
ytconv --diagnose
```

The package installs under the Termux prefix and bundles verified pure-Python yt-dlp and gallery-dl modules. It uses the Termux Python and FFmpeg packages and does not run a package maintainer script.

## iSH on iPhone and iPad

Run inside iSH as root:

```sh
apk update
apk add --no-cache curl ca-certificates
curl -fsSL \
  https://raw.githubusercontent.com/andhikamarcella/youtubetomp3/release/ytconv-1.6.6-socket-hardening/cli/scripts/install-ish.sh \
  -o /tmp/ytconv-ish.sh
sh /tmp/ytconv-ish.sh
ytconv --version
ytconv --diagnose
```

The installer verifies `ytconv.py` and `ytconv-core.py` against the versioned SHA-256 file before replacing the installed frontend. Later updates use:

```sh
ytconv update
```

## Native Android APK

The Android app is a native downloader, not a WebView. It bundles Android-compatible yt-dlp and FFmpeg engines and saves files to `Download/YTConv`.

Install the debug-signed testing APK:

```text
YTConv-1.6.6-debug.apk
```

Android may require enabling installation from the browser or file manager used to open the APK. The release also contains an unsigned release APK and the complete corresponding Android source archive.

The Android module is GPL-3.0-only because it links to GPL-3.0 youtubedl-android. The standalone CLI and npm package remain ISC licensed. No private signing key is stored in the repository.

## npm remains supported

```sh
npm install -g ytconv@latest --ignore-scripts
ytconv --version
```

The npm installation requires Node.js 22.14 or newer. Native packages and the Windows EXE bundle their runtime where documented.
