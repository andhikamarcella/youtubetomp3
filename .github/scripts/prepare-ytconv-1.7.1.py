#!/usr/bin/env python3
from __future__ import annotations

import hashlib
import json
import sys
from pathlib import Path

ROOT = Path(sys.argv[1]).resolve()
OLD = "1.7.0"
NEW = "1.7.1"
BRANCH = "release/ytconv-1.7.1"
REPO = "andhikamarcella/YTConv"

SKIP_DIRS = {".git", "node_modules", "dist", "build", ".next", "coverage"}
SKIP_PREFIXES = {
    ".github/workflows/",
    ".github/release-status/",
    ".github/release-markers/",
}
HISTORICAL_FILES = {
    "cli/CHANGELOG.md",
    "cli/docs/MIGRATION-1.7.0.md",
}


def text_file(path: Path) -> bool:
    if any(part in SKIP_DIRS for part in path.parts):
        return False
    relative = path.relative_to(ROOT).as_posix()
    if any(relative.startswith(prefix) for prefix in SKIP_PREFIXES):
        return False
    try:
        data = path.read_bytes()
    except OSError:
        return False
    return b"\x00" not in data


def replace_release_identity() -> None:
    for path in ROOT.rglob("*"):
        if not path.is_file() or not text_file(path):
            continue
        relative = path.relative_to(ROOT).as_posix()
        if relative in HISTORICAL_FILES:
            continue
        try:
            original = path.read_text("utf-8")
        except UnicodeDecodeError:
            continue
        updated = original
        updated = updated.replace("release/ytconv-1.7.0", BRANCH)
        updated = updated.replace("ytconv-v1.7.0", "ytconv-v1.7.1")
        updated = updated.replace("ytconv-1.7.0", "ytconv-1.7.1")
        updated = updated.replace(OLD, NEW)
        updated = updated.replace("versionCode 10700", "versionCode 10701")
        updated = updated.replace("VERSION_CODE=10700", "VERSION_CODE=10701")
        if updated != original:
            path.write_text(updated, "utf-8")

    old_marker = ROOT / "cli/.release-1.7.0"
    new_marker = ROOT / "cli/.release-1.7.1"
    if old_marker.exists():
        old_marker.unlink()
    new_marker.write_text(
        "YTConv 1.7.1 release source\n"
        "Base: release/ytconv-1.7.0\n"
        "Target: release/ytconv-1.7.1\n",
        "utf-8",
    )


def update_manifest() -> None:
    path = ROOT / "cli/package.json"
    manifest = json.loads(path.read_text("utf-8"))
    manifest["version"] = NEW
    manifest["description"] = (
        "Secure cross-platform social-media downloader CLI with an interactive help center, "
        "stable documentation links, guided diagnostics, browser-login recovery, animated progress, "
        "native packages, and verified release provenance."
    )
    manifest["releaseDate"] = "2026-08-06"
    manifest["releaseNotes"] = (
        "YTConv 1.7.1 fixes stable HEAD documentation links, adds an interactive terminal help center "
        "with docs, about, and shortcuts commands, improves discoverability and responsive help output, "
        "and refreshes every supported package identity while preserving the secure 1.7.0 download core."
    )
    keywords = manifest.setdefault("keywords", [])
    for keyword in ["help-center", "interactive-docs", "documentation-command", "terminal-dashboard"]:
        if keyword not in keywords:
            keywords.append(keyword)
    scripts = manifest.setdefault("scripts", {})
    scripts["test:help-center"] = "node --test ./test/help-center.test.js"
    scripts["prepack"] = (
        "npm run docs:check && npm run check && npm run typecheck && npm test && "
        "npm run test:help-center && npm run check:ish && npm run security"
    )
    documentation = manifest.setdefault("documentation", {})
    documentation["url"] = f"https://github.com/{REPO}/tree/{BRANCH}/cli/docs"
    documentation["helpCenter"] = f"https://github.com/{REPO}/blob/{BRANCH}/cli/docs/HELP-CENTER.md"
    documentation["migration"] = f"https://github.com/{REPO}/blob/{BRANCH}/cli/docs/MIGRATION-1.7.1.md"
    manifest["homepage"] = f"https://github.com/{REPO}/tree/{BRANCH}/cli#readme"
    manifest["releaseNotesUrl"] = f"https://github.com/{REPO}/blob/{BRANCH}/cli/CHANGELOG.md"
    path.write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + "\n", "utf-8")


