#!/usr/bin/env python3
"""YTConv 1.2 native compatibility frontend for iSH on iOS.

This frontend intentionally avoids Node.js and Ink because iSH commonly ships
an older Alpine/Node environment. It calls yt-dlp, gallery-dl, and FFmpeg
through Python-compatible subprocess arguments without a shell wrapper.
"""

import argparse
import importlib.util
import json
import os
import re
import shutil
import subprocess
import sys
import urllib.error
import urllib.request
from pathlib import Path
from urllib.parse import urlparse

VERSION = "1.2.0"
RAW_BASE = (
    "https://raw.githubusercontent.com/andhikamarcella/"
    "youtubetomp3/codex/add-ytconv-cli/cli"
)
REMOTE_VERSION_URL = RAW_BASE + "/ish/VERSION"
INSTALLER_URL = RAW_BASE + "/scripts/install-ish.sh"
DEFAULT_SPONSOR_CATEGORIES = (
    "sponsor,selfpromo,interaction,intro,outro,preview,music_offtopic"
)
GALLERY_HOSTS = {
    "instagram.com", "pinterest.com", "pin.it", "tiktok.com", "twitter.com",
    "x.com", "facebook.com", "threads.com", "threads.net", "reddit.com",
    "tumblr.com", "imgur.com", "flickr.com", "deviantart.com", "pixiv.net",
    "bsky.app",
}
PRESETS = {
    "balanced": {},
    "music": {
        "mode": "audio", "audio_format": "mp3", "audio_quality": "320",
        "thumbnail": True,
    },
    "lossless": {
        "mode": "audio", "audio_format": "flac", "audio_quality": "best",
        "thumbnail": True,
    },
    "mobile": {"mode": "video", "video_format": "mp4", "resolution": "720"},
    "hd": {"mode": "video", "video_format": "mp4", "resolution": "1080"},
    "archive": {
        "mode": "auto", "video_format": "mkv", "resolution": "best",
        "playlist": True, "subtitles": True, "metadata_files": True,
        "thumbnail": True, "restrict_filenames": True,
    },
}


def eprint(message):
    print(message, file=sys.stderr)


def version_tuple(value):
    parts = re.findall(r"\d+", str(value))[:3]
    return tuple(int(part) for part in parts + ["0"] * (3 - len(parts)))


def fetch_text(url, timeout=8):
    request = urllib.request.Request(
        url, headers={"User-Agent": "ytconv-ish/%s" % VERSION}
    )
    with urllib.request.urlopen(request, timeout=timeout) as response:
        return response.read().decode("utf-8", "replace").strip()


def remote_version():
    try:
        value = fetch_text(REMOTE_VERSION_URL)
        if re.fullmatch(r"\d+\.\d+\.\d+", value):
            return value
    except (OSError, urllib.error.URLError, ValueError):
        pass
    return None


def install_command():
    return "curl -fsSL %s | sh" % INSTALLER_URL


def update_available():
    latest = remote_version()
    return latest, bool(latest and version_tuple(latest) > version_tuple(VERSION))


def perform_update():
    print("Mengunduh installer YTConv iSH terbaru...")
    result = subprocess.run(["sh", "-c", install_command()])
    if result.returncode != 0:
        eprint("Update gagal. Jalankan manual:")
        eprint(install_command())
        return result.returncode or 1
    print("Update selesai. Jalankan kembali: ytconv")
    return 0


def enforce_update(disabled=False):
    if disabled:
        return 0
    latest, available = update_available()
    if not available:
        return 0
    print("\nUPDATE WAJIB YTConv iSH: %s -> %s" % (VERSION, latest))
    print("YTConv akan memperbarui frontend iSH sebelum dipakai.\n")
    return perform_update() or 2


def module_runner(module_name):
    if importlib.util.find_spec(module_name) is None:
        return None
    return [sys.executable, "-m", module_name]


def command_runner(names, module_name=None):
    for name in names:
        executable = shutil.which(name)
        if executable:
            return [executable]
    if module_name:
        return module_runner(module_name)
    return None


