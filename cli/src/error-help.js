function text(error) {
  return error instanceof Error ? error.message : String(error ?? 'Unknown error.');
}

export function explainError(error, { platform = process.platform } = {}) {
  const original = text(error).trim();
  const value = original.toLowerCase();
  const lines = [original];

  if (/spawn(sync)? .*einval|npm\.cmd.*einval/u.test(value)) {
    lines.push('Cause: an older Windows updater attempted to spawn npm.cmd directly.');
    lines.push('Fix: npm uninstall -g ytconv && npm install -g ytconv@latest --force');
  } else if (/execution policy|running scripts is disabled|cannot be loaded because running scripts/u.test(value)) {
    lines.push('PowerShell blocked the npm .ps1 shim.');
    lines.push('Use: ytconv.cmd');
    lines.push('Optional current-user fix: Set-ExecutionPolicy -Scope CurrentUser RemoteSigned');
  } else if (/not recognized|is not recognized|enoent|tidak ditemukan/u.test(value)) {
    lines.push('Cause: a command or dependency is not available through PATH.');
    lines.push(platform === 'win32'
      ? 'Try: where node && where npm && where ytconv'
      : 'Try: command -v node; command -v npm; command -v ytconv');
    lines.push('Then run: ytconv repair');
  } else if (/permission denied|eacces|operation not permitted/u.test(value)) {
    lines.push('Cause: the npm prefix or output directory is not writable.');
    lines.push(platform === 'win32'
      ? 'Use a directory owned by the current account and check npm config get prefix.'
      : 'Do not use sudo npm. Set a user prefix: npm config set prefix "$HOME/.local"');
  } else if (/cookie database|decrypt.*cookie|dpapi|keyring/u.test(value)) {
    lines.push('The browser may still be locking its cookie database, or the system keyring cannot be read.');
    lines.push('Close the browser completely, retry --cookies-from-browser BROWSER, or use a Netscape cookies.txt file.');
  } else if (/cookie|login|sign in|private|authentication|members.only|age.restricted/u.test(value)) {
    lines.push('The media requires authentication or the cookies are expired.');
    lines.push('Desktop: --cookies-from-browser chrome. Every platform: --cookies "PATH".');
    lines.push('Never share cookies because they can contain an active account session.');
  } else if (/429|too many requests/u.test(value)) {
    lines.push('The site is rate limiting requests. Avoid aggressive retries.');
    lines.push('Wait, then retry with --jobs 1 --concurrent-fragments 1 --retry-sleep "linear=2:20:3".');
  } else if (/requested format|format is not available/u.test(value)) {
    lines.push('The requested quality or container is not available from the source.');
    lines.push('Run ytconv formats URL, or use --resolution best --video-format auto.');
  } else if (/ffmpeg|ffprobe/u.test(value)) {
    lines.push('FFmpeg/ffprobe is missing or failed while processing a codec, thumbnail, subtitle, or merge.');
    lines.push('Run ytconv repair, followed by ytconv doctor.');
  } else if (/unsupported|no suitable extractor/u.test(value)) {
    lines.push('The installed engines do not support this URL, or the site changed its URL/extractor behavior.');
    lines.push('Run ytconv repair to update yt-dlp and gallery-dl.');
  } else if (/network|timed out|timeout|enotfound|econnreset|certificate|proxy|dns/u.test(value)) {
    lines.push('A network, DNS, certificate, proxy, or source-site connection problem occurred.');
    lines.push('Try without a proxy/VPN, check the device clock, and retry.');
  }

  lines.push('Diagnostics: ytconv doctor and ytconv --shell-info');
  return [...new Set(lines.filter(Boolean))].join('\n');
}
