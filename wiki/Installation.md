# Installation

The npm CLI needs Node.js 22.14+ and npm 10+. Install a current Node.js LTS release, then:

```bash
npm install -g ytconv@1.7.2
ytconv repair
ytconv doctor
```

- Windows: use `npm.cmd` and `ytconv.cmd` if PowerShell blocks `.ps1` shims.
- CachyOS/Arch: `sudo pacman -Syu --needed nodejs npm python python-pip ffmpeg`.
- Ubuntu/Debian: `sudo apt install nodejs npm python3 python3-pip ffmpeg` and verify Node is new enough.
- Termux: `pkg install nodejs python ffmpeg`.
- iSH: use the Python frontend documented in the repository's `cli/docs/ISH.md`.
