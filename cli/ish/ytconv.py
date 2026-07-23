#!/usr/bin/env python3
"""YTConv 1.5.0-beta.2 compatibility frontend for iSH and Alpine."""

from pathlib import Path

VERSION = "1.5.0-beta.2"
DIRECTORY = Path(__file__).resolve().parent
TARGET = DIRECTORY / "ytconv-core.py"
if not TARGET.is_file():
    TARGET = DIRECTORY / "ytconv-beta.py"

if not TARGET.is_file():
    raise SystemExit("YTConv core frontend is missing: %s" % TARGET)

source = TARGET.read_text(encoding="utf-8")
replacements = {
    'VERSION = "1.5.0-beta.1"': 'VERSION = "1.5.0-beta.2"',
    'codex/add-ytconv-cli': 'release/ytconv-1.5.0-beta.2',
    'YTConv 1.5.0 Beta native frontend for iSH/Alpine and Python-only shells.': 'YTConv 1.5.0-beta.2 native frontend for iSH/Alpine and Python-only shells.',
    'description="YTConv 1.5.0 Beta untuk iSH/Alpine."': 'description="YTConv 1.5.0-beta.2 for iSH/Alpine."',
    'YTConv iSH Beta doctor': 'YTConv iSH beta doctor',
    'Mengunduh installer YTConv iSH beta terbaru...': 'Downloading the latest YTConv iSH beta installer...',
    'Update gagal: %s': 'Update failed: %s',
    'Jalankan manual:': 'Run manually:',
    'Update selesai. Jalankan kembali: ytconv --version': 'Update completed. Run again: ytconv --version',
    'tidak ditemukan': 'not found',
    'gagal dijalankan': 'failed to run',
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
    'per profil': 'per profile',
}

for old, new in replacements.items():
    source = source.replace(old, new)

namespace = {
    "__name__": "__main__",
    "__file__": str(TARGET),
    "__package__": None,
}
exec(compile(source, str(TARGET), "exec"), namespace)
