#!/usr/bin/env python3
"""Stable YTConv 1.6.4 launcher and compatibility policy for iSH/Alpine."""

import os
import runpy
import sys
from pathlib import Path
from urllib.parse import urlparse

VERSION = "1.6.4"
RELEASE_BRANCH = "release/ytconv-1.6.4-security-types"
RAW_BASE = "https://raw.githubusercontent.com/andhikamarcella/youtubetomp3/%s/cli" % RELEASE_BRANCH
CORE = Path(__file__).resolve().with_name("ytconv-core.py")
MEDIA_EXTENSIONS = {
    ".aac", ".alac", ".flac", ".m4a", ".mkv", ".mov", ".mp3", ".mp4",
    ".ogg", ".opus", ".wav", ".webm", ".webp", ".jpg", ".jpeg", ".png",
}


def host_for(value):
    try:
        host = (urlparse(value).hostname or "").lower()
    except ValueError:
        return ""
    return host[4:] if host.startswith("www.") else host


def is_youtube_host(host):
    return host in ("youtube.com", "youtu.be", "youtube-nocookie.com") or host.endswith(".youtube.com")


def first_url(arguments):
    for value in arguments:
        if value.startswith(("http://", "https://")):
            return value
    return ""


def has_any(arguments, values):
    return any(value in arguments for value in values)


def set_option(arguments, flag, value):
    if flag in arguments:
        index = arguments.index(flag)
        if index + 1 < len(arguments):
            arguments[index + 1] = value
            return
    arguments.extend([flag, value])


def apply_auto_routing(arguments):
    result = list(arguments)
    url = first_url(result)
    host = host_for(url)
    if not url or not is_youtube_host(host):
        return result

    explicit_mode = has_any(result, ("--audio", "--video", "--image", "--images", "--gallery"))
    requested_auto = "--auto" in result
    if requested_auto:
        result = [value for value in result if value != "--auto"]

    if not explicit_mode or requested_auto:
        result.append("--audio" if host == "music.youtube.com" else "--video")

    final_audio = "--audio" in result and "--video" not in result
    if final_audio:
        if "--audio-format" not in result:
            result.extend(["--audio-format", "mp3"])
    elif "--video" in result:
        requested_container = "auto"
        if "--video-format" in result:
            index = result.index("--video-format")
            if index + 1 < len(result):
                requested_container = result[index + 1]
        if requested_container == "auto":
            set_option(result, "--video-format", "mp4")
    return result


def video_selector(resolution, container):
    limit_value = "" if resolution == "best" else "[height<=%s]" % resolution
    if container == "mp4":
        return (
            "bv%s[ext=mp4][vcodec^=avc1]+ba[ext=m4a]/"
            "b%s[ext=mp4][vcodec^=avc1]/"
            "bv%s[ext=mp4]+ba[ext=m4a]/b%s[ext=mp4]/"
            "bv%s+ba/bv*%s+ba/b%s"
        ) % ((limit_value,) * 7)
    if container == "webm":
        return (
            "bv%s[ext=webm]+ba[ext=webm]/b%s[ext=webm]/"
            "bv%s+ba/bv*%s+ba/b%s"
        ) % ((limit_value,) * 5)
    return "bv%s+ba/bv*%s+ba/b%s" % ((limit_value,) * 3)


def patch_video_args(original):
    def wrapped(options, output, yt_archive):
        args = original(options, output, yt_archive)
        if options.subtitle_only or options.mode == "audio":
            return args

        container = options.video_format
        if container == "auto" and is_youtube_host(host_for(options.url)):
            container = "mp4"
        if "-f" in args:
            args[args.index("-f") + 1] = video_selector(options.resolution, container)
        if "--merge-output-format" in args:
            args[args.index("--merge-output-format") + 1] = "mp4/mkv" if container == "auto" else container
        if container == "mp4":
            args.extend(["--recode-video", "mp4"])
        elif container == "webm":
            args.extend(["--recode-video", "webm"])
        elif container == "mkv":
            args.extend(["--remux-video", "mkv"])
        return args
    return wrapped


def output_directory(options, default_output):
    return Path(options.output).expanduser().resolve() if options.output else default_output()


def media_files(directory):
    if not directory.exists():
        return set()
    return {
        path.resolve()
        for path in directory.rglob("*")
        if path.is_file() and path.suffix.lower() in MEDIA_EXTENSIONS
    }


def patch_execute_one(original, default_output):
    def wrapped(options):
        if options.list_formats or options.list_subs or options.dry_run or options.json:
            return original(options)

        output = output_directory(options, default_output)
        before = media_files(output)
        result = original(options)
        after = media_files(output)
        if after - before:
            return result

        archive_enabled = not options.no_archive
        if archive_enabled and result.get("engine") == "yt-dlp":
            print("The archive recorded this URL but no output file exists. Restoring it once without the archive...")
            previous_no_archive = options.no_archive
            previous_archive = options.archive
            options.no_archive = True
            options.archive = None
            try:
                result = original(options)
            finally:
                options.no_archive = previous_no_archive
                options.archive = previous_archive
            after = media_files(output)
            if after - before:
                return result

        if after:
            return result
        raise RuntimeError("The media engine exited successfully but produced no file.")
    return wrapped


def main():
    if not CORE.is_file():
        raise SystemExit("YTConv core frontend is missing: %s" % CORE)

    sys.argv[1:] = apply_auto_routing(sys.argv[1:])
    namespace = runpy.run_path(str(CORE), run_name="ytconv_ish_core")
    namespace["VERSION"] = VERSION
    namespace["RAW_BASE"] = RAW_BASE
    namespace["REMOTE_VERSION_URL"] = RAW_BASE + "/ish/VERSION"
    namespace["INSTALLER_URL"] = RAW_BASE + "/scripts/install-ish.sh"
    namespace["video_selector"] = video_selector
    namespace["yt_dlp_args"] = patch_video_args(namespace["yt_dlp_args"])
    namespace["execute_one"] = patch_execute_one(namespace["execute_one"], namespace["default_output"])
    namespace["parser"].__globals__["VERSION"] = VERSION
    return namespace["main"](sys.argv[1:])


if __name__ == "__main__":
    raise SystemExit(main())