def tool_version(runner):
    if not runner:
        return "tidak ditemukan"
    try:
        result = subprocess.run(
            runner + ["--version"], stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT, text=True, timeout=20,
        )
        output = (result.stdout or "").strip().splitlines()
        return output[0] if result.returncode == 0 and output else "gagal dijalankan"
    except (OSError, subprocess.SubprocessError):
        return "gagal dijalankan"


def tools():
    return {
        "yt-dlp": command_runner(["yt-dlp"], "yt_dlp"),
        "gallery-dl": command_runner(["gallery-dl"], "gallery_dl"),
        "ffmpeg": command_runner(["ffmpeg"]),
    }


def default_output():
    configured = os.environ.get("YTCONV_OUTPUT")
    if configured:
        return Path(configured).expanduser().resolve()
    return Path.home() / "Downloads" / "YTConv"


def cookie_args(path_value):
    if not path_value:
        return []
    cookie_path = Path(path_value).expanduser().resolve()
    if not cookie_path.is_file():
        raise RuntimeError("cookies.txt tidak ditemukan: %s" % cookie_path)
    return ["--cookies", str(cookie_path)]


def host_for(url):
    try:
        host = (urlparse(url).hostname or "").lower()
    except ValueError:
        return ""
    return host[4:] if host.startswith("www.") else host


def gallery_preferred(url):
    host = host_for(url)
    return any(host == item or host.endswith("." + item) for item in GALLERY_HOSTS)


def validate_url(url):
    try:
        parsed = urlparse(url)
        return parsed.scheme in ("http", "https") and bool(parsed.netloc)
    except ValueError:
        return False


def output_template(options, output):
    if options.output_template:
        return str(output / options.output_template)
    if options.playlist:
        return str(
            output / "%(playlist_title).120B"
            / "%(playlist_index)03d - %(title).160B [%(id)s].%(ext)s"
        )
    return str(output / "%(title).180B [%(id)s].%(ext)s")


def video_selector(resolution, container):
    limit = "" if resolution == "best" else "[height<=%s]" % resolution
    if container == "webm":
        return "/".join([
            "bv*%s[ext=webm]+ba[ext=webm]" % limit,
            "b%s[ext=webm]" % limit,
            "bv*%s+ba" % limit,
            "b%s" % limit,
        ])
    return "/".join([
        "bv*%s[ext=mp4]+ba[ext=m4a]" % limit,
        "b%s[ext=mp4]" % limit,
        "bv*%s+ba" % limit,
        "b%s" % limit,
    ])


def append_common_download_args(args, options, output):
    args += [
        "--ignore-config", "--newline", "--continue", "--retries", "10",
        "--fragment-retries", "10", "--extractor-retries", "5",
        "--socket-timeout", "30", "--concurrent-fragments",
        str(options.concurrent_fragments), "--output", output_template(options, output),
    ]
    args += ["--force-overwrites"] if options.overwrite else ["--no-overwrites"]
    args += cookie_args(options.cookies)
    args += ["--yes-playlist", "--no-abort-on-error"] if options.playlist else ["--no-playlist"]
    if options.proxy:
        args += ["--proxy", options.proxy]
    if options.rate_limit:
        args += ["--limit-rate", options.rate_limit]
    if options.restrict_filenames:
        args += ["--restrict-filenames"]
    if options.playlist_items:
        args += ["--playlist-items", options.playlist_items]
    if options.max_downloads:
        args += ["--max-downloads", str(options.max_downloads)]
    if options.live_from_start:
        args += ["--live-from-start"]
    if options.archive:
        args += ["--download-archive", str(Path(options.archive).expanduser().resolve())]


def append_sidecar_args(args, options):
    if options.metadata_files or options.write_info_json:
        args += ["--write-info-json"]
    if options.metadata_files or options.write_description:
        args += ["--write-description"]
    if options.start or options.end:
        args += [
            "--download-sections", "*%s-%s" % (options.start or "0", options.end or "inf"),
            "--force-keyframes-at-cuts",
        ]
    if options.sponsorblock != "off":
        flag = "--sponsorblock-remove" if options.sponsorblock == "remove" else "--sponsorblock-mark"
        args += [flag, options.sponsorblock_categories]


