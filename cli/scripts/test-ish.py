#!/usr/bin/env python3
"""Deterministic YTConv iSH 1.6.2 behavior checks."""

import importlib.util
import json
import os
import sys
import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace

ROOT = Path(__file__).resolve().parents[1]
CORE_PATH = ROOT / "ish" / "ytconv-core.py"
SPEC = importlib.util.spec_from_file_location("ytconv_ish_core", CORE_PATH)
CORE = importlib.util.module_from_spec(SPEC)
assert SPEC and SPEC.loader
SPEC.loader.exec_module(CORE)


def options(output, **overrides):
    values = {
        "url": "https://www.youtube.com/watch?v=BaW_jenozKc",
        "mode": "auto",
        "preset": "balanced",
        "audio_format": "mp3",
        "audio_quality": "best",
        "video_format": "auto",
        "resolution": "720",
        "thumbnail": False,
        "subtitle_only": False,
        "subtitle_langs": "all,-live_chat",
        "subtitles": False,
        "normalize_audio": False,
        "artist": None,
        "title": None,
        "album": None,
        "track": None,
        "year": None,
        "genre": None,
        "output_template": None,
        "playlist": False,
        "overwrite": False,
        "resume": True,
        "cookies": None,
        "proxy": None,
        "rate_limit": None,
        "restrict_filenames": False,
        "metadata_files": False,
        "playlist_items": None,
        "max_downloads": None,
        "skip_playlist_after_errors": None,
        "start": None,
        "end": None,
        "sponsorblock": "off",
        "sponsorblock_categories": CORE.DEFAULT_CATEGORIES,
        "retries": "1",
        "fragment_retries": "1",
        "file_access_retries": "1",
        "retry_sleep": "0",
        "no_archive": False,
        "archive": None,
        "output": str(output),
    }
    values.update(overrides)
    return SimpleNamespace(**values)


class RoutingTests(unittest.TestCase):
    def test_auto_routing(self):
        self.assertEqual(
            CORE.effective_mode("https://music.youtube.com/watch?v=music", "auto"),
            "audio",
        )
        self.assertEqual(
            CORE.effective_mode("https://www.youtube.com/watch?v=video", "auto"),
            "video",
        )
        self.assertEqual(
            CORE.effective_mode("https://youtu.be/video", "auto"),
            "video",
        )

    def test_explicit_choices_win(self):
        self.assertEqual(
            CORE.effective_mode("https://music.youtube.com/watch?v=music", "video"),
            "video",
        )
        self.assertEqual(
            CORE.effective_video_container(
                "https://www.youtube.com/watch?v=video", "video", "mkv"
            ),
            "mkv",
        )

    def test_mp4_selector_and_container(self):
        selector = CORE.video_selector("1080", "mp4")
        self.assertIn("[vcodec^=avc1]+ba[ext=m4a]", selector)
        self.assertIn("bv[height<=1080]+ba", selector)
        self.assertEqual(
            CORE.video_container_args("mp4"),
            ["--merge-output-format", "mp4", "--recode-video", "mp4"],
        )

    def test_sidecars_are_not_media_results(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            thumbnail = root / "cover.jpg"
            metadata = root / "video.info.json"
            video = root / "video.mp4"
            thumbnail.write_bytes(b"jpg")
            metadata.write_text("{}", encoding="utf-8")
            video.write_bytes(b"mp4")
            files = CORE.verified_outputs(set(), {thumbnail, metadata, video}, [], "video")
            self.assertEqual(len(files), 1)
            self.assertTrue(os.path.samefile(files[0], video))


class ArchiveRecoveryTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)
        self.output = self.root / "output"
        self.output.mkdir()
        self.marker = self.root / "calls.jsonl"
        self.script = self.root / "fake-yt-dlp.py"
        self.script.write_text(
            """
import json
import os
import sys
from pathlib import Path

args = sys.argv[1:]
marker = Path(os.environ["YTCONV_TEST_MARKER"])
with marker.open("a", encoding="utf-8") as handle:
    handle.write(json.dumps(args) + "\\n")

behavior = os.environ["YTCONV_TEST_BEHAVIOR"]
target = Path(os.environ["YTCONV_TEST_TARGET"])
if behavior == "archive":
    if "--download-archive" in args:
        print("[download] BaW_jenozKc has already been recorded in the archive")
        raise SystemExit(0)
    target.write_bytes(b"verified mp4")
    print("ytconv-file:" + str(target))
    raise SystemExit(0)
if behavior == "zero":
    raise SystemExit(0)
raise SystemExit(2)
""".strip()
            + "\n",
            encoding="utf-8",
        )
        self.previous = {
            "YTCONV_TEST_MARKER": os.environ.get("YTCONV_TEST_MARKER"),
            "YTCONV_TEST_BEHAVIOR": os.environ.get("YTCONV_TEST_BEHAVIOR"),
            "YTCONV_TEST_TARGET": os.environ.get("YTCONV_TEST_TARGET"),
        }
        os.environ["YTCONV_TEST_MARKER"] = str(self.marker)
        os.environ["YTCONV_TEST_TARGET"] = str(self.output / "restored.mp4")
        self.available = {
            "yt-dlp": [sys.executable, str(self.script)],
            "gallery-dl": None,
            "ffmpeg": None,
            "ffprobe": None,
        }

    def tearDown(self):
        for key, value in self.previous.items():
            if value is None:
                os.environ.pop(key, None)
            else:
                os.environ[key] = value
        self.temp.cleanup()

    def test_archive_missing_file_is_restored_once(self):
        os.environ["YTCONV_TEST_BEHAVIOR"] = "archive"
        opts = options(self.output)
        archive = self.root / "archive.txt"
        result = CORE.run_verified_yt_dlp(opts, self.available, self.output, archive, "video")
        restored = Path(result["files"][0])
        self.assertTrue(os.path.samefile(restored, self.output / "restored.mp4"))
        calls = [
            json.loads(row)
            for row in self.marker.read_text(encoding="utf-8").splitlines()
            if row.strip()
        ]
        self.assertEqual(len(calls), 2)
        self.assertIn("--download-archive", calls[0])
        self.assertNotIn("--download-archive", calls[1])

    def test_exit_zero_without_media_is_rejected(self):
        os.environ["YTCONV_TEST_BEHAVIOR"] = "zero"
        opts = options(self.output)
        with self.assertRaisesRegex(RuntimeError, "produced no verified video file"):
            CORE.run_verified_yt_dlp(opts, self.available, self.output, None, "video")


if __name__ == "__main__":
    unittest.main(verbosity=2)
