#!/usr/bin/env node
/**
 * Produce and honestly resolve forecasts for the track record.
 *
 * Two modes:
 *   --forecast   run the agent loop over live markets and save LLM forecasts
 *   --resolve    sweep unresolved forecasts, check the platform's settlement
 *                state, and record outcomes (+ trigger the memory pipeline)
 *
 * Usage:
 *   node scripts/forecast-and-resolve.mjs --forecast [--max-markets 6] [--min-volume 10000] [--max-days 10]
 *   node scripts/forecast-and-resolve.mjs --resolve [--dry-run]
 *   node scripts/forecast-and-resolve.mjs --forecast --local   # local sqlite instead of Turso
 *
 * Environment: loaded the same way as the memory writer — the env file named
 * by FOURCAST_AGENT_ENV_FILE, then .env. The script REFUSES to run unless
 * TURSO_CONNECTION_URL is set or --local is passed, so it can never silently
 * write to a stray local sqlite on a server.
 *
 * Forecast mode requires VENICE_API_KEY. It never trades: autopilot is never
 * enabled and any POLYMARKET_PRIVATE_KEY in the environment is deleted up
 * front.
 */

import dotenv from 'dotenv';

dotenv.config({ path: process.env.FOURCAST_AGENT_ENV_FILE || '.env.agent' });
dotenv.config();

