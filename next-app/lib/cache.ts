type MemoryEntry = {
  value: string;
  expiresAt: number;
};

function getMemoryStore() {
  const g = globalThis as unknown as { __ytmp3MemCache?: Map<string, MemoryEntry> };
  if (!g.__ytmp3MemCache) g.__ytmp3MemCache = new Map();
  return g.__ytmp3MemCache;
}

export async function cacheGet(key: string) {
  const store = getMemoryStore();
  const entry = store.get(key);
  if (!entry) return null;
  if (Date.now() >= entry.expiresAt) {
    store.delete(key);
    return null;
  }
  return entry.value;
}

export async function cacheSet(key: string, value: string, ttlSeconds: number) {
  const store = getMemoryStore();
  store.set(key, { value, expiresAt: Date.now() + ttlSeconds * 1000 });
}

