#!/usr/bin/env node
/**
 * Fourcast autonomous World Cup worker.
 *
 * Headless by design: the worker does not expose a public port. It consumes
 * TxLINE fixtures, runs the canonical decision policy/simulation modules, and
 * writes signed decision receipts plus a compact status file for ops/demo use.
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import dotenv from 'dotenv';
import txlineService from '../services/txline/txlineService.js';
import { readReceiptFixture } from '../services/txline/txlineService.js';
import { createDecisionPolicy, evaluateDecision } from '../services/domain/decision/decisionPolicy.js';
import { buildDecisionReceipt } from '../services/domain/decision/decisionReceipt.js';
import { deriveSimulationSeed, simulateBinaryMarket } from '../services/domain/decision/simulation.js';
import { assertNoLookahead, historicalPhase, historicalTimeline } from '../services/domain/decision/historicalLab.js';
import { reconcile } from '../services/txline/reconciliationService.js';
import { getMandate, migrationsReady, saveForecast, resolveForecast } from '../services/db.js';
import { readSizingCalibration } from '../services/memory/calibrationMemory.js';
import { rememberResolution } from '../services/memory/resolutionTrigger.js';
import { enqueueNearAnchor, drainNearAnchors } from '../services/near/nearAnchorQueue.js';

dotenv.config({ path: process.env.FOURCAST_AGENT_ENV_FILE || '.env.agent' });
dotenv.config();

const args = new Set(process.argv.slice(2));
const once = args.has('--once') || args.has('once');
const stateDir = path.resolve(process.env.FOURCAST_AGENT_STATE_DIR || '.fourcast-agent');
const receiptDir = path.join(stateDir, 'receipts');
const intervalMs = toInt(process.env.FOURCAST_AGENT_INTERVAL_MS, 5 * 60 * 1000);
const fixtureFilter = process.env.FOURCAST_AGENT_FIXTURE_ID || getArgValue('--fixture-id');
const maxFixtures = toInt(process.env.FOURCAST_AGENT_MAX_FIXTURES, 8);
const forcedEdge = toNumber(process.env.FOURCAST_AGENT_FAIR_EDGE, 0.056);
const dryRun = process.env.FOURCAST_AGENT_DRY_RUN !== 'false';
const dataMode = (process.env.FOURCAST_AGENT_DATA_MODE || 'historical-lab').toLowerCase();
const historicalStepMs = toInt(process.env.FOURCAST_AGENT_CLOCK_STEP_MS, 60 * 60 * 1000);
const webhookUrl = process.env.FOURCAST_AGENT_WEBHOOK_URL || null;
const webhookSecret = process.env.FOURCAST_AGENT_WEBHOOK_SECRET || null;
const operatorId = process.env.FOURCAST_AGENT_OPERATOR_ID || null;

fs.mkdirSync(receiptDir, { recursive: true });

/**
 * Translate observed bucket hit-rates into the shrinkage factor applied to a
 * given confidence bucket's Kelly multiplier. Mirrors `kellySizing.js` so the
 * receipt's `shrinkageFactor` matches the sizing that was actually applied.
 *
 * Nominal hit-rates: LOW ≈ 0.35, MEDIUM ≈ 0.55, HIGH ≈ 0.75.
 */
const NOMINAL_HIT_RATE = { LOW: 0.35, MEDIUM: 0.55, HIGH: 0.75 };
function computeShrinkageFactor(buckets, bucket) {
  const observed = Number(buckets?.[bucket]);
  const nominal = NOMINAL_HIT_RATE[bucket];
  if (!Number.isFinite(observed) || !nominal) return 1.0;
  return Math.max(0.25, Math.min(1.5, observed / nominal));
}

/**
 * When FOURCAST_AGENT_OPERATOR_ID is set, pull the persisted mandate from the
 * DB and use its policy knobs instead of env var defaults. This closes the
 * loop between the self-serve MandateBuilder (Slice 4) and the worker: a
 * prospect saves their mandate in-browser, then the concierge deploys the
 * worker with their operator_id, and the worker runs under that mandate.
 *
 * Returns null when no operator_id is configured or no mandate is found,
 * signaling the caller to fall back to env-var defaults.
 */
