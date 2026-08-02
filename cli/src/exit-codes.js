export const EXIT_CODES = Object.freeze({
  SUCCESS: 0,
  DOWNLOAD_FAILED: 1,
  INVALID_USAGE: 2,
  DEPENDENCY_MISSING: 3,
  AUTH_REQUIRED: 4,
  TEMPORARY_FAILURE: 5,
  CANCELLED: 130,
});

export function exitCodeForError(error) {
  const message = String(error?.message ?? error ?? '').toLowerCase();
  if (/dibatalkan|cancelled|canceled|sigint/u.test(message)) return EXIT_CODES.CANCELLED;
  if (/link tidak valid|url tidak valid|opsi tidak dikenal|membutuhkan nilai|harus salah satu/u.test(message)) {
    return EXIT_CODES.INVALID_USAGE;
  }
  if (/ffmpeg|ffprobe|yt-dlp belum|gallery-dl belum|dependency belum|executable.*tidak/u.test(message)) {
    return EXIT_CODES.DEPENDENCY_MISSING;
  }
  if (/login|sign in|authentication|cookies?.*(expired|invalid)|private|members.only|age.restricted/u.test(message)) {
    return EXIT_CODES.AUTH_REQUIRED;
  }
  if (/429|too many requests|timeout|timed out|temporary|dns|certificate|proxy|network|connection/u.test(message)) {
    return EXIT_CODES.TEMPORARY_FAILURE;
  }
  return EXIT_CODES.DOWNLOAD_FAILED;
}
