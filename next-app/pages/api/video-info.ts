import type { NextApiRequest, NextApiResponse } from 'next';

type YouTubeVideoResponse = {
  items: Array<{
    id: string;
    snippet: {
      title: string;
      channelTitle: string;
      description: string;
      thumbnails: Record<string, { url: string; width?: number; height?: number }>;
    };
    contentDetails: {
      duration: string;
    };
  }>;
};

function parseIsoDurationToSeconds(isoDuration: string): number {
  const match = isoDuration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?/);
  if (!match) return 0;
  const hours = match[1] ? parseInt(match[1], 10) : 0;
  const minutes = match[2] ? parseInt(match[2], 10) : 0;
  const seconds = match[3] ? parseFloat(match[3]) : 0;
  return Math.round(hours * 3600 + minutes * 60 + seconds);
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const videoId = Array.isArray(req.query.id) ? req.query.id[0] : req.query.id;
  if (!videoId) {
    return res.status(400).json({ error: 'Missing video id' });
  }

  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'Missing YOUTUBE_API_KEY' });
  }

  try {
    const url = new URL('https://www.googleapis.com/youtube/v3/videos');
    url.searchParams.set('id', videoId);
    url.searchParams.set('part', 'snippet,contentDetails');
    url.searchParams.set('key', apiKey);

    const response = await fetch(url.toString());
    if (!response.ok) {
      const text = await response.text();
      console.error('YouTube API error', response.status, text);
      return res.status(response.status).json({ error: 'Failed to fetch video info' });
    }

    const data = (await response.json()) as YouTubeVideoResponse;
    if (!data.items || data.items.length === 0) {
      return res.status(404).json({ error: 'Video not found' });
    }

    const item = data.items[0];
    return res.status(200).json({
      videoId: item.id,
      title: item.snippet.title,
      channelTitle: item.snippet.channelTitle,
      thumbnails: item.snippet.thumbnails,
      durationSeconds: parseIsoDurationToSeconds(item.contentDetails.duration),
      description: item.snippet.description,
    });
  } catch (error) {
    console.error('/api/video-info error', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}