async function loadMandatePolicy() {
  if (!operatorId) return null;
  try {
    await migrationsReady;
    const result = await getMandate(operatorId);
    if (!result.success || !result.mandate) {
      console.warn(`[fourcast-agent] no persisted mandate for operator ${operatorId}, falling back to env defaults`);
      return null;
    }
    const m = result.mandate;
    console.log(`[fourcast-agent] loaded mandate for operator ${operatorId}: minEdge=${m.minAbsoluteEdge} maxAlloc=${m.maxAllocationPct} maxLoss=${m.maxLossProbability} simRuns=${m.simulationRuns}`);
    return createDecisionPolicy({
      minAbsoluteEdge: m.minAbsoluteEdge,
      maxAllocationPct: m.maxAllocationPct,
      maxLossProbability: m.maxLossProbability,
      simulationRuns: m.simulationRuns,
    });
  } catch (err) {
    console.warn(`[fourcast-agent] failed to load mandate for operator ${operatorId}:`, err.message);
    return null;
  }
}

async function main() {
  if (once) {
    await runCycle();
    return;
  }

  console.log(`[fourcast-agent] starting autonomous loop interval=${intervalMs}ms stateDir=${stateDir}`);
  for (;;) {
    await runCycle().catch((err) => {
      console.error('[fourcast-agent] cycle failed:', err);
      writeStatus({ ok: false, error: err.message, timestamp: new Date().toISOString() });
    });
    await sleep(intervalMs);
  }
}

