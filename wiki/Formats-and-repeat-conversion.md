# Formats and repeat conversion

Video: MP4, MKV, WebM. Audio: MP3, M4A, AAC, Opus, Vorbis, FLAC, ALAC, WAV.

```bash
ytconv URL --mode video --video-format mp4 --resolution 1080
ytconv URL --mode audio --audio-format mp3 --audio-quality 320
```

YTConv verifies a real matching output before reporting success. Automatic archives and default output names are separated by mode, format, and requested quality. Native 2160p streams now outrank lower AVC compatibility fallbacks, and the 1.7.6 release smoke test verifies 1080p, 2160p, and 720p twice each with ffprobe. A final metadata-free fallback remains available for sources that omit height metadata.

Optional upscaling:

```bash
ytconv URL --mode video --upscale 4k
```

This creates a local FFmpeg Lanczos copy at 3840×2160. It does not claim to recreate missing detail with AI.
