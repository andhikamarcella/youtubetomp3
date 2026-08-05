const FRAMES = Object.freeze(['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏']);

export function spinnerFrame(index = 0) {
  const normalized = Math.abs(Number(index) || 0) % FRAMES.length;
  return FRAMES[normalized];
}

export function progressPhase(stage = '', statusText = '') {
  const value = String(statusText);
  if (/convert|extractaudio|merger|remux|ffmpeg|post-process|thumbnail/iu.test(value)) {
    return 'Converting';
  }
  if (stage === 'probing') return 'Checking link';
  if (stage === 'downloading') return 'Downloading';
  return 'Working';
}

export function progressSummary(progress = {}) {
  return [
    progress.percent || '0%',
    progress.speed || '',
    progress.eta ? `ETA ${progress.eta}` : '',
  ].filter(Boolean).join(' · ');
}
