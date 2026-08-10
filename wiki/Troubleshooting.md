# Troubleshooting

Run:

```bash
ytconv --version
ytconv --diagnose
ytconv repair
ytconv doctor
```

Check Node.js is 22.14+, npm is 10+, and FFmpeg is visible with `ffmpeg -version`. In iSH, run `apk add --no-cache ffmpeg`, then `hash -r`.

Provider-side bot challenges, deleted posts, private permissions, DRM, regional restrictions, and unavailable subtitles cannot be repaired by changing the output format. Send only sanitized diagnostics to [help.ytconv@proton.me](mailto:help.ytconv@proton.me).
