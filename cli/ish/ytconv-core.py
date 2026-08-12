#!/usr/bin/env python3
"""YTConv 1.7.4 native frontend for iSH/Alpine and Python-only shells."""

import argparse
import importlib.util
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
import urllib.error
import urllib.request
from pathlib import Path
from urllib.parse import urlparse

VERSION = "1.7.4"
RAW_BASE = "https://raw.githubusercontent.com/andhikamarcella/YTConv/release/ytconv-1.7.4/cli"
REMOTE_VERSION_URL = RAW_BASE + "/ish/VERSION"
INSTALLER_URL = RAW_BASE + "/scripts/install-ish.sh"
DEFAULT_CATEGORIES = "sponsor,selfpromo,interaction,intro,outro,preview,music_offtopic"

GALLERY_HOSTS = {
    "instagram.com", "pinterest.com", "pin.it", "tiktok.com", "twitter.com",
    "x.com", "facebook.com", "threads.com", "threads.net", "reddit.com",
    "tumblr.com", "imgur.com", "flickr.com", "deviantart.com", "pixiv.net",
    "bsky.app", "weibo.com", "vk.com", "mastodon.social",
}
YOUTUBE_HOSTS = {"youtube.com", "youtu.be", "youtube-nocookie.com"}
AUDIO_EXTENSIONS = {
    ".mp3", ".m4a", ".aac", ".opus", ".ogg", ".oga", ".vorbis",
    ".flac", ".alac", ".wav", ".wma", ".aiff", ".aif",
}
VIDEO_EXTENSIONS = {
    ".mp4", ".mkv", ".webm", ".mov", ".m4v", ".avi", ".flv",
    ".wmv", ".mpeg", ".mpg", ".ts", ".mts", ".m2ts", ".3gp",
}
IMAGE_EXTENSIONS = {
    ".avif", ".bmp", ".gif", ".heic", ".jpeg", ".jpg", ".png",
    ".tif", ".tiff", ".webp",
}
SUBTITLE_EXTENSIONS = {".srt", ".vtt", ".ass", ".ssa", ".lrc"}

PRESETS = {
    "balanced": {},
    "music": {"mode": "audio", "audio_format": "mp3", "audio_quality": "320", "thumbnail": True},
    "lossless": {"mode": "audio", "audio_format": "flac", "thumbnail": True},
    "mobile": {"mode": "video", "video_format": "mp4", "resolution": "720"},
    "hd": {"mode": "video", "video_format": "mp4", "resolution": "1080"},
    "archive": {
        "mode": "auto", "video_format": "mkv", "playlist": True,
        "subtitles": True, "metadata_files": True, "thumbnail": True,
        "restrict_filenames": True,
    },
}


SENSITIVE_ENVIRONMENT_NAME = re.compile(
    r"(?:^|_)(?:AUTH|AUTHORIZATION|COOKIE|CREDENTIAL|KEY|PASS|PASSWORD|SECRET|SESSION|TOKEN)(?:_|$)",
    re.IGNORECASE,
)
SENSITIVE_ENVIRONMENT_PREFIX = re.compile(
    r"^(?:AWS|AZURE|CI_JOB|CIRCLE|CLOUDFLARE|DOCKER_AUTH|GCLOUD|GOOGLE|GH|GITHUB|GITLAB|NPM|NUGET|PYPI|TWINE|YTCONV_AUTH)_",
    re.IGNORECASE,
)
EXPLICIT_SENSITIVE_ENVIRONMENT_NAMES = {
    "NODE_AUTH_TOKEN", "NPM_TOKEN", "GH_TOKEN", "GITHUB_TOKEN",
    "GIT_ASKPASS", "SSH_ASKPASS", "SSH_AUTH_SOCK",
    "YTCONV_AUTH_TOKEN", "YTCONV_USER_EMAIL",
}


def child_environment():
    environment = {}
    for name, value in os.environ.items():
        if (
            name in EXPLICIT_SENSITIVE_ENVIRONMENT_NAMES
            or SENSITIVE_ENVIRONMENT_PREFIX.search(name)
            or SENSITIVE_ENVIRONMENT_NAME.search(name)
        ):
            continue
        environment[name] = value
    environment["NO_COLOR"] = "1"
    environment["FORCE_COLOR"] = "0"
    return environment


