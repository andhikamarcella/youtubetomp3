# Audio and video formats

YTConv 1.7.2 verifies that a real output file exists before reporting success. Repeating the same command is supported: the second run overwrites only when requested or returns the already valid output according to the selected archive/overwrite policy.

## Video

```bash
ytconv download "URL" --mode video --video-format mp4 --resolution 1080
ytconv download "URL" --mode video --video-format mkv --resolution best
ytconv download "URL" --mode video --video-format webm --resolution 720
```

- MP4 prefers AVC/H.264 video plus M4A/AAC audio for broad compatibility, with safe fallbacks when a provider does not expose those codecs.
- MKV accepts a wider combination of codecs.
- WebM normally uses VP9/AV1 plus Opus/Vorbis.
- A requested maximum resolution is applied to formats that publish height metadata. Metadata-free direct/social formats use a final unbounded fallback instead of failing incorrectly.

## Audio

```bash
ytconv download "URL" --mode audio --audio-format mp3 --audio-quality 320
ytconv download "URL" --mode audio --audio-format flac
```

Supported choices are MP3, M4A, AAC, Opus, Vorbis, FLAC, ALAC, and WAV. AAC and ALAC are normally stored in an `.m4a` container; Vorbis is normally stored in `.ogg`. Converting a lossy source to FLAC/WAV does not restore lost quality.

## AUTO

- A normal YouTube URL defaults to MP4 video.
- YouTube Music defaults to MP3 audio.
- An explicit `--mode`, `--format`, or container choice always wins.

Inspect a source before downloading with `ytconv formats "URL"` or `ytconv info "URL" --json`.
