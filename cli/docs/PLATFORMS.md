# Platforms and Media Engines

YTConv does not maintain a separate extractor catalog. Actual site support follows the installed versions of yt-dlp and gallery-dl.

## Main routing

- **yt-dlp:** video, audio, live streams, format inspection, subtitles, metadata, and SponsorBlock.
- **gallery-dl:** images, carousels, Stories, profiles, and some mixed-media posts.
- **FFmpeg:** merge, remux, audio extraction, thumbnail conversion, cropping, subtitles, normalization, and clipping.

## Recognized platforms

YTConv includes routing hints for YouTube, YouTube Music, Instagram, Facebook, TikTok, X/Twitter, Pinterest, Reddit, Threads, Twitch, Snapchat, SoundCloud, Bandcamp, Mixcloud, Vimeo, Dailymotion, Bilibili, Tumblr, Telegram, LinkedIn, Bluesky, Imgur, Flickr, DeviantArt, Pixiv, Weibo, VK, Mastodon, Kick, Rumble, Streamable, Odysee, and 9GAG.

Other sites may work when yt-dlp or gallery-dl provides a suitable extractor.

## YouTube Music

- AUTO routing prefers audio.
- MP3 can keep a separate JPG thumbnail and embed cover art, metadata, and chapters.
- Artwork is cropped from the center to a square when FFmpeg is available.

## Instagram, TikTok, X, and Reddit

A post can contain images, video, or both. AUTO selects an engine based on the URL and may try the other engine as a fallback. Stories, private accounts, and login-only media require valid cookies from an account that has access.

## Limitations

- DRM and paywalls are not bypassed.
- Private media cannot be accessed without legitimate account access.
- Regional restrictions still follow the site, location, and proxy rules.
- Deleted posts and expired URLs cannot be restored.
- Site API changes may require updated yt-dlp or gallery-dl releases.
- Older iSH/Python environments may require a compatible engine version rather than the newest engine release.