def eprint(message):
    value = str(message)
    if sys.stderr.isatty() and "NO_COLOR" not in os.environ:
        value = "\033[31m%s\033[0m" % value
    print(value, file=sys.stderr)


def version_tuple(value):
    match = re.match(r"^v?(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?$", str(value).strip())
    if not match:
        return (0, 0, 0, -1, ())
    major, minor, patch = (int(match.group(index)) for index in (1, 2, 3))
    pre = match.group(4)
    if not pre:
        return (major, minor, patch, 1, ())
    parts = tuple(int(part) if part.isdigit() else part for part in pre.split("."))
    return (major, minor, patch, 0, parts)


def valid_url(value):
    try:
        parsed = urlparse(value)
        return parsed.scheme in ("http", "https") and bool(parsed.netloc)
    except ValueError:
        return False


def host_for(url):
    try:
        host = (urlparse(url).hostname or "").lower()
    except ValueError:
        return ""
    return host[4:] if host.startswith("www.") else host


def host_matches(host, candidate):
    return host == candidate or host.endswith("." + candidate)


def is_youtube_url(url):
    host = host_for(url)
    return any(host_matches(host, candidate) for candidate in YOUTUBE_HOSTS)


def is_youtube_music_url(url):
    return host_for(url) == "music.youtube.com"


def effective_mode(url, requested_mode):
    if requested_mode != "auto":
        return requested_mode
    if is_youtube_music_url(url):
        return "audio"
    if is_youtube_url(url):
        return "video"
    return "auto"


def effective_video_container(url, mode, requested_container):
    if requested_container != "auto":
        return requested_container
    if mode == "video" and is_youtube_url(url):
        return "mp4"
    return "auto"


def fetch_text(url, timeout=8):
    request = urllib.request.Request(url, headers={"User-Agent": "ytconv-ish/%s" % VERSION})
    with urllib.request.urlopen(request, timeout=timeout) as response:
        return response.read().decode("utf-8", "replace").strip()


def remote_version():
    try:
        value = fetch_text(REMOTE_VERSION_URL)
        return value if re.fullmatch(r"\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?", value) else None
    except (OSError, urllib.error.URLError, ValueError):
        return None


def perform_update():
    print("Downloading the latest stable YTConv iSH installer...")
    target = None
    try:
        data = fetch_text(INSTALLER_URL, timeout=20)
        with tempfile.NamedTemporaryFile("w", suffix=".sh", delete=False) as handle:
            handle.write(data + "\n")
            target = handle.name
        result = subprocess.run(["sh", target], check=False, env=child_environment())
        if result.returncode:
            raise RuntimeError("installer exit %s" % result.returncode)
    except (OSError, RuntimeError, urllib.error.URLError) as error:
        eprint("Update failed: %s" % error)
        eprint("Run manually: curl -fsSL %s -o /tmp/ytconv-ish.sh && sh /tmp/ytconv-ish.sh" % INSTALLER_URL)
        return 1
    finally:
        if target:
            try:
                os.unlink(target)
            except OSError:
                pass
    print("Update complete. Run again: ytconv --version")
    return 0


def command_runner(names, module_name=None):
    for name in names:
        executable = shutil.which(name)
        if executable:
            return [executable]
    if module_name and importlib.util.find_spec(module_name) is not None:
        return [sys.executable, "-m", module_name]
    return None


def tools():
    return {
        "yt-dlp": command_runner(["yt-dlp"], "yt_dlp"),
        "gallery-dl": command_runner(["gallery-dl"], "gallery_dl"),
        "ffmpeg": command_runner(["ffmpeg"]),
        "ffprobe": command_runner(["ffprobe"]),
    }


def tool_version(runner):
    if not runner:
        return "not found"
    try:
        result = subprocess.run(
            runner + ["--version"],
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            timeout=20,
            check=False,
        )
        rows = (result.stdout or "").strip().splitlines()
        return rows[0] if result.returncode == 0 and rows else "failed to run"
    except (OSError, subprocess.SubprocessError):
        return "failed to run"


