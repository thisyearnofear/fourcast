import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import { GET } from '@/app/api/decision/whatif/route.js';
import { execute, migrationsReady, resolveForecast, saveForecast } from '@/services/db.js';

/**
 * /api/decision/whatif — the route that has to prove the memory is load-bearing.
 *
 * Pinned here: the arithmetic is the SAME function the agent sizes with, so a
 * HIGH-confidence decision at p=0.72 / odds=0.6 is 0.15 of bankroll with no
 * evidence, 0.20 when the curve says HIGH actually hits, and 0.09 when a stored
 * rung says it hits 45%. Also pinned: nothing is invented — partial inputs are
 * refused, thin buckets are dropped rather than trusted, and the memory
 * scenario costs a relayer read only when the caller asks for one.
 */

function url(search = '') {
  return new Request(`http://localhost:3000/api/decision/whatif${search}`);
}

async function json(response) {
  expect(response.status).toBe(200);
  return response.json();
}

async function seedResolved({ id, marketId, confidence, p, odds, outcome }) {
  const saved = await saveForecast({
    id,
    marketID: marketId,
    title: `Seed ${marketId}`,
    platform: 'test',
    aiProbability: p,
    marketOdds: odds,
    edge: p - odds,
    confidence,
    source: 'fourcast-agent',
  });
  expect(saved.success).toBe(true);
  const resolved = await resolveForecast(marketId, outcome);
  expect(resolved.success).toBe(true);
  expect(resolved.resolved).toBe(1);
}

function scenarioOf(body, key) {
  return body.scenarios.find((s) => s.key === key);
}

beforeEach(async () => {
  global.fetch = vi.fn();
  await migrationsReady;
  await execute('DELETE FROM agent_forecasts', []);
  delete process.env.FOURCAST_CALIBRATION_MIN_BUCKET;
});

afterEach(() => {
  delete process.env.FOURCAST_MEMORY_ENABLED;
  delete process.env.MEMWAL_PRIVATE_KEY;
  delete process.env.MEMWAL_ACCOUNT_ID;
  delete process.env.TATUM_API_KEY;
});

