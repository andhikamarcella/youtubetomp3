# download_audio.py — helper for yt_dlp / PyTube audio download
import os
import re
import shutil
import subprocess
import sys
from typing import Dict, Iterable, Optional

YoutubeDL = None
YouTube = None


def upgrade_ytdlp() -> bool:
    global YoutubeDL
    flag = str(os.environ.get("YTDLP_AUTO_UPGRADE", "0") or "").strip().lower()
    if flag in {"0", "false", "no", "off"}:
        return False
    try:
        subprocess.check_call(
            [sys.executable, "-m", "pip", "install", "--quiet", "--upgrade", "yt-dlp"]
        )
        YoutubeDL = None
        return ensure_ytdlp()
    except Exception:
        return False


def _major_version(value: str) -> int:
    match = re.search(r"v?(\d+)", value or "")
    return int(match.group(1)) if match else 0


def get_youtube_extractor_args() -> Dict[str, Dict[str, list[str]]]:
    clients_raw = os.environ.get(
        "YTDLP_YOUTUBE_PLAYER_CLIENTS",
        "mweb,web_safari,tv_embedded,android,default",
    )
    clients = [item.strip() for item in re.split(r"[,+]", clients_raw) if item.strip()]
    youtube_args: Dict[str, list[str]] = {}
    if clients:
        youtube_args["player_client"] = clients
    po_token = os.environ.get("YTDLP_YOUTUBE_PO_TOKEN", "").strip()
    if po_token:
        youtube_args["po_token"] = [po_token]
    return {"youtube": youtube_args} if youtube_args else {}


def get_js_runtime_options() -> Dict[str, object]:
    runtime = os.environ.get("YTDLP_JS_RUNTIME", "node").strip().lower()
    if runtime in {"", "off", "none", "0"}:
        return {}

    if runtime == "node":
        node_bin = shutil.which("node")
        if not node_bin:
            print("node runtime not found; yt_dlp JS runtime disabled", file=sys.stderr)
            return {}
        try:
            version = subprocess.check_output([node_bin, "--version"], text=True, timeout=3).strip()
        except Exception as exc:
            print(f"failed to inspect node version; yt_dlp JS runtime disabled: {exc}", file=sys.stderr)
            return {}
        if _major_version(version) < 22:
            print(f"node {version} is below yt-dlp 2026.06.09 minimum; yt_dlp JS runtime disabled", file=sys.stderr)
            return {}

    return {
        "js_runtimes": {runtime: {}},
        "remote_components": ["ejs:github"],
        "extractor_retries": 3,
    }


def should_use_cookies() -> bool:
    return os.environ.get("YTDLP_USE_COOKIES", "").strip().lower() in {"1", "true", "yes", "on"}


def ensure_ytdlp() -> bool:
    """Lazily import yt_dlp without mutating externally-managed Python envs."""

    global YoutubeDL
    if YoutubeDL is not None:
        return True
    try:
        from yt_dlp import YoutubeDL as _YoutubeDL  # type: ignore

        YoutubeDL = _YoutubeDL
        return True
    except ModuleNotFoundError:
        if str(os.environ.get("YTDLP_HELPER_PIP_INSTALL", "0") or "").strip().lower() not in {"1", "true", "yes", "on"}:
            print("yt_dlp module is not installed; skipping pip install in managed Python", file=sys.stderr)
            return False
        try:
            subprocess.check_call(
                [sys.executable, "-m", "pip", "install", "--quiet", "--user", "yt-dlp"]
            )
            from yt_dlp import YoutubeDL as _YoutubeDL  # type: ignore

            YoutubeDL = _YoutubeDL
            return True
        except Exception as exc:  # pragma: no cover - install best effort
            print(f"failed to install yt_dlp: {exc}", file=sys.stderr)
            return False
    except Exception as exc:  # pragma: no cover - unexpected import failure
        print(f"failed to load yt_dlp: {exc}", file=sys.stderr)
        return False


def ensure_pytube() -> bool:
    """Lazily import PyTube, installing it on demand."""

    global YouTube
    if YouTube is not None:
        return True
    try:
        from pytube import YouTube as _YouTube  # type: ignore

        YouTube = _YouTube
        return True
    except ModuleNotFoundError:
        try:
            subprocess.check_call(
                [sys.executable, "-m", "pip", "install", "--quiet", "pytube"]
            )
            from pytube import YouTube as _YouTube  # type: ignore

            YouTube = _YouTube
            return True
        except Exception as exc:  # pragma: no cover - install best effort
            print(f"failed to install pytube: {exc}", file=sys.stderr)
            return False
    except Exception as exc:  # pragma: no cover - unexpected import failure
        print(f"failed to load pytube: {exc}", file=sys.stderr)
        return False


