#!/usr/bin/env python3
"""YTConv 1.4.0 stable compatibility frontend for iSH and Alpine."""

from pathlib import Path
import sys

VERSION = "1.4.0"
TARGET = Path(__file__).with_name("ytconv-core.py")

if not TARGET.is_file():
    raise SystemExit("YTConv core frontend is missing: %s" % TARGET)

source = TARGET.read_text(encoding="utf-8")
replacements = {
    'VERSION = "1.5.0-beta.1"': 'VERSION = "1.4.0"',
    'codex/add-ytconv-cli': 'release/ytconv-1.4.0',
    'YTConv 1.5.0 Beta native frontend for iSH/Alpine and Python-only shells.': 'YTConv 1.4.0 stable frontend for iSH/Alpine and Python-only shells.',
    'description="YTConv 1.5.0 Beta untuk iSH/Alpine."': 'description="YTConv 1.4.0 stable for iSH/Alpine."',
    'action="store_true", default=True)': 'action="store_true", default=False)',
    'choices=["off", "mark", "remove"], default="mark")': 'choices=["off", "mark", "remove"], default="off")',
    'if options.no_archive:\n        return (None, None)': 'if options.no_archive or not options.archive:\n        return (None, None)',
    '("Subtitle", "ON"), ("SponsorBlock", "ON (mark)"), ("Archive", "ON per profil")': '("Subtitles", "OFF"), ("SponsorBlock", "OFF"), ("Archive", "OFF")',
    'YTConv iSH Beta doctor': 'YTConv iSH stable doctor',
    'Mengunduh installer YTConv iSH beta terbaru...': 'Downloading the latest stable YTConv iSH installer...',
    'Update gagal: %s': 'Update failed: %s',
    'Jalankan manual:': 'Run manually:',
    'Update selesai. Jalankan kembali: ytconv --version': 'Update completed. Run again: ytconv --version',
    'tidak ditemukan': 'not found',
    'gagal dijalankan': 'failed to run',
    'YTConv iSH beta repair': 'YTConv iSH stable repair',
    'pip gagal memasang yt-dlp/gallery-dl. Periksa internet dan waktu perangkat.': 'pip could not install yt-dlp/gallery-dl. Check the internet connection and device clock.',
    'Masih kurang: %s': 'Still missing: %s',
    'Semua dependency siap.': 'All dependencies are ready.',
    'cookies.txt tidak ditemukan: %s': 'cookies.txt was not found: %s',
    '--output-template harus relatif, tidak boleh \'..\', dan wajib memuat %(ext)s': '--output-template must be relative, must not contain .., and must include %(ext)s',
    '%s belum tersedia. Jalankan ytconv repair': '%s is not available. Run ytconv repair',
    '%s gagal dengan kode %s': '%s failed with exit code %s',
    '%s gagal': '%s failed',
    'Judul: %s\\nUploader: %s': 'Title: %s\\nUploader: %s',
    'gallery-dl gagal; mencoba yt-dlp...': 'gallery-dl failed; trying yt-dlp...',
    'yt-dlp gagal; mencoba gallery-dl...': 'yt-dlp failed; trying gallery-dl...',
    'Belum tersedia: %s\\nJalankan: ytconv repair': 'Missing: %s\\nRun: ytconv repair',
    'Link tidak valid: %s': 'Invalid URL: %s',
    'tersedia %s': '%s available',
    'sudah terbaru (%s)': 'up to date (%s)',
    'Paste link media: ': 'Paste a media URL: ',
    'Tidak ada link. Berikan LINK, batch file, atau pipe melalui stdin.': 'No URL was provided. Pass a URL, batch file, or pipe URLs through stdin.',
    'Gagal: %s': 'Failed: %s',
    'Laporan JSON: %s': 'JSON report: %s',
    'Ringkasan: %s berhasil, %s gagal.': 'Summary: %s succeeded, %s failed.',
    'Jalankan ytconv doctor dan ytconv repair.': 'Run ytconv doctor and ytconv repair.',
}

for old, new in replacements.items():
    source = source.replace(old, new)

namespace = {
    "__name__": "__main__",
    "__file__": str(TARGET),
    "__package__": None,
}
exec(compile(source, str(TARGET), "exec"), namespace)