def write_help_center() -> None:
    source = r'''import process from 'node:process';
import { CLI_VERSION } from './version.js';

const REPOSITORY = 'https://github.com/andhikamarcella/YTConv';
const RELEASE_BRANCH = 'release/ytconv-1.7.1';
const DOCS_ROOT = `${REPOSITORY}/tree/${RELEASE_BRANCH}/cli/docs`;

const TOPICS = Object.freeze([
  ['index', 'Documentation hub', 'README.md', ['home', 'start', 'readme']],
  ['installation', 'Installation and upgrade', 'INSTALLATION.md', ['install', 'upgrade', 'setup']],
  ['commands', 'Commands and options', 'COMMANDS.md', ['command', 'cli', 'options']],
  ['configuration', 'Configuration and profiles', 'CONFIGURATION.md', ['config', 'profile', 'settings']],
  ['authentication', 'Authentication and browser recovery', 'AUTHENTICATION.md', ['auth', 'login', 'cookies']],
  ['troubleshooting', 'Troubleshooting and diagnostics', 'TROUBLESHOOTING.md', ['trouble', 'fix', 'doctor', 'diagnose']],
  ['platforms', 'Platform-specific guidance', 'PLATFORMS.md', ['platform', 'windows', 'linux', 'macos', 'termux', 'ish']],
  ['packages', 'Native packages and artifacts', 'PACKAGES.md', ['package', 'apk', 'exe', 'flatpak', 'nix']],
  ['security', 'Security model', '../SECURITY.md', ['safe', 'privacy']],
  ['releases', 'Releases, checksums, and provenance', 'RELEASES.md', ['release', 'checksum', 'provenance']],
  ['development', 'Development and testing', 'DEVELOPMENT.md', ['develop', 'contribute', 'test']],
  ['architecture', 'Architecture and process boundaries', 'ARCHITECTURE.md', ['internals', 'design']],
  ['nodejs', 'Node.js integration', 'NODEJS.md', ['node', 'api', 'library']],
  ['faq', 'Frequently asked questions', 'FAQ.md', ['questions', 'help']],
  ['migration', 'Migration to YTConv 1.7.1', 'MIGRATION-1.7.1.md', ['migrate', '1.7.1', 'repository']],
  ['trusted-publishing', 'npm Trusted Publishing', 'TRUSTED-PUBLISHING.md', ['oidc', 'npm', 'publish']],
  ['help-center', 'Interactive help center', 'HELP-CENTER.md', ['docs-command', 'about', 'shortcuts']],
]);

function normalized(value) {
  return String(value ?? '').trim().toLowerCase().replace(/[^a-z0-9.]+/gu, '-').replace(/^-|-$/gu, '');
}

export function documentationTopics() {
  return TOPICS.map(([key, label]) => ({ key, label }));
}

export function resolveDocumentationTopic(value = 'index') {
  const query = normalized(value) || 'index';
  const exact = TOPICS.find(([key, , , aliases]) => key === query || aliases.includes(query));
  if (exact) return { key: exact[0], label: exact[1], file: exact[2] };
  const prefix = TOPICS.filter(([key, label, , aliases]) =>
    key.startsWith(query) || normalized(label).includes(query) || aliases.some((alias) => alias.startsWith(query)));
  if (prefix.length === 1) return { key: prefix[0][0], label: prefix[0][1], file: prefix[0][2] };
  return null;
}

export function documentationUrl(value = 'index') {
  const topic = resolveDocumentationTopic(value);
  if (!topic) return null;
  if (topic.key === 'index') return DOCS_ROOT;
  if (topic.file === '../SECURITY.md') return `${REPOSITORY}/blob/${RELEASE_BRANCH}/cli/SECURITY.md`;
  return `${REPOSITORY}/blob/${RELEASE_BRANCH}/cli/docs/${topic.file}`;
}

function panel(title, rows, columns = 80) {
  const width = Math.max(42, Math.min(88, Number(columns) || 80));
  const inner = width - 4;
  const fit = (value) => {
    const text = String(value);
    return text.length > inner ? `${text.slice(0, Math.max(1, inner - 1))}…` : text;
  };
  const line = (value = '') => `│ ${fit(value).padEnd(inner, ' ')} │`;
  return [
    `┌${'─'.repeat(width - 2)}┐`,
    line(title),
    `├${'─'.repeat(width - 2)}┤`,
    ...rows.map(line),
    `└${'─'.repeat(width - 2)}┘`,
  ].join('\n');
}

export function aboutText(columns = process.stdout.columns) {
  return panel(`YTConv ${CLI_VERSION} · Help Center`, [
    'Secure downloader and converter for supported social platforms',
    '',
    `Repository  ${REPOSITORY}`,
    'npm         https://www.npmjs.com/package/ytconv',
    `Docs        ${DOCS_ROOT}`,
    '',
    'Start       ytconv',
    'Docs        ytconv docs --list',
    'Diagnose    ytconv --diagnose',
    'Shortcuts   ytconv shortcuts',
    'Update      npm install -g ytconv@latest',
  ], columns);
}

export function shortcutsText(columns = process.stdout.columns) {
  return panel(`YTConv ${CLI_VERSION} · Interactive Shortcuts`, [
    'Enter      download or convert',
    'Ctrl+M     cycle AUTO / VIDEO / AUDIO / IMAGE',
    'Ctrl+A/T   cycle audio or video format',
    'Ctrl+Q/F   cycle quality or image format',
    'Ctrl+G/B   cycle platform or access source',
    'Ctrl+S/P   toggle subtitles or playlist',
    'Ctrl+V     paste URL from clipboard',
    'H / D      help / diagnostics',
    'Q / Esc    exit safely',
  ], columns);
}

export function docsText(value = 'index', columns = process.stdout.columns) {
  const topic = resolveDocumentationTopic(value);
  if (!topic) return null;
  const url = documentationUrl(topic.key);
  return panel(`YTConv ${CLI_VERSION} · ${topic.label}`, [
    url,
    '',
    'The URL is printable, copyable, and clickable in supported terminals.',
    'List topics: ytconv docs --list',
    'Project info: ytconv about',
  ], columns);
}

export function docsListText(columns = process.stdout.columns) {
  const rows = TOPICS.map(([key, label]) => `${key.padEnd(20)} ${label}`);
  rows.push('', 'Open a topic: ytconv docs <topic>');
  return panel(`YTConv ${CLI_VERSION} · Documentation Topics`, rows, columns);
}

export function handleHelpCenterCommand(argv, options = {}) {
  const args = Array.isArray(argv) ? argv : [];
  const command = normalized(args[0]);
  const write = options.write ?? ((value) => console.log(value));
  const columns = options.columns ?? process.stdout.columns;

  if (['about', 'welcome', 'info'].includes(command)) {
    write(aboutText(columns));
    return { handled: true, exitCode: 0, action: 'about' };
  }
  if (['shortcuts', 'keys'].includes(command)) {
    write(shortcutsText(columns));
    return { handled: true, exitCode: 0, action: 'shortcuts' };
  }
  if (!['docs', 'documentation', 'guide'].includes(command)) {
    return { handled: false, exitCode: 0 };
  }
  if (args.includes('--list') || args.includes('-l')) {
    write(docsListText(columns));
    return { handled: true, exitCode: 0, action: 'docs-list' };
  }
  const topicInput = args.slice(1).find((value) => !String(value).startsWith('-')) || 'index';
  const text = docsText(topicInput, columns);
  if (!text) {
    write(`Unknown documentation topic: ${topicInput}\n\n${docsListText(columns)}`);
    return { handled: true, exitCode: 2, action: 'docs-error' };
  }
  write(text);
  return { handled: true, exitCode: 0, action: 'docs', topic: resolveDocumentationTopic(topicInput).key };
}
'''
    (ROOT / "cli/src/help-center.js").write_text(source, "utf-8")

    test = r'''import assert from 'node:assert/strict';
import test from 'node:test';
import {
  aboutText,
  docsListText,
  documentationTopics,
  documentationUrl,
  handleHelpCenterCommand,
  resolveDocumentationTopic,
  shortcutsText,
} from '../src/help-center.js';

test('documentation topics resolve canonical names and aliases', () => {
  assert.equal(resolveDocumentationTopic('install').key, 'installation');
  assert.equal(resolveDocumentationTopic('doctor').key, 'troubleshooting');
  assert.equal(resolveDocumentationTopic('oidc').key, 'trusted-publishing');
  assert.equal(resolveDocumentationTopic('missing-topic'), null);
});

test('documentation URLs use the canonical 1.7.1 release branch', () => {
  assert.match(documentationUrl('faq'), /andhikamarcella\/YTConv\/blob\/release\/ytconv-1\.7\.1\/cli\/docs\/FAQ\.md$/u);
  assert.match(documentationUrl('index'), /andhikamarcella\/YTConv\/tree\/release\/ytconv-1\.7\.1\/cli\/docs$/u);
});

test('help-center panels are responsive and discoverable', () => {
  assert.match(aboutText(50), /YTConv 1\.7\.1/u);
  assert.match(shortcutsText(50), /Ctrl\+M/u);
  assert.match(docsListText(90), /installation/u);
  assert.ok(documentationTopics().length >= 15);
});

test('command handler supports docs, about, shortcuts, and unknown topics', () => {
  const output = [];
  assert.deepEqual(handleHelpCenterCommand(['about'], { write: (value) => output.push(value), columns: 60 }).exitCode, 0);
  assert.equal(handleHelpCenterCommand(['shortcuts'], { write: (value) => output.push(value), columns: 60 }).handled, true);
  assert.equal(handleHelpCenterCommand(['docs', 'faq'], { write: (value) => output.push(value), columns: 60 }).topic, 'faq');
  assert.equal(handleHelpCenterCommand(['docs', 'does-not-exist'], { write: (value) => output.push(value), columns: 60 }).exitCode, 2);
  assert.equal(handleHelpCenterCommand(['download'], { write: (value) => output.push(value) }).handled, false);
});
'''
    (ROOT / "cli/test/help-center.test.js").write_text(test, "utf-8")


