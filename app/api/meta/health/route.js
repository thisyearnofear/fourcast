/**
 * Health check endpoint for all external providers.
 * Returns structured status for Polymarket, Kalshi, Venice AI, SynthData, and the database.
 * Used by the public /status page for transparency.
 *
 * Runtime: nodejs — uses fetch, not WASM or GPU
 */

export const runtime = 'nodejs';

/**
 * Ping an HTTP endpoint and return (status, latencyMs).
 * Returns 'unreachable' on any failure.
 */
async function pingUrl(url, timeoutMs = 5000) {
  const start = Date.now();
  try {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeoutMs);
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(id);
    const latencyMs = Date.now() - start;
    return { status: res.ok ? 'healthy' : 'degraded', latencyMs, httpStatus: res.status };
  } catch {
    return { status: 'unreachable', latencyMs: Date.now() - start, httpStatus: null };
  }
}

export async function GET() {
  const startedAt = Date.now();

  // ── Polymarket ────────────────────────────────────────────────────────
  const pm = await pingUrl('https://gamma-api.polymarket.com/events?limit=1&closed=false', 6000);

  // ── Kalshi ────────────────────────────────────────────────────────────
  const ks = await pingUrl('https://api.elections.kalshi.com/trade-api/v2/events?limit=1&status=open', 6000);

  // ── Venice AI ─────────────────────────────────────────────────────────
  const hasVeniceKey = !!process.env.VENICE_API_KEY;
  let venice = { status: 'disabled', latencyMs: 0, httpStatus: null };
  if (hasVeniceKey) {
    venice = await pingUrl('https://api.venice.ai/api/v1/models', 8000);
    if (venice.status === 'healthy' || venice.status === 'degraded') {
      venice = { ...venice, model: 'llama-3.3-70b' };
    }
  }

  // ── SynthData ─────────────────────────────────────────────────────────
  const hasSynthKey = !!process.env.SYNTH_API_KEY;
  let synth = { status: 'disabled', latencyMs: 0, httpStatus: null };
  if (hasSynthKey) {
    synth = await pingUrl('https://api.synthdata.co/prediction-percentiles?asset=BTC&horizon=24h', 8000);
  }

  // ── Database ──────────────────────────────────────────────────────────
  let db = { status: 'unknown', latencyMs: 0 };
  try {
    const { getRedisClient } = await import('@/services/redisService.js');
    const redis = await getRedisClient();
    if (redis) {
      const start = Date.now();
      await redis.ping();
      db = { status: 'healthy', latencyMs: Date.now() - start, type: 'redis' };
    } else {
      db = { status: 'healthy', latencyMs: 0, type: 'sqlite' };
    }
  } catch {
    db = { status: 'healthy', latencyMs: 0, type: 'sqlite' }; // SQLite doesn't need a ping
  }

  // ── Aggregate ─────────────────────────────────────────────────────────
  const allUp = [pm, ks, venice, synth].every(
    (p) => p.status === 'healthy' || p.status === 'disabled'
  );

  const response = {
    success: true,
    summary: allUp ? 'all_healthy' : 'degraded',
    generatedAt: new Date().toISOString(),
    totalLatencyMs: Date.now() - startedAt,
    providers: {
      polymarket: {
        label: 'Polymarket',
        description: 'Prediction market data & order book',
        ...pm,
      },
      kalshi: {
        label: 'Kalshi',
        description: 'Event contract trading platform',
        ...ks,
      },
      venice: {
        label: 'Venice AI',
        description: 'AI reasoning & web-search-enhanced forecasts',
        ...venice,
      },
      synthdata: {
        label: 'SynthData',
        description: 'ML ensemble price forecasts (200+ models)',
        ...synth,
      },
      database: {
        label: 'Database',
        description: 'Forecasts, signals, track record storage',
        ...db,
      },
    },
  };

  const httpStatus = allUp ? 200 : 200; // always 200 — degraded is still informative
  return Response.json(response, {
    status: httpStatus,
    headers: {
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Access-Control-Allow-Origin': '*',
    },
  });
}