async function runCycle() {
  const startedAt = new Date().toISOString();
  const txlineStatus = txlineService.getTxlineStatus();
  const { fixtures, mode, fallback } = await txlineService.getFixtures();
  const candidates = fixtures
    .filter((fixture) => !fixtureFilter || fixture.id === String(fixtureFilter))
    .filter((fixture) => hasUsableOdds(fixture) || Boolean(getReceiptOdds(fixture.id)))
    .slice(0, maxFixtures);

  // The policy is env-derived and stable across a cycle, UNLESS an operator_id
  // is configured — in that case, pull the persisted mandate from the DB so
  // the worker runs under the same policy the prospect configured in-browser.
  // Lift it into the status so the Mandate Control hero can show the real
  // mandate constraints without a parallel data model.
  const mandatePolicy = (await loadMandatePolicy()) || createDecisionPolicy({
    minAbsoluteEdge: toNumber(process.env.FOURCAST_AGENT_MIN_EDGE, 0.05),
    maxAllocationPct: toNumber(process.env.FOURCAST_AGENT_MAX_ALLOCATION_PCT, 0.03),
    maxLossProbability: toNumber(process.env.FOURCAST_AGENT_MAX_LOSS_PROBABILITY, 0.75),
    simulationRuns: toInt(process.env.FOURCAST_AGENT_SIMULATION_RUNS, 10_000),
  });

  const receipts = [];
  const lab = dataMode === 'historical-lab' ? readHistoricalState() : null;
  const agentTime = lab ? advanceHistoricalClock(lab, candidates) : null;

  // Pull bucket hit-rates once per cycle so every receipt in this run
  // shares a consistent calibration snapshot. Our own ledger first; a stored
  // memory only when the ledger has no usable buckets. Failures fall back to
  // null, in which case the receipt records no evidence and sizing runs unshrunk.
  let calibrationBuckets = null;
  let calibrationSampleSize = 0;
  let calibrationDropped = [];
  let calibrationSource = 'db';
  let calibrationMemory = null;
  try {
    await migrationsReady;
    const calibration = await readSizingCalibration();
    calibrationBuckets = calibration.bucketCalibration;
    calibrationSampleSize = calibration.sampleSize;
    calibrationDropped = calibration.droppedBuckets;
    calibrationSource = calibration.calibrationSource;
    calibrationMemory = calibration.memory;
    if (calibrationSource === 'walrus-memory') {
      console.log(
        `[fourcast-agent] sizing calibrated from Walrus Memory rung ${calibrationMemory.key} ` +
          `v${calibrationMemory.version} (blob ${calibrationMemory.blobId}, as of ${calibrationMemory.asOf})`
      );
    }
  } catch (err) {
    console.warn(`[fourcast-agent] calibration lookup failed (continuing without):`, err.message);
  }

  for (const fixture of candidates) {
    if (lab) {
      const activity = await runHistoricalFixture({ fixture, mode, lab, agentTime, policy: mandatePolicy });
      if (activity) {
        receipts.push(activity);
        // When a fixture has settled, score the original forecast so the
        // calibration curve grows. The historical fixture detail carries
        // the final scores; actualOutcome = 1 means home team won.
        if (activity.phase === 'proof_reconciled' && activity.timeline?.outcomeAvailableAt) {
          try {
            const detail = txlineService.readReplayFixture(fixture.id);
            const homeWon = detail?.proof?.outcome?.homeWon;
            // Only a recorded boolean is a result. Treating "missing" as a win
            // would score the forecast against something nobody observed.
            if (homeWon === true || homeWon === false) {
              const outcome = homeWon ? 1 : 0;
              const r = await resolveForecast(fixture.id, outcome);
              if (r.success && r.resolved > 0) {
                console.log(`[fourcast-agent] resolved ${r.resolved} forecast(s) for ${fixture.id} → outcome=${outcome}`);
                // Memory is written by the resolution, not a cron: a resolution
                // is a belief revision, and that is the only event worth an
                // append on a ledger we cannot edit afterwards.
                const memory = await rememberResolution({
                  marketId: fixture.id,
                  triggerReceipt: lab.fixtures[fixture.id]?.receiptHash || null,
                });
                if (memory.written?.length) {
                  const rungs = memory.written
                    .map((w) => `${w.kind}:${w.key} v${w.version}${w.blobId ? ` blob=${w.blobId}` : ''}`)
                    .join(', ');
                  console.log(`[fourcast-agent] memory appended → ${rungs}`);
                } else if (memory.skipped || memory.refused?.length) {
                  console.log(`[fourcast-agent] memory: ${memory.reason || `refused ${memory.refused.join(' | ')}`}`);
                }
              }
            } else {
              console.warn(`[fourcast-agent] fixture ${fixture.id} settled without a recorded homeWon; leaving forecast unresolved`);
            }
          } catch (err) {
            console.warn(`[fourcast-agent] resolution skipped for ${fixture.id}:`, err.message);
          }
        }
      }
    } else {
      receipts.push(await evaluateFixture({
        fixture,
        mode,
        policy: mandatePolicy,
        calibrationBuckets,
        calibrationSampleSize,
        calibrationDropped,
        calibrationSource,
        calibrationMemory,
      }));
    }
  }

  const status = {
    ok: true,
    mode,
    dataMode,
    agentTime,
    fallback,
    txline: txlineStatus,
    hostname: os.hostname(),
    dryRun,
    operatorId: operatorId || null,
    startedAt,
    completedAt: new Date().toISOString(),
    fixturesSeen: fixtures.length,
    candidates: candidates.length,
    policy: mandatePolicy,
    receipts: receipts.map((receipt) => summarizeReceipt(receipt)),
  };
  writeStatus(status);
  appendJsonl('runs.ndjson', status);
  await postWebhook(status);
  // Arena feed: same ingest contract as the Delphi worker — this is what puts
  // nearTx on the public run record so the rail can show `⬡ anchored`.
  await postArenaIngest(collectArenaPayload({ receipts, startedAt, dryRun }));
  console.log(`[fourcast-agent] cycle complete fixtures=${fixtures.length} receipts=${receipts.length}`);
}

