import Redis from "ioredis";
import { config } from "../config/env";

// In-process fallback (used when no REDIS_URL is set)

interface FallbackEntry {
  value: string;
  expiresAt: number;
}

const fallbackStore = new Map<string, FallbackEntry>();

const fallbackCache = {
  get: async (key: string): Promise<string | null> => {
    const entry = fallbackStore.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      fallbackStore.delete(key);
      return null;
    }
    return entry.value;
  },
  set: async (
    key: string,
    value: string,
    ttlSeconds: number,
  ): Promise<void> => {
    fallbackStore.set(key, {
      value,
      expiresAt: Date.now() + ttlSeconds * 1000,
    });
  },
  flush: async (pattern: string): Promise<void> => {
    const prefix = pattern.replace(/\*$/, "");
    for (const key of fallbackStore.keys()) {
      if (key.startsWith(prefix)) fallbackStore.delete(key);
    }
  },
};

// Redis client

let redisClient: Redis | null = null;

if (config.redisUrl) {
  redisClient = new Redis(config.redisUrl, {
    maxRetriesPerRequest: 3,
    enableOfflineQueue: false,
    lazyConnect: true,
  });

  redisClient.on("error", (err: Error) => {
    console.error("[cache] Redis error:", err.message);
  });
}

// Public cache API

export async function cacheGet(key: string): Promise<string | null> {
  if (!redisClient) return fallbackCache.get(key);
  try {
    return await redisClient.get(key);
  } catch {
    return fallbackCache.get(key);
  }
}

export async function cacheSet(
  key: string,
  value: string,
  ttlSeconds: number = config.cacheTtlSeconds,
): Promise<void> {
  if (!redisClient) return fallbackCache.set(key, value, ttlSeconds);
  try {
    await redisClient.set(key, value, "EX", ttlSeconds);
  } catch {
    await fallbackCache.set(key, value, ttlSeconds);
  }
}

export async function cacheFlush(pattern: string): Promise<void> {
  if (!redisClient) return fallbackCache.flush(pattern);
  try {
    // Scan and delete matching keys
    let cursor = "0";
    do {
      const [nextCursor, keys] = await redisClient.scan(
        cursor,
        "MATCH",
        pattern,
        "COUNT",
        100,
      );
      cursor = nextCursor;
      if (keys.length > 0) await redisClient.del(...keys);
    } while (cursor !== "0");
  } catch {
    await fallbackCache.flush(pattern);
  }
}
