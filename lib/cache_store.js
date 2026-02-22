import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CACHE_DIR = join(__dirname, '../data');
const CACHE_FILE = join(CACHE_DIR, 'conversion_cache.json');

// Ensure data dir exists
if (!existsSync(CACHE_DIR)) {
  try {
    mkdirSync(CACHE_DIR, { recursive: true });
  } catch (e) {
    console.error('Failed to create data dir:', e);
  }
}

let memoryCache = new Map();

// Load cache on startup
try {
  if (existsSync(CACHE_FILE)) {
    const data = JSON.parse(readFileSync(CACHE_FILE, 'utf8'));
    Object.keys(data).forEach(k => memoryCache.set(k, data[k]));
  }
} catch (e) {
  console.error('Failed to load cache:', e);
}

function saveDisk() {
  try {
    const obj = Object.fromEntries(memoryCache);
    writeFileSync(CACHE_FILE, JSON.stringify(obj, null, 2), 'utf8');
  } catch (e) {
    console.error('Failed to save cache:', e);
  }
}

export const CacheStore = {
  get: (key) => memoryCache.get(key),
  set: (key, value) => {
    // Store minimal info needed to reconstruct result
    memoryCache.set(key, { ...value, cachedAt: Date.now() });
    saveDisk();
  },
  has: (key) => memoryCache.has(key),
  cleanup: (ttlMs = 24 * 60 * 60 * 1000) => {
    const now = Date.now();
    let changed = false;
    for (const [key, val] of memoryCache.entries()) {
      if (now - (val.cachedAt || 0) > ttlMs) {
        memoryCache.delete(key);
        changed = true;
      }
    }
    if (changed) saveDisk();
  }
};
