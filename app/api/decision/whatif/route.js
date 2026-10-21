import { listResolvedForecasts } from '@/services/db';
import { calculateKellySizing } from '@/utils/kellySizing';
import { minBucketCount, readCalibrationForSizing } from '@/services/domain/decision/bucketCalibration';
import { getBucketCalibrationFromMemory } from '@/services/memory/calibrationMemory';
import { bucketField, fieldBuckets } from '@/services/memory/memoryFormat.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/decision/whatif
 *
 * The one question the memory layer has to answer to be worth anything:
 * "would this decision have been sized differently?" Takes a real decision and
 * runs the SAME Kelly function the agent uses, under each calibration source we
 * have, side by side. No new math lives here — if this route and the worker ever
 * disagreed, the demo would be a simulation of a simulation.
 *
 * Which decision:
 *   default            newest settled forecast on this host (real, scored)
 *   ?probability=&odds=&bucket=   an explicit what-if, labelled input:'query'
 *
 * Which evidence:
 *   ledger             our own scored curve (always computed, no network)
 *   memory             buckets passed in as `buckets=HIGH:0.79/LOW:0.41`
 *                      (+ `counts=` so the same evidence floor applies), OR
 *                      `?memory=1` to read the newest usable window rung from the
 *                      relayer. A page load does not get to spend recall()
 *                      silently, so the client-supplied form is the default and
 *                      the relayer read is opt-in.
 *
 * Response:
 * {
 *   success: true, schema: 'whatif/v1',
 *   input: { origin, forecastId, marketId, question, probability, odds, bucket,
 *            riskTolerance, minEdge, settled: {outcome, brierScore, logLoss,
 *            sizedAs} | null },
 *   scenarios: [ { key, label, calibrationSource, buckets, sampleSize, counts,
 *                  droppedBuckets, sizePct, kellyPct, calibrationFactor,
 *                  direction, actionable, deltaVsUncalibrated } ],
 *   applied: { key, reason },   // what the agent would use today (db → memory)
 *   notes: [ … ]
 * }
 *
 * Refusal shape: with no settled forecast and no query inputs, `input` is null
 * and the scenarios are empty. That is the honest answer — inventing a decision
 * to make the panel look alive is the one thing this route must not do.
 */

const BUCKETS = ['HIGH', 'MEDIUM', 'LOW'];

