import { getCachedJson } from './cacheJson';
import { makeSearchCacheKey, type SearchItem } from './search';

export async function getCachedSearchItems(q: string): Promise<{ q: string; items: SearchItem[] } | null> {
  const { normalized, key } = makeSearchCacheKey(q);
  if (!normalized) return null;
  const cached = await getCachedJson<{ q: string; items: SearchItem[] }>(key);
  if (!cached) return null;
  const items = Array.isArray((cached as any)?.items) ? (cached as any).items : [];
  return { q: normalized, items };
}

