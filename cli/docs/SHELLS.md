# Panduan shell: CMD, PowerShell, SSH, Termux, dan iSH

## CMD

Gunakan executable shim `.cmd` untuk hasil paling konsisten:

```cmd
ytconv.cmd --version
ytconv.cmd --repair
ytconv.cmd "LINK"
```

Cari instalasi aktif:

```cmd
where ytconv
where node
where npm
```

## PowerShell

PowerShell memilih `ytconv.ps1` lebih dahulu. Bila Execution Policy memblokirnya, gunakan:

```powershell
ytconv.cmd --version
ytconv.cmd "LINK"
```

Atau izinkan script lokal untuk akun sendiri:

```powershell
Set-ExecutionPolicy -Scope CurrentUser RemoteSigned
```

Diagnosis:

```powershell
Get-Command ytconv -All
ytconv.cmd --shell-info
ytconv.cmd --diagnose
```

Pipe batch:

```powershell
Get-Content .\links.txt | ytconv.cmd --stdin --continue-on-error
```

## SSH/Linux

TUI hanya dipakai saat stdin dan stdout memiliki TTY. Untuk cron, CI, redirect, atau SSH noninteraktif, mode headless aktif otomatis.

```sh
ytconv --headless "LINK"
ssh server 'ytconv --headless "LINK"'
```

Batch:

```sh
cat links.txt | ytconv --stdin --continue-on-error
```

Simpan output khusus:

```sh
ytconv --headless -o "$HOME/media" "LINK"
```

## Termux

Berikan izin penyimpanan satu kali:

```sh
termux-setup-storage
```

Diagnosis:

```sh
ytconv --shell-info
ytconv --repair
ytconv --diagnose
```

Batch dari folder Download:

```sh
ytconv --batch-file ~/storage/downloads/links.txt --continue-on-error
```

## iSH

iSH menjalankan frontend Python native 1.2.3.

```sh
ytconv --version
ytconv --repair
ytconv --diagnose
ytconv --batch-file links.txt --continue-on-error
```

Update tidak memblokir penggunaan:

```sh
ytconv --check-update
ytconv --update
```

## Mengetahui YTConv yang benar-benar dijalankan

Semua platform:

```sh
ytconv --shell-info
```

CMD:

```cmd
where ytconv
```

PowerShell:

```powershell
Get-Command ytconv -All
```

Unix/Termux/iSH:

```sh
command -v ytconv
type -a ytconv
```
