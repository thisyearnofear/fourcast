/**
 * Bucket calibration reader — the bridge between the scored ledger and Kelly.
 *
 * `getCalibrationAnalysis()` returns hit rates per confidence bucket; Kelly
 * sizing consumes a plain `{ HIGH: 0.82, MEDIUM: 0.55 }` map plus a sample size.
 * Both the agent loop and the headless worker need the same translation, so it
 * lives here rather than in two copies of the same reduce (which is how the
 * hit-rate lookup silently returned nothing).
 *
 * Buckets below MIN_BUCKET_COUNT are dropped rather than passed through. Until
 * the camelCase fix, shrinkage never fired at all, so every resolved forecast
 * count is new: a single 100%-hit HIGH bucket would otherwise multiply Kelly by
 * 1.33x on n=1. A missing bucket means "no evidence", which sizing already
 * treats as factor 1.0.
 */
import { getCalibrationAnalysis } from '../../db.js';

const DEFAULT_MIN_BUCKET_COUNT = 5;

/** Exported because the memory reader applies the identical evidence floor. */
export function minBucketCount() {
  const raw = Number(process.env.FOURCAST_CALIBRATION_MIN_BUCKET);
  return Number.isFinite(raw) && raw >= 0 ? raw : DEFAULT_MIN_BUCKET_COUNT;
}

export function bucketsToHitRates(buckets = [], { minCount = minBucketCount() } = {}) {
  const hitRates = {};
  const dropped = [];
  for (const bucket of buckets) {
    if (!bucket?.bucket) continue;
    const hitRate = Number(bucket.hitRate ?? bucket.hit_rate);
    if (!Number.isFinite(hitRate)) continue;
    const count = Number(bucket.count);
    if (Number.isFinite(count) && count < minCount) {
      dropped.push({ bucket: bucket.bucket, count });
      continue;
    }
    hitRates[bucket.bucket] = hitRate;
  }
  return {
    hitRates: Object.keys(hitRates).length > 0 ? hitRates : null,
    dropped,
  };
}

export async function readCalibrationForSizing({ operatorId = null, minCount } = {}) {
  const calibration = await getCalibrationAnalysis(operatorId);
  if (!calibration?.success) {
    return {
      bucketCalibration: null,
      sampleSize: 0,
      schema: null,
      droppedBuckets: [],
      error: calibration?.error || 'unavailable',
    };
  }
  const total = Number(calibration.summary?.totalResolved ?? calibration.summary?.total_resolved);
  const { hitRates, dropped } = bucketsToHitRates(calibration.buckets, {
    minCount: minCount ?? minBucketCount(),
  });
  return {
    bucketCalibration: hitRates,
    sampleSize: Number.isFinite(total) ? total : 0,
    schema: calibration.schema || null,
    droppedBuckets: dropped,
  };
}