def javascript_runtime_args():
    deno = shutil.which("deno")
    if deno:
        return ["--js-runtimes", "deno:%s" % deno]
    node = shutil.which("node")
    if node:
        try:
            result = subprocess.run(
                [node, "-p", "process.versions.node.split('.')[0]"],
                stdout=subprocess.PIPE,
                stderr=subprocess.DEVNULL,
                text=True,
                timeout=10,
                check=False,
            )
            if result.returncode == 0 and int(result.stdout.strip()) >= 22:
                return ["--js-runtimes", "node:%s" % node]
        except (OSError, ValueError, subprocess.SubprocessError):
            pass
    return []


def pip_install(*packages):
    for extra in (["--break-system-packages"], []):
        command = [sys.executable, "-m", "pip", "install", "-U", "--no-cache-dir"] + extra + list(packages)
        if subprocess.run(command, check=False, env=child_environment()).returncode == 0:
            return True
    return False


def repair():
    print("YTConv iSH repair")
    if Path("/etc/alpine-release").exists() and shutil.which("apk"):
        subprocess.run(["apk", "update"], check=False, env=child_environment())
        subprocess.run(
            ["apk", "add", "--no-cache", "python3", "py3-pip", "ffmpeg", "curl", "ca-certificates"],
            check=False,
            env=child_environment(),
        )
    if not pip_install("yt-dlp[default]", "gallery-dl"):
        eprint("pip could not install yt-dlp/gallery-dl. Check the internet connection and device clock.")
    available = tools()
    missing = [name for name in ("yt-dlp", "gallery-dl", "ffmpeg") if not available[name]]
    if missing:
        eprint("Still missing: %s" % ", ".join(missing))
        return 3
    print("All dependencies are ready.")
    return 0


def default_output():
    configured = os.environ.get("YTCONV_OUTPUT")
    return Path(configured).expanduser().resolve() if configured else Path.home() / "Downloads" / "YTConv"


def safe_part(value, fallback="default"):
    result = re.sub(r"[^a-z0-9._-]+", "-", str(value or fallback).lower()).strip("-")
    return result or fallback


def archive_paths(options, mode):
    if options.no_archive:
        return (None, None)
    directory = Path.home() / ".ytconv" / "archives"
    directory.mkdir(parents=True, exist_ok=True)
    if options.archive:
        yt_archive = Path(options.archive).expanduser().resolve()
        yt_archive.parent.mkdir(parents=True, exist_ok=True)
        return (yt_archive, Path(str(yt_archive) + ".gallery.sqlite3"))
    if mode == "audio":
        profile = "audio-%s-%s" % (safe_part(options.audio_format), safe_part(options.audio_quality))
    elif mode == "video":
        container = effective_video_container(options.url, mode, options.video_format)
        profile = "video-%s-%s" % (safe_part(container), safe_part(options.resolution))
    elif mode == "image":
        profile = "image-original"
    else:
        profile = "auto-%s" % safe_part(options.preset, "balanced")
    return (directory / ("yt-dlp-%s.txt" % profile), directory / ("gallery-dl-%s.sqlite3" % profile))


def cookie_args(path_value):
    if not path_value:
        return []
    target = Path(path_value).expanduser().resolve()
    if not target.is_file():
        raise RuntimeError("cookies.txt was not found: %s" % target)
    return ["--cookies", str(target)]


def output_template(options, output):
    if options.output_template:
        template = options.output_template
        if Path(template).is_absolute() or ".." in Path(template).parts or "%(ext)s" not in template:
            raise RuntimeError("--output-template must be relative, must not contain '..', and must include %(ext)s")
        return str(output / template)
    filename = "%(title).180B [%(id)s].%(ext)s"
    if options.playlist:
        return str(output / "%(playlist_title).120B" / ("%(playlist_index)03d - " + filename))
    return str(output / filename)


def video_selector(resolution, container):
    limit_value = "" if resolution == "best" else "[height<=%s]" % resolution
    separate_any = "bv%s+ba" % limit_value
    combined_any = "b%s" % limit_value
    if container == "mp4":
        return "/".join([
            "bv%s[ext=mp4][vcodec^=avc1]+ba[ext=m4a]" % limit_value,
            "b%s[ext=mp4][vcodec^=avc1]" % limit_value,
            "bv%s[ext=mp4]+ba[ext=m4a]" % limit_value,
            "b%s[ext=mp4]" % limit_value,
            separate_any,
            combined_any,
            "bv+ba",
            "bv*+ba",
            "b",
        ])
    if container == "webm":
        return "/".join([
            "bv%s[ext=webm]+ba[ext=webm]" % limit_value,
            "b%s[ext=webm]" % limit_value,
            separate_any,
            combined_any,
            "bv+ba",
            "bv*+ba",
            "b",
        ])
    return "/".join([separate_any, combined_any, "bv+ba", "bv*+ba", "b"])


