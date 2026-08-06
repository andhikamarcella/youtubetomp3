#!/usr/bin/env python3
from pathlib import Path
import sys

root = Path(sys.argv[1]).resolve()

for path in (root / "cli/test").glob("*.js"):
    text = path.read_text("utf-8")
    text = text.replace(r"1\.7\.0", r"1\.7\.1")
    text = text.replace("2026-08-05", "2026-08-06")
    path.write_text(text, "utf-8")

readme = root / "cli/README.md"
text = readme.read_text("utf-8")
text = text.replace("version code **10700**", "version code **10701**")
readme.write_text(text, "utf-8")

checker = root / "cli/scripts/check-docs.js"
text = checker.read_text("utf-8")
if "'docs/HELP-CENTER.md'" not in text:
    text = text.replace(
        "  'docs/MIGRATION-1.7.1.md'\n];",
        "  'docs/MIGRATION-1.7.0.md',\n  'docs/MIGRATION-1.7.1.md',\n  'docs/HELP-CENTER.md'\n];",
    )
checker.write_text(text, "utf-8")

print("Synchronized YTConv 1.7.1 tests, Android README metadata, and docs contract.")
