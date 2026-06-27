# download_audio.py — helper for yt_dlp / PyTube audio download
import os
import subprocess
import sys
from typing import Iterable, Optional

def _pip_install(*packages: str) -> None:
    """Install Python packages in hosted environments, including PEP 668 images."""

    base_cmd = [sys.executable, "-m", "pip", "install", "--quiet"]
    extra = os.environ.get("PIP_INSTALL_EXTRA_ARGS", "").split()
    attempts = [
        base_cmd + extra + list(packages),
        base_cmd + ["--user"] + extra + list(packages),
        base_cmd + ["--break-system-packages"] + extra + list(packages),
    ]
    last_exc = None
    for cmd in attempts:
        try:
            subprocess.check_call(cmd)
            return
        except Exception as exc:
            last_exc = exc
    raise RuntimeError(f"pip install failed: {last_exc}")

YoutubeDL = None
YouTube = None


def upgrade_ytdlp() -> bool:
    global YoutubeDL
    flag = str(os.environ.get("YTDLP_AUTO_UPGRADE", "1") or "").strip().lower()
    if flag in {"0", "false", "no", "off"}:
        return False
    try:
        _pip_install("--upgrade", "yt-dlp")
        YoutubeDL = None
        return ensure_ytdlp()
    except Exception:
        return False


def ensure_ytdlp() -> bool:
    """Lazily import yt_dlp, installing it when absent."""

    global YoutubeDL
    if YoutubeDL is not None:
        return True
    try:
        from yt_dlp import YoutubeDL as _YoutubeDL  # type: ignore

        YoutubeDL = _YoutubeDL
        return True
    except ModuleNotFoundError:
        try:
            _pip_install("yt-dlp")
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
            _pip_install("pytube")
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
        "js_runtimes": {"node": {}},
        "remote_components": ["ejs:github"],
        "nocheckcertificate": True,
        "cachedir": False,
        "ignoreerrors": False,
    }

    if cookies_path and os.path.isfile(cookies_path):
        base_opts["cookiefile"] = cookies_path

    compat_opts = dict(base_opts)
    compat_opts["force_ipv4"] = True
    compat_opts["extractor_args"] = {"youtube": {"player_client": ["default", "ios", "android"]}}

    relaxed_opts = dict(compat_opts)
    relaxed_opts["format"] = "bestaudio*/best*"

    generic_opts = dict(base_opts)
    generic_opts["format"] = "best"
    generic_opts.pop("extractor_args", None)

    last_exc: Optional[Exception] = None
    upgrade_tried = False
    attempts = [base_opts, compat_opts, relaxed_opts, generic_opts]
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
