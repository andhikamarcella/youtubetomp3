# Formats and repeat conversion

Video: MP4, MKV, WebM. Audio: MP3, M4A, AAC, Opus, Vorbis, FLAC, ALAC, WAV.

```bash
ytconv URL --mode video --video-format mp4 --resolution 1080
ytconv URL --mode audio --audio-format mp3 --audio-quality 320
```

YTConv verifies a real matching output before reporting success. The 1.7.5 release matrix converts every listed choice ten times. A final metadata-free video fallback prevents direct/social media from failing only because it did not publish height metadata.

Optional upscaling:

```bash
ytconv URL --mode video --upscale 4k
```

This creates a local FFmpeg Lanczos copy at 3840×2160. It does not claim to recreate missing detail with AI.
