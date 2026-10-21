/**
 * Building memories from the real ledger.
 *
 * Every number here comes from `signals` or `agent_forecasts`, and every
 * candidate carries the evidence source it came from. That is the entry's
 * honesty rule: `getLeaderboard().win_rate` is an efficiency label, not a hit
 * rate, so it is not eligible to be written to mainnet as credibility.
 *
 * Sample floors, per kind, are deliberately uneven:
 *   analyst / source  >= FOURCAST_MEMORY_MIN_SAMPLES (default 20) — these are
 *                     statistical claims, and WP3 lets them move position size.
 *   window            >= 1 — a period's aggregate prints its own `n` next to the
 *                     number, the same way the calibration curve already does.
 *   signal            no floor — a resolution is an observation, not a claim.
 */

import {
  getAnalystCalibration,
  getCalibrationAnalysis,
  listAnalystAddresses,
  listResolvedForecasts,
} from '../db.js';
import { bucketField, num, sourceField, UNKNOWN } from './memoryFormat.js';

function isoFromEpoch(seconds) {
  const n = Number(seconds);
  if (!Number.isFinite(n) || n <= 0) return null;
  return new Date(n * 1000).toISOString().replace(/\.\d{3}Z$/, 'Z');
}

function nowIso() {
  return new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
}

function slug(value, fallback = UNKNOWN) {
  const raw = String(value ?? '').trim();
  if (!raw) return fallback;
  return raw.replace(/\s+/g, '_').replace(/[^\x21-\x7E]/g, '').slice(0, 120) || fallback;
}

/** Per-analyst credibility — the headline `fourcast.analyst` memory. */
export async function buildAnalystMemory(address, { minSamples = 20, asOf = null } = {}) {
  const result = await getAnalystCalibration(address, { minSamples: 3 });
  if (!result.success) {
    return { skip: `analyst ${address}: ledger read failed (${result.reason || result.error})` };
  }
  if (!result.ok) {
    return { skip: `analyst ${address}: only ${result.n} WIN/LOSS verdicts, below its own floor of 3` };
  }
  if (result.n < minSamples) {
    return {
      skip: `analyst ${address}: n=${result.n} below FOURCAST_MEMORY_MIN_SAMPLES=${minSamples}`,
      key: result.address,
      n: result.n,
    };
  }

  const evidence = result.forecastEvidence || {};
  const fields = {
    n: num(result.n, 0),
    hit: num(result.hitRate, 4),
    brier: num(evidence.avgBrier, 4),
    logloss: num(evidence.avgLogLoss, 4),
    buckets: bucketField(result.buckets),
    venues: sourceField(result.venueBreakdown),
    scored: num(evidence.count, 0),
    unmapped: sourceField(result.unmappedOutcomes),
    source: result.source,
  };
  const note =
    `Analyst ${result.address} made ${result.n} called verdicts and was right ${result.wins} times ` +
    `(hit rate ${num(result.hitRate, 3)}). ${evidence.count || 0} of them have scored forecasts ` +
    `with mean Brier ${num(evidence.avgBrier, 4)} and mean log-loss ${num(evidence.avgLogLoss, 4)}. ` +
    `Bucket hit rates: ${fields.buckets}. Venues: ${fields.venues}. ` +
    `Excluded as market results rather than verdicts: ${fields.unmapped}. Source: ${result.source}.`;

  return {
    kind: 'analyst',
    key: slug(result.address),
    fields,
    note,
    evidenceSource: result.source,
    triggerReceipt: result.latestTrace?.receipt || null,
    asOf: asOf || isoFromEpoch(result.latestTrace?.resolvedAt) || nowIso(),
    metrics: { n: result.n, hitRate: result.hitRate, avgBrier: evidence.avgBrier, avgLogLoss: evidence.avgLogLoss },
  };
}