async function runHistoricalFixture({ fixture, mode, lab, agentTime, policy = null }) {
  const replay = txlineService.readReplayFixture(fixture.id);
  const boundReceipt = readReceiptFixture(fixture.id);
  const timeline = historicalTimeline({ fixture, boundReceipt, replay });
  const existing = lab.fixtures[fixture.id] || {};
  const phase = historicalPhase({ agentTime, timeline, hasReceipt: Boolean(existing.file), reconciled: Boolean(existing.reconciled) });
  if (phase === 'unavailable' || phase === 'waiting' || phase === 'complete') {
    return { fixtureId: fixture.id, phase, timeline };
  }

  if (phase === 'decide') {
    const created = await evaluateFixture({ fixture, mode, createdAt: agentTime, historical: { timeline, agentTime }, policy });
    lab.fixtures[fixture.id] = { file: created.file, receiptHash: created.proof.integrity.contentHash, decisionAt: agentTime, timeline, reconciled: false };
    writeHistoricalState(lab);
    return { ...created, phase: 'decision_receipt_created', timeline };
  }

  const stored = readGeneratedReceipt(existing.file);
  if (!stored?.receipt || !assertNoLookahead({ receiptCreatedAt: stored.receipt.proof.createdAt, timeline })) {
    throw new Error(`Historical lookahead guard failed for fixture ${fixture.id}`);
  }
  const reconciliation = reconcile({ receipt: stored.receipt, proof: replay.proof, verification: { verdict: 'proof-present' }, fixtureId: fixture.id });
  fs.writeFileSync(existing.file, JSON.stringify({ receipt: stored.receipt, reconciliation }, null, 2) + '\n');
  lab.fixtures[fixture.id] = { ...existing, reconciled: true, reconciledAt: agentTime };
  writeHistoricalState(lab);
  return { ...stored.receipt, reconciliation, file: existing.file, phase: 'proof_reconciled', timeline };
}

