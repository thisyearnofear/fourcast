/**
 * What the ledger will actually allow us to remember.
 *
 * These are the honesty rules from the plan, made executable: a floor below
 * which a credibility claim is refused rather than written, per-analyst metrics
 * built from verdicts only, a signal memory that cannot exist without a
 * recorded 0/1 outcome, and a version that is only bumped when a number moved.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import crypto from 'crypto';
import {
  migrationsReady,
  saveSignal,
  saveForecast,
  resolveForecast,
  execute,
  listAnalystAddresses,
  listResolvedForecasts,
} from '@/services/db.js';
import {
  buildAnalystMemory,
  buildSignalMemory,
  buildSourceMemory,
  buildWindowMemory,
  collectMemoryCandidates,
  memoriesForResolution,
} from '@/services/memory/ledgerMemory.js';
import { factsDigest } from '@/services/memory/memoryStore.js';

const ANALYST = `0x${crypto.randomUUID().replace(/-/g, '')}`;
const TIED_ANALYST = `0x${crypto.randomUUID().replace(/-/g, '')}`;
const OPERATOR = `op-${crypto.randomUUID().slice(0, 8)}`;
const now = Math.floor(Date.now() / 1000);

// Seed order is newest-first, so "the latest verdict" is a fact under test
// rather than whatever the engine felt like returning.
let seedClock = now;

async function seedVerdict(id, confidence, outcome, { author = ANALYST, resolvedAt = null } = {}) {
  const at = resolvedAt === null ? (seedClock -= 60) : resolvedAt;
  await saveSignal({
    id,
    event_id: `evt-${id}`,
    market_title: `Ledger memory fixture ${id}`,
    venue: 'polymarket',
    event_time: now,
    market_snapshot_hash: `sha256:${id}`,
    confidence,
    author_address: author,
    tx_hash: `0xtx-${id}`,
    timestamp: now,
  });
  await execute(`UPDATE signals SET outcome = ?, resolved_at = ? WHERE id = ?`, [outcome, at, id]);
}

function forecastFixture(marketId, aiProbability, confidence) {
  return {
    id: crypto.randomUUID(),
    marketID: marketId,
    title: `Ledger memory forecast ${marketId}`,
    platform: 'polymarket',
    aiProbability,
    marketOdds: 0.6,
    edge: aiProbability - 0.6,
    confidence,
    reasoning: 'fixture',
    keyFactors: [],
    timestamp: now,
    operatorId: OPERATOR,
  };
}

describe('memory candidates from the real ledger', () => {
  beforeAll(async () => {
    await migrationsReady;
    // 22 called verdicts, 14 right: clears the default floor of 20 so the
    // analyst memory exists at all.
    for (let i = 0; i < 14; i += 1) await seedVerdict(`mem-win-${i}`, i < 8 ? 'HIGH' : 'MEDIUM', 'WIN');
    for (let i = 0; i < 8; i += 1) await seedVerdict(`mem-loss-${i}`, i < 4 ? 'HIGH' : 'LOW', 'LOSS');
    // A market result is not a verdict — must not be scored as either.
    await seedVerdict('mem-market-yes', 'HIGH', 'YES');

    // Three verdicts resolving at the same instant, seeded out of id order, to
    // pin the tie-break: an unordered "latest" would change the cited receipt
    // between two reads of an unchanged ledger and mint a phantom version.
    for (const id of ['tie-c', 'tie-a', 'tie-b']) {
      await seedVerdict(id, 'MEDIUM', 'WIN', { author: TIED_ANALYST, resolvedAt: now - 5000 });
    }

    // 20 scored forecasts on one venue, so source/window aggregates clear the
    // same floor and a signal memory has a real outcome to cite.
    for (let i = 0; i < 12; i += 1) {
      const id = `mem-fc-win-${i}`;
      await saveForecast(forecastFixture(id, 0.85, 'HIGH'));
      await resolveForecast(id, 1);
    }
    for (let i = 0; i < 8; i += 1) {
      const id = `mem-fc-loss-${i}`;
      await saveForecast(forecastFixture(id, 0.55, 'MEDIUM'));
      await resolveForecast(id, 0);
    }
  });

  it('rosters the addresses that hold verdicts, newest first', async () => {
    const roster = await listAnalystAddresses({ minVerdicts: 1 });
    expect(roster.success).toBe(true);
    const entry = roster.addresses.find((a) => a.address === ANALYST);
    expect(entry.verdicts).toBe(22);
    expect(entry.wins).toBe(14);
  });

  it('builds the analyst memory from verdicts, with NA where evidence is absent', async () => {
    const built = await buildAnalystMemory(ANALYST, { minSamples: 20 });
    expect(built.skip).toBeUndefined();
    expect(built.kind).toBe('analyst');
    expect(built.key).toBe(ANALYST);
    expect(built.fields.n).toBe('22');
    expect(built.fields.hit).toBe((14 / 22).toFixed(4));
    // This analyst called verdicts but has no scored forecasts of their own:
    // the memory says NA, it does not borrow the venue's Brier score.
    expect(built.fields.brier).toBe('NA');
    expect(built.fields.logloss).toBe('NA');
    expect(built.fields.source).toBe('db:signals+agent_forecasts');
    expect(built.fields.unmapped).toBe('YES:1');
    expect(built.triggerReceipt).toBe('sha256:mem-win-0');
    expect(built.note).toContain('22 called verdicts');
  });

  it('cites the same receipt twice for a ledger it has not changed', async () => {
    const first = await buildAnalystMemory(TIED_ANALYST, { minSamples: 3 });
    const second = await buildAnalystMemory(TIED_ANALYST, { minSamples: 3 });
    expect(first.skip).toBeUndefined();
    // All three verdicts share a resolved_at, so without a stated tie-break the
    // "latest" would be whichever row the engine happened to return first.
    expect(first.triggerReceipt).toBe('sha256:tie-a');
    expect(second.triggerReceipt).toBe(first.triggerReceipt);
    expect(factsDigest(first)).toBe(factsDigest(second));
  });

  it('refuses an analyst memory below the sample floor instead of writing a thin claim', async () => {
    const built = await buildAnalystMemory(ANALYST, { minSamples: 23 });
    expect(built.skip).toMatch(/below FOURCAST_MEMORY_MIN_SAMPLES=23/);
    expect(built.n).toBe(22);
  });

  it('refuses below its own floor of 3 verdicts, before the memory floor is reached', async () => {
    const nobody = await buildAnalystMemory(`0x${crypto.randomUUID().replace(/-/g, '')}`, { minSamples: 20 });
    expect(nobody.skip).toMatch(/below its own floor of 3/);
  });

  it('builds a source memory with the venue it scored and the time it last resolved', async () => {
    const calibrationRows = await collectMemoryCandidates({ kinds: ['source'], minSamples: 20 });
    const row = calibrationRows.candidates.find((c) => c.kind === 'source');
    expect(row.fields.n).toBe('20');
    expect(row.fields.brier).not.toBe('NA');
    expect(row.fields.logloss).not.toBe('NA');
    expect(row.key).toBe('polymarket');
    expect(Number.isFinite(Date.parse(row.asOf))).toBe(true);

    expect(buildSourceMemory({ source: 'kalshi', count: 4, hitRate: 1, avgBrier: 0.1 }).skip)
      .toMatch(/below FOURCAST_MEMORY_MIN_SAMPLES=20/);
  });

  it('will not turn a non-binary outcome into a signal memory', async () => {
    expect(buildSignalMemory({ id: 'x', actual_outcome: 0.5 }).skip).toMatch(/not a recorded 0\/1/);
    expect(buildSignalMemory({ id: 'y', actual_outcome: null }).skip).toMatch(/not a recorded 0\/1/);
  });

  it('records one resolved forecast as an observation, no sample floor attached', async () => {
    const { forecasts } = await listResolvedForecasts({ operatorId: OPERATOR, limit: 5 });
    expect(forecasts.length).toBe(5);
    // The window's order is a tie-break, not a fact about the ledger: pick the
    // row by what it says rather than by where it landed, and assert separately
    // that two reads of an unchanged ledger agree on that order.
    const again = await listResolvedForecasts({ operatorId: OPERATOR, limit: 5 });
    expect(again.forecasts.map((f) => f.id)).toEqual(forecasts.map((f) => f.id));

    const high = forecasts.find((f) => f.confidence_bucket === 'HIGH');
    expect(high).toBeTruthy();
    const built = buildSignalMemory(high, { triggerReceipt: 'c'.repeat(64) });
    expect(built.kind).toBe('signal');
    expect(built.fields.bucket).toBe('HIGH');
    expect(built.fields.p).toBe('0.8500');
    expect(['0', '1']).toContain(built.fields.outcome);
    expect(built.fields.brier).not.toBe('NA');
    expect(built.triggerReceipt).toBe('c'.repeat(64));
  });

  it('gives every window memory its own month and sample size', async () => {
    const { candidates } = await collectMemoryCandidates({ kinds: ['window'], minSamples: 20 });
    const month = candidates.find((c) => c.kind === 'window');
    expect(month.key).toMatch(/^\d{4}-\d{2}$/);
    expect(month.fields.n).toBe('20');
    expect(month.note).toContain('one rung of the ladder');
  });

  it('collects all four kinds and reports the refusals rather than hiding them', async () => {
    const { candidates, skipped, summary } = await collectMemoryCandidates({ minSamples: 20 });
    const kinds = new Set(candidates.map((c) => c.kind));
    expect([...kinds].sort()).toEqual(['analyst', 'signal', 'source', 'window']);
    expect(summary.totalResolved).toBe(20);
    for (const refusal of skipped) expect(typeof refusal.skip).toBe('string');
  });

  it('writes the observation plus the month it belongs to when a market resolves', async () => {
    const marketId = `mem-trigger-${crypto.randomUUID().slice(0, 6)}`;
    const saved = await saveForecast(forecastFixture(marketId, 0.78, 'HIGH'));
    expect(saved.success).toBe(true);
    await resolveForecast(marketId, 1);
    const { forecasts } = await listResolvedForecasts({ marketId });
    expect(forecasts.length).toBe(1);
    const row = forecasts[0];

    const { candidates, skipped } = await memoriesForResolution(row, { triggerReceipt: 'd'.repeat(64) });
    expect(candidates.map((c) => c.kind)).toEqual(['signal', 'window']);
    expect(skipped).toEqual([]);
    // The window rung changed, the signal rung is a fixed fact.
    expect(candidates[1].fields.n).toBe('21');
  });

  it('treats identical facts as the same memory and moved facts as a new rung', async () => {
    const base = { kind: 'analyst', key: ANALYST, fields: { n: '22', hit: '0.6364' } };
    expect(factsDigest(base)).toBe(factsDigest({ ...base }));
    expect(factsDigest(base)).not.toBe(factsDigest({ kind: 'analyst', key: ANALYST, fields: { n: '23', hit: '0.6364' } }));
    // `as_of` is provenance, not a fact: a re-read of the same numbers must not
    // look like learning.
    expect(factsDigest(base)).toBe(factsDigest({ ...base, asOf: '2020-01-01T00:00:00Z' }));
  });

  it('excludes forecasts that were never given a real outcome', async () => {
    const marketId = `mem-unresolved-${crypto.randomUUID().slice(0, 6)}`;
    await saveForecast(forecastFixture(marketId, 0.7, 'HIGH'));
    const { forecasts } = await listResolvedForecasts({ marketId });
    expect(forecasts).toEqual([]);
  });
});