def video_container_args(container):
    if container == "mp4":
        return ["--merge-output-format", "mp4", "--recode-video", "mp4"]
    if container == "mkv":
        return ["--merge-output-format", "mkv", "--remux-video", "mkv"]
    if container == "webm":
        return ["--merge-output-format", "webm", "--recode-video", "webm"]
    return ["--merge-output-format", "mp4/mkv"]


def metadata_args(options):
    values = [
        (options.artist, "meta_artist"), (options.title, "meta_title"),
        (options.album, "meta_album"), (options.track, "meta_track"),
        (options.year, "meta_date"), (options.genre, "meta_genre"),
    ]
    args = []
    for value, target in values:
        if value:
            args += ["--parse-metadata", "%s:%%(%s)s" % (value.replace("%", "%%"), target)]
    return args


def common_args(options, output, yt_archive):
    args = [
        "--ignore-config", "--no-colors", "--no-remote-components",
        "--newline", "--socket-timeout", "30",
        "--retries", options.retries, "--fragment-retries", options.fragment_retries,
        "--file-access-retries", options.file_access_retries,
        "--retry-sleep", "http:%s" % options.retry_sleep,
        "--retry-sleep", "fragment:%s" % options.retry_sleep,
        "--retry-sleep", "file_access:%s" % options.retry_sleep,
        "--output", output_template(options, output),
        "--print", "after_move:ytconv-file:%(filepath)s",
        "--force-overwrites" if options.overwrite else "--no-overwrites",
        "--continue" if options.resume else "--no-continue",
        "--yes-playlist" if options.playlist else "--no-playlist",
    ]
    args += javascript_runtime_args()
    args += cookie_args(options.cookies)
    args += metadata_args(options)
    if yt_archive:
        args += ["--download-archive", str(yt_archive)]
    if options.proxy:
        args += ["--proxy", options.proxy]
    if options.rate_limit:
        args += ["--limit-rate", options.rate_limit]
    if options.restrict_filenames:
        args += ["--restrict-filenames"]
    if options.metadata_files:
        args += ["--write-info-json", "--write-description"]
    if options.playlist_items:
        args += ["--playlist-items", options.playlist_items]
    if options.max_downloads:
        args += ["--max-downloads", str(options.max_downloads)]
    if options.skip_playlist_after_errors:
        args += ["--skip-playlist-after-errors", str(options.skip_playlist_after_errors)]
    if options.start or options.end:
        args += [
            "--download-sections",
            "*%s-%s" % (options.start or "0", options.end or "inf"),
            "--force-keyframes-at-cuts",
        ]
    if options.sponsorblock != "off":
        args += [
            "--sponsorblock-remove" if options.sponsorblock == "remove" else "--sponsorblock-mark",
            options.sponsorblock_categories,
        ]
    return args


def yt_dlp_args(options, output, yt_archive, mode):
    args = common_args(options, output, yt_archive)
    thumbnail = options.thumbnail or (mode == "audio" and options.audio_format == "mp3")
    if thumbnail:
        args += ["--write-thumbnail", "--convert-thumbnails", "jpg"]
    if options.subtitle_only:
        args += [
            "--write-subs", "--write-auto-subs", "--sub-langs", options.subtitle_langs,
            "--sub-format", "best", "--convert-subs", "srt", "--skip-download",
        ]
    elif mode == "audio":
        quality = "0" if options.audio_quality == "best" else options.audio_quality + "K"
        args += [
            "-f", "ba/b", "-x", "--audio-format", options.audio_format,
            "--audio-quality", quality, "--embed-metadata", "--embed-chapters",
        ]
        if thumbnail and options.audio_format != "wav":
            args += ["--embed-thumbnail"]
        if thumbnail and is_youtube_music_url(options.url):
            args += ["--ppa", "ThumbnailsConvertor+ffmpeg_o:-vf crop=ih:ih"]
        if options.normalize_audio:
            args += ["--ppa", "ExtractAudio+ffmpeg_o:-af loudnorm=I=-16:LRA=11:TP=-1.5"]
    else:
        container = effective_video_container(options.url, "video", options.video_format)
        args += [
            "-f", video_selector(options.resolution, container),
            "--embed-metadata", "--embed-chapters",
        ]
        args += video_container_args(container)
        if options.subtitles:
            args += [
                "--write-subs", "--write-auto-subs", "--sub-langs", options.subtitle_langs,
                "--sub-format", "best", "--convert-subs", "srt", "--embed-subs",
            ]
    ffmpeg = shutil.which("ffmpeg")
    if ffmpeg:
        args += ["--ffmpeg-location", ffmpeg]
    args.append(options.url)
    return args


