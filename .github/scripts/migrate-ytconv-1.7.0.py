#!/usr/bin/env python3
from pathlib import Path
import json
import shutil
import sys

root = Path(sys.argv[1] if len(sys.argv) > 1 else '.').resolve()
skip_dirs = {'.git', 'node_modules', 'dist', 'build', '.gradle', '.cache'}
binary = {'.png','.jpg','.jpeg','.gif','.webp','.ico','.pdf','.zip','.gz','.tgz','.apk','.deb','.rpm','.zst','.exe','.dll','.so','.woff','.woff2','.ttf','.jar','.keystore','.jks'}
changelog = root / 'cli/CHANGELOG.md'

replacements = [
    ('github.com/andhikamarcella/youtubetomp3', 'github.com/andhikamarcella/YTConv'),
    ('andhikamarcella/youtubetomp3', 'andhikamarcella/YTConv'),
    ('release/ytconv-1.6.8-stable', 'release/ytconv-1.7.0'),
    ('ytconv-v1.6.8', 'ytconv-v1.7.0'),
    ('YTConv-1.6.8', 'YTConv-1.7.0'),
    ('ytconv-1.6.8', 'ytconv-1.7.0'),
    ('ytconv_1.6.8', 'ytconv_1.7.0'),
    ('1.6.8', '1.7.0'),
    ('YTConv 1.6.2', 'YTConv 1.7.0'),
    ('Stable 1.6.2', 'Stable 1.7.0'),
    ('1.6.2', '1.7.0'),
    ('10608', '10700'),
    ('Subtitles         ON', 'Subtitles         OFF unless requested'),
    ('enables subtitles by default for video unless explicitly disabled', 'keeps subtitles disabled by default unless explicitly requested'),
]

for path in root.rglob('*'):
    if not path.is_file() or path == changelog:
        continue
    if any(part in skip_dirs for part in path.parts) or path.suffix.lower() in binary:
        continue
    try:
        text = path.read_text(encoding='utf-8')
    except (UnicodeDecodeError, OSError):
        continue
    updated = text
    for old, new in replacements:
        updated = updated.replace(old, new)
    if updated != text:
        path.write_text(updated, encoding='utf-8')

package_path = root / 'cli/package.json'
package = json.loads(package_path.read_text(encoding='utf-8'))
package['version'] = '1.7.0'
package['description'] = 'Secure cross-platform social-media downloader CLI with guided diagnostics, browser-login recovery, animated progress, native packages, expanded documentation, and verified release provenance.'
package['organization'] = {'name': 'YTConv Project', 'url': 'https://github.com/andhikamarcella/YTConv'}
package['repository'] = {'type': 'git', 'url': 'git+https://github.com/andhikamarcella/YTConv.git', 'directory': 'cli'}
package['homepage'] = 'https://github.com/andhikamarcella/YTConv/tree/release/ytconv-1.7.0/cli#readme'
package['bugs'] = {'url': 'https://github.com/andhikamarcella/YTConv/issues'}
package['licenseUrl'] = 'https://github.com/andhikamarcella/YTConv/blob/release/ytconv-1.7.0/cli/LICENSE'
package['documentation'] = {
    'url': 'https://github.com/andhikamarcella/YTConv/tree/release/ytconv-1.7.0/cli/docs',
    'installation': 'https://github.com/andhikamarcella/YTConv/blob/release/ytconv-1.7.0/cli/docs/INSTALLATION.md',
    'commands': 'https://github.com/andhikamarcella/YTConv/blob/release/ytconv-1.7.0/cli/docs/COMMANDS.md',
    'configuration': 'https://github.com/andhikamarcella/YTConv/blob/release/ytconv-1.7.0/cli/docs/CONFIGURATION.md',
    'authentication': 'https://github.com/andhikamarcella/YTConv/blob/release/ytconv-1.7.0/cli/docs/AUTHENTICATION.md',
    'troubleshooting': 'https://github.com/andhikamarcella/YTConv/blob/release/ytconv-1.7.0/cli/docs/TROUBLESHOOTING.md',
    'packages': 'https://github.com/andhikamarcella/YTConv/blob/release/ytconv-1.7.0/cli/docs/PACKAGES.md',
    'security': 'https://github.com/andhikamarcella/YTConv/blob/release/ytconv-1.7.0/cli/SECURITY.md'
}
package['releaseDate'] = '2026-08-05'
package['releaseNotes'] = 'YTConv 1.7.0 completes the canonical repository migration to andhikamarcella/YTConv, adds comprehensive documentation and automated documentation validation, introduces npm Trusted Publishing through GitHub OIDC, and refreshes every supported package target.'
package['releaseNotesUrl'] = 'https://github.com/andhikamarcella/YTConv/blob/release/ytconv-1.7.0/cli/CHANGELOG.md'
package['installer'] = {
    'type': 'Multi-format release',
    'npm': 'https://registry.npmjs.org/ytconv/-/ytconv-1.7.0.tgz',
    'release': 'https://github.com/andhikamarcella/YTConv/releases/tag/ytconv-v1.7.0',
    'sha256Url': 'https://github.com/andhikamarcella/YTConv/releases/download/ytconv-v1.7.0/SHA256SUMS.txt',
    'sbomUrl': 'https://github.com/andhikamarcella/YTConv/releases/download/ytconv-v1.7.0/ytconv-1.7.0.cdx.json'
}
keywords = list(package.get('keywords', []))
for value in ['trusted-publishing', 'openid-connect', 'oidc', 'documentation-validation']:
    if value not in keywords:
        keywords.append(value)
