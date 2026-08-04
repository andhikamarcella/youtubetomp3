# YTConv security policy

## Supported release

Security fixes are applied to the current npm `latest` release. YTConv versions and GitHub release tags are immutable; a fix is published as a new patch version.

## Reporting a vulnerability

Open a GitHub security advisory for the repository when available. Do not place credentials, browser cookies, npm tokens, private media URLs, or personal data in a public issue. Include the affected YTConv version, operating system, Node.js version, reproduction steps, and the smallest safe proof of concept.

## Expected capabilities

Automated scanners can report the following capabilities. They are expected for a local media-downloader CLI, but each capability is constrained.

### Network access

YTConv must access the media URL supplied by the user. It can also access:

- npm registry metadata for optional update checks;
- allowlisted GitHub release APIs and release assets for verified yt-dlp/FFmpeg repair;
- official provider login pages after an explicit login command.

YTConv does not include telemetry, analytics, advertisements, credential collection, or hidden remote configuration.

### Child-process access

YTConv launches yt-dlp, gallery-dl, FFmpeg, ffprobe, Python, package managers during explicit repair, and the user's browser during explicit login. It uses executable paths plus separate argument arrays. Runtime policy rejects `child_process.exec`, `shell: true`, dynamic evaluation, and string-built shell commands.

### Environment-variable access

YTConv reads documented `YTCONV_*`, `NO_COLOR`, platform, home-directory, and PATH-related values. Child processes receive a scrubbed environment. npm tokens, GitHub tokens, CI secrets, authentication headers, and unrelated package-manager credentials are removed.

### Filesystem access

YTConv writes media to the selected output directory and stores managed state under `~/.ytconv`. Engine and sensitive state writes use private permissions where supported and atomic temporary-file replacement. YTConv does not intentionally scan arbitrary personal files.

### URL strings

URLs in the source identify npm metadata, allowlisted GitHub APIs/assets, documentation, and official provider login pages. Release-asset downloads require HTTPS and a repository/path match before bytes are accepted.

## Installation behavior

YTConv 1.6.4 has no npm `preinstall`, `install`, or `postinstall` lifecycle script. `npm install ytconv` does not download or execute media engines. Engine inspection and verified repair happen only when the user runs YTConv or explicitly runs:

```sh
ytconv repair
```

Use `--ignore-scripts` for a defense-in-depth installation policy:

```sh
npm install -g ytconv@latest --ignore-scripts
```

## Verified engine downloads

A downloaded engine is accepted only when all relevant controls pass:

1. HTTPS is required.
2. The GitHub owner/repository is syntactically validated and selected by YTConv code, not by untrusted media metadata.
3. The asset name is an exact platform/architecture match.
4. The release URL must remain under the expected GitHub repository release path.
5. GitHub must provide a valid SHA-256 digest.
6. Downloaded bytes must match the digest with a timing-safe comparison.
7. Declared size, minimum size, and hard maximum size are checked.
8. Timeouts and bounded retries are used.
9. The executable is written with private permissions and replaced atomically.
10. The executable must pass a version/health check before use.

## Public media and cookies

Ordinary public YouTube media is attempted without cookies. YTConv does not require a manually exported `cookies.txt` for public media. Provider restrictions can still require authentication for private, age-gated, members-only, region-restricted, or account-only content. In those cases, use the explicit official browser-login workflow. YTConv does not bypass access controls.

## npm release security

The release workflow must:

- use a GitHub-hosted runner;
- use npm trusted publishing with OIDC when the npm package settings are configured;
- request only required GitHub permissions;
- run with release-build package-manager caching disabled;
- install from the committed lockfile with scripts disabled;
- run syntax, type, unit, iSH, security, and package-content tests;
- generate an SBOM;
- publish provenance;
- verify the npm dist-tag and registry tarball checksum;
- create an immutable GitHub tag/release only after registry verification.

Long-lived npm write tokens should be revoked after trusted publishing is verified. A read-only token may be used only when private development dependencies require it.

## License

The published package contains the canonical ISC license text and declares the SPDX identifier `ISC` in `package.json`.