def _iter_candidates(info) -> Iterable[object]:
    """Yield possible filename sources from a yt_dlp info dict."""

    if isinstance(info, dict):
        requested = info.get("requested_downloads") or []
        entries = info.get("entries") or []
        for item in requested:
            yield item
        for item in entries:
            yield item
        yield info
    else:
        yield info


def download_with_ytdlp(
    url: str,
    out_dir: str,
    out_basename: str,
    *,
    cookies_path: Optional[str] = None,
) -> str:
    if not ensure_ytdlp():
        raise RuntimeError("yt_dlp unavailable")

    template = os.path.join(out_dir, f"{out_basename}.%(ext)s")
    base_opts = {
        "format": "bestaudio/best",
        "outtmpl": template,
        "restrictfilenames": False,
        "noplaylist": True,
        "quiet": False,
        "no_warnings": False,
        "nocheckcertificate": True,
        "cachedir": False,
        "ignoreerrors": False,
    }

    base_opts.update(get_js_runtime_options())

    extractor_args = get_youtube_extractor_args()
    if extractor_args:
        base_opts["extractor_args"] = extractor_args

    if should_use_cookies() and cookies_path and os.path.isfile(cookies_path):
        base_opts["cookiefile"] = cookies_path

    compat_opts = dict(base_opts)
    compat_opts["force_ipv4"] = True
    compat_opts["extractor_args"] = {"youtube": {"player_client": ["android", "mweb"]}}

    tv_opts = dict(base_opts)
    tv_opts["extractor_args"] = {"youtube": {"player_client": ["mweb", "web_safari", "tv_embedded", "android"]}}

    relaxed_opts = dict(compat_opts)
    relaxed_opts["format"] = "best"

    http_opts = dict(relaxed_opts)
    http_opts["format"] = "bestaudio[protocol^=http]/best[protocol^=http]/bestaudio/best/worst"

    universal_opts = dict(tv_opts)
    universal_opts.pop("format", None)

    last_exc: Optional[Exception] = None
    upgrade_tried = False
    attempts = [base_opts, compat_opts, tv_opts, relaxed_opts, http_opts, universal_opts]
    for opts in attempts:
        try:
            with YoutubeDL(opts) as ydl:  # type: ignore[misc]
                info = ydl.extract_info(url, download=True)
                if info is None:
                    raise RuntimeError("yt_dlp returned no metadata")

                for candidate in _iter_candidates(info):
                    filename: Optional[str] = None
                    if isinstance(candidate, dict):
                        filename = candidate.get("_filename")
                    if filename and os.path.isfile(filename):
                        return os.path.abspath(filename)
                    try:
                        guess = ydl.prepare_filename(candidate)
                    except Exception:
                        continue
                    if guess and os.path.isfile(guess):
                        return os.path.abspath(guess)
        except Exception as exc:
            last_exc = exc
            text = str(exc)
            if (
                not upgrade_tried
                and ("Requested format is not available" in text or "HTTP Error 400" in text or "HTTP Error 403" in text)
                and upgrade_ytdlp()
            ):
                upgrade_tried = True
                continue

    raise RuntimeError(f"yt_dlp did not produce an output file: {last_exc}")


def download_with_pytube(url: str, out_dir: str, out_basename: str) -> str:
    if not ensure_pytube():
        raise RuntimeError("pytube unavailable")

    yt = YouTube(url)  # type: ignore[call-arg]
    stream = (
        yt.streams.filter(only_audio=True).order_by("abr").desc().first()  # type: ignore[attr-defined]
    )
    if not stream:
        raise RuntimeError("no audio stream found")

    out_path = stream.download(output_path=out_dir, filename=out_basename)  # type: ignore[attr-defined]
    if not out_path:
        raise RuntimeError("pytube returned empty path")
    return os.path.abspath(out_path)


def main() -> None:
    if len(sys.argv) < 4:
        print(
            "usage: python3 download_audio.py <url> <out_dir> <out_basename> [cookies_path]",
            file=sys.stderr,
        )
        sys.exit(2)

    url, out_dir, out_basename = sys.argv[1], sys.argv[2], sys.argv[3]
    cookies_path = sys.argv[4] if len(sys.argv) > 4 else None
    os.makedirs(out_dir, exist_ok=True)

    errors = []
    try:
        path = download_with_ytdlp(
            url,
            out_dir,
            out_basename,
            cookies_path=cookies_path,
        )
    except Exception as exc:
        errors.append(f"yt_dlp failed: {exc}")
        path = None

    if path is None:
        try:
            path = download_with_pytube(url, out_dir, out_basename)
        except Exception as exc:
            errors.append(f"pytube failed: {exc}")
            path = None

    if path is None:
        for msg in errors:
            print(msg, file=sys.stderr)
        sys.exit(1)

    print(path)


if __name__ == "__main__":
    main()
