/**
 * AI Status module
 * Reports current AI service configuration and availability.
 */

import { synthService } from "./synthService.js";

export function getAIStatus() {
  const hasRedis = !!process.env.REDIS_URL;
  return {
    available: true,
    model: "llama-3.3-70b",
    cacheSize: 0,
    cacheDuration: 10 * 60 * 1000,
    cache: {
      memory: { size: 0, duration: "10 minutes" },
      redis: { connected: hasRedis, ttl: "6 hours" },
    },
    synthData: {
      available: synthService.isAvailable(),
      supportedAssets: synthService.SUPPORTED_ASSETS,
    },
  };
}
