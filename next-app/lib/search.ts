import crypto from 'node:crypto';

export type SearchItem = {
  id: string;
  title: string;
  author?: string;
  description?: string;
  thumbnail?: string;
  webpageUrl?: string;
};

export type SearchResponse = {
  q: string;
  cached: boolean;
  items: SearchItem[];
};

export function normalizeQuery(q: string) {
  return String(q || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

export function makeSearchCacheKey(q: string) {
  const normalized = normalizeQuery(q);
  const hash = crypto.createHash('sha1').update(normalized).digest('hex');
  return { normalized, key: `search:v1:${hash}` };
}

export async function searchYouTubeMusic(q: string, maxResults = 12): Promise<SearchItem[]> {
  const apiKey = process.env.YOUTUBE_API_KEY || '';
  if (!apiKey) return mockSearch(q);
  const url = new URL('https://www.googleapis.com/youtube/v3/search');
  url.searchParams.set('part', 'snippet');
  url.searchParams.set('type', 'video');
  url.searchParams.set('q', q);
  url.searchParams.set('maxResults', String(Math.min(Math.max(maxResults, 1), 25)));
  url.searchParams.set('videoCategoryId', '10');
  url.searchParams.set('key', apiKey);
  const res = await fetch(url.toString(), { method: 'GET' });
  if (!res.ok) return mockSearch(q);
  const data = (await res.json()) as {
    items?: Array<{ id?: { videoId?: string }; snippet?: any }>;
  };
  const items = Array.isArray(data.items) ? data.items : [];
  return items
    .map((it) => {
      const id = String(it?.id?.videoId || '').trim();
      const sn = it?.snippet || {};
      if (!id) return null;
      const title = String(sn.title || '').trim() || 'Untitled';
      const author = String(sn.channelTitle || '').trim() || undefined;
      const description = String(sn.description || '').trim() || undefined;
      const thumbnail =
        sn?.thumbnails?.high?.url ||
        sn?.thumbnails?.medium?.url ||
        sn?.thumbnails?.default?.url ||
        undefined;
      const out: SearchItem = {
        id,
        title,
        author,
        description,
        thumbnail,
        webpageUrl: `https://www.youtube.com/watch?v=${id}`,
      };
      return out;
    })
    .filter((v): v is SearchItem => v !== null);
}

function mockSearch(q: string): SearchItem[] {
  const seed = normalizeQuery(q).replace(/[^a-z0-9]+/g, '-').slice(0, 24) || 'music';
  const base = [
    { t: `${q} - Official Audio`, a: 'Sample Channel' },
    { t: `${q} - Live Session`, a: 'Live Studio' },
    { t: `${q} - Lyrics Video`, a: 'Lyrics Hub' },
  ];
  return base.map((it, idx) => {
    const id = crypto.createHash('sha1').update(`${seed}:${idx}`).digest('hex').slice(0, 11);
    return {
      id,
      title: it.t,
      author: it.a,
      thumbnail: `https://picsum.photos/seed/${encodeURIComponent(`${seed}-${idx}`)}/300/300`,
      webpageUrl: `https://www.youtube.com/watch?v=${id}`,
    };
  });
}

