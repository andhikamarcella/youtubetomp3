# Windows 10 and 11

1. Install a current Node.js LTS installer from [nodejs.org](https://nodejs.org/en/download). Keep npm and Add to PATH enabled.
2. Close all terminal windows and open a new CMD or PowerShell window.
3. Run:

    node.exe --version
    npm.cmd --version
    npm.cmd install -g ytconv@1.7.5
    ytconv.cmd repair
    ytconv.cmd doctor

Node.js must be 22.14+ and npm 10+. Using the .cmd executables avoids PowerShell script-policy errors without changing the system policy.

Basic use:

    ytconv.cmd "URL"
    ytconv.cmd transcript "URL"
    ytconv.cmd "URL" --mode video --video-format mp4 --resolution 1080

The release may also provide an EXE installer and portable ZIP. Verify SHA256SUMS-windows.txt from the matching ytconv-v1.7.5 release before running downloaded binaries.
