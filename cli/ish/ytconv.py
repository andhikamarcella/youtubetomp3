#!/usr/bin/env python3
"""YTConv 1.7.0 launcher for iSH, Alpine Linux, and Python-only shells."""

import runpy
import sys
from pathlib import Path
from urllib.parse import urlparse

VERSION = "1.7.0"
RELEASE_BRANCH = "release/ytconv-1.7.0"
RAW_BASE = "https://raw.githubusercontent.com/andhikamarcella/YTConv/%s/cli" % RELEASE_BRANCH
CORE = Path(__file__).resolve().with_name("ytconv-core.py")


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


def apply_auto_routing(arguments):
    """Keep explicit user choices authoritative and make AUTO predictable."""
    result = [value for value in arguments if value != "--auto"]
    url = first_url(result)
    host = host_for(url)
    if not url or not is_youtube_host(host):
        return result

    explicit_mode = any(
        value in result
        for value in ("--audio", "--video", "--image", "--images", "--gallery")
    )
    if not explicit_mode:
        result.append("--audio" if host == "music.youtube.com" else "--video")

    audio_selected = "--audio" in result and "--video" not in result
    video_selected = "--video" in result and "--audio" not in result
    if audio_selected and "--audio-format" not in result:
        result.extend(["--audio-format", "mp3"])
    if video_selected and "--video-format" not in result:
        result.extend(["--video-format", "mp4"])
    return result


def main():
    if not CORE.is_file():
        raise SystemExit(
            "YTConv core frontend is missing: %s\n"
            "Reinstall with: curl -fsSL %s/scripts/install-ish.sh -o /tmp/ytconv-ish.sh && sh /tmp/ytconv-ish.sh"
            % (CORE, RAW_BASE)
        )

    sys.argv[1:] = apply_auto_routing(sys.argv[1:])
    namespace = runpy.run_path(str(CORE), run_name="ytconv_ish_core")
    namespace["VERSION"] = VERSION
    namespace["RAW_BASE"] = RAW_BASE
    namespace["REMOTE_VERSION_URL"] = RAW_BASE + "/ish/VERSION"
    namespace["INSTALLER_URL"] = RAW_BASE + "/scripts/install-ish.sh"
    namespace["parser"].__globals__["VERSION"] = VERSION
    return namespace["main"](sys.argv[1:])


if __name__ == "__main__":
    raise SystemExit(main())
