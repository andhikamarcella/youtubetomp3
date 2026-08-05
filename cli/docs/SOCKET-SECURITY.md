# Socket security findings in YTConv 1.6.6

Socket reports capabilities, not only confirmed vulnerabilities. YTConv is a downloader and converter, so several capabilities are intentional and required:

- **Network access:** fetches media metadata, verified release assets, and media streams.
- **Filesystem access:** writes downloads, configuration, archives, temporary files, and locally verified engines.
- **Process access:** launches executables with Node.js `spawn`/`execFile` argument arrays. YTConv does not build user-controlled shell command strings.
- **Environment access:** reads explicit `YTCONV_*` settings, PATH, terminal capability variables, and package-manager context.
- **URL strings:** contains allowlisted provider and release URLs required for routing and verified updates.
- **WebSocket access:** the managed-browser bridge connects only to loopback Chrome DevTools endpoints on `127.0.0.1`, `localhost`, or `::1`.

Version 1.6.6 removes the external `which`/`isexe` lookup chain and the `figlet`/`commander` logo chain. Command discovery now checks PATH entries directly, does not fall back to the current directory when PATH is empty, and requires executable regular files on POSIX.

Do not suppress an alert merely to obtain a perfect score. Investigate unexpected install scripts, obfuscation, credential access, new domains, dynamic shell strings, or unverified downloads as release blockers.
