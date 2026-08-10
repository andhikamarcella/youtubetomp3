# Video upscaling

YTConv can create an additional fixed-resolution copy after a video download:

```bash
ytconv download "URL" --mode video --video-format mp4 --upscale 4k
```

Accepted targets are `720`, `1080`, `1440`, `2160`, `2k`, `4k`, or `off`. `4k` maps to 3840×2160. The video is scaled to fit and padded when necessary so its aspect ratio is preserved.

The implementation uses FFmpeg Lanczos scaling. It is deterministic and locally processed, but it is not presented as AI detail recovery: enlarging a low-resolution source cannot recreate detail that was never present. The original download is retained and the derived file gets an `.upscaled-<height>p` suffix.

4K conversion needs substantial storage, memory, CPU time, and battery. Avoid it on iSH and low-memory phones. If a source is already at or above the target, prefer the original instead of re-encoding.
