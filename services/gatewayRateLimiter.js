/**
 * Simple rate limiter for Vercel AI Gateway free tier.
 * Serializes gateway calls with a minimum interval to avoid 429s.
 * Free tier allows roughly 1 request per 2 minutes per model.
 * Override via VERCEL_GATEWAY_MIN_INTERVAL_MS (ms).
 */

const MIN_INTERVAL_MS = Number(process.env.VERCEL_GATEWAY_MIN_INTERVAL_MS) || 2 * 60 * 1000;
let lastCallTime = 0;
let queue = [];
let processing = false;

/**
 * Wait for a slot in the rate limiter, then execute the function.
 * Serializes all gateway calls to respect rate limits.
 */
export async function withRateLimit(fn) {
  return new Promise((resolve, reject) => {
    queue.push({ fn, resolve, reject });
    processQueue();
  });
}

async function processQueue() {
  if (processing) return;
  processing = true;

  while (queue.length > 0) {
    const { fn, resolve, reject } = queue.shift();

    const elapsed = Date.now() - lastCallTime;
    if (elapsed < MIN_INTERVAL_MS) {
      const waitTime = MIN_INTERVAL_MS - elapsed;
      console.log(`[rateLimiter] waiting ${Math.round(waitTime / 1000)}s before next gateway call (${queue.length} queued)`);
      await new Promise((r) => setTimeout(r, waitTime));
    }

    lastCallTime = Date.now();
    try {
      const result = await fn();
      resolve(result);
    } catch (err) {
      reject(err);
    }
  }

  processing = false;
}
