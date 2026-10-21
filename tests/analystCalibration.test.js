/**
 * Per-analyst credibility — what the Total Recall memory is allowed to say.
 *
 * The honesty rule: a voice counts as right or wrong only when a verdict was
 * recorded. reputationService.determineSignalOutcome writes the *market* result
 * ('YES'/'NO') into signals.outcome, which says nothing about whether the
 * author's pick won, so those rows must be reported, not scored.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import crypto from 'crypto';
import {
  migrationsReady,
  saveSignal,
  execute,
  getAnalystCalibration,
} from '@/services/db.js';

const ANALYST = `0x${crypto.randomUUID().replace(/-/g, '')}`;
const THIN_ANALYST = `0x${crypto.randomUUID().replace(/-/g, '')}`;

async function seedSignal(id, confidence, outcome) {
  await saveSignal({
    id,
    event_id: `evt-${id}`,
    market_title: `Analyst fixture ${id}`,
    venue: 'polymarket',
    event_time: Math.floor(Date.now() / 1000),
    market_snapshot_hash: `sha256:${id}`,
    confidence,
    author_address: ANALYST,
    tx_hash: `0xtx-${id}`,
    timestamp: Math.floor(Date.now() / 1000),
  });
  if (outcome) {
    await execute(`UPDATE signals SET outcome = ?, resolved_at = ? WHERE id = ?`, [
      outcome,
      Math.floor(Date.now() / 1000),
      id,
    ]);
  }
}

describe('getAnalystCalibration', () => {
  beforeAll(async () => {
    await migrationsReady;
    await seedSignal('a-win-1', 'HIGH', 'WIN');
    await seedSignal('a-win-2', 'MEDIUM', 'WIN');
    await seedSignal('a-win-3', 'HIGH', 'WIN');
    await seedSignal('a-loss-1', 'HIGH', 'LOSS');
    await seedSignal('a-loss-2', 'LOW', 'LOSS');
    await seedSignal('a-market-yes', 'HIGH', 'YES');
    await seedSignal('a-pending', 'HIGH', null);

    await saveSignal({
      id: 'thin-1',
      event_id: 'evt-thin-1',
      market_title: 'Thin analyst fixture',
      venue: 'kalshi',
      confidence: 'HIGH',
      author_address: THIN_ANALYST,
      timestamp: Math.floor(Date.now() / 1000),
    });
    await execute(`UPDATE signals SET outcome = 'WIN', resolved_at = ? WHERE id = ?`, [
      Math.floor(Date.now() / 1000),
      'thin-1',
    ]);
  });

  it('scores verdicts and refuses to invent a hit rate from market results', async () => {
    const result = await getAnalystCalibration(ANALYST);
    expect(result.success).toBe(true);
    expect(result.ok).toBe(true);
    expect(result.n).toBe(5);
    expect(result.wins).toBe(3);
    expect(result.losses).toBe(2);
    expect(result.hitRate).toBeCloseTo(0.6, 5);
    expect(result.unmappedOutcomes).toEqual([{ outcome: 'YES', count: 1 }]);
    expect(result.buckets.HIGH).toEqual({ count: 3, hitRate: 2 / 3 });
    expect(result.buckets.MEDIUM).toEqual({ count: 1, hitRate: 1 });
    expect(result.buckets.LOW).toEqual({ count: 1, hitRate: 0 });
    expect(result.source).toBe('db:signals+agent_forecasts');
  });

  it('carries a traceable receipt with the number', async () => {
    const result = await getAnalystCalibration(ANALYST);
    expect(result.latestTrace.receipt).toMatch(/^sha256:/);
    expect(result.latestTrace.txHash).toMatch(/^0xtx-/);
    expect(result.latestTrace.resolvedAt).toBeGreaterThan(0);
  });

  it('returns no forecast Brier evidence when none exists for that id', async () => {
    const result = await getAnalystCalibration(ANALYST);
    expect(result.forecastEvidence.count).toBe(0);
    expect(result.forecastEvidence.avgBrier).toBeNull();
  });

  it('refuses a credibility figure below the sample floor', async () => {
    const result = await getAnalystCalibration(THIN_ANALYST, { minSamples: 3 });
    expect(result.ok).toBe(false);
    expect(result.reason).toBe('insufficient_sample');
    expect(result.n).toBe(1);
  });

  it('does not match on address case or whitespace', async () => {
    const upper = await getAnalystCalibration(`  ${ANALYST.toUpperCase()}  `);
    expect(upper.n).toBe(5);
  });

  it('rejects a missing address instead of aggregating everyone', async () => {
    expect(await getAnalystCalibration('')).toMatchObject({ ok: false, reason: 'missing_address' });
  });
});
