import {
  effectiveVideoContainer,
  formatVideoSelector,
  isYouTubeMusicUrl,
  isYouTubeUrl,
  normalizeRetrySleep,
  videoContainerArgs,
  type VideoContainer,
} from 'ytconv';

const container: VideoContainer = effectiveVideoContainer({
  url: 'https://www.youtube.com/watch?v=public',
  mode: 'video',
  requestedContainer: 'auto',
});

const selector: string = formatVideoSelector('1080', container);
const argumentsList: string[] = videoContainerArgs(container);
const retryExpression: string = normalizeRetrySleep('fragment:http:linear=1::2');
const youtube: boolean = isYouTubeUrl('https://youtu.be/public');
const music: boolean = isYouTubeMusicUrl('https://music.youtube.com/watch?v=public');

void [selector, argumentsList, retryExpression, youtube, music];
