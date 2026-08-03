from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def replace_once(path: Path, old: str, new: str) -> None:
    text = path.read_text(encoding="utf-8")
    if text.count(old) != 1:
        raise SystemExit(f"Expected exactly one match in {path}: {old!r}")
    path.write_text(text.replace(old, new, 1), encoding="utf-8")


def patch_retry_logic() -> None:
    cli_options = ROOT / "cli/src/cli-options.js"
    replace_once(cli_options, "  return `http:${normalized}`;", "  return normalized;")
    replace_once(
        cli_options,
        "    retrySleep: 'http:linear=1::2',",
        "    retrySleep: 'linear=1::2',",
    )

    downloader = ROOT / "cli/src/downloader.js"
    marker = (
        "function optionFlag(options, key, envName, fallback = false) {\n"
        "  if (typeof options?.[key] === 'boolean') return options[key];\n"
        "  if (process.env[envName] !== undefined) return envFlag(envName);\n"
        "  return fallback;\n"
        "}\n"
    )
    addition = marker + (
        "\nconst RETRY_SLEEP_PREFIX = /^(?:http|fragment|file_access|extractor):/iu;\n\n"
        "export function normalizeRetrySleepExpression(value, fallback = 'linear=1::2') {\n"
        "  const normalized = String(value ?? '').trim().replace(RETRY_SLEEP_PREFIX, '');\n"
        "  return normalized || fallback;\n"
        "}\n"
    )
    replace_once(downloader, marker, addition)
    replace_once(
        downloader,
        "  const retrySleep = optionValue(options, 'retrySleep', 'YTCONV_RETRY_SLEEP', 'linear=1::2');",
        "  const retrySleep = normalizeRetrySleepExpression(optionValue(options, 'retrySleep', 'YTCONV_RETRY_SLEEP', 'linear=1::2'));",
    )
    replace_once(
        downloader,
        "    '--retry-sleep', retrySleep, '--retry-sleep', `fragment:${retrySleep}`,\n"
        "    '--retry-sleep', `file_access:${retrySleep}`, '--geo-bypass',",
        "    '--retry-sleep', `http:${retrySleep}`, '--retry-sleep', `fragment:${retrySleep}`,\n"
        "    '--retry-sleep', `file_access:${retrySleep}`, '--geo-bypass',",
    )


def add_regression_test() -> None:
    path = ROOT / "cli/test/youtube-output.test.js"
    marker = "test('archive skip with a missing file is restored once without the archive', async (t) => {"
    addition = """test('retry sleep expressions are typed exactly once', () => {
  for (const retrySleep of ['linear=1::2', 'http:linear=1::2', 'fragment:linear=1::2']) {
    const args = buildDownloadArgs(baseOptions({ retrySleep }));
    const values = args.flatMap((value, index) => args[index - 1] === '--retry-sleep' ? [value] : []);
    assert.deepEqual(values, [
      'http:linear=1::2',
      'fragment:linear=1::2',
      'file_access:linear=1::2',
    ]);
    assert.equal(values.some((value) => /:(?:http|fragment|file_access|extractor):/u.test(value)), false);
  }
});

"""
    replace_once(path, marker, addition + marker)


def update_current_release_references() -> None:
    paths: list[Path] = []
    for pattern in (
        "cli/bin/*.js",
        "cli/src/*.js",
        "cli/test/*.js",
        "cli/ish/*.py",
        "cli/scripts/*",
        "cli/docs/*.md",
    ):
        paths.extend(ROOT.glob(pattern))
    paths.extend(
        [
            ROOT / "cli/README.md",
            ROOT / "cli/ish/VERSION",
            ROOT / ".github/workflows/ytconv-cli.yml",
            ROOT / ".github/workflows/publish-ytconv-stable.yml",
        ]
    )
    for path in paths:
        if not path.is_file():
            continue
        try:
            text = path.read_text(encoding="utf-8")
        except UnicodeDecodeError:
            continue
        text = text.replace(
            "release/ytconv-1.6.2-cli-only-final",
            "release/ytconv-1.6.3-cli-only-final",
        )
        text = text.replace("ytconv-v1.6.2", "ytconv-v1.6.3")
        text = text.replace("ytconv-1.6.2", "ytconv-1.6.3")
        text = text.replace("1.6.2", "1.6.3")
        path.write_text(text, encoding="utf-8")


def update_package_metadata() -> None:
    path = ROOT / "cli/package.json"
    package = json.loads(path.read_text(encoding="utf-8"))
    final_branch = "release/ytconv-1.6.3-cli-only-final"
    package["licenseUrl"] = (
        f"https://github.com/andhikamarcella/youtubetomp3/blob/{final_branch}/cli/LICENSE"
    )
    package["homepage"] = (
        f"https://github.com/andhikamarcella/youtubetomp3/tree/{final_branch}/cli#readme"
    )
    package["documentation"] = {
        "url": f"https://github.com/andhikamarcella/youtubetomp3/tree/{final_branch}/cli/docs",
        "nodejs": f"https://github.com/andhikamarcella/youtubetomp3/blob/{final_branch}/cli/docs/NODEJS.md",
    }
    package["releaseNotes"] = (
        "YTConv 1.6.3 fixes invalid yt-dlp retry-sleep arguments that prevented "
        "YouTube downloads from starting. Retry expressions are normalized for "
        "current defaults and legacy saved profiles, and HTTP, fragment, and "
        "file-access retry types are emitted exactly once."
    )
    package["releaseNotesUrl"] = (
        f"https://github.com/andhikamarcella/youtubetomp3/blob/{final_branch}/cli/CHANGELOG.md"
    )
    package["installer"] = {
        "type": "Tarball",
        "url": "https://registry.npmjs.org/ytconv/-/ytconv-1.6.3.tgz",
        "sha256Url": "https://github.com/andhikamarcella/youtubetomp3/releases/download/ytconv-v1.6.3/SHA256SUMS.txt",
        "metadataUrl": "https://github.com/andhikamarcella/youtubetomp3/releases/download/ytconv-v1.6.3/ytconv-1.6.3.metadata.json",
    }
    path.write_text(json.dumps(package, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


def update_changelog() -> None:
    path = ROOT / "cli/CHANGELOG.md"
    text = path.read_text(encoding="utf-8")
    heading = "# YTConv CLI changelog\n"
    if not text.startswith(heading):
        raise SystemExit("Unexpected changelog heading")
    section = """
## 1.6.3 — retry-sleep hotfix

Released: 2026-08-03

- Fixed YouTube conversions failing before download with `invalid fragment retry sleep expression 'http:linear=1::2'`.
- Store retry sleep as a plain expression and apply `http`, `fragment`, and `file_access` exactly once when building yt-dlp arguments.
- Normalize legacy saved values that already include a retry-type prefix.
- Added regression coverage that rejects nested values such as `fragment:http:linear=1::2`.

"""
    path.write_text(heading + section + text[len(heading) :], encoding="utf-8")


patch_retry_logic()
add_regression_test()
update_current_release_references()
update_package_metadata()
update_changelog()