describe('/api/decision/whatif', () => {
  it('sizes a query what-if against the live curve without touching the network', async () => {
    const body = await json(await GET(url('?probability=0.72&odds=0.6&bucket=HIGH')));

    expect(body.schema).toBe('whatif/v1');
    expect(body.input).toMatchObject({
      origin: 'query',
      probability: 0.72,
      odds: 0.6,
      bucket: 'HIGH',
    });
    expect(global.fetch).not.toHaveBeenCalled();

    const keys = body.scenarios.map((s) => s.key);
    expect(keys).toEqual(['uncalibrated', 'ledger']);
    // Hand-checked against utils/kellySizing: b = 2/3, kelly = 0.3,
    // HIGH multiplier 1.0 × riskTolerance 0.5 → 0.15 of bankroll.
    expect(scenarioOf(body, 'uncalibrated')).toMatchObject({
      kellyPct: 0.3,
      sizePct: 0.15,
      calibrationFactor: null,
      direction: 'BUY YES',
    });
    expect(body.applied.key).toBe('uncalibrated');
    expect(body.applied.reason).toMatch(/no usable calibration/i);
    expect(body.notes.join(' ')).toMatch(/memory scenario not computed/i);
  });

  it('shrinks or grows the position when the scored ledger has evidence for the bucket', async () => {
    for (let i = 0; i < 6; i += 1) {
      await seedResolved({
        id: `hf-${i}`,
        marketId: `mkt-hf-${i}`,
        confidence: 'HIGH',
        p: 0.8,
        odds: 0.7,
        outcome: 1,
      });
    }

    const body = await json(await GET(url('?probability=0.72&odds=0.6&bucket=HIGH')));
    const ledger = scenarioOf(body, 'ledger');

    expect(ledger.buckets).toEqual({ HIGH: 1 });
    expect(ledger.sampleSize).toBe(6);
    // observed 1.0 / nominal 0.75 = 1.333×, so the same decision sizes larger.
    expect(ledger.calibrationFactor).toBeCloseTo(1.333, 3);
    expect(ledger.sizePct).toBeCloseTo(0.2, 5);
    expect(ledger.deltaVsUncalibrated).toBeCloseTo(0.05, 5);
    expect(body.applied.key).toBe('ledger');
  });

  it('refuses a stored rate that arrived without a visible sample size', async () => {
    const body = await json(await GET(url(
      '?probability=0.72&odds=0.6&bucket=HIGH&buckets=HIGH:0.95&counts=HIGH:2&blob=blob-thin'
    )));
    const memory = scenarioOf(body, 'memory');

    expect(memory).toBeDefined();
    expect(memory.buckets).toBeNull();
    expect(memory.droppedBuckets).toEqual([{ bucket: 'HIGH', count: 2 }]);
    expect(memory.blobId).toBe('blob-thin');
    // Refused evidence cannot change the size — it falls back to the baseline.
    expect(memory.sizePct).toBe(0.15);
    expect(body.notes.join(' ')).toMatch(/under the evidence floor/i);
  });

  it('makes the position SMALLER when the memory says the bucket underperforms', async () => {
    const body = await json(await GET(url(
      '?probability=0.72&odds=0.6&bucket=HIGH'
      + '&buckets=HIGH:0.450&counts=HIGH:20&blob=blob-2026-10&version=4&asOf=2026-10'
    )));
    const memory = scenarioOf(body, 'memory');

    expect(memory.buckets).toEqual({ HIGH: 0.45 });
    expect(memory.sampleSize).toBe(20);
    expect(memory.calibrationFactor).toBeCloseTo(0.6, 5);
    expect(memory.sizePct).toBeCloseTo(0.09, 5);
    expect(memory.deltaVsUncalibrated).toBeCloseTo(-0.06, 5);
    expect(memory.provenance).toMatchObject({
      key: null,
      version: 4,
      asOf: '2026-10',
      how: 'supplied-by-caller',
    });
    // No live curve here, so the rung is what the agent would size on.
    expect(body.applied.key).toBe('memory');
    expect(body.applied.reason).toMatch(/cold-deployment/i);
  });

  it('reads the default decision from the settled ledger, score included', async () => {
    await seedResolved({ id: 'pick-1', marketId: 'mkt-pick-1', confidence: 'MEDIUM', p: 0.61, odds: 0.5, outcome: 0 });
    await execute(
      "UPDATE agent_forecasts SET size_pct = 0.04, kelly_pct = 0.08 WHERE id = 'pick-1'",
      []
    );

    const body = await json(await GET(url()));
    expect(body.input).toMatchObject({
      origin: 'forecast',
      forecastId: 'pick-1',
      marketId: 'mkt-pick-1',
      bucket: 'MEDIUM',
    });
    expect(body.input.settled).toMatchObject({ outcome: 0, sizedAs: 0.04, kellyAs: 0.08 });
    expect(body.input.settled.brierScore).toBeCloseTo(0.3721, 4);
    // log-loss came from migration 0014's column, not from a re-derivation here.
    expect(body.input.settled.logLoss).not.toBeNull();
  });

  it('answers with an empty scenario list instead of a made-up decision', async () => {
    const body = await json(await GET(url()));

    expect(body.input).toBeNull();
    expect(body.scenarios).toEqual([]);
    expect(body.notes.join(' ')).toMatch(/no settled forecast/i);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('refuses half a set of query inputs rather than guessing the rest', async () => {
    const body = await json(await GET(url('?probability=0.72&bucket=HIGH')));

    expect(body.input).toBeNull();
    expect(body.scenarios).toEqual([]);
    expect(body.notes.join(' ')).toMatch(/need probability, odds AND bucket together/i);
  });

  it('does not spend a recall unless memory=1, and reports the refusal when it does', async () => {
    const without = await json(await GET(url('?probability=0.72&odds=0.6&bucket=HIGH')));
    expect(without.scenarios.map((s) => s.key)).not.toContain('memory');

    process.env.FOURCAST_MEMORY_ENABLED = 'true';
    process.env.MEMWAL_PRIVATE_KEY = '0x'.padEnd(66, 'f');
    process.env.MEMWAL_ACCOUNT_ID = '0x'.padEnd(64, 'a');
    const asked = await json(await GET(url('?probability=0.72&odds=0.6&bucket=HIGH&memory=1')));
    expect(asked.notes.join(' ')).toMatch(/no usable window rung/i);
    expect(asked.scenarios.map((s) => s.key)).not.toContain('memory');
  });
});