/** Per-venue / per-source calibration from scored forecasts. */
export function buildSourceMemory(row, { minSamples = 20, asOf = null } = {}) {
  const source = slug(row?.source);
  if (!source || source === UNKNOWN) return { skip: 'source row without a platform label' };
  const count = Number(row.count) || 0;
  if (count < minSamples) {
    return { skip: `source ${source}: n=${count} below FOURCAST_MEMORY_MIN_SAMPLES=${minSamples}`, key: source, n: count };
  }
  const fields = {
    n: num(count, 0),
    hit: num(row.hitRate, 4),
    brier: num(row.avgBrier, 4),
    logloss: num(row.avgLogLoss, 4),
    source: 'db:agent_forecasts.platform',
  };
  return {
    kind: 'source',
    key: source,
    fields,
    note:
      `Forecast source ${source} resolved ${count} scored predictions with mean Brier ` +
      `${num(row.avgBrier, 4)}, mean log-loss ${num(row.avgLogLoss, 4)} and a hit rate of ` +
      `${num(row.hitRate, 3)}. Source: ${fields.source}.`,
    evidenceSource: 'db:agent_forecasts.platform',
    triggerReceipt: null,
    // As-of is the newest resolution we are summarising, not the moment we ran
    // the script — otherwise every run would look like fresh evidence.
    asOf: asOf || isoFromEpoch(row.lastResolved) || nowIso(),
    metrics: { n: count, hitRate: row.hitRate, avgBrier: row.avgBrier, avgLogLoss: row.avgLogLoss },
  };
}

/** One resolved forecast — the observation itself, versioned once. */
export function buildSignalMemory(forecast, { triggerReceipt = null, asOf = null } = {}) {
  const id = String(forecast?.id || forecast?.market_id || '').trim();
  if (!id) return { skip: 'resolved forecast without an id' };
  // Checked as a raw value, not through Number(): Number(null) is 0, so a
  // missing outcome would have been remembered as "resolved NO" — an invented
  // observation, which is the one thing this layer must never write.
  const raw = forecast.actual_outcome;
  if (raw !== 0 && raw !== 1 && raw !== '0' && raw !== '1') {
    return { skip: `signal ${id}: outcome ${JSON.stringify(raw)} is not a recorded 0/1` };
  }
  const outcome = Number(raw);
  const fields = {
    p: num(forecast.ai_probability, 4),
    odds: num(forecast.market_odds, 4),
    edge: num(forecast.edge, 4),
    bucket: slug(forecast.confidence_bucket || forecast.confidence),
    outcome: num(outcome, 0),
    brier: num(forecast.brier_score, 4),
    logloss: num(forecast.log_loss, 4),
    size: num(forecast.size_pct, 2),
    venue: slug(forecast.platform),
    source: 'db:agent_forecasts',
  };
  const verdict = outcome === 1 ? 'resolved YES' : 'resolved NO';
  return {
    kind: 'signal',
    key: slug(id),
    fields,
    note:
      `Fourcast priced ${slug(forecast.market_title) || id} at ${fields.p} against market odds ` +
      `${fields.odds} (bucket ${fields.bucket}) on ${fields.venue}. The market ${verdict}, so the ` +
      `Brier score is ${fields.brier} and log-loss is ${fields.logloss}.`,
    evidenceSource: 'db:agent_forecasts',
    triggerReceipt,
    asOf: asOf || isoFromEpoch(forecast.resolution_time) || nowIso(),
    metrics: { brier: forecast.brier_score, logLoss: forecast.log_loss, outcome },
  };
}

