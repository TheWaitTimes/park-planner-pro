// Simple TTL cache backed by memory + localStorage so tab switches
// don't re-hit rate-limited public APIs.

const memory = new Map<string, { at: number; data: unknown }>();

export const TTL_30_MIN = 30 * 60 * 1000;

function storageKey(key: string) {
  return `msi:cache:${key}`;
}

export function readCache<T>(key: string, ttlMs: number): T | null {
  const mem = memory.get(key);
  const now = Date.now();
  if (mem && now - mem.at < ttlMs) return mem.data as T;

  try {
    const raw = localStorage.getItem(storageKey(key));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { at: number; data: T };
    if (now - parsed.at >= ttlMs) return null;
    memory.set(key, parsed);
    return parsed.data;
  } catch {
    return null;
  }
}

export function readCacheMeta(key: string): { at: number } | null {
  const mem = memory.get(key);
  if (mem) return { at: mem.at };
  try {
    const raw = localStorage.getItem(storageKey(key));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { at: number };
    return { at: parsed.at };
  } catch {
    return null;
  }
}

export function writeCache<T>(key: string, data: T) {
  const entry = { at: Date.now(), data };
  memory.set(key, entry);
  try {
    localStorage.setItem(storageKey(key), JSON.stringify(entry));
  } catch {
    // storage full / disabled — memory cache still works
  }
}

/**
 * Cached fetcher. Returns cached value if fresh, otherwise calls loader.
 * Set `force` to bypass the cache (e.g. manual refresh button).
 */
export async function cachedFetch<T>(
  key: string,
  ttlMs: number,
  loader: () => Promise<T>,
  force = false,
): Promise<T> {
  if (!force) {
    const hit = readCache<T>(key, ttlMs);
    if (hit !== null) return hit;
  }
  const data = await loader();
  writeCache(key, data);
  return data;
}