async function evaluateFixture({
  fixture,
  mode,
  createdAt = new Date().toISOString(),
  historical = null,
  policy: overridePolicy = null,
  calibrationBuckets = null,
  calibrationSampleSize = 0,
  calibrationDropped = [],
  calibrationSource = 'db',
  calibrationMemory = null,
}) {
  const policy = overridePolicy || createDecisionPolicy({
    minAbsoluteEdge: toNumber(process.env.FOURCAST_AGENT_MIN_EDGE, 0.05),
    maxAllocationPct: toNumber(process.env.FOURCAST_AGENT_MAX_ALLOCATION_PCT, 0.03),
    maxLossProbability: toNumber(process.env.FOURCAST_AGENT_MAX_LOSS_PROBABILITY, 0.75),
    simulationRuns: toInt(process.env.FOURCAST_AGENT_SIMULATION_RUNS, 10_000),
  });
  const odds = getFixtureOdds(fixture);
  const homePrice = odds.implied.home;
  const fairProbability = clamp(homePrice + forcedEdge, 0.01, 0.99);
  const recommendation = {
    aiProbability: round(fairProbability),
    marketOdds: round(homePrice),
    edge: round(fairProbability - homePrice),
    sizePct: round(Math.min(policy.maxAllocationPct, Math.max(0, (fairProbability - homePrice) * 0.375))),
  };
  const marketId = `txline:${fixture.id}:home_win`;
  const seed = deriveSimulationSeed(['fourcast-agent', fixture.id, marketId, policy.version, fixture.updatedAt]);
  const simulation = simulateBinaryMarket({
    probability: recommendation.aiProbability,
    marketOdds: recommendation.marketOdds,
    direction: 'BUY YES',
    runs: policy.simulationRuns,
    seed,
  });
  const decision = evaluateDecision({ recommendation, simulation, policy });
  // Historical decisions deliberately never load a completed fixture detail.
  // The proof is fetched only in the later reconciliation phase.
  const detail = historical ? null : await txlineService.getFixtureDetail(fixture.id).catch(() => null);
  const replay = txlineService.readReplayFixture(fixture.id);
  const receipt = buildDecisionReceipt({
    id: `fourcast-agent-${fixture.id}-${randomUUID()}`,
    createdAt,
    policy,
    evidence: {
      sources: ['txline'],
      mode,
      fixture: {
        id: fixture.id,
        competition: fixture.competition,
        competitionId: fixture.competitionId,
        kickoff: fixture.kickoff,
        status: fixture.status,
        home: fixture.home,
        away: fixture.away,
      },
      snapshot: {
        provider: 'txline',
        capturedAt: historical?.timeline?.decisionAvailableAt || createdAt,
        consensusOdds: odds,
        score: historical ? null : detail?.scores?.final || null,
      },
      historicalReplay: historical
        ? { dataMode: 'historical-lab', agentTime: historical.agentTime, outcomeAvailableAt: historical.timeline.outcomeAvailableAt, outcomeVisible: false }
        : null,
    },
    decisions: [
      {
        market: {
          id: marketId,
          fixtureId: fixture.id,
          side: 'home_win',
          title: `${fixture.home.name} to beat ${fixture.away.name}`,
        },
        forecast: {
          probability: recommendation.aiProbability,
          edge: recommendation.edge,
          source: 'fourcast-agent:vps',
        },
        simulation,
        decision,
      },
    ],
    execution: { attempted: 0, completed: 0, failed: 0, dryRun },
    ledger: {
      fixtureId: fixture.id,
      summary: {
        marketsScanned: 1,
        candidatesFiltered: 1,
        forecastsMade: 1,
        runMode: dryRun ? 'autonomous-dry-run' : 'autonomous-live',
      },
    },
    calibration:
      calibrationBuckets || calibrationSampleSize > 0 || calibrationDropped.length > 0
        ? {
            buckets: calibrationBuckets,
            bucket: confBucket,
            // Calibration-aware shrinkage applied to this decision's sizing
            shrinkageFactor: computeShrinkageFactor(calibrationBuckets, confBucket),
            sampleSize: calibrationSampleSize,
            // Buckets held back for lack of evidence — a receipt that shows no
            // shrinkage must also show whether that was "no data" or "not enough".
            droppedBuckets: calibrationDropped,
            // Which evidence moved the size. A memory-derived snapshot carries
            // the blob it was read from, so an auditor can start at something
            // on chain instead of at our word. Excluded from the integrity hash
            // (as the whole calibration block is), so historical receipts still
            // verify.
            source: calibrationSource,
            ...(calibrationMemory
              ? {
                  memory: {
                    key: calibrationMemory.key,
                    version: calibrationMemory.version,
                    blobId: calibrationMemory.blobId,
                    textHash: calibrationMemory.textHash,
                    asOf: calibrationMemory.asOf,
                    counts: calibrationMemory.counts,
                  },
                }
              : {}),
            message: 'Sized on calibrated confidence, not vibes.',
          }
        : null,
  });

  const reconciliation = !historical && replay?.proof
    ? reconcile({ receipt, proof: replay.proof, verification: { verdict: 'proof-present' }, fixtureId: fixture.id })
    : null;
  const out = path.join(receiptDir, `${Date.now()}-${fixture.id}-${receipt.proof.integrity.contentHash.slice(0, 10)}.receipt.json`);
  fs.writeFileSync(out, JSON.stringify({ receipt, reconciliation }, null, 2) + '\n');

  // NEAR anchor: queue every receipt so it commits on-chain the moment a
  // treasury key exists (drain no-ops until then). Must never break the cycle.
  let nearAnchor = { status: 'queued' };
  try {
    enqueueNearAnchor({
      stateDir,
      fixtureId: fixture.id,
      contentHash: receipt.proof.integrity.contentHash,
      receiptFile: out,
    });
    const drain = await drainNearAnchors({ stateDir });
    if (drain.anchored > 0) {
      const mine = drain.items.find((i) => i.contentHash === receipt.proof.integrity.contentHash);
      nearAnchor = { status: 'anchored', txHash: mine?.txHash || null, explorerUrl: mine?.explorerUrl || null };
    }
  } catch (err) {
    nearAnchor = { status: 'queue-error', error: err.message };
    console.warn(`[fourcast-agent] NEAR anchor skipped for ${fixture.id}:`, err.message);
  }

  // Lift confBucket before the receipt build so the calibration block can
  // reference it without a TDZ-style linter warning.
  const confBucket =
    decision.verdict === 'EXECUTE' ? 'HIGH' :
    decision.verdict === 'PASS' ? 'MEDIUM' :
    'LOW';

  // Persist to agent_forecasts so the calibration curve has data points.
  // Failures here must never break the cycle — forecasting is the primary
  // job, scoring is downstream. Confidence is mapped LOW/MEDIUM/HIGH by
  // db.js based on the policy decision verdict.
  try {
    await migrationsReady;
    await saveForecast({
      id: `fourcast-${fixture.id}-${receipt.proof.integrity.contentHash.slice(0, 12)}`,
      marketID: fixture.id,
      title: fixture.home?.name && fixture.away?.name
        ? `${fixture.home.name} vs ${fixture.away.name}`
        : fixture.id,
      platform: 'txline',
      aiProbability: recommendation.aiProbability,
      marketOdds: recommendation.marketOdds,
      edge: recommendation.edge,
      confidence: confBucket,
      reasoning: `fourcast-agent policy=${policy.version} verdict=${decision.verdict}`,
      keyFactors: [fixture.home?.name, fixture.away?.name, mode].filter(Boolean),
      source: 'fourcast-agent',
      timestamp: Math.floor(new Date(createdAt).getTime() / 1000),
    });
  } catch (err) {
    console.warn(`[fourcast-agent] forecast save skipped for ${fixture.id}:`, err.message);
  }

  return { ...receipt, reconciliation, file: out, nearAnchor };
}

