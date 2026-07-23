#!/usr/bin/env python3
"""Compatibility entrypoint for the YTConv 1.5 beta native iSH frontend."""

from pathlib import Path
import runpy

TARGET = Path(__file__).with_name("ytconv-beta.py")
if not TARGET.is_file():
    raise SystemExit("YTConv beta frontend tidak ditemukan: %s" % TARGET)
runpy.run_path(str(TARGET), run_name="__main__")
