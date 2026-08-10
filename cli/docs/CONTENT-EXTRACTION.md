# Transcript and content extraction

Use these commands only for content you own or are authorized to save.

## Readable transcript

```bash
ytconv transcript "URL"
```

This requests subtitles and creates an SRT transcript when the provider exposes subtitles. It does not invent speech-to-text when no subtitle track exists.

## Structured content bundle

```bash
ytconv extract "URL"
```

This requests subtitles plus available metadata files such as the description and info JSON. The main media is not downloaded in subtitle-only mode.

## Full media plus metadata

```bash
ytconv download "URL" --subtitles --metadata-files --write-thumbnail
```

Availability depends on the provider and the permissions of the active account. Private posts, deleted pages, DRM streams, and unavailable captions cannot be reconstructed by YTConv.
