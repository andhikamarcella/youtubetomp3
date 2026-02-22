#!/usr/bin/env python3
import json
import re
import subprocess
import sys
from typing import List, Tuple

YouTube = None
Caption = None


def ensure_pytube():
    global YouTube, Caption
    if YouTube is not None:
        return
    try:
        from pytube import YouTube as _YouTube  # type: ignore
        from pytube import Caption as _Caption  # type: ignore
        YouTube = _YouTube
        Caption = _Caption
    except ModuleNotFoundError:
        try:
            subprocess.check_call(
                [sys.executable, "-m", "pip", "install", "--quiet", "pytube"]
            )
            from pytube import YouTube as _YouTube  # type: ignore
            from pytube import Caption as _Caption  # type: ignore
            YouTube = _YouTube
            Caption = _Caption
        except Exception as exc:  # pragma: no cover - install best effort
            print(f"failed to install pytube: {exc}", file=sys.stderr)
            sys.exit(90)


def parse_patterns(raw: str) -> List[str]:
    parts = [part.strip() for part in (raw or "").split(",")]
    return [p for p in parts if p]


def wildcard_match(pattern: str, value: str) -> bool:
    escaped = re.escape(pattern).replace(r"\*", ".*")
    return re.match(rf"^{escaped}$", value or "", re.IGNORECASE) is not None


def collect_captions(yt) -> List[Tuple[object, str, bool, str]]:
    results = []
    for caption in yt.captions:  # type: ignore[attr-defined]
        code = (getattr(caption, "code", "") or "").strip()
        name = (getattr(caption, "name", "") or "").strip()
        is_auto = code.lower().startswith("a.")
        lang = code[2:] if is_auto and len(code) > 2 else code
        if not lang:
            lang = "auto" if is_auto else "subtitle"
        results.append((caption, lang, is_auto, name))
    return results


def pick_caption(candidates, patterns, prefer_auto):
    autos = [item for item in candidates if item[2]]
    manuals = [item for item in candidates if not item[2]]

    def select(pool):
        for pattern in patterns:
            for item in pool:
                code = getattr(item[0], "code", "") or ""
                if wildcard_match(pattern, item[1]) or wildcard_match(pattern, code):
                    return item
        return None

    if prefer_auto:
        choice = select(autos) or select(manuals)
    else:
        choice = select(manuals) or select(autos)

    if choice:
        return choice

    if prefer_auto and autos:
        return autos[0]
    if manuals:
        return manuals[0]
    if autos:
        return autos[0]
    return candidates[0] if candidates else None


def caption_to_srt(caption_obj) -> str:
    xml = getattr(caption_obj, "xml_captions", None)
    if not xml:
        return ""
    converter = getattr(caption_obj, "xml_caption_to_srt", None)
    if callable(converter):
        return converter(xml)
    module_converter = getattr(Caption, "xml_caption_to_srt", None)
    if callable(module_converter):
        return module_converter(xml)
    return ""


def main():
    if len(sys.argv) < 4:
        print(
            "usage: python3 download_subtitle.py <url> <lang_pref> <prefer_auto>",
            file=sys.stderr,
        )
        sys.exit(2)

    url = sys.argv[1]
    lang_pref = sys.argv[2]
    prefer_auto = sys.argv[3] not in ("0", "false", "False")

    ensure_pytube()
    try:
        yt = YouTube(url)
    except Exception as exc:
        print(f"failed to load video: {exc}", file=sys.stderr)
        sys.exit(3)

    captions = collect_captions(yt)
    if not captions:
        print("no subtitles available", file=sys.stderr)
        sys.exit(4)

    patterns = parse_patterns(lang_pref)
    choice = pick_caption(captions, patterns, prefer_auto)
    if not choice:
        print("no matching subtitle track", file=sys.stderr)
        sys.exit(5)

    caption_obj, lang, is_auto, name = choice
    try:
        srt = caption_to_srt(caption_obj)
    except Exception as exc:
        print(f"failed to convert subtitle: {exc}", file=sys.stderr)
        sys.exit(6)

    if not srt.strip():
        print("empty subtitle", file=sys.stderr)
        sys.exit(7)

    payload = {
        "srt": srt,
        "lang": lang,
        "auto": bool(is_auto),
        "title": getattr(yt, "title", ""),
        "author": getattr(yt, "author", ""),
        "track": name,
    }
    print(json.dumps(payload))


if __name__ == "__main__":
    main()