function toNumber(raw) {
  // `Number(null)` is 0 — the same absent-becomes-a-zero trap that made the
  // calibration curve plot every bucket at hit rate 0. An unset param, an empty
  // string and a NULL column all mean "not supplied", never "zero".
  if (raw === null || raw === undefined || raw === '') return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

function bucketName(raw) {
  const value = String(raw || '').trim().toUpperCase();
  if (value === 'MED') return 'MEDIUM';
  return BUCKETS.includes(value) ? value : null;
}

/** `HIGH:0.79/MEDIUM:0.58/LOW:0.410` → `{HIGH:0.79,…}` using the memory parser. */
function parseBucketString(raw) {
  if (!raw) return null;
  return fieldBuckets({ buckets: String(raw).replace(/%2F/gi, '/') }, 'buckets');
}

/**
 * Counts travel with rates or the rung does not earn a place in the comparison.
 * Same rule as `calibrationMemory`: a stored rate with no visible `n` is a claim,
 * not evidence, so it is dropped through the identical `minBucketCount()` floor.
 */
function applyEvidenceFloor(rates, counts, minCount) {
  const kept = {};
  const dropped = [];
  for (const [bucket, rate] of Object.entries(rates)) {
    const count = Number(counts?.[bucket]);
    if (!Number.isFinite(count) || count < minCount) {
      dropped.push({ bucket, count: Number.isFinite(count) ? count : null });
      continue;
    }
    kept[bucket] = rate;
  }
  return {
    buckets: Object.keys(kept).length ? kept : null,
    droppedBuckets: dropped,
    sampleSize: Object.values(counts || {}).reduce((sum, c) => sum + (Number.isFinite(Number(c)) ? Number(c) : 0), 0),
  };
}

function scenario(key, label, calibrationSource, { buckets = null, sampleSize = 0, counts = null, droppedBuckets = [], provenance = null, blobId = null }, decision) {
  const sized = calculateKellySizing(
    decision.probability,
    decision.odds,
    decision.riskTolerance,
    decision.bucket,
    decision.source,
    decision.minEdge,
    buckets
  );
  return {
    key,
    label,
    calibrationSource,
    buckets: buckets || null,
    bucketField: bucketField(buckets),
    sampleSize,
    counts,
    droppedBuckets,
    blobId,
    provenance,
    sizePct: sized.sizePct,
    kellyPct: sized.kellyPct,
    calibrationFactor: sized.calibrationFactor ?? null,
    direction: sized.direction,
    actionable: sized.actionable,
    edge: sized.edge,
  };
}

async function pickInput(searchParams, notes) {
  const probability = toNumber(searchParams.get('probability'));
  const odds = toNumber(searchParams.get('odds'));
  const bucket = bucketName(searchParams.get('bucket'));
  const riskTolerance = searchParams.has('riskTolerance') ? toNumber(searchParams.get('riskTolerance')) : 0.5;
  const minEdge = searchParams.has('minEdge') ? toNumber(searchParams.get('minEdge')) : 0.05;
  const sourceParam = searchParams.get('source') || 'fourcast-agent';

  if (probability != null || odds != null || bucket) {
    if (probability == null || odds == null || !bucket) {
      notes.push('Query inputs need probability, odds AND bucket together; none of them were guessed.');
      return null;
    }
    if (!(probability > 0 && probability < 1) || !(odds > 0 && odds < 1)) {
      notes.push('Probability and market odds must both sit strictly between 0 and 1 — a price of exactly 0 or 1 has no Kelly edge to size.');
      return null;
    }
    return {
      origin: 'query',
      forecastId: null,
      marketId: searchParams.get('marketId') || null,
      question: searchParams.get('question') || 'Ad-hoc what-if (not a stored decision)',
      probability,
      odds,
      bucket,
      riskTolerance,
      minEdge,
      source: sourceParam,
      settled: null,
    };
  }

  const listed = await listResolvedForecasts({ limit: 1 });
  if (!listed.success) {
    notes.push(`Settled forecasts unreadable: ${listed.error}`);
    return null;
  }
  const row = listed.forecasts[0];
  if (!row) {
    notes.push(
      'No settled forecast on this host yet. The what-if recomputes a decision that was actually made — pass probability/odds/bucket to size a hypothetical one instead.'
    );
    return null;
  }
  return {
    origin: 'forecast',
    forecastId: row.id,
    marketId: row.market_id,
    question: row.market_title || row.market_id,
    probability: toNumber(row.ai_probability),
    odds: toNumber(row.market_odds),
    bucket: bucketName(row.confidence_bucket || row.confidence) || 'LOW',
    riskTolerance: 0.5,
    minEdge: 0.05,
    source: row.source || 'fourcast-agent',
    settled: {
      outcome: toNumber(row.actual_outcome),
      brierScore: toNumber(row.brier_score),
      logLoss: toNumber(row.log_loss),
      // What the agent actually committed at the time, so the comparison is
      // against a real number and not against an imagined baseline.
      sizedAs: toNumber(row.size_pct),
      kellyAs: toNumber(row.kelly_pct),
      resolvedAt: toNumber(row.resolution_time),
    },
  };
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const notes = [];

  const decision = await pickInput(searchParams, notes);
  if (!decision) {
    return Response.json({ success: true, schema: 'whatif/v1', input: null, scenarios: [], applied: null, notes });
  }

  const minCount = minBucketCount();
  const scenarios = [];

  // 1. The baseline the agent ran on before calibration could fire at all.
  scenarios.push(
    scenario('uncalibrated', 'No calibration', 'none', {}, decision)
  );

  // 2. Our own scored curve — always available, never a network call.
  const ledger = await readCalibrationForSizing({ minCount });
  scenarios.push(
    scenario('ledger', 'Scored ledger (db)', 'db', {
      buckets: ledger.bucketCalibration,
      sampleSize: ledger.sampleSize,
      counts: null,
      droppedBuckets: ledger.droppedBuckets || [],
    }, decision)
  );

  // 3. The stored rung — client-supplied numbers, or an explicit relayer read.
  let memory = null;
  const suppliedRates = parseBucketString(searchParams.get('buckets'));
  if (suppliedRates) {
    const suppliedCounts = parseBucketString(searchParams.get('counts'));
    const floored = applyEvidenceFloor(
      suppliedRates,
      suppliedCounts && Object.fromEntries(Object.entries(suppliedCounts).map(([k, v]) => [k, Number(v)])),
      minCount
    );
    memory = {
      buckets: floored.buckets,
      droppedBuckets: floored.droppedBuckets,
      sampleSize: floored.sampleSize,
      counts: suppliedCounts,
      blobId: searchParams.get('blob') || null,
      version: toNumber(searchParams.get('version')),
      asOf: searchParams.get('asOf') || null,
      provenance: 'supplied-by-caller',
    };
    if (!floored.buckets) {
      notes.push('Every supplied bucket fell under the evidence floor, so the memory scenario sizes at 1.0x — thin evidence is refused, not rounded up.');
    }
  } else if (searchParams.get('memory') === '1' || searchParams.get('memory') === 'true') {
    const read = await getBucketCalibrationFromMemory({ minCount });
    if (read) {
      memory = { ...read, provenance: 'relayer-recall' };
    } else {
      notes.push('Relayer recall returned no usable window rung (memory disabled, unreachable, or every bucket under the floor).');
    }
  } else {
    notes.push('Memory scenario not computed: pass buckets= (from the ladder the page already read) or memory=1 to spend a recall().');
  }

  if (memory) {
    scenarios.push(
      scenario('memory', 'Walrus Memory rung', 'walrus-memory', {
        buckets: memory.buckets,
        sampleSize: memory.sampleSize,
        counts: memory.counts,
        droppedBuckets: memory.droppedBuckets || [],
        blobId: memory.blobId || null,
        provenance: {
          key: memory.key || null,
          version: memory.version ?? null,
          asOf: memory.asOf || null,
          textHash: memory.textHash || null,
          // `supplied-by-caller` means these are the numbers the page read off
          // the ladder a moment ago; `relayer-recall` means this route fetched
          // them. Same arithmetic either way, different trust path.
          how: memory.provenance,
        },
      }, decision)
    );
  }

  // Delta against the uncalibrated baseline, in percentage points of bankroll.
  const baseline = scenarios[0];
  for (const s of scenarios) {
    s.deltaVsUncalibrated = Math.round((s.sizePct - baseline.sizePct) * 10000) / 10000;
  }

  const hasLedgerRung = Boolean(ledger.bucketCalibration);
  const applied = {
    key: hasLedgerRung ? 'ledger' : memory?.buckets ? 'memory' : 'uncalibrated',
    reason: hasLedgerRung
      ? 'The scored ledger outranks any stored snapshot: it is fresher and it is ours.'
      : memory?.buckets
        ? 'No usable bucket on the live curve, so the memory-derived rung sizes this decision — the cold-deployment path.'
        : 'No usable calibration evidence anywhere, so sizing runs unshrunk and says so.',
  };

  return Response.json({
    success: true,
    schema: 'whatif/v1',
    minBucketCount: minCount,
    input: decision,
    scenarios,
    applied,
    notes,
  });
}
