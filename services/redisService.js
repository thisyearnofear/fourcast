/**
 * Redis Service - Server-side caching layer
 * Handles all Redis operations that should only run on the server
 */

let redisClientPromise = null;
let redisAvailable = null; // Cache Redis availability to avoid repeated checks
let lastAvailabilityCheck = 0;
const AVAILABILITY_CHECK_INTERVAL = 60000; // Check every 60 seconds

export const getRedisClient = async () => {
  // Only allow this to run on the server
  if (typeof window !== 'undefined') {
    console.warn('RedisService should not be imported in client-side code');
    return null;
  }

  const url = process.env.REDIS_URL;
  if (!url) {
    redisAvailable = false;
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