/** One calendar month of scored forecasts — how the loop learned over time. */
export function buildWindowMemory(row, { asOf = null } = {}) {
  const month = slug(row?.month);
  if (!month) return { skip: 'trend row without a month label' };
  const count = Number(row.count) || 0;
  const fields = {
    n: num(count, 0),
    brier: num(row.avgBrier, 4),
    logloss: num(row.avgLogLoss, 4),
    // The rates WP3 feeds to Kelly, plus the `n` behind each one. Reading the
    // rates without the counts is the mistake that would let a one-call bucket
    // shrink or boost a position, so both are written and the reader refuses
    // any bucket whose count it cannot see.
    buckets: bucketField(row.buckets),
    bucket_n: sourceField(row.buckets),
    source: 'db:agent_forecasts.monthly',
  };
  return {
    kind: 'window',
    key: month,
    fields,
    note:
      `Resolution window ${month}: ${count} forecasts scored, mean Brier ${fields.brier}, mean ` +
      `log-loss ${fields.logloss}, bucket hit rates ${fields.buckets} on ${fields.bucket_n}. ` +
      `This is one rung of the ladder — the point is to compare it against the months before and after.`,
    evidenceSource: 'db:agent_forecasts.monthly',
    triggerReceipt: null,
    // The newest resolution inside the window; if the row carries no timestamp
    // the window's own first day is the honest label, not today.
    asOf: asOf || isoFromEpoch(row.lastResolved) || `${month}-01T00:00:00Z`,
    metrics: { n: count, avgBrier: row.avgBrier, avgLogLoss: row.avgLogLoss },
  };
}

/**
 * Walk the ledger and return everything that is currently memory-worthy, plus
 * everything that was refused and why. The refusals are the point: the batch
 * script prints them so a thin mainnet entry is a visible decision, not a
 * silent gap.
 */
export async function collectMemoryCandidates({
  kinds = ['analyst', 'source', 'window', 'signal'],
  minSamples = 20,
  signalLimit = 10,
  analystLimit = 25,
  operatorId = null,
} = {}) {
  const candidates = [];
  const skipped = [];
  const calibration = await getCalibrationAnalysis(operatorId);
  if (!calibration.success) {
    return { candidates, skipped: [{ skip: `calibration read failed: ${calibration.error}` }] };
  }

  if (kinds.includes('analyst')) {
    const roster = await listAnalystAddresses({ minVerdicts: 1, limit: analystLimit });
    for (const entry of roster.addresses) {
      const built = await buildAnalystMemory(entry.address, { minSamples });
      if (built.skip) skipped.push(built);
      else candidates.push(built);
    }
  }

  if (kinds.includes('source')) {
    for (const row of calibration.sourceCal || []) {
      const built = buildSourceMemory(row, { minSamples });
      if (built.skip) skipped.push(built);
      else candidates.push(built);
    }
  }

  if (kinds.includes('window')) {
    for (const row of calibration.trend || []) {
      const built = buildWindowMemory(row);
      if (built.skip) skipped.push(built);
      else candidates.push(built);
    }
  }

  if (kinds.includes('signal')) {
    const resolved = await listResolvedForecasts({ limit: signalLimit, operatorId });
    for (const forecast of resolved.forecasts || []) {
      const built = buildSignalMemory(forecast);
      if (built.skip) skipped.push(built);
      else candidates.push(built);
    }
  }

  return { candidates, skipped, summary: calibration.summary || null };
}

/**
 * The resolution-triggered write: one memory per observation, immediately,
 * because a resolution is a fact. `refreshWindow` appends the month's running
 * aggregate alongside it. Analyst and source memories stay on the batch path —
 * they are the sizing-consumed claims, and that is where the sample floor is
 * enforced, so a resolution handler must not be able to write a thin one.
 */
export async function memoriesForResolution(forecast, { triggerReceipt = null, refreshWindow = true } = {}) {
  const out = [];
  const skipped = [];
  const signal = buildSignalMemory(forecast, { triggerReceipt });
  if (signal.skip) skipped.push(signal);
  else out.push(signal);

  if (refreshWindow && !signal.skip) {
    const calibration = await getCalibrationAnalysis(forecast.operator_id || null);
    const month = isoFromEpoch(forecast.resolution_time)?.slice(0, 7);
    const row = (calibration.trend || []).find((t) => t.month === month);
    if (!row) {
      skipped.push({ skip: `window ${month}: no aggregate row yet`, kind: 'window', key: month });
    } else {
      const built = buildWindowMemory(row);
      if (built.skip) skipped.push(built);
      else out.push(built);
    }
  }
  return { candidates: out, skipped };
}