def yt_dlp_args(options, output):
    args = []
    append_common_download_args(args, options, output)
    append_sidecar_args(args, options)

    thumbnail = options.thumbnail or (options.mode == "audio" and options.audio_format == "mp3")
    if thumbnail:
        args += ["--write-thumbnail", "--convert-thumbnails", "jpg"]

    if options.mode == "audio":
        quality = "0" if options.audio_quality == "best" else options.audio_quality + "K"
        args += [
            "-f", "ba/b", "-x", "--audio-format", options.audio_format,
            "--audio-quality", quality, "--embed-metadata", "--embed-chapters",
        ]
        if options.keep_video:
            args += ["--keep-video"]
        if thumbnail and options.audio_format != "wav":
            args += ["--embed-thumbnail"]
        if thumbnail and host_for(options.url) == "music.youtube.com":
            args += ["--ppa", "ThumbnailsConvertor+ffmpeg_o:-vf crop=ih:ih"]
        if options.normalize_audio:
            args += ["--ppa", "ExtractAudio+ffmpeg_o:-af loudnorm=I=-16:LRA=11:TP=-1.5"]
    else:
        args += [
            "-f", video_selector(options.resolution, options.video_format),
            "--embed-metadata", "--embed-chapters",
        ]
        if options.video_format == "auto":
            args += ["--merge-output-format", "mp4/mkv", "--remux-video", "mov>mp4/mkv"]
        else:
            args += ["--merge-output-format", options.video_format, "--remux-video", options.video_format]
        if options.subtitles:
            args += [
                "--write-subs", "--write-auto-subs", "--sub-langs",
                options.subtitle_langs, "--sub-format", "best",
                "--convert-subs", "srt", "--embed-subs",
            ]

    ffmpeg = shutil.which("ffmpeg")
    if ffmpeg:
        args += ["--ffmpeg-location", ffmpeg]
    args.append(options.url)
    return args


def gallery_args(options, output):
    args = [
        "--config-ignore", "--no-colors", "--no-input", "--retries", "10",
        "--http-timeout", "30", "--destination", str(output),
        "--option", "extractor.instagram.static-videos=false",
        "--option", "extractor.instagram.videos=true",
        "--option", "extractor.pinterest.stories=true",
        "--option", "extractor.pinterest.videos=true",
    ]
    args += cookie_args(options.cookies)
    if options.mode == "stories":
        args += ["--option", "extractor.instagram.include=stories"]
    elif options.mode == "all-media":
        args += ["--option", "extractor.instagram.include=all"]
    args.append(options.url)
    return args


def run_tool(label, runner, args, capture=False):
    if not runner:
        raise RuntimeError(
            "%s belum tersedia. Jalankan ulang installer iSH:\n%s"
            % (label, install_command())
        )
    if not capture:
        print("\nYTConv %s menggunakan %s" % (VERSION, label))
        result = subprocess.run(runner + args)
        if result.returncode != 0:
            raise RuntimeError("%s gagal dengan kode %s" % (label, result.returncode))
        return ""
    result = subprocess.run(
        runner + args, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True
    )
    if result.returncode != 0:
        detail = (result.stderr or result.stdout or "").strip().splitlines()
        raise RuntimeError(detail[-1] if detail else "%s gagal" % label)
    return result.stdout


def inspect_direct(options, runner):
    if options.list_formats or options.list_subs:
        args = ["--ignore-config"] + cookie_args(options.cookies)
        args += ["--list-formats"] if options.list_formats else ["--list-subs"]
        args.append(options.url)
        run_tool("yt-dlp", runner, args)
        return 0

    args = [
        "--ignore-config", "--dump-single-json", "--skip-download", "--no-warnings",
    ] + cookie_args(options.cookies)
    args += ["--yes-playlist", "--flat-playlist"] if options.playlist else ["--no-playlist"]
    args.append(options.url)
    raw = run_tool("yt-dlp", runner, args, capture=True)
    data = json.loads(raw)
    entries = [item for item in (data.get("entries") or []) if item]
    item = entries[0] if entries else data
    summary = {
        "schemaVersion": 1,
        "ytconvVersion": VERSION,
        "preset": options.preset,
        "media": {
            "title": data.get("title") or item.get("title") or "Media tanpa judul",
            "uploader": data.get("uploader") or data.get("channel") or item.get("uploader") or "",
            "duration": data.get("duration") or item.get("duration"),
            "itemCount": len(entries) if entries else 1,
            "isPlaylist": bool(entries),
            "originalUrl": data.get("webpage_url") or options.url,
            "engine": "yt-dlp",
        },
    }
    if options.json:
        print(json.dumps(summary, indent=2, ensure_ascii=False))
    else:
        media = summary["media"]
        print("YTConv %s dry run" % VERSION)
        print("Preset     %s" % options.preset)
        print("Title      %s" % media["title"])
        print("Uploader   %s" % (media["uploader"] or "-"))
        print("Duration   %s" % (media["duration"] or "-"))
        print("Items      %s" % media["itemCount"])
        print("URL        %s" % media["originalUrl"])
    return 0


