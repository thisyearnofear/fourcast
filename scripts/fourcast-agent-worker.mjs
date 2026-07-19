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

fs.mkdirSync(receiptDir, { recursive: true });

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

  const receipts = [];
  const lab = dataMode === 'historical-lab' ? readHistoricalState() : null;
  const agentTime = lab ? advanceHistoricalClock(lab, candidates) : null;
  for (const fixture of candidates) {
    if (lab) {
      const activity = await runHistoricalFixture({ fixture, mode, lab, agentTime });
      if (activity) receipts.push(activity);
    } else {
      receipts.push(await evaluateFixture({ fixture, mode }));
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
    startedAt,
    completedAt: new Date().toISOString(),
    fixturesSeen: fixtures.length,
    candidates: candidates.length,
    receipts: receipts.map((receipt) => summarizeReceipt(receipt)),
  };
  writeStatus(status);
  appendJsonl('runs.ndjson', status);
  await postWebhook(status);
  console.log(`[fourcast-agent] cycle complete fixtures=${fixtures.length} receipts=${receipts.length}`);
}

async function runHistoricalFixture({ fixture, mode, lab, agentTime }) {
  const replay = txlineService.readReplayFixture(fixture.id);
  const boundReceipt = readReceiptFixture(fixture.id);
  const timeline = historicalTimeline({ fixture, boundReceipt, replay });
  const existing = lab.fixtures[fixture.id] || {};
  const phase = historicalPhase({ agentTime, timeline, hasReceipt: Boolean(existing.file), reconciled: Boolean(existing.reconciled) });
  if (phase === 'unavailable' || phase === 'waiting' || phase === 'complete') {
    return { fixtureId: fixture.id, phase, timeline };
  }

  if (phase === 'decide') {
    const created = await evaluateFixture({ fixture, mode, createdAt: agentTime, historical: { timeline, agentTime } });
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

async function evaluateFixture({ fixture, mode, createdAt = new Date().toISOString(), historical = null }) {
  const policy = createDecisionPolicy({
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
  });

  const reconciliation = !historical && replay?.proof
    ? reconcile({ receipt, proof: replay.proof, verification: { verdict: 'proof-present' }, fixtureId: fixture.id })
    : null;
  const out = path.join(receiptDir, `${Date.now()}-${fixture.id}-${receipt.proof.integrity.contentHash.slice(0, 10)}.receipt.json`);
  fs.writeFileSync(out, JSON.stringify({ receipt, reconciliation }, null, 2) + '\n');
  return { ...receipt, reconciliation, file: out };
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
    file: receipt.file,
  };
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