def integrate_cli() -> None:
    path = ROOT / "cli/bin/ytconv.js"
    text = path.read_text("utf-8")
    import_line = "import { handleHelpCenterCommand } from '../src/help-center.js';\n"
    anchor = "import { collectUrls, runHeadlessDownloads } from '../src/headless.js';\n"
    if import_line not in text:
        text = text.replace(anchor, anchor + import_line)
    hook = """  const helpCenter = handleHelpCenterCommand(rawArgs);\n  if (helpCenter.handled) return helpCenter.exitCode;\n\n"""
    anchor2 = "  const rawArgs = process.argv.slice(2);\n"
    if hook not in text:
        text = text.replace(anchor2, anchor2 + hook)
    path.write_text(text, "utf-8")

    command_path = ROOT / "cli/src/command-program.js"
    command_text = command_path.read_text("utf-8")
    command_text = command_text.replace(
        "  ytconv social help\n",
        "  ytconv social help\n  ytconv docs --list\n  ytconv docs troubleshooting\n  ytconv about\n  ytconv shortcuts\n",
    )
    command_text = command_text.replace(
        "  ytconv login instagram\n\nPrivacy:",
        "  ytconv login instagram\n  ytconv docs --list\n  ytconv about\n\nPrivacy:",
    )
    command_path.write_text(command_text, "utf-8")