package['keywords'] = keywords
scripts = dict(package.get('scripts', {}))
scripts['docs:check'] = 'node ./scripts/check-docs.js'
existing = scripts.get('prepack', '')
if 'npm run docs:check' not in existing:
    scripts['prepack'] = f'npm run docs:check && {existing}' if existing else 'npm run docs:check'
package['scripts'] = scripts
package_path.write_text(json.dumps(package, indent=2) + '\n', encoding='utf-8')

lock_path = root / 'cli/package-lock.json'
lock = json.loads(lock_path.read_text(encoding='utf-8'))
lock['name'] = 'ytconv'
lock['version'] = '1.7.0'
if '' in lock.get('packages', {}):
    lock['packages']['']['name'] = 'ytconv'
    lock['packages']['']['version'] = '1.7.0'
lock_path.write_text(json.dumps(lock, indent=2) + '\n', encoding='utf-8')

changelog_text = changelog.read_text(encoding='utf-8').replace('github.com/andhikamarcella/youtubetomp3', 'github.com/andhikamarcella/YTConv')
entry = '''## 1.7.0 — 2026-08-05

### Repository and release integrity

- Migrated canonical source, issue, documentation, installer, checksum, SBOM, and release URLs to `andhikamarcella/YTConv`.
- Added npm Trusted Publishing through GitHub Actions OpenID Connect; the canonical release workflow no longer requires a long-lived npm token.
- Refreshed version identity across npm, iSH, Android, Windows, Linux, Alpine, Nix, Snap, Flatpak, Termux, portable archives, and CI matrices.

### Documentation and validation

- Added a comprehensive documentation hub covering installation, commands, configuration, authentication, troubleshooting, platforms, architecture, development, releases, trusted publishing, FAQ, and migration.
- Added `npm run docs:check` to reject stale repository URLs, missing guides, broken local Markdown links, and package-version drift.

### Compatibility

- Preserves existing commands, secure argument-array child processes, secret-stripped environments, browser-login recovery, animated progress, public-first access, and subtitles disabled by default.
- No existing command was intentionally removed or renamed.

'''
if '## 1.7.0 — 2026-08-05' not in changelog_text:
    if changelog_text.startswith('# Changelog'):
        changelog_text = changelog_text.replace('# Changelog', '# Changelog\n\n' + entry, 1)
    else:
        changelog_text = '# Changelog\n\n' + entry + changelog_text
changelog.write_text(changelog_text, encoding='utf-8')

readme = root / 'cli/README.md'
readme_text = readme.read_text(encoding='utf-8')
if '## Documentation hub' not in readme_text:
    readme_text += '''\n\n## Documentation hub\n\n- [Documentation index](docs/README.md)\n- [Installation](docs/INSTALLATION.md)\n- [Commands](docs/COMMANDS.md)\n- [Configuration](docs/CONFIGURATION.md)\n- [Authentication](docs/AUTHENTICATION.md)\n- [Troubleshooting](docs/TROUBLESHOOTING.md)\n- [Platform support](docs/PLATFORMS.md)\n- [Architecture](docs/ARCHITECTURE.md)\n- [Development](docs/DEVELOPMENT.md)\n- [Release process](docs/RELEASES.md)\n- [npm Trusted Publishing](docs/TRUSTED-PUBLISHING.md)\n- [FAQ](docs/FAQ.md)\n- [Migration to 1.7.0](docs/MIGRATION-1.7.0.md)\n\nCanonical repository: <https://github.com/andhikamarcella/YTConv>\n'''
readme.write_text(readme_text, encoding='utf-8')

workflow_dir = root / '.github/workflows'
for pattern in ('publish-ytconv-1.*.yml', '*token*.yml'):
    for path in workflow_dir.glob(pattern):
        path.unlink()

for path in sorted([p for p in root.rglob('*') if '1.6.8' in p.name and '.git' not in p.parts], key=lambda p: len(p.parts), reverse=True):
    target = path.with_name(path.name.replace('1.6.8', '1.7.0'))
    if target.exists():
        if path.is_dir():
            shutil.rmtree(path)
        else:
            path.unlink()
    else:
        path.rename(target)

for obsolete in (
    root / '.github/workflows/prepare-ytconv-1.7.0.yml',
    root / '.github/release-markers/prepare-ytconv-1.7.0',
):
    if obsolete.exists():
        obsolete.unlink()

print('YTConv 1.7.0 migration completed.')