def gallery_args(options, output, gallery_archive):
    args = [
        "--config-ignore", "--no-colors", "--no-input",
        "--retries", int(options.retries) if options.retries.isdigit() else 10,
        "--http-timeout", "30", "--destination", str(output),
        "--option", "extractor.instagram.videos=true",
        "--option", "extractor.pinterest.videos=true",
    ]
    args += cookie_args(options.cookies)
    if gallery_archive:
        args += ["--download-archive", str(gallery_archive)]
    args.append(options.url)
    return args


def output_files(directory):
    files = set()
    if not directory.exists():
        return files
    for target in directory.rglob("*"):
        try:
            if target.is_file():
                files.add(target.resolve())
        except OSError:
            pass
    return files


def expected_extensions(mode, subtitle_only=False):
    if subtitle_only:
        return SUBTITLE_EXTENSIONS
    if mode == "audio":
        return AUDIO_EXTENSIONS
    if mode == "video":
        return VIDEO_EXTENSIONS
    if mode == "image":
        return IMAGE_EXTENSIONS | VIDEO_EXTENSIONS
    return AUDIO_EXTENSIONS | VIDEO_EXTENSIONS | IMAGE_EXTENSIONS


def verified_outputs(before, after, reported, mode, subtitle_only=False):
    allowed = expected_extensions(mode, subtitle_only)
    candidates = set(after.difference(before))
    for value in reported:
        try:
            target = Path(value).expanduser().resolve()
            if target.is_file():
                candidates.add(target)
        except OSError:
            pass
    return sorted(
        (target for target in candidates if target.suffix.lower() in allowed),
        key=lambda item: str(item),
    )


def run_tool(label, runner, args, capture=False):
    if not runner:
        raise RuntimeError("%s is not available. Run ytconv repair" % label)
    command = runner + args
    environment = child_environment()
    if capture:
        result = subprocess.run(
            command,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            check=False,
            env=environment,
        )
        if result.returncode:
            rows = (result.stderr or result.stdout or "").strip().splitlines()
            raise RuntimeError(rows[-1] if rows else "%s failed" % label)
        return {"stdout": result.stdout or "", "reported": [], "archive_skipped": False}

    print("\nYTConv %s is using %s" % (VERSION, label))
    process = subprocess.Popen(
        command,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        env=environment,
        bufsize=1,
    )
    reported = []
    archive_skipped = False
    rows = []
    assert process.stdout is not None
    try:
        for row in process.stdout:
            row = row.rstrip("\r\n")
            rows.append(row)
            if row.startswith("ytconv-file:"):
                reported.append(row[len("ytconv-file:"):].strip())
            else:
                print(row)
            lower = row.lower()
            if "already been recorded in the archive" in lower or "has already been recorded in archive" in lower:
                archive_skipped = True
    finally:
        process.stdout.close()
    return_code = process.wait()
    if return_code:
        message = next((row for row in reversed(rows) if row.strip()), "%s failed" % label)
        raise RuntimeError(message)
    return {
        "stdout": "\n".join(rows),
        "reported": reported,
        "archive_skipped": archive_skipped,
    }


def gallery_preferred(url):
    host = host_for(url)
    return any(host == item or host.endswith("." + item) for item in GALLERY_HOSTS)