function historicalStateFile() {
  return path.join(stateDir, 'historical-lab.json');
}

function readHistoricalState() {
  try {
    return JSON.parse(fs.readFileSync(historicalStateFile(), 'utf8'));
  } catch {
    return { version: 1, agentTime: process.env.FOURCAST_AGENT_CLOCK_START || null, fixtures: {} };
  }
}

function writeHistoricalState(state) {
  fs.writeFileSync(historicalStateFile(), JSON.stringify(state, null, 2) + '\n');
}

function advanceHistoricalClock(state, fixtures) {
  if (!state.agentTime) {
    const starts = fixtures
      .map((fixture) => historicalTimeline({ fixture, boundReceipt: readReceiptFixture(fixture.id), replay: txlineService.readReplayFixture(fixture.id) }).decisionAvailableAt)
      .filter(Boolean)
      .sort();
    state.agentTime = starts[0] || new Date().toISOString();
  } else {
    state.agentTime = new Date(new Date(state.agentTime).getTime() + historicalStepMs).toISOString();
  }
  writeHistoricalState(state);
  return state.agentTime;
}

function readGeneratedReceipt(file) {
  if (!file || !fs.existsSync(file)) return null;
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
}

function hasUsableOdds(fixture) {
  return Boolean(fixture?.id && fixture?.odds?.implied?.home && fixture?.home?.name && fixture?.away?.name);
}

function getFixtureOdds(fixture) {
  if (fixture?.odds?.implied?.home) return fixture.odds;
  return getReceiptOdds(fixture?.id);
}

function getReceiptOdds(fixtureId) {
  if (!fixtureId) return null;
  const receipt = readReceiptFixture(fixtureId);
  return receipt?.proof?.evidence?.snapshot?.consensusOdds || null;
}

function summarizeReceipt(receipt) {
  if (!receipt?.proof?.decisions?.[0]) return { fixtureId: receipt.fixtureId, phase: receipt.phase, timeline: receipt.timeline };
  const decision = receipt.proof.decisions[0].decision;
  return {
    id: receipt.proof.id,
    fixtureId: receipt.fixtureId,
    verdict: decision.verdict,
    allocationPct: decision.allocationPct,
    receiptHash: receipt.proof.integrity.contentHash,
    reconciliationStatus: receipt.reconciliation?.status || null,
    nearAnchor: receipt.nearAnchor?.status || null,
    nearTx: receipt.nearAnchor?.txHash || null,
    phase: receipt.phase || null,
    timeline: receipt.timeline || null,
    file: receipt.file,
  };
}

