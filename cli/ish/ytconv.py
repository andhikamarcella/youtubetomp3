#!/usr/bin/env python3
"""YTConv native compatibility frontend for iSH on iOS.

This frontend intentionally avoids Node.js and npm. iSH commonly ships an old
Alpine userspace and old Node/npm builds that cannot install the desktop Ink UI.
The native frontend calls yt-dlp, gallery-dl, and FFmpeg through Python/Alpine.
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

VERSION = "1.0.1"
RAW_BASE = (
    "https://raw.githubusercontent.com/andhikamarcella/"
    "youtubetomp3/codex/add-ytconv-cli/cli"
)
REMOTE_VERSION_URL = RAW_BASE + "/ish/VERSION"
INSTALLER_URL = RAW_BASE + "/scripts/install-ish.sh"
GALLERY_HOSTS = {
    "instagram.com",
    "pinterest.com",
    "pin.it",
    "tiktok.com",
    "twitter.com",
    "x.com",
    "facebook.com",
    "threads.net",
    "reddit.com",
    "tumblr.com",
    "imgur.com",
    "flickr.com",
    "deviantart.com",
    "pixiv.net",
    "bsky.app",
}


def eprint(message):
    print(message, file=sys.stderr)


def version_tuple(value):
    parts = re.findall(r"\d+", str(value))[:3]
    return tuple(int(part) for part in parts + ["0"] * (3 - len(parts)))


def fetch_text(url, timeout=8):
    request = urllib.request.Request(
        url,
        headers={"User-Agent": "ytconv-ish/%s" % VERSION},
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
            runner + ["--version"],
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            timeout=20,
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


def cookie_args(path_value, gallery=False):
    if not path_value:
        return []
    path = Path(path_value).expanduser().resolve()
    if not path.is_file():
        raise RuntimeError("cookies.txt tidak ditemukan: %s" % path)
    return ["--cookies", str(path)]


def host_for(url):
    try:
        host = (urlparse(url).hostname or "").lower()
    except ValueError:
        return ""
    return host[4:] if host.startswith("www.") else host


def gallery_preferred(url):
    host = host_for(url)
    return any(host == candidate or host.endswith("." + candidate) for candidate in GALLERY_HOSTS)


def validate_url(url):
    try:
        parsed = urlparse(url)
        return parsed.scheme in ("http", "https") and bool(parsed.netloc)
    except ValueError:
        return False


def output_template(output, playlist=False):
    if playlist:
        return str(
            output
            / "%(playlist_title).120B"
            / "%(playlist_index)03d - %(title).160B [%(id)s].%(ext)s"
        )
    return str(output / "%(title).180B [%(id)s].%(ext)s")


def yt_dlp_args(options, output):
    args = [
        "--ignore-config",
        "--newline",
        "--no-overwrites",
        "--continue",
        "--retries",
        "10",
        "--fragment-retries",
        "10",
        "--socket-timeout",
        "30",
        "--output",
        output_template(output, options.playlist),
    ]
    args += cookie_args(options.cookies)
    args += ["--yes-playlist"] if options.playlist else ["--no-playlist"]

    if options.audio:
        args += ["-f", "ba/b", "-x", "--audio-format", "mp3", "--audio-quality", "0"]
    else:
        args += [
            "-f",
            "bv*[ext=mp4]+ba[ext=m4a]/b[ext=mp4]/bv*+ba/b",
            "--merge-output-format",
            "mp4/mkv",
        ]
        if shutil.which("ffmpeg"):
            args += ["--ffmpeg-location", shutil.which("ffmpeg")]
    args.append(options.url)
    return args


def gallery_args(options, output):
    args = [
        "--config-ignore",
        "--no-colors",
        "--no-input",
        "--retries",
        "10",
        "--http-timeout",
        "30",
        "--destination",
        str(output),
        "--option",
        "extractor.instagram.static-videos=false",
        "--option",
        "extractor.instagram.videos=true",
        "--option",
        "extractor.pinterest.stories=true",
        "--option",
        "extractor.pinterest.videos=true",
    ]
    args += cookie_args(options.cookies, gallery=True)
    if options.stories:
        args += ["--option", "extractor.instagram.include=stories"]
    elif options.all_media:
        args += ["--option", "extractor.instagram.include=all"]
    args.append(options.url)
    return args


def run_tool(label, runner, args):
    if not runner:
        raise RuntimeError(
            "%s belum tersedia. Jalankan ulang installer iSH:\n%s"
            % (label, install_command())
        )
    print("\nYTConv %s menggunakan %s" % (VERSION, label))
    print("Output: %s\n" % default_output())
    result = subprocess.run(runner + args)
    if result.returncode != 0:
        raise RuntimeError("%s gagal dengan kode %s" % (label, result.returncode))
    return 0


def execute(options):
    available = tools()
    output = Path(options.output).expanduser().resolve() if options.output else default_output()
    output.mkdir(parents=True, exist_ok=True)

    force_gallery = options.image or options.stories or options.all_media
    force_video = options.video or options.audio
    first_gallery = force_gallery or (not force_video and gallery_preferred(options.url))

    if first_gallery:
        try:
            return run_tool(
                "gallery-dl",
                available["gallery-dl"],
                gallery_args(options, output),
            )
        except RuntimeError as gallery_error:
            if force_gallery:
                raise
            eprint("Gallery engine gagal: %s" % gallery_error)
            eprint("Mencoba yt-dlp...")

    try:
        return run_tool(
            "yt-dlp",
            available["yt-dlp"],
            yt_dlp_args(options, output),
        )
    except RuntimeError as video_error:
        if force_video:
            raise
        eprint("yt-dlp gagal: %s" % video_error)
        eprint("Mencoba gallery-dl...")
        return run_tool(
            "gallery-dl",
            available["gallery-dl"],
            gallery_args(options, output),
        )


def diagnostics():
    available = tools()
    latest, newer = update_available()
    rows = [
        ("YTConv iSH", VERSION),
        ("Python", sys.version.split()[0]),
        ("Platform", sys.platform),
        ("yt-dlp", tool_version(available["yt-dlp"])),
        ("gallery-dl", tool_version(available["gallery-dl"])),
        ("FFmpeg", tool_version(available["ffmpeg"])),
        ("Output", str(default_output())),
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
            "\nCatatan: Python iSH ini lebih lama dari 3.10. pip akan memakai "
            "rilis yt-dlp terakhir yang kompatibel; beberapa situs terbaru dapat gagal."
        )
    return 0


def parser():
    value = argparse.ArgumentParser(
        prog="ytconv",
        description="YTConv native iSH: video, audio, image, carousel, Reel, dan Story.",
    )
    value.add_argument("url", nargs="?", help="Link media sosial")
    value.add_argument("--version", action="store_true", help="Tampilkan versi")
    value.add_argument("--diagnose", action="store_true", help="Periksa seluruh engine")
    value.add_argument("--check-update", action="store_true", help="Periksa update")
    value.add_argument("--update", action="store_true", help="Update frontend iSH")
    value.add_argument("--no-update-check", action="store_true", help="Lewati update check sesi ini")
    modes = value.add_mutually_exclusive_group()
    modes.add_argument("--auto", action="store_true", help="Pilih engine otomatis")
    modes.add_argument("--video", action="store_true", help="Paksa video")
    modes.add_argument("--audio", action="store_true", help="Ambil MP3")
    modes.add_argument("--image", "--images", "--gallery", action="store_true", help="Gambar/carousel")
    modes.add_argument("--stories", action="store_true", help="Instagram Stories")
    modes.add_argument("--all-media", action="store_true", help="Semua media profil Instagram")
    value.add_argument("--playlist", action="store_true", help="Aktifkan playlist")
    value.add_argument("--cookies", help="Lokasi cookies.txt Netscape")
    value.add_argument("--output", "-o", help="Folder hasil")
    return value


def main(argv=None):
    options = parser().parse_args(argv)
    if options.version:
        print(VERSION)
        return 0
    if options.diagnose:
        return diagnostics()
    if options.check_update:
        latest, newer = update_available()
        print("tersedia %s" % latest if newer else "sudah terbaru (%s)" % VERSION)
        return 0 if latest else 1
    if options.update:
        return perform_update()

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
    except (OSError, RuntimeError) as error:
        eprint("\nconversion failed: %s" % error)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
