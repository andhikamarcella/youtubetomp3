import { getRedis } from './redis';
import { cacheGet, cacheSet } from './cache';

export async function getCachedJson<T>(key: string) {
  const redis = getRedis();
  if (redis) {
    try {
      const val = await redis.get(key);
      if (val) return JSON.parse(val) as T;
      return null;
    } catch {
      return null;
    }
  }
  const val = await cacheGet(key);
  if (!val) return null;
  try {
    return JSON.parse(val) as T;
  } catch {
    return null;
  }
}

export async function setCachedJson(key: string, data: unknown, ttlSeconds: number) {
  const payload = JSON.stringify(data);
  const redis = getRedis();
  if (redis) {
    try {
      await redis.set(key, payload, 'EX', ttlSeconds);
      return;
    } catch {
      await cacheSet(key, payload, ttlSeconds);
      return;
    }
  }
  await cacheSet(key, payload, ttlSeconds);
}

