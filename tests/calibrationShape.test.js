/**
 * Calibration shape + the shrinkage it is supposed to drive.
 *
 * Regression guard for a silent break: getCalibrationAnalysis() returned
 * snake_case SQL aliases while the curve, the agent loop and the worker all
 * read camelCase. Nothing threw — the calibration curve plotted every bucket
 * at hit rate 0 and the Kelly shrinkage never fired.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import crypto from 'crypto';
import {
  migrationsReady,
  saveForecast,
  resolveForecast,
  execute,
  query,
  getCalibrationAnalysis,
  backfillForecastLogLoss,
  computeLogLoss,
} from '@/services/db.js';
import {
  readCalibrationForSizing,
  bucketsToHitRates,
} from '@/services/domain/decision/bucketCalibration.js';
import { calculateKellySizing } from '@/utils/kellySizing.js';

const OPERATOR = `op-${crypto.randomUUID().slice(0, 8)}`;

function forecast(marketId, aiProbability, confidence) {
  return {
    id: crypto.randomUUID(),
    marketID: marketId,
    title: `Calibration fixture ${marketId}`,
    platform: 'polymarket',
    aiProbability,
    marketOdds: 0.5,
    edge: aiProbability - 0.5,
    confidence,
    reasoning: 'test fixture',
    keyFactors: [],
    timestamp: Math.floor(Date.now() / 1000),
    operatorId: OPERATOR,
  };
}

describe('getCalibrationAnalysis shape (calibration/v2)', () => {
  beforeAll(async () => {
    await migrationsReady;
    // Six HIGH-confidence calls at 0.90, three of them wrong: the bucket's
    // observed hit rate (0.5) sits far below the 0.75 nominal, which is exactly
    // the overconfidence shrinkage exists for — and n=6 clears the floor that
    // keeps a thin bucket from moving size at all.
    const highWinners = ['m-high-win-1', 'm-high-win-2', 'm-high-win-3'];
    const highLosers = ['m-high-loss-1', 'm-high-loss-2', 'm-high-loss-3'];
    for (const id of [...highWinners, ...highLosers]) {
      expect((await saveForecast(forecast(id, 0.9, 'HIGH'))).success).toBe(true);
    }
    for (const id of highWinners) {
      expect((await resolveForecast(id, 1)).success).toBe(true);
    }
    for (const id of highLosers) {
      expect((await resolveForecast(id, 0)).success).toBe(true);
    }
    expect((await saveForecast(forecast('m-medium-win-1', 0.6, 'MEDIUM'))).success).toBe(true);
    expect((await resolveForecast('m-medium-win-1', 1)).success).toBe(true);
  });

  it('exposes camelCase metrics and identical snake_case aliases', async () => {
    const result = await getCalibrationAnalysis();
    expect(result.success).toBe(true);
    expect(result.schema).toBe('calibration/v2');
    expect(result.buckets.length).toBeGreaterThan(0);

    for (const bucket of result.buckets) {
      expect(Number.isFinite(bucket.hitRate)).toBe(true);
      expect(bucket.hitRate).toBe(bucket.hit_rate);
      expect(bucket.avgBrier).toBe(bucket.avg_brier);
      expect(bucket.avgProbability).toBe(bucket.avg_probability);
      expect(Number.isFinite(bucket.avgLogLoss)).toBe(true);
      expect(bucket.avgLogLoss).toBe(bucket.avg_log_loss);
    }

    expect(result.summary.totalResolved).toBe(result.summary.total_resolved);
    expect(result.summary.minBucket).toBe(result.summary.min_bucket);
  });

  it('reports the HIGH bucket at its observed 0.5 hit rate, not 0', async () => {
    const result = await getCalibrationAnalysis();
    const high = result.buckets.find((b) => b.bucket === 'HIGH');
    expect(high).toBeTruthy();
    expect(high.count).toBe(6);
    expect(high.hitRate).toBeCloseTo(0.5, 5);
  });

  it('scopes to one operator with an AND filter, not a second WHERE', async () => {
    // The operator clause used to be appended as `WHERE operator_id = ?` onto
    // queries that already had a WHERE. SQLite rejected it, the catch turned it
    // into { success: false }, and every per-operator consumer — the track
    // record page and any memory built for one operator — read that as "no
    // calibration data" instead of "broken query".
    const scoped = await getCalibrationAnalysis(OPERATOR);
    expect(scoped.success).toBe(true);
    expect(scoped.operatorId).toBe(OPERATOR);
    expect(scoped.summary.totalResolved).toBe(7);
    expect(scoped.buckets.find((b) => b.bucket === 'HIGH').count).toBe(6);
    expect(scoped.trend).toHaveLength(1);
    expect(Number.isFinite(scoped.sourceCal[0].lastResolved)).toBe(true);

    const stranger = await getCalibrationAnalysis('operator-that-does-not-exist');
    expect(stranger.success).toBe(true);
    expect(stranger.summary.totalResolved).toBe(0);
    expect(stranger.buckets).toEqual([]);

    const sizing = await readCalibrationForSizing({ operatorId: 'operator-that-does-not-exist' });
    expect(sizing.bucketCalibration).toBeNull();
    expect(sizing.sampleSize).toBe(0);
  });

  it('feeds Kelly a map that actually shrinks an overconfident bucket', async () => {
    const { bucketCalibration, sampleSize, droppedBuckets } = await readCalibrationForSizing();
    expect(sampleSize).toBeGreaterThanOrEqual(7);
    expect(bucketCalibration).toBeTruthy();
    expect(bucketCalibration.HIGH).toBeCloseTo(0.5, 5);
    // The lone MEDIUM call is evidence of nothing; sizing must not move on it.
    expect(droppedBuckets).toContainEqual({ bucket: 'MEDIUM', count: 1 });

    // 0.7 vs 0.5: Kelly lands under the 25% position cap, so the shrink is
    // visible in sizePct. At 0.9 both sides saturate at the cap — the cap, not
    // the calibration, is what binds there.
    const uncalibrated = calculateKellySizing(0.7, 0.5, 0.5, 'HIGH', 'llm', 0.05);
    const calibrated = calculateKellySizing(0.7, 0.5, 0.5, 'HIGH', 'llm', 0.05, bucketCalibration);

    expect(calibrated.calibrationFactor).toBeDefined();
    expect(calibrated.calibrationFactor).not.toBe(1);
    expect(calibrated.calibrationFactor).toBeCloseTo(0.5 / 0.75, 3);
    expect(uncalibrated.sizePct).toBeLessThan(0.25);
    expect(calibrated.sizePct).toBeLessThan(uncalibrated.sizePct);
  });

  it('will not let a thin bucket boost size', () => {
    const thin = [{ bucket: 'HIGH', count: 1, hitRate: 1, hit_rate: 1 }];
    expect(bucketsToHitRates(thin).hitRates).toBeNull();
    expect(bucketsToHitRates(thin, { minCount: 0 }).hitRates).toEqual({ HIGH: 1 });
  });

  it('refuses to record an outcome nobody observed', async () => {
    await saveForecast(forecast('m-guard-1', 0.8, 'HIGH'));
    const result = await resolveForecast('m-guard-1', 0.5);
    expect(result.success).toBe(false);
    expect(result.resolved).toBe(0);
    expect(result.error).toMatch(/must be 1 \(won\) or 0 \(lost\)/);

    const rows = await query(
      `SELECT resolved, actual_outcome FROM agent_forecasts WHERE market_id = 'm-guard-1'`
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].resolved).toBe(0);
    expect(rows[0].actual_outcome).toBeNull();
  });

  it('derives stored log loss from the numbers already in the row', async () => {
    await saveForecast(forecast('m-backfill-1', 0.8, 'HIGH'));
    await resolveForecast('m-backfill-1', 1);
    await execute(`UPDATE agent_forecasts SET log_loss = NULL WHERE market_id = 'm-backfill-1'`);

    const preview = await backfillForecastLogLoss({ dryRun: true });
    expect(preview.dryRun).toBe(true);
    expect(preview.scanned).toBe(1);
    expect(preview.updated).toBe(0);

    const applied = await backfillForecastLogLoss();
    expect(applied.updated).toBe(1);

    const [row] = await query(
      `SELECT log_loss FROM agent_forecasts WHERE market_id = 'm-backfill-1'`
    );
    expect(row.log_loss).toBeCloseTo(computeLogLoss(0.8, 1), 12);
  });
});

describe('computeLogLoss', () => {
  it('is zero-ish for a confident correct call', () => {
    expect(computeLogLoss(1, 1)).toBeCloseTo(0, 5);
    expect(computeLogLoss(0, 0)).toBeCloseTo(0, 5);
  });

  it('stays finite for the confident-wrong calls that would be ln(0)', () => {
    expect(Number.isFinite(computeLogLoss(1, 0))).toBe(true);
    expect(computeLogLoss(0, 1)).toBeCloseTo(-Math.log(1e-6), 1);
    expect(computeLogLoss(0, 1)).toBeGreaterThan(13);
  });

  it('scores a coin flip at ln(2)', () => {
    expect(computeLogLoss(0.5, 1)).toBeCloseTo(Math.LN2, 5);
    expect(computeLogLoss(0.5, 0)).toBeCloseTo(Math.LN2, 5);
  });

  it('punishes confident-wrong harder than unsure-wrong', () => {
    expect(computeLogLoss(0.9, 0)).toBeGreaterThan(computeLogLoss(0.6, 0));
  });

  it('returns null for anything that is not a scored probability/outcome pair', () => {
    expect(computeLogLoss(null, 1)).toBeNull();
    expect(computeLogLoss(0.7, null)).toBeNull();
    expect(computeLogLoss('0.7', 'x')).toBeNull();
    expect(computeLogLoss(1.5, 1)).toBeNull();
    expect(computeLogLoss(0.7, 2)).toBeNull();
  });
});