def run_verified_yt_dlp(options, available, output, yt_archive, mode):
    before = output_files(output)
    result = run_tool("yt-dlp", available["yt-dlp"], yt_dlp_args(options, output, yt_archive, mode))
    after = output_files(output)
    files = verified_outputs(before, after, result["reported"], mode, options.subtitle_only)

    if not files and result["archive_skipped"] and yt_archive:
        print("The archive entry exists but its output file is missing. Restoring once without the archive...")
        retry = run_tool("yt-dlp", available["yt-dlp"], yt_dlp_args(options, output, None, mode))
        after = output_files(output)
        files = verified_outputs(before, after, retry["reported"], mode, options.subtitle_only)
        result = retry

    if not files:
        raise RuntimeError(
            "yt-dlp exited successfully but produced no verified %s file. "
            "YTConv did not mark this conversion as successful." % ("subtitle" if options.subtitle_only else mode)
        )
    return {"ok": True, "url": options.url, "engine": "yt-dlp", "mode": mode, "files": [str(item) for item in files]}


def run_verified_gallery(options, available, output, gallery_archive):
    before = output_files(output)
    run_tool("gallery-dl", available["gallery-dl"], gallery_args(options, output, gallery_archive))
    after = output_files(output)
    files = verified_outputs(before, after, [], "image")
    if not files:
        raise RuntimeError("gallery-dl exited successfully but produced no verified media file.")
    return {"ok": True, "url": options.url, "engine": "gallery-dl", "mode": "image", "files": [str(item) for item in files]}


def execute_one(options):
    available = tools()
    output = Path(options.output).expanduser().resolve() if options.output else default_output()
    output.mkdir(parents=True, exist_ok=True)
    mode = effective_mode(options.url, options.mode)
    yt_archive, gallery_archive = archive_paths(options, mode)

    if options.list_formats or options.list_subs:
        args = ["--ignore-config"] + cookie_args(options.cookies)
        args += ["--list-formats"] if options.list_formats else ["--list-subs"]
        args.append(options.url)
        run_tool("yt-dlp", available["yt-dlp"], args)
        return {"ok": True, "url": options.url, "mode": "utility"}

    if options.dry_run or options.json:
        raw = run_tool(
            "yt-dlp",
            available["yt-dlp"],
            ["--ignore-config", "--dump-single-json", "--skip-download", "--no-warnings"]
            + cookie_args(options.cookies)
            + [options.url],
            capture=True,
        )["stdout"]
        data = json.loads(raw)
        summary = {
            "schemaVersion": 2,
            "ytconvVersion": VERSION,
            "title": data.get("title"),
            "uploader": data.get("uploader") or data.get("channel"),
            "url": options.url,
        }
        print(
            json.dumps(summary, indent=2, ensure_ascii=False)
            if options.json
            else "Title: %s\nUploader: %s" % (summary["title"], summary["uploader"] or "-")
        )
        return {"ok": True, "url": options.url, "mode": "inspect"}

    force_gallery = mode == "image"
    force_video = mode in ("video", "audio") or options.subtitle_only
    first_gallery = force_gallery or (not force_video and gallery_preferred(options.url))

    if first_gallery:
        try:
            return run_verified_gallery(options, available, output, gallery_archive)
        except RuntimeError:
            if force_gallery:
                raise
            eprint("gallery-dl failed; trying yt-dlp...")

    yt_mode = "video" if mode == "auto" else mode
    try:
        return run_verified_yt_dlp(options, available, output, yt_archive, yt_mode)
    except RuntimeError:
        if force_video:
            raise
        eprint("yt-dlp failed; trying gallery-dl...")
        return run_verified_gallery(options, available, output, gallery_archive)


def diagnostics():
    available = tools()
    latest = remote_version()
    rows = [
        ("YTConv iSH", VERSION), ("Python", sys.version.split()[0]),
        ("yt-dlp", tool_version(available["yt-dlp"])),
        ("gallery-dl", tool_version(available["gallery-dl"])),
        ("FFmpeg", tool_version(available["ffmpeg"])),
        ("Output", str(default_output())), ("Update", latest or "offline"),
        ("YouTube AUTO", "MP4 video"), ("YT Music AUTO", "MP3 audio"),
        ("Archive", "ON per output profile"),
    ]
    print("YTConv iSH doctor\n")
    for label, value in rows:
        print("%-14s %s" % (label, value))
    missing = [name for name in ("yt-dlp", "gallery-dl", "ffmpeg") if not available[name]]
    if missing:
        print("\nMissing: %s\nRun: ytconv repair" % ", ".join(missing))
        return 3
    return 0


