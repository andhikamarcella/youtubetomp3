#!/usr/bin/env python3
"""Stable YTConv 1.6.0 launcher for iSH/Alpine."""

import runpy
from pathlib import Path

VERSION = "1.6.0"
CORE = Path(__file__).resolve().with_name("ytconv-core.py")

if not CORE.is_file():
    raise SystemExit("YTConv core frontend is missing: %s" % CORE)

runpy.run_path(str(CORE), run_name="__main__")