def execute(options):
    available = tools()
    output = Path(options.output).expanduser().resolve() if options.output else default_output()
    output.mkdir(parents=True, exist_ok=True)

    if options.dry_run or options.json or options.list_formats or options.list_subs:
        return inspect_direct(options, available["yt-dlp"])

    force_gallery = options.mode in ("image", "stories", "all-media")
    force_video = options.mode in ("video", "audio")
    first_gallery = force_gallery or (not force_video and gallery_preferred(options.url))

    if first_gallery:
        try:
            run_tool("gallery-dl", available["gallery-dl"], gallery_args(options, output))
            return 0
        except RuntimeError as gallery_error:
            if force_gallery:
                raise
            eprint("Gallery engine gagal: %s" % gallery_error)
            eprint("Mencoba yt-dlp...")

    try:
        run_tool("yt-dlp", available["yt-dlp"], yt_dlp_args(options, output))
        return 0
    except RuntimeError as video_error:
        if force_video:
            raise
        eprint("yt-dlp gagal: %s" % video_error)
        eprint("Mencoba gallery-dl...")
        run_tool("gallery-dl", available["gallery-dl"], gallery_args(options, output))
        return 0


def diagnostics():
    available = tools()
    latest, newer = update_available()
    rows = [
        ("YTConv iSH", VERSION), ("Python", sys.version.split()[0]),
        ("Platform", sys.platform), ("yt-dlp", tool_version(available["yt-dlp"])),
        ("gallery-dl", tool_version(available["gallery-dl"])),
        ("FFmpeg", tool_version(available["ffmpeg"])), ("Output", str(default_output())),
        ("Update", ("tersedia " + latest) if newer else (latest or "offline")),
    ]
    print("YTConv iSH diagnostics\n")
    for label, value in rows:
        print("%-14s %s" % (label, value))
    missing = [name for name, runner in available.items() if not runner]
    if missing:
        print("\nBelum tersedia: %s" % ", ".join(missing))
        print("Perbaiki dengan:\n%s" % install_command())
        return 1
    if sys.version_info < (3, 10):
        print(
            "\nCatatan: Python iSH lebih lama dari 3.10. pip memakai rilis yt-dlp "
            "terakhir yang kompatibel; beberapa situs terbaru dapat gagal."
        )
    return 0


def selected_preset(argv):
    for index, value in enumerate(argv):
        if value == "--preset" and index + 1 < len(argv):
            return argv[index + 1]
    return "balanced"


