function text(error) {
  return error instanceof Error ? error.message : String(error ?? 'Error tidak diketahui.');
}

export function explainError(error, { platform = process.platform } = {}) {
  const original = text(error).trim();
  const value = original.toLowerCase();
  const lines = [original];

  if (/spawn(sync)? .*einval|npm\.cmd.*einval/u.test(value)) {
    lines.push('Penyebab: updater lama Windows menjalankan npm.cmd secara langsung.');
    lines.push('Perbaikan: npm uninstall -g ytconv && npm install -g ytconv@1.2.3 --force');
  } else if (/not recognized|is not recognized|enoent|tidak ditemukan/u.test(value)) {
    lines.push('Penyebab: command atau dependency belum masuk PATH.');
    lines.push(platform === 'win32'
      ? 'Coba: where node && where npm && where ytconv'
      : 'Coba: command -v node; command -v npm; command -v ytconv');
    lines.push('Lalu jalankan: ytconv --repair');
  } else if (/execution policy|running scripts is disabled|cannot be loaded because running scripts/u.test(value)) {
    lines.push('PowerShell memblokir shim .ps1 dari npm.');
    lines.push('Gunakan sementara: ytconv.cmd');
    lines.push('Perbaikan akun pengguna: Set-ExecutionPolicy -Scope CurrentUser RemoteSigned');
  } else if (/permission denied|eacces|operation not permitted/u.test(value)) {
    lines.push('Penyebab: folder global npm atau folder output tidak dapat ditulis.');
    lines.push(platform === 'win32'
      ? 'Buka terminal biasa, gunakan folder milik akun, lalu jalankan npm config get prefix.'
      : 'Jangan gunakan sudo npm. Gunakan prefix npm milik akun atau npx -y ytconv@1.2.3.');
  } else if (/cookie|login|sign in|private|authentication/u.test(value)) {
    lines.push('Konten meminta login atau cookies sudah kedaluwarsa.');
    lines.push('Ekspor cookies.txt format Netscape dari akun yang memang memiliki akses, lalu gunakan --cookies "PATH".');
  } else if (/429|too many requests/u.test(value)) {
    lines.push('Situs sedang membatasi permintaan. Jangan retry terus-menerus.');
    lines.push('Tunggu beberapa menit lalu coba --concurrent-fragments 1 --rate-limit 1M.');
  } else if (/requested format|format is not available/u.test(value)) {
    lines.push('Kualitas/container yang diminta tidak tersedia pada sumber.');
    lines.push('Lihat pilihan dengan --list-formats, atau gunakan --resolution best --video-format auto.');
  } else if (/ffmpeg/u.test(value)) {
    lines.push('FFmpeg belum siap atau gagal memproses codec/thumbnail.');
    lines.push('Jalankan ytconv --repair kemudian ytconv --diagnose.');
  } else if (/unsupported|no suitable extractor/u.test(value)) {
    lines.push('Link belum didukung oleh engine yang terpasang atau bentuk URL sudah berubah.');
    lines.push('Jalankan ytconv --repair untuk memperbarui yt-dlp dan gallery-dl.');
  } else if (/network|timed out|timeout|enotfound|econnreset|certificate/u.test(value)) {
    lines.push('Ada masalah jaringan, DNS, sertifikat, proxy, atau koneksi ke situs sumber.');
    lines.push('Coba tanpa proxy/VPN, periksa tanggal perangkat, lalu jalankan kembali.');
  }

  lines.push('Buat laporan lengkap dengan: ytconv --diagnose dan ytconv --shell-info');
  return [...new Set(lines.filter(Boolean))].join('\n');
}
