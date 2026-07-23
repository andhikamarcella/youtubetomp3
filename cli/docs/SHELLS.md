# Panduan shell YTConv 1.5.0 Beta

Versi npm: `1.5.0-beta.1`

Default di semua shell: subtitle ON untuk video, SponsorBlock `mark` ON, dan archive ON. Matikan per proses dengan `--no-subtitles --no-sponsorblock --no-archive`.

## Windows CMD

Instalasi beta:

```cmd
npm.cmd install -g ytconv@beta --force
ytconv.cmd --version
ytconv.cmd doctor
```

Gunakan shim `.cmd` untuk hasil paling konsisten:

```cmd
ytconv.cmd download "LINK"
ytconv.cmd playlist "LINK"
ytconv.cmd batch links.txt --jobs 2 --result-json report.json
ytconv.cmd download "LINK" --no-subtitles --no-sponsorblock --no-archive
```

Cari instalasi aktif:

```cmd
where ytconv
where node
where npm
```

Tes source lokal:

```cmd
cd C:\path\ke\youtubetomp3\cli
npm.cmd install
npm.cmd run check
npm.cmd test
npm.cmd install -g . --force
ytconv.cmd --version
```

## Windows PowerShell

PowerShell dapat memilih shim `ytconv.ps1`. Bila Execution Policy memblokirnya, gunakan `ytconv.cmd`:

```powershell
npm.cmd install -g ytconv@beta --force
ytconv.cmd --version
ytconv.cmd doctor
ytconv.cmd download "LINK"
```

Cari semua command:

```powershell
Get-Command ytconv -All
Get-Command ytconv.cmd -All
Get-Command node -All
Get-Command npm.cmd -All
```

Mengizinkan script npm untuk akun sendiri:

```powershell
Set-ExecutionPolicy -Scope CurrentUser RemoteSigned
```

PowerShell quoting:

```powershell
ytconv.cmd download "LINK" --output "$HOME\Downloads\YTConv"
ytconv.cmd download "LINK" --output-template "%(uploader)s/%(title)s.%(ext)s"
```

Untuk command multiline gunakan backtick:

```powershell
ytconv.cmd download "LINK" `
  --artist "Artis" `
  --title "Judul"
```

## Bash, Zsh, Fish, dan terminal Linux/macOS

```sh
npm install -g ytconv@beta --force
ytconv --version
ytconv doctor
ytconv download "LINK" --preset music
ytconv playlist "LINK" --playlist-items "1-10"
```

Bila command belum ada di PATH:

```sh
export PATH="$HOME/.local/bin:$PATH"
```

Fish:

```fish
fish_add_path $HOME/.local/bin
```

Lihat distro dan package manager:

```sh
ytconv --shell-info
```

## SSH dan terminal non-TTY

YTConv otomatis memilih headless ketika stdin atau stdout bukan TTY. Bisa dipaksa:

```sh
ytconv --headless "LINK"
```

Batch:

```sh
ytconv batch links.txt --jobs 2 --continue-on-error --result-json report.json
```

Pipe:

```sh
printf '%s\n' "LINK1" "LINK2" | ytconv --stdin --jobs 2 --continue-on-error
```

Cron sebaiknya memakai path lengkap:

```cron
0 2 * * * /home/user/.local/bin/ytconv --headless --output /home/user/downloads "LINK" >>/home/user/ytconv.log 2>&1
```

Archive otomatis berguna untuk cron agar item lama dilewati. Gunakan `--no-archive` hanya ketika pengunduhan ulang memang dimaksudkan.

## Android Termux

```sh
npm install -g ytconv@beta --omit=optional --force
ytconv --version
ytconv doctor
ytconv repair
ytconv download "LINK" --preset mobile
ytconv batch links.txt --continue-on-error
```

Folder shared storage:

```text
~/storage/downloads/YTConv
```

Termux tidak dapat membaca database privat Chrome Android. Gunakan file cookies Netscape yang diekspor secara sah:

```sh
ytconv download "LINK" --cookies ~/storage/downloads/cookies.txt
```

## iPhone/iPad iSH

Frontend iSH adalah Python native beta dan memakai command yang sama untuk fitur inti:

```sh
ytconv --version
ytconv doctor
ytconv repair
ytconv download "LINK" --preset music
ytconv playlist "LINK"
ytconv batch links.txt --continue-on-error --result-json report.json
```

Default subtitle, SponsorBlock mark, dan archive tersedia juga pada frontend iSH. Untuk menjaga memori, batch diproses berurutan.

Folder hasil:

```text
~/Downloads/YTConv
```

## File batch lintas shell

Gunakan UTF-8, satu link per baris:

```text
# komentar
https://example.com/1
https://example.com/2
```

CMD:

```cmd
ytconv.cmd batch links.txt --jobs 2
```

PowerShell:

```powershell
ytconv.cmd batch .\links.txt --jobs 2
```

Linux/macOS/Termux/iSH:

```sh
ytconv batch ./links.txt --jobs 2
```

## JSON untuk script

CMD:

```cmd
ytconv.cmd info "LINK" --json > info.json
```

PowerShell:

```powershell
ytconv.cmd info "LINK" --json | Set-Content -Encoding utf8 info.json
```

Linux/macOS:

```sh
ytconv info "LINK" --json > info.json
```

## Membatalkan dengan aman

Tekan `Ctrl+C`. YTConv meneruskan pembatalan ke engine dan mengembalikan exit code 130 saat dapat dikenali. File `.part` dapat dilanjutkan pada eksekusi berikutnya karena resume aktif secara default.