def parser(argv):
    preset = selected_preset(argv)
    defaults = dict(PRESETS.get(preset, {}))
    value = argparse.ArgumentParser(
        prog="ytconv",
        description="YTConv 1.2 native iSH: downloader dan converter sosial media.",
    )
    value.set_defaults(**defaults)
    value.add_argument("url", nargs="?", help="Link media sosial")
    value.add_argument("--version", action="store_true")
    value.add_argument("--diagnose", action="store_true")
    value.add_argument("--check-update", action="store_true")
    value.add_argument("--update", action="store_true")
    value.add_argument("--no-update-check", action="store_true")
    value.add_argument("--preset", choices=sorted(PRESETS), default=preset)
    value.add_argument("--list-presets", action="store_true")
    modes = value.add_mutually_exclusive_group()
    modes.add_argument("--auto", dest="mode", action="store_const", const="auto")
    modes.add_argument("--video", dest="mode", action="store_const", const="video")
    modes.add_argument("--audio", dest="mode", action="store_const", const="audio")
    modes.add_argument("--image", "--images", "--gallery", dest="mode", action="store_const", const="image")
    modes.add_argument("--stories", dest="mode", action="store_const", const="stories")
    modes.add_argument("--all-media", dest="mode", action="store_const", const="all-media")
    value.set_defaults(mode=defaults.get("mode", "auto"))
    value.add_argument("--audio-format", choices=["mp3", "m4a", "aac", "opus", "vorbis", "flac", "alac", "wav"], default=defaults.get("audio_format", "mp3"))
    value.add_argument("--audio-quality", "--bitrate", choices=["best", "320", "256", "192", "128", "96"], default=defaults.get("audio_quality", "best"))
    value.add_argument("--video-format", "--container", choices=["auto", "mp4", "mkv", "webm"], default=defaults.get("video_format", "auto"))
    value.add_argument("--resolution", choices=["best", "2160", "1440", "1080", "720", "480", "360", "240", "144"], default=defaults.get("resolution", "best"))
    value.add_argument("--subtitles", action="store_true", default=defaults.get("subtitles", False))
    value.add_argument("--subtitle-langs", default="all,-live_chat")
    value.add_argument("--thumbnail", action="store_true", default=defaults.get("thumbnail", False))
    value.add_argument("--metadata-files", action="store_true", default=defaults.get("metadata_files", False))
    value.add_argument("--write-info-json", action="store_true")
    value.add_argument("--write-description", action="store_true")
    value.add_argument("--start")
    value.add_argument("--end")
    value.add_argument("--archive", default=(str(default_output() / "ytconv-archive.txt") if preset == "archive" else None))
    value.add_argument("--sponsorblock", choices=["off", "mark", "remove"], default="off")
    value.add_argument("--remove-sponsors", action="store_true")
    value.add_argument("--sponsorblock-categories", default=DEFAULT_SPONSOR_CATEGORIES)
    value.add_argument("--normalize-audio", action="store_true")
    value.add_argument("--keep-video", action="store_true")
    value.add_argument("--overwrite", action="store_true")
    value.add_argument("--rate-limit")
    value.add_argument("--concurrent-fragments", type=int, choices=range(1, 17), default=4)
    value.add_argument("--proxy")
    value.add_argument("--output-template")
    value.add_argument("--restrict-filenames", action="store_true", default=defaults.get("restrict_filenames", False))
    value.add_argument("--playlist", action="store_true", default=defaults.get("playlist", False))
    value.add_argument("--playlist-items")
    value.add_argument("--max-downloads", type=int)
    value.add_argument("--live-from-start", action="store_true")
    value.add_argument("--dry-run", action="store_true")
    value.add_argument("--json", action="store_true")
    value.add_argument("--list-formats", action="store_true")
    value.add_argument("--list-subs", action="store_true")
    value.add_argument("--cookies")
    value.add_argument("--output", "-o")
    return value


def main(argv=None):
    argv = list(sys.argv[1:] if argv is None else argv)
    options = parser(argv).parse_args(argv)
    if options.version:
        print(VERSION)
        return 0
    if options.list_presets:
        for name in sorted(PRESETS):
            print(name)
        return 0
    if options.diagnose:
        return diagnostics()
    if options.check_update:
        latest, newer = update_available()
        print("tersedia %s" % latest if newer else "sudah terbaru (%s)" % VERSION)
        return 0 if latest else 1
    if options.update:
        return perform_update()

    if options.remove_sponsors:
        options.sponsorblock = "remove"
    if options.json:
        options.dry_run = True
        options.no_update_check = True
    if any(flag in argv for flag in ("--audio-format", "--audio-quality", "--bitrate", "--normalize-audio", "--keep-video")):
        options.mode = "audio"
    if any(flag in argv for flag in ("--video-format", "--container", "--resolution", "--subtitles", "--subtitle-langs")):
        options.mode = "video"

    update_result = enforce_update(options.no_update_check)
    if update_result:
        return update_result

    if not options.url and sys.stdin.isatty():
        options.url = input("Paste link media: ").strip()
    if not options.url or not validate_url(options.url):
        eprint("Masukkan link http/https yang valid.")
        return 2

    try:
        return execute(options)
    except (OSError, RuntimeError, ValueError, json.JSONDecodeError) as error:
        eprint("\nconversion failed: %s" % error)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