def normalize_commands(argv):
    if not argv or argv[0].startswith("-") or valid_url(argv[0]):
        return argv
    command, rest = argv[0].lower(), argv[1:]
    mapping = {
        "download": rest, "dl": rest, "get": rest,
        "playlist": ["--playlist"] + rest, "pl": ["--playlist"] + rest,
        "doctor": ["--doctor"] + rest, "repair": ["--repair"] + rest,
        "setup": ["--repair"] + rest, "update": ["--update"] + rest,
    }
    if command == "batch":
        return (["--batch-file", rest[0], "--continue-on-error"] + rest[1:]) if rest else ["--batch-file"]
    if command in ("info", "inspect"):
        return ["--dry-run"] + rest
    if command == "formats":
        return ["--list-formats"] + rest
    if command in ("subtitles", "subs"):
        return ["--list-subs"] + rest
    if command in ("extract", "content"):
        return ["--subtitle-only", "--metadata-files"] + rest
    if command in ("transcript", "text"):
        return ["--subtitle-only"] + rest
    return mapping.get(command, argv)


def selected_preset(argv):
    try:
        return argv[argv.index("--preset") + 1]
    except (ValueError, IndexError):
        return "balanced"


def parser(argv):
    preset = selected_preset(argv)
    defaults = dict(PRESETS.get(preset, {}))
    value = argparse.ArgumentParser(prog="ytconv", description="YTConv %s for iSH/Alpine." % VERSION)
    value.set_defaults(**defaults)
    value.add_argument("url", nargs="?")
    value.add_argument("--version", action="store_true")
    value.add_argument("--diagnose", "--doctor", action="store_true")
    value.add_argument("--repair", "--setup", action="store_true")
    value.add_argument("--check-update", action="store_true")
    value.add_argument("--update", action="store_true")
    value.add_argument("--preset", choices=sorted(PRESETS), default=preset)
    value.add_argument("--list-presets", action="store_true")
    modes = value.add_mutually_exclusive_group()
    modes.add_argument("--auto", dest="mode", action="store_const", const="auto")
    modes.add_argument("--video", dest="mode", action="store_const", const="video")
    modes.add_argument("--audio", dest="mode", action="store_const", const="audio")
    modes.add_argument("--image", "--images", "--gallery", dest="mode", action="store_const", const="image")
    value.set_defaults(mode=defaults.get("mode", "auto"))
    value.add_argument("--audio-format", choices=["mp3", "m4a", "aac", "opus", "vorbis", "flac", "alac", "wav"], default=defaults.get("audio_format", "mp3"))
    value.add_argument("--audio-quality", choices=["best", "320", "256", "192", "128", "96"], default=defaults.get("audio_quality", "best"))
    value.add_argument("--video-format", choices=["auto", "mp4", "mkv", "webm"], default=defaults.get("video_format", "auto"))
    value.add_argument("--resolution", choices=["best", "2160", "1440", "1080", "720", "480", "360", "240", "144"], default=defaults.get("resolution", "best"))
    value.add_argument("--subtitles", dest="subtitles", action="store_true", default=False)
    value.add_argument("--no-subtitles", dest="subtitles", action="store_false")
    value.add_argument("--subtitle-only", action="store_true")
    value.add_argument("--subtitle-langs", default="all,-live_chat")
    value.add_argument("--sponsorblock", choices=["off", "mark", "remove"], default="mark")
    value.add_argument("--no-sponsorblock", dest="sponsorblock", action="store_const", const="off")
    value.add_argument("--sponsorblock-categories", default=DEFAULT_CATEGORIES)
    value.add_argument("--thumbnail", action="store_true", default=defaults.get("thumbnail", False))
    value.add_argument("--metadata-files", action="store_true", default=defaults.get("metadata_files", False))
    value.add_argument("--artist")
    value.add_argument("--title")
    value.add_argument("--album")
    value.add_argument("--track")
    value.add_argument("--year")
    value.add_argument("--genre")
    value.add_argument("--playlist", action="store_true", default=defaults.get("playlist", False))
    value.add_argument("--playlist-items")
    value.add_argument("--max-downloads", type=int)
    value.add_argument("--skip-playlist-after-errors", type=int)
    value.add_argument("--archive")
    value.add_argument("--no-archive", action="store_true")
    value.add_argument("--retries", default="10")
    value.add_argument("--fragment-retries", default="10")
    value.add_argument("--file-access-retries", default="3")
    value.add_argument("--retry-sleep", default="linear=1::2")
    value.add_argument("--resume", dest="resume", action="store_true", default=True)
    value.add_argument("--no-resume", dest="resume", action="store_false")
    value.add_argument("--cleanup-part", action="store_true")
    value.add_argument("--start", "--from", dest="start")
    value.add_argument("--end", "--to", dest="end")
    value.add_argument("--normalize-audio", action="store_true")
    value.add_argument("--overwrite", action="store_true")
    value.add_argument("--restrict-filenames", action="store_true", default=defaults.get("restrict_filenames", False))
    value.add_argument("--proxy")
    value.add_argument("--rate-limit")
    value.add_argument("--cookies")
    value.add_argument("--output-template")
    value.add_argument("--output", "-o")
    value.add_argument("--dry-run", action="store_true")
    value.add_argument("--json", action="store_true")
    value.add_argument("--list-formats", action="store_true")
    value.add_argument("--list-subs", action="store_true")
    value.add_argument("--batch-file")
    value.add_argument("--continue-on-error", action="store_true")
    value.add_argument("--result-json")
    value.add_argument("--jobs", type=int, default=1)
    return value