// ── Arena feed ingest ──────────────────────────────────────────────────────
// Same contract as scripts/delphi-agent-worker.mjs: ARENA_INGEST_URL +
// ADMIN_SECRET → POST /api/arena/ingest. Without this the worker's anchored
// receipts never reach the public feed and the rail's `⬡ anchored` chip has
// no data — nearTx must ride on the run record itself.

function decisionFromReceipt(receipt) {
  const d = receipt?.proof?.decisions?.[0];
  if (!d) return null;
  const market = d.market || {};
  const forecast = d.forecast || {};
  const decision = d.decision || {};
  const fixture = receipt.proof?.evidence?.fixture || {};
  const odds = receipt.proof?.evidence?.snapshot?.consensusOdds?.implied || {};
  return {
    verdict: decision.verdict,
    outcome: fixture.home?.name || market.title || 'home',
    question: market.title || market.fixtureId || receipt.fixtureId,
    yourProb: forecast.probability ?? null,
    marketProb: odds.home ?? null,
    edge: forecast.edge ?? null,
    shares: decision.allocationPct ? Math.round(decision.allocationPct * 10000) / 100 : null,
    source: forecast.source || 'fourcast-agent',
    category: 'sports',
    gates: (decision.riskChecks || []).map((g) => ({ label: g.label, passed: g.passed })),
    receiptHash: receipt.proof?.integrity?.contentHash || null,
    nearTx: receipt.nearAnchor?.txHash || null,
    nearExplorer: receipt.nearAnchor?.explorerUrl || null,
  };
}

function collectArenaPayload({ receipts, startedAt, dryRun }) {
  const decisions = receipts.map(decisionFromReceipt).filter(Boolean);
  const anchored = receipts.find((r) => r.nearAnchor?.txHash);
  return {
    runId: `fourcast-${startedAt}`,
    timestamp: startedAt,
    summary: {
      dryRun,
      marketsScanned: receipts.length,
      tradesExecuted: 0,
      tradesPaper: 0,
      mode: 'txline',
    },
    balances: null,
    decisions,
    executions: [],
    positions: [],
    nearTx: anchored?.nearAnchor?.txHash || null,
    nearExplorer: anchored?.nearAnchor?.explorerUrl || null,
  };
}

async function postArenaIngest(payload) {
  const base = process.env.ARENA_INGEST_URL;
  const secret = process.env.ADMIN_SECRET;
  if (!base || !secret) return; // feed unconfigured — skip quietly
  try {
    const res = await fetch(`${base}/api/arena/ingest`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${secret}` },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) console.warn(`[fourcast-agent] arena ingest ${res.status}`);
    else console.log('[fourcast-agent] cycle published to arena feed');
  } catch (err) {
    console.warn(`[fourcast-agent] arena ingest failed: ${err.message}`);
  }
}

function writeStatus(status) {
  fs.writeFileSync(path.join(stateDir, 'status.json'), JSON.stringify(status, null, 2) + '\n');
}

function appendJsonl(filename, payload) {
  fs.appendFileSync(path.join(stateDir, filename), `${JSON.stringify(payload)}\n`);
}

async function postWebhook(status) {
  if (!webhookUrl) return;
  const headers = { 'content-type': 'application/json' };
  if (webhookSecret) headers.authorization = `Bearer ${webhookSecret}`;
  try {
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(status),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) console.error(`[fourcast-agent] webhook failed ${res.status}`);
  } catch (err) {
    console.error('[fourcast-agent] webhook error:', err.message);
  }
}

function getArgValue(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : null;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function toInt(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.floor(number) : fallback;
}

function toNumber(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function round(value) {
  return Math.round(value * 1_000_000) / 1_000_000;
}

main().catch((err) => {
  console.error('[fourcast-agent] fatal:', err);
  process.exit(1);
});
