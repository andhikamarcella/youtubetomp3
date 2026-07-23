function text(error) {
  return error instanceof Error ? error.message : String(error ?? 'Error tidak diketahui.');
}

export function explainError(error, { platform = process.platform } = {}) {
  const original = text(error).trim();
  const value = original.toLowerCase();
  const lines = [original];

  if (/spawn(sync)? .*einval|npm\.cmd.*einval/u.test(value)) {
    lines.push('Penyebab: updater lama Windows menjalankan npm.cmd secara langsung.');
    lines.push('Perbaikan: npm uninstall -g ytconv && npm install -g ytconv@1.3.0 --force');
  } else if (/execution policy|running scripts is disabled|cannot be loaded because running scripts/u.test(value)) {
    lines.push('PowerShell memblokir shim .ps1 dari npm.');
    lines.push('Gunakan sementara: ytconv.cmd');
    lines.push('Perbaikan akun pengguna: Set-ExecutionPolicy -Scope CurrentUser RemoteSigned');
  } else if (/not recognized|is not recognized|enoent|tidak ditemukan/u.test(value)) {
    lines.push('Penyebab: command atau dependency belum masuk PATH.');
    lines.push(platform === 'win32'
      ? 'Coba: where node && where npm && where ytconv'
      : 'Coba: command -v node; command -v npm; command -v ytconv');
    lines.push('Lalu jalankan: ytconv repair');
  } else if (/permission denied|eacces|operation not permitted/u.test(value)) {
    lines.push('Penyebab: folder global npm atau folder output tidak dapat ditulis.');
    lines.push(platform === 'win32'
      ? 'Gunakan folder milik akun dan periksa npm config get prefix.'
      : 'Jangan gunakan sudo npm. Atur prefix: npm config set prefix "$HOME/.local"');
  } else if (/cookie database|decrypt.*cookie|dpapi|keyring/u.test(value)) {
    lines.push('Browser masih membuka/mengunci database cookies atau keyring tidak dapat dibaca.');
    lines.push('Tutup browser sepenuhnya, coba --cookies-from-browser BROWSER, atau gunakan cookies.txt Netscape.');
  } else if (/cookie|login|sign in|private|authentication|members.only|age.restricted/u.test(value)) {
    lines.push('Konten meminta login atau cookies sudah kedaluwarsa.');
    lines.push('Desktop: --cookies-from-browser chrome. Semua platform: --cookies "PATH".');
    lines.push('Jangan pernah membagikan cookies karena berisi sesi akun.');
  } else if (/429|too many requests/u.test(value)) {
    lines.push('Situs sedang membatasi permintaan. Jangan retry agresif.');
    lines.push('Tunggu lalu coba --jobs 1 --concurrent-fragments 1 --retry-sleep "linear=2:20:3".');
  } else if (/requested format|format is not available/u.test(value)) {
    lines.push('Kualitas/container yang diminta tidak tersedia pada sumber.');
    lines.push('Lihat pilihan dengan ytconv formats LINK, atau gunakan --resolution best --video-format auto.');
  } else if (/ffmpeg|ffprobe/u.test(value)) {
    lines.push('FFmpeg/ffprobe belum siap atau gagal memproses codec, thumbnail, subtitle, atau merge.');
    lines.push('Jalankan ytconv repair lalu ytconv doctor.');
  } else if (/unsupported|no suitable extractor/u.test(value)) {
    lines.push('Link belum didukung oleh engine yang terpasang atau bentuk URL situs berubah.');
    lines.push('Jalankan ytconv repair untuk memperbarui yt-dlp dan gallery-dl.');
  } else if (/network|timed out|timeout|enotfound|econnreset|certificate|proxy|dns/u.test(value)) {
    lines.push('Ada masalah jaringan, DNS, sertifikat, proxy, atau koneksi ke situs sumber.');
    lines.push('Coba tanpa proxy/VPN, periksa tanggal perangkat, lalu jalankan kembali.');
  }

  lines.push('Diagnosis: ytconv doctor dan ytconv --shell-info');
  return [...new Set(lines.filter(Boolean))].join('\n');
}
