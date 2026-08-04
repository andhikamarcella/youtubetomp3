export type VideoContainer = 'auto' | 'mp4' | 'mkv' | 'webm';
export type MediaMode = 'auto' | 'audio' | 'video' | 'image';

export interface EffectiveVideoContainerOptions {
  url?: string;
  mode?: MediaMode;
  requestedContainer?: VideoContainer;
}

/** Return true when the URL belongs to YouTube, YouTube Music, youtu.be, or YouTube No-Cookie. */
export function isYouTubeUrl(value: string): boolean;

/** Return true only for music.youtube.com URLs. */
export function isYouTubeMusicUrl(value: string): boolean;

/** Resolve AUTO video output to MP4 for YouTube while preserving an explicit container. */
export function effectiveVideoContainer(options?: EffectiveVideoContainerOptions): VideoContainer;

/** Build the yt-dlp format selector used by YTConv for a resolution and container. */
export function formatVideoSelector(
  resolution?: 'best' | `${number}`,
  container?: VideoContainer,
): string;

/** Build safe yt-dlp/FFmpeg container arguments for the selected output container. */
export function videoContainerArgs(container?: VideoContainer): string[];

/** Remove repeated yt-dlp retry-type prefixes while preserving the retry expression. */
export function normalizeRetrySleep(value?: unknown, fallback?: string): string;
