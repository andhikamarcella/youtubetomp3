from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
OLD_VERSION = "1.6.3"
NEW_VERSION = "1.6.4"
OLD_BRANCH = "release/ytconv-1.6.3-cli-only-final"
NEW_BRANCH = "release/ytconv-1.6.4-security-types"
RELEASE_BLOB = f"https://github.com/andhikamarcella/youtubetomp3/blob/{NEW_BRANCH}/cli"


def release_paths():
    patterns = (
        ".github/workflows/ytconv-cli.yml",
        ".github/workflows/publish-ytconv-stable.yml",
        "cli/bin/*.js",
        "cli/src/*.js",
        "cli/test/*.js",
        "cli/ish/*.py",
        "cli/ish/VERSION",
        "cli/scripts/*",
        "cli/docs/*.md",
        "cli/README.md",
        "cli/package.json",
        "cli/package-lock.json",
    )
    values = []
    for pattern in patterns:
        values.extend(ROOT.glob(pattern))
    return sorted({path for path in values if path.is_file()})


def synchronize_release_references():
    for path in release_paths():
        try:
            text = path.read_text(encoding="utf-8")
        except UnicodeDecodeError:
            continue
        updated = (
            text.replace(OLD_BRANCH, NEW_BRANCH)
            .replace(f"ytconv-v{OLD_VERSION}", f"ytconv-v{NEW_VERSION}")
            .replace(f"ytconv-{OLD_VERSION}", f"ytconv-{NEW_VERSION}")
            .replace(OLD_VERSION, NEW_VERSION)
        )
        if updated != text:
            path.write_text(updated, encoding="utf-8")


def normalize_readme_links():
    path = ROOT / "cli/README.md"
    text = path.read_text(encoding="utf-8")
    replacements = {
        "](LICENSE)": f"]({RELEASE_BLOB}/LICENSE)",
        "](SECURITY.md)": f"]({RELEASE_BLOB}/SECURITY.md)",
        "](docs/NODEJS.md)": f"]({RELEASE_BLOB}/docs/NODEJS.md)",
    }
    for old, new in replacements.items():
        text = text.replace(old, new)
    path.write_text(text, encoding="utf-8")


def prepend_changelog():
    path = ROOT / "cli/CHANGELOG.md"
    text = path.read_text(encoding="utf-8")
    heading = "# YTConv CLI changelog\n"
    if not text.startswith(heading):
        raise SystemExit("Unexpected changelog heading")
    if "## 1.6.4 — supply-chain hardening and typed API" in text:
        return
    section = """

## 1.6.4 — supply-chain hardening and typed API

Released: 2026-08-04

### Installation and supply chain

- Removed npm lifecycle install scripts so package installation does not download or execute media engines.
- Kept first-use and explicit repair visible, verified, bounded, and outside npm installation.
- Changed package licensing to the canonical SPDX-recognized ISC license.
- Added a versioned Socket badge, capability threat model, SBOM/provenance policy, and package-content assertions.
- Scrubbed tokens, credentials, passwords, cookies, cloud secrets, and authentication variables from every child-process environment.
- Enforced no `exec`, `shell: true`, dynamic evaluation, or unfiltered `process.env` in published JavaScript.

### TypeScript and package consumers

- Added a real side-effect-free programmatic API for YouTube URL/container and retry helpers.
- Added bundled TypeScript declarations, conditional exports, type-check CI, and development-only TypeScript/Node declarations.
- Documented that npm Dependents are registry relationships and cannot be manufactured by package metadata.

### Public YouTube MP4

- Preserved no-cookie operation for ordinary public YouTube URLs.
- Kept current yt-dlp default clients, JavaScript runtime support, AVC/M4A preference, broad format fallbacks, FFmpeg MP4 conversion, real-file verification, and automatic verified engine repair.
- Added deterministic assertions that public MP4 arguments contain no cookie source and produce an MP4 conversion path.
- Clarified that private, age-gated, members-only, region-restricted, or account-only media may still require official browser authentication.

### Discoverability and release verification

- Expanded accurate npm description and keywords for YTConv, YouTube MP4/MP3, yt-dlp, TypeScript, Termux, and supported platforms.
- Added search-friendly README headings and examples without promising a particular Google rank.
- Updated installers, iSH frontend, documentation, tests, CI, publishing metadata, tarball URLs, and release references to 1.6.4.
"""
    path.write_text(heading + section + text[len(heading):], encoding="utf-8")


synchronize_release_references()
normalize_readme_links()
prepend_changelog()
