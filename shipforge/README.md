# ShipForge CLI

ShipForge is a safe, zero-runtime-dependency, cross-platform release automation CLI. It discovers and synchronizes project versions, validates the release state, generates changelogs and SHA-256 manifests, publishes npm packages with provenance, creates GitHub Releases, and verifies both destinations.

## Requirements

- Node.js 22.14 or newer
- Git for repository checks and changelog generation
- npm for npm publication
- GitHub CLI (`gh`) only when publishing or verifying GitHub Releases

## Install for development

```bash
npm install
npm link
shipforge --help
```

## Safe release workflow

```bash
shipforge init
shipforge scan
shipforge version 1.2.0
shipforge version 1.2.0 --write
shipforge changelog 1.2.0
shipforge check
shipforge checksum dist
shipforge publish 1.2.0 --npm --github --dry-run
shipforge publish 1.2.0 --npm --github --yes
shipforge verify 1.2.0
```

`shipforge version` is preview-only unless `--write` is supplied. Publication is blocked unless the release checks pass and `--yes` is supplied. ShipForge has zero runtime dependencies. Child processes are started with argument arrays and `shell: false`.

## Version files detected in 0.1.0

- npm `package.json`
- Rust `Cargo.toml`
- Python `pyproject.toml`
- Android `build.gradle` and `build.gradle.kts`
- Snap `snapcraft.yaml`
- Alpine `APKBUILD`

## Configuration

Run `shipforge init` to create `shipforge.config.json`. Configure test commands, tag prefix, npm directory/tag, GitHub repository, changelog path, and release asset locations.

## Commands

- `init` — create the configuration file
- `scan` — list detected version files
- `check` — validate version consistency, Git state, and project checks
- `version <version>` — preview or synchronize versions
- `changelog <version>` — generate release notes from Git commits
- `checksum [directory]` — create `SHA256SUMS.txt`
- `publish <version>` — publish explicitly selected npm/GitHub targets
- `verify <version>` — verify publication results

## Security model

ShipForge does not store npm or GitHub tokens. It relies on the user's existing npm and GitHub CLI authentication. It never invokes a shell for child processes, requires explicit publication targets, and requires `--yes` for irreversible publishing.

## License

MIT
