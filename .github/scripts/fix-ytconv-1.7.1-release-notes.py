#!/usr/bin/env python3
from pathlib import Path
import json
import sys

root = Path(sys.argv[1]).resolve()
manifest_path = root / "cli/package.json"
manifest = json.loads(manifest_path.read_text("utf-8"))
manifest["releaseNotes"] = (
    "YTConv 1.7.1 preserves the recognizable Figlet terminal identity and Commander command UX, "
    "fixes stable HEAD documentation links, adds an interactive terminal help center with docs, "
    "about, and shortcuts commands, improves discoverability and responsive help output, keeps "
    "subtitles off by default, and refreshes every supported package identity while preserving "
    "the established secure download core."
)
manifest_path.write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + "\n", "utf-8")
print("Preserved Figlet, Commander, and subtitle-default identity in YTConv 1.7.1 release notes.")