def update_documentation() -> None:
    docs = ROOT / "cli/docs"
    docs.mkdir(parents=True, exist_ok=True)
    docs_readme = """# YTConv Documentation\n\nThis directory is the canonical documentation hub for YTConv 1.7.1. YTConv is a cross-platform command-line downloader and media conversion tool. Use it only for media you own or are authorized to download.\n\n## Start here\n\n- [Interactive Help Center](HELP-CENTER.md) — terminal documentation, project information, and shortcuts.\n- [Installation](INSTALLATION.md) — supported installation methods and verification.\n- [Commands](COMMANDS.md) — command families, options, examples, and exit behavior.\n- [Configuration](CONFIGURATION.md) — configuration files, profiles, paths, and precedence.\n- [Authentication](AUTHENTICATION.md) — browser-login recovery and private session handling.\n- [Troubleshooting](TROUBLESHOOTING.md) — diagnosis steps for common failures.\n- [Platforms](PLATFORMS.md) — Windows, Linux, macOS, Termux, iSH, Android, and packages.\n- [Architecture](ARCHITECTURE.md) — modules, engines, process boundaries, and security.\n- [Development](DEVELOPMENT.md) — local setup, tests, contribution workflow, and release checks.\n- [Releases](RELEASES.md) — artifacts, checksums, SBOM, provenance, and versioning.\n- [Trusted Publishing](TRUSTED-PUBLISHING.md) — npm OIDC configuration for maintainers.\n- [FAQ](FAQ.md) — concise answers to recurring questions.\n- [Migration to 1.7.1](MIGRATION-1.7.1.md) — stable docs links and new terminal commands.\n- [Migration to 1.7.0](MIGRATION-1.7.0.md) — canonical repository migration.\n- [Node.js integration](NODEJS.md) — programmatic use from Node.js.\n- [Native packages](PACKAGES.md) — platform package details.\n\n## Terminal discovery\n\n```bash\nytconv docs\nytconv docs --list\nytconv docs troubleshooting\nytconv about\nytconv shortcuts\n```\n\n## Canonical locations\n\n- Repository: `https://github.com/andhikamarcella/YTConv`\n- Stable HEAD docs landing: `https://github.com/andhikamarcella/YTConv/blob/HEAD/cli/docs/README.md`\n- npm package: `ytconv`\n- Release tag format: `ytconv-v<version>`\n"""
    (docs / "README.md").write_text(docs_readme, "utf-8")

    help_doc = """# Interactive Help Center\n\nYTConv 1.7.1 adds terminal-first documentation discovery. The commands print responsive, copyable panels and canonical URLs without requiring a browser integration or shell execution.\n\n## Commands\n\n```bash\nytconv docs\nytconv docs --list\nytconv docs installation\nytconv docs troubleshooting\nytconv docs authentication\nytconv about\nytconv shortcuts\n```\n\nTopic names accept useful aliases such as `install`, `doctor`, `login`, `cookies`, `oidc`, `package`, and `migrate`. Unknown topics return exit code `2` and display the complete topic list.\n\n## Why URLs are release-pinned\n\nThe repository default branch also contains the web application, so CLI documentation URLs use an explicit CLI release branch. A small compatibility documentation landing page remains on the default branch so existing `blob/HEAD/cli/docs/...` links do not return 404.\n\n## Security\n\nThe help center only formats text and prints HTTPS URLs. It does not execute a shell, collect telemetry, read browser sessions, or send project data anywhere.\n"""
    (docs / "HELP-CENTER.md").write_text(help_doc, "utf-8")

    migration = """# Migrating to YTConv 1.7.1\n\n## Upgrade\n\n```bash\nnpm install -g ytconv@1.7.1\nytconv --version\nytconv --diagnose\n```\n\n## Stable documentation links\n\nVersion 1.7.1 restores the compatibility path below on the repository default branch:\n\n```text\nhttps://github.com/andhikamarcella/YTConv/blob/HEAD/cli/docs/MIGRATION-1.7.0.md\n```\n\nMaintained CLI documentation remains release-pinned so it cannot accidentally follow the web branch:\n\n```text\nhttps://github.com/andhikamarcella/YTConv/tree/release/ytconv-1.7.1/cli/docs\n```\n\n## New terminal help center\n\n```bash\nytconv docs --list\nytconv docs migration\nytconv about\nytconv shortcuts\n```\n\nNo established download, conversion, authentication, batch, profile, or package command is removed.\n"""
    (docs / "MIGRATION-1.7.1.md").write_text(migration, "utf-8")

    faq = docs / "FAQ.md"
    faq_text = faq.read_text("utf-8")
    section = """\n\n## Why did a `blob/HEAD/cli/docs/...` link return 404?\n\nThe repository default branch hosts the web application, while the maintained CLI lives on versioned release branches. YTConv 1.7.1 restores a compatibility docs path on the default branch and prints release-pinned documentation URLs through `ytconv docs`.\n\n## How do I find documentation from the terminal?\n\nRun `ytconv docs --list`, then open a topic such as `ytconv docs troubleshooting`, `ytconv docs authentication`, or `ytconv docs packages`. Run `ytconv about` for project links and `ytconv shortcuts` for interactive keys.\n"""
    if "Why did a `blob/HEAD/cli/docs/...` link return 404?" not in faq_text:
        faq.write_text(faq_text.rstrip() + section + "\n", "utf-8")

    commands = docs / "COMMANDS.md"
    command_text = commands.read_text("utf-8")
    section2 = """\n\n## Interactive help center\n\n```bash\nytconv docs\nytconv docs --list\nytconv docs <topic>\nytconv about\nytconv shortcuts\n```\n\n`ytconv docs` prints canonical, release-pinned documentation URLs. Topic aliases are accepted, panels adapt to terminal width, and unknown topics return exit code `2` with suggestions.\n"""
    if "## Interactive help center" not in command_text:
        commands.write_text(command_text.rstrip() + section2 + "\n", "utf-8")

    cli_readme = ROOT / "cli/README.md"
    readme_text = cli_readme.read_text("utf-8")
    block = """\n\n## Interactive help center (1.7.1)\n\n```bash\nytconv docs --list\nytconv docs troubleshooting\nytconv about\nytconv shortcuts\n```\n\nThese commands print responsive terminal panels and release-pinned documentation URLs. Stable `HEAD` compatibility documentation is also maintained on the repository default branch.\n"""
    if "## Interactive help center (1.7.1)" not in readme_text:
        cli_readme.write_text(readme_text.rstrip() + block + "\n", "utf-8")

    changelog = ROOT / "cli/CHANGELOG.md"
    old = changelog.read_text("utf-8")
    entry = """## 1.7.1 - 2026-08-06\n\n- Restored stable `blob/HEAD/cli/docs/...` compatibility links on the repository default branch.\n- Added `ytconv docs`, `ytconv docs --list`, topic aliases, and responsive documentation panels.\n- Added `ytconv about` and `ytconv shortcuts` for clearer project discovery and interactive guidance.\n- Added dedicated help-center documentation and migration guidance.\n- Added automated help-center tests and expanded documentation validation.\n- Refreshed CLI and native package identities to 1.7.1 without removing established commands.\n\n"""
    if "## 1.7.1 - 2026-08-06" not in old:
        if old.startswith("# Changelog"):
            rest = old[len("# Changelog"):].lstrip("\n")
            changelog.write_text("# Changelog\n\n" + entry + rest, "utf-8")
        else:
            changelog.write_text(entry + old, "utf-8")

    checker = ROOT / "cli/scripts/check-docs.js"
    check_text = checker.read_text("utf-8")
    check_text = check_text.replace(
        "  'docs/MIGRATION-1.7.0.md'\n];",
        "  'docs/MIGRATION-1.7.0.md',\n  'docs/MIGRATION-1.7.1.md',\n  'docs/HELP-CENTER.md'\n];",
    )
    checker.write_text(check_text, "utf-8")


def regenerate_ish_checksums() -> None:
    ish = ROOT / "cli/ish"
    lines = []
    for name in ["ytconv.py", "ytconv-core.py"]:
        digest = hashlib.sha256((ish / name).read_bytes()).hexdigest()
        lines.append(f"{digest}  {name}")
    (ish / "SHA256SUMS").write_text("\n".join(lines) + "\n", "utf-8")


def main() -> None:
    replace_release_identity()
    update_manifest()
    write_help_center()
    integrate_cli()
    update_documentation()
    regenerate_ish_checksums()
    print("Prepared YTConv 1.7.1 source, docs, help center, tests, and checksums.")


if __name__ == "__main__":
    main()
