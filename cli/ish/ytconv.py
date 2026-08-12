#!/usr/bin/env python3
"""YTConv 1.7.6 launcher for iSH, Alpine Linux, and Python-only shells."""

import runpy
import sys
import time
import webbrowser
from pathlib import Path
from urllib.parse import urlparse

VERSION = "1.7.6"
RELEASE_BRANCH = "release/ytconv-1.7.6"
RAW_BASE = "https://raw.githubusercontent.com/andhikamarcella/YTConv/%s/cli" % RELEASE_BRANCH
CORE = Path(__file__).resolve().with_name("ytconv-core.py")
DONATIONS = {
    "kofi": ("Ko-fi", "Global", "https://ko-fi.com/cellauu"),
    "saweria": ("Saweria", "Indonesia", "https://saweria.co/dhikamarcella"),
}
DONATION_ALIASES = {
    "1": "kofi", "ko-fi": "kofi", "kofi": "kofi", "global": "kofi",
    "2": "saweria", "id": "saweria", "indo": "saweria",
    "indonesia": "saweria", "saweria": "saweria",
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


def handle_donation(arguments, input_fn=input, open_browser=webbrowser.open, sleep_fn=time.sleep, output_fn=print):
    """Open one fixed donation page or print it when iSH cannot open a browser."""
    if not arguments or arguments[0].lower() not in ("donate", "donation", "fund", "support-us"):
        return None
    output_fn("Donate — just pay what you can\n")
    output_fn("  1  Ko-fi   · Global")
    output_fn("  2  Saweria · Indonesia only")
    output_fn("\nDonations are optional. Every YTConv feature remains available without paying.")
    interactive = bool(sys.stdin.isatty() and sys.stdout.isatty())
    choice = arguments[1] if len(arguments) > 1 else ""
    if not choice and interactive:
        choice = input_fn("Choose 1 or 2: ")
    if not choice:
        output_fn("\nRun: ytconv donate kofi | ytconv donate saweria")
        return 0
    key = DONATION_ALIASES.get(choice.strip().lower())
    if not key:
        output_fn("\nUnknown donation option. Choose kofi or saweria.")
        return 2
    label, _audience, url = DONATIONS[key]
    if not interactive:
        output_fn("\n%s: %s" % (label, url))
        output_fn("Automatic browser opening is disabled outside an interactive terminal.")
        return 0
    opened = bool(open_browser(url, new=2))
    if opened:
        output_fn("\nOpened %s in the default browser." % label)
    else:
        output_fn("\nA browser could not be opened. Copy this link: %s" % url)
    output_fn("Returning to YTConv in 5 seconds...")
    sleep_fn(5)
    return 0


def main():
    donation = handle_donation(sys.argv[1:])
    if donation is not None:
        if donation or not (sys.stdin.isatty() and sys.stdout.isatty()):
            return donation
        sys.argv[1:] = []

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