def batch_urls(options):
    values = []
    if options.url:
        values.append(options.url)
    if options.batch_file:
        for row in Path(options.batch_file).expanduser().read_text(encoding="utf-8").splitlines():
            row = row.strip()
            if row and not row.startswith("#"):
                values.append(row)
    if not values and not sys.stdin.isatty():
        values.extend(row.strip() for row in sys.stdin.read().splitlines() if row.strip() and not row.strip().startswith("#"))
    unique = list(dict.fromkeys(values))
    invalid = [url for url in unique if not valid_url(url)]
    if invalid:
        raise RuntimeError("Invalid URL: %s" % invalid[0])
    return unique


def main(argv=None):
    argv = normalize_commands(list(sys.argv[1:] if argv is None else argv))
    options = parser(argv).parse_args(argv)
    if options.version:
        print(VERSION)
        return 0
    if options.list_presets:
        print("\n".join(sorted(PRESETS)))
        return 0
    if options.diagnose:
        return diagnostics()
    if options.repair:
        return repair()
    if options.check_update:
        latest = remote_version()
        print("%s available" % latest if latest and version_tuple(latest) > version_tuple(VERSION) else "up to date (%s)" % VERSION)
        return 0 if latest else 5
    if options.update:
        return perform_update()

    try:
        urls = batch_urls(options)
        if not urls and sys.stdin.isatty():
            candidate = input("Paste link media: ").strip()
            urls = [candidate] if candidate else []
        if not urls:
            raise RuntimeError("No URL was provided. Pass a URL, batch file, or pipe URLs through stdin.")
        results = []
        for index, url in enumerate(urls, 1):
            options.url = url
            print("\n[%s/%s] %s" % (index, len(urls), url))
            try:
                results.append(execute_one(options))
            except (OSError, RuntimeError, ValueError, json.JSONDecodeError) as error:
                eprint("Failed: %s" % error)
                results.append({"ok": False, "url": url, "error": str(error)})
                if not options.continue_on_error:
                    break
        success = len([item for item in results if item.get("ok")])
        failed = len(results) - success
        report = {
            "schemaVersion": 1,
            "ytconvVersion": VERSION,
            "success": success,
            "failed": failed,
            "results": results,
        }
        if options.result_json:
            target = Path(options.result_json).expanduser().resolve()
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_text(json.dumps(report, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
            print("JSON report: %s" % target)
        print("\nSummary: %s succeeded, %s failed." % (success, failed))
        return 1 if failed else 0
    except (OSError, RuntimeError, ValueError, json.JSONDecodeError) as error:
        eprint("YTConv: %s" % error)
        eprint("Run ytconv doctor and ytconv repair.")
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
