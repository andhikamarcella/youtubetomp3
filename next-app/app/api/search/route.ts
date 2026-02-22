import { NextResponse } from 'next/server';
import { getCachedJson, setCachedJson } from '../../../lib/cacheJson';
import { makeSearchCacheKey, searchYouTubeMusic, type SearchResponse } from '../../../lib/search';

async function handle(q: string) {
  const { normalized, key } = makeSearchCacheKey(q);
  if (!normalized) {
    return NextResponse.json({ error: 'missing_query' }, { status: 400 });
  }

  const cached = await getCachedJson<Omit<SearchResponse, 'cached'>>(key);
  if (cached) {
    const items = Array.isArray((cached as any)?.items) ? (cached as any).items : [];
    return NextResponse.json({ q: normalized, cached: true, items, results: items });
  }

  const items = await searchYouTubeMusic(normalized, 12);
  const payload: Omit<SearchResponse, 'cached'> = { q: normalized, items };
  await setCachedJson(key, payload, 2 * 60 * 60);
  return NextResponse.json({ q: normalized, cached: false, items, results: items });
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const q = String(url.searchParams.get('q') || '');
  return handle(q);
}

export async function POST(req: Request) {
  let body: any = null;
  try {
    body = await req.json();
  } catch {
    body = null;
  }
  const q = String(body?.query || body?.q || '');
  return handle(q);
}

