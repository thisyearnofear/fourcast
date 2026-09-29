/**
 * Redis Service - Server-side caching layer
 * Handles all Redis operations that should only run on the server.
 *
 * Two backends, tried in order:
 *   1. REDIS_URL — persistent connection via the `redis` client
 *      (local dev, VPS).
 *   2. UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN — dependency-free
 *      REST shim (Vercel serverless). Upstash free tier fails closed: when
 *      the quota ends calls error and callers degrade to in-memory/null.
 * Returns null when neither is configured or reachable — every caller
 * already degrades gracefully, so caching is never load-bearing.
 */

let redisClientPromise = null;
let redisAvailable = null; // Cache Redis availability to avoid repeated checks
let lastAvailabilityCheck = 0;
const AVAILABILITY_CHECK_INTERVAL = 60000; // Check every 60 seconds

/**
 * Minimal Upstash REST client covering exactly what callers use
 * (get/set/setEx/del/ping). No dependency: plain fetch + Bearer token.
 */
function createUpstashRestClient(baseUrl, token) {
  const endpoint = String(baseUrl).replace(/\/+$/, '');
  async function cmd(...args) {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(args),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) throw new Error(`upstash ${res.status}`);
    const data = await res.json();
    if (data.error) throw new Error(String(data.error).slice(0, 120));
    return data.result ?? null;
  }
  return {
    isUpstashRest: true,
    ping: () => cmd('PING'),
    get: (key) => cmd('GET', key),
    set: (key, value) => cmd('SET', key, value),
    setEx: (key, ttlSeconds, value) => cmd('SETEX', key, ttlSeconds, value),
    del: (key) => cmd('DEL', key),
    quit: async () => null,
  };
}

async function getUpstashClient() {
  const baseUrl = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!baseUrl || !token) return null;
  try {
    const client = createUpstashRestClient(baseUrl, token);
    await client.ping();
    console.log('[Redis] Connected via Upstash REST');
    return client;
  } catch (error) {
    console.warn('[Redis] Upstash REST unreachable:', error.message);
    return null;
  }
}

export const getRedisClient = async () => {
  // Only allow this to run on the server
  if (typeof window !== 'undefined') {
    console.warn('RedisService should not be imported in client-side code');
    return null;
  }

  const url = process.env.REDIS_URL;
  if (!url) {
    // No persistent Redis — try Upstash REST (serverless free tier) before
    // giving up. Fail-closed: null when unconfigured or unreachable.
    if (redisAvailable === false && Date.now() - lastAvailabilityCheck < AVAILABILITY_CHECK_INTERVAL) {
      return null;
    }
    const upstash = await getUpstashClient();
    if (upstash) {
      redisAvailable = true;
      lastAvailabilityCheck = Date.now();
      redisClientPromise = Promise.resolve(upstash);
      return upstash;
    }
    redisAvailable = false;
    lastAvailabilityCheck = Date.now();
    return null;
  }

  // Return cached availability result if recent
  const now = Date.now();
  if (redisAvailable === false && now - lastAvailabilityCheck < AVAILABILITY_CHECK_INTERVAL) {
    return null;
  }

  if (!redisClientPromise) {
    try {
      const { createClient } = await import('redis');
      const client = createClient({ url });
      client.on('error', (err) => {
        console.error('Redis Client Error:', err);
        redisAvailable = false;
        lastAvailabilityCheck = Date.now();
      });
      await client.connect();
      redisClientPromise = client;
      redisAvailable = true;
      lastAvailabilityCheck = Date.now();
      console.log('[Redis] Connected successfully');
    } catch (error) {
      console.error('Failed to connect to Redis:', error.message);
      redisAvailable = false;
      lastAvailabilityCheck = Date.now();
      return null; // Return null on connection failure
    }
  }
  return redisClientPromise;
};