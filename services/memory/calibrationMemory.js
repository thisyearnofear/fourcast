/**
 * The read that makes a stored memory load-bearing.
 *
 * A memory on Sui only earns its place if it can change what the product does.
 * Here it is the same thing the calibration curve does for a live deployment:
 * per-bucket hit rates feeding Kelly shrinkage. The precedence is `db → memory`,
 * deliberately in that order — our own scored ledger is fresher than any
 * snapshot of it, so memory is the fallback that lets a cold deployment size on
 * evidence instead of falling back to an uncalibrated 1.0x.
 *
 * The fail-closed rules are the point of this file:
 *   - rates are read back WITH their sample sizes and put through the identical
 *     floor the DB path uses, so a stored memory can never outrank the live
 *     ledger on thinner evidence;
 *   - a rung whose `bucket_n` is missing is refused outright, even if `buckets`
 *     parses — a rate with no visible `n` is exactly the claim we do not size on;
 *   - anything unparseable, unreachable, or unconfigured returns null. A caller
 *     must be able to keep deciding when the memory service is down.
 */

import { fieldBuckets, fieldValue, sha256Hex } from './memoryFormat.js';
import { listKindMemories } from './memoryStore.js';
import { minBucketCount, readCalibrationForSizing } from '../domain/decision/bucketCalibration.js';

/**
 * Newest window rung that carries evidence thick enough to size on.
 *
 * @returns {{buckets: Object<string, number>, counts: Object<string, number>,
 *   droppedBuckets: Array<{bucket: string, count: number|null}>, blobId: string,
 *   textHash: string, asOf: string|null, version: number, key: string,
 *   sampleSize: number, source: 'walrus-memory'} | null}
 */
export async function getBucketCalibrationFromMemory({ minCount = minBucketCount(), client = null } = {}) {
  try {
    // The window namespace holds one rung per calendar month, and month keys
    // sort chronologically as strings, so "newest usable" is a sort, not a guess.
    const rungs = await listKindMemories('window', { limit: 40, client });
    for (const rung of rungs) {
      const rates = fieldBuckets(rung.fields, 'buckets');
      if (!rates) continue;
      const rawCounts = fieldBuckets(rung.fields, 'bucket_n');
      if (!rawCounts) continue;

      const counts = Object.fromEntries(
        Object.entries(rawCounts).map(([bucket, count]) => [String(bucket).toUpperCase(), count])
      );
      const buckets = {};
      const dropped = [];
      for (const [bucket, rate] of Object.entries(rates)) {
        const count = Number(counts[bucket]);
        if (!Number.isFinite(count) || count < minCount) {
          dropped.push({ bucket, count: Number.isFinite(count) ? count : null });
          continue;
        }
        buckets[bucket] = rate;
      }
      if (Object.keys(buckets).length === 0) continue;

      return {
        buckets,
        counts,
        droppedBuckets: dropped,
        sampleSize: Object.values(counts).reduce((sum, c) => sum + (Number.isFinite(c) ? c : 0), 0),
        blobId: rung.blobId || null,
        textHash: sha256Hex(rung.text),
        // The rung's own as_of — the moment the ledger said this. Re-stamping it
        // with "now" would turn a historical claim into a fresh one.
        asOf: fieldValue(rung.fields, 'as_of') || rung.asOf || null,
        version: rung.version,
        key: rung.key,
        source: 'walrus-memory',
      };
    }
    return null;
  } catch (error) {
    console.error('[memory] calibration read failed:', error.message);
    return null;
  }
}

/**
 * `db → memory` precedence in one place, so the loop and the worker cannot
 * drift into two different answers for the same decision.
 */
export async function readSizingCalibration({ operatorId = null, minCount, allowMemory = true } = {}) {
  const fromDb = await readCalibrationForSizing({ operatorId, minCount });
  if (fromDb.bucketCalibration || !allowMemory) {
    return { ...fromDb, calibrationSource: 'db', memory: null };
  }

  const memory = await getBucketCalibrationFromMemory({ minCount });
  if (!memory) {
    return { ...fromDb, calibrationSource: 'db', memory: null };
  }

  return {
    bucketCalibration: memory.buckets,
    sampleSize: memory.sampleSize,
    schema: 'calibration/memory-window/v1',
    droppedBuckets: memory.droppedBuckets,
    error: fromDb.error || null,
    calibrationSource: 'walrus-memory',
    memory,
  };
}