const args = process.argv.slice(2);
const has = (flag) => args.includes(flag);
const val = (name) => {
  const inline = args.find((a) => a.startsWith(`--${name}=`));
  if (inline) return inline.slice(name.length + 3);
  const idx = args.indexOf(`--${name}`);
  return idx >= 0 ? args[idx + 1] : null;
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ── Outcome derivation (pure — unit-tested without network) ────────────

const parseMaybeJson = (v) => {
  if (Array.isArray(v)) return v;
  if (typeof v !== 'string') return null;
  try {
    const parsed = JSON.parse(v);
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
};

/**
 * Strict settlement rules — a forecast resolves only on an unambiguous
 * terminal state. Anything else is { skip: reason } and stays unresolved.
 *
 * @returns {{ outcome: 0|1 } | { skip: string }}
 */
export function deriveOutcome(platform, rawMarket) {
  if (platform === 'polymarket') {
    if (!rawMarket || typeof rawMarket !== 'object') return { skip: 'no market payload' };
    if (rawMarket.closed !== true) return { skip: 'not closed' };
    if ('umaResolutionStatus' in rawMarket && rawMarket.umaResolutionStatus !== 'resolved') {
      return { skip: `umaResolutionStatus=${rawMarket.umaResolutionStatus}` };
    }
    const outcomes = parseMaybeJson(rawMarket.outcomes);
    const prices = parseMaybeJson(rawMarket.outcomePrices)?.map(Number);
    if (!outcomes || outcomes.length !== 2 || outcomes[0] !== 'Yes' || outcomes[1] !== 'No') {
      return { skip: 'non-Yes/No outcomes' };
    }
    if (!prices || prices.length !== 2) return { skip: 'unparseable outcomePrices' };
    if (prices[0] === 1 && prices[1] === 0) return { outcome: 1 };
    if (prices[0] === 0 && prices[1] === 1) return { outcome: 0 };
    return { skip: `ambiguous outcomePrices ${JSON.stringify(prices)}` };
  }

  if (platform === 'kalshi') {
    const market = rawMarket?.market || rawMarket;
    if (!market || typeof market !== 'object') return { skip: 'no market payload' };
    if (!['settled', 'finalized'].includes(market.status)) {
      return { skip: `status=${market.status}` };
    }
    if (market.result === 'yes') return { outcome: 1 };
    if (market.result === 'no') return { outcome: 0 };
    return { skip: `result=${JSON.stringify(market.result)}` };
  }

  return { skip: `unknown platform ${JSON.stringify(platform)}` };
}

// ── Platform fetchers ──────────────────────────────────────────────────

const FETCH_TIMEOUT_MS = 15000;

async function fetchJson(url, fetchImpl = fetch) {
  const res = await fetchImpl(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
  if (!res.ok) throw new Error(`HTTP ${res.status} from ${url}`);
  return res.json();
}

export function marketApiUrl(platform, marketId) {
  if (platform === 'polymarket') return `https://gamma-api.polymarket.com/markets/${marketId}`;
  if (platform === 'kalshi') {
    const base = process.env.KALSHI_BASE_URL || 'https://api.elections.kalshi.com/trade-api/v2';
    return `${base}/markets/${marketId}`;
  }
  return null;
}

// ── Resolve sweep ──────────────────────────────────────────────────────

/**
 * Sweep unresolved forecasts and settle the ones whose markets are final.
 * Dependencies are injectable so tests can run it with a local DB and a
 * mocked fetch; production callers use the real services.
 */
export async function sweepResolve({
  dryRun = false,
  fetchImpl = fetch,
  listUnresolved,
  resolve,
  remember,
  delayMs = 300,
  log = console.log,
} = {}) {
  const rows = await listUnresolved();
  log(`unresolved forecasts: ${rows.length}`);

  const byMarket = new Map();
  for (const row of rows) {
    const key = `${row.platform}:${row.market_id}`;
    if (!byMarket.has(key)) byMarket.set(key, { platform: row.platform, market_id: row.market_id, rows: [] });
    byMarket.get(key).rows.push(row);
  }
  log(`distinct markets to check: ${byMarket.size}`);

  let resolved = 0;
  let skipped = 0;
  let failed = 0;

  for (const { platform, market_id } of byMarket.values()) {
    try {
      const url = marketApiUrl(platform, market_id);
      if (!url) {
        log(`  skip ${platform}:${market_id} — ${deriveOutcome(platform, {}).skip}`);
        skipped++;
        continue;
      }
      const raw = await fetchJson(url, fetchImpl);
      const decision = deriveOutcome(platform, raw);
      if (decision.skip) {
        log(`  open ${platform}:${market_id} — ${decision.skip}`);
        skipped++;
      } else {
        log(`  RESOLVED ${platform}:${market_id} → outcome ${decision.outcome}${dryRun ? ' (dry-run)' : ''}`);
        if (!dryRun) {
          const res = await resolve(market_id, decision.outcome);
          log(`    resolveForecast: ${JSON.stringify(res)}`);
          const mem = await remember({ marketId: market_id, triggerReceipt: null });
          log(`    rememberResolution: ${JSON.stringify(mem)}`);
        }
        resolved++;
      }
    } catch (err) {
      log(`  ERROR ${platform}:${market_id} — ${err.message}`);
      failed++;
    }
    if (delayMs > 0) await sleep(delayMs);
  }

  const summary = { markets: byMarket.size, resolved, skipped, failed, dryRun };
  log(`sweep summary: ${JSON.stringify(summary)}`);
  return summary;
}

// ── CLI ────────────────────────────────────────────────────────────────

async function main() {
  const local = has('--local');
  if (local) {
    // --local means local, even when Turso creds happen to be in the environment.
    delete process.env.TURSO_CONNECTION_URL;
    delete process.env.TURSO_AUTH_TOKEN;
  }
  const isTurso = Boolean(process.env.TURSO_CONNECTION_URL && process.env.TURSO_AUTH_TOKEN);

  if (!isTurso && !local) {
    console.error(
      'Refusing to run: TURSO_CONNECTION_URL is not set and --local was not passed.\n' +
      'This script writes to a real track record; point it at Turso via the env file\n' +
      'named by FOURCAST_AGENT_ENV_FILE, or pass --local to use local sqlite explicitly.'
    );
    process.exit(2);
  }

  const dbLabel = isTurso
    ? `Turso ${new URL(process.env.TURSO_CONNECTION_URL).host}`
    : 'local sqlite';
  console.log(`target db: ${dbLabel}`);

  if (process.env.POLYMARKET_PRIVATE_KEY) {
    delete process.env.POLYMARKET_PRIVATE_KEY;
    console.log('trading key ignored: forecast-only');
  }

  const { migrationsReady } = await import('../services/db.js');
  await migrationsReady;

  if (has('--forecast')) {
    if (!process.env.VENICE_API_KEY) {
      console.error('VENICE_API_KEY is not set — the forecast loop needs it. Set it in the env file passed via FOURCAST_AGENT_ENV_FILE.');
      process.exit(2);
    }

    const { runAgentLoop } = await import('../services/aiAgentLoop.js');
    const maxMarkets = Number(val('max-markets') || 6);
    const minVolume = Number(val('min-volume') || 10000);
    const maxDaysOut = Number(val('max-days') || 10);

    console.log(`forecast: maxMarkets=${maxMarkets} minVolume=${minVolume} maxDaysOut=${maxDaysOut}`);

    const saved = [];
    let steps = 0;
    for await (const ev of runAgentLoop({ categories: ['all'], maxMarkets, minVolume, maxDaysOut })) {
      steps++;
      const tag = ev.market?.marketID ? ` [${ev.market.marketID}]` : '';
      console.log(`  ${ev.step}/${ev.status}${tag} ${ev.message || ''}`);
      if (ev.step === 'execute') {
        console.error('FATAL: loop reached the trading step — aborting. This script is forecast-only.');
        process.exit(3);
      }
    }

    // Read back what this run persisted (saveForecast is fire-and-forget in the loop).
    const { query } = await import('../services/db.js');
    const since = Math.floor(Date.now() / 1000) - 3600;
    const rows = await query(
      `SELECT id, platform, market_id, market_title, ai_probability, market_odds
       FROM agent_forecasts WHERE timestamp > ? ORDER BY timestamp DESC`,
      [since]
    );
    saved.push(...rows);

    console.log(`\nforecasts saved this run: ${saved.length} (steps: ${steps})`);
    for (const f of saved) {
      console.log(
        `  ${f.id}\n    ${f.platform} ${f.market_id} — ${(f.market_title || '').slice(0, 80)}\n` +
        `    ai ${f.ai_probability} vs market ${f.market_odds}`
      );
    }
    return;
  }

  if (has('--resolve')) {
    const { listUnresolvedForecasts, resolveForecast } = await import('../services/db.js');
    const { rememberResolution } = await import('../services/memory/resolutionTrigger.js');
    const dryRun = has('--dry-run');
    console.log(`resolve: ${dryRun ? 'DRY RUN (writes nothing)' : 'LIVE'}`);
    await sweepResolve({
      dryRun,
      listUnresolved: listUnresolvedForecasts,
      resolve: resolveForecast,
      remember: rememberResolution,
    });
    return;
  }

  console.error('Pass --forecast or --resolve (see header).');
  process.exit(2);
}

const isMain = process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href;
if (isMain) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
