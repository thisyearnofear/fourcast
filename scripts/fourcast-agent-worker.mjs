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
  for (const fixture of candidates) {
    const receipt = await evaluateFixture({ fixture, mode });
    receipts.push(receipt);
  }

  const status = {
    ok: true,
    mode,
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

async function evaluateFixture({ fixture, mode }) {
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
  const detail = await txlineService.getFixtureDetail(fixture.id).catch(() => null);
  const replay = txlineService.readReplayFixture(fixture.id);
  const receipt = buildDecisionReceipt({
    id: `fourcast-agent-${fixture.id}-${randomUUID()}`,
    createdAt: new Date().toISOString(),
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
        capturedAt: new Date().toISOString(),
        consensusOdds: odds,
        score: detail?.scores?.final || null,
      },
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

  const reconciliation = replay?.proof
    ? reconcile({ receipt, proof: replay.proof, verification: { verdict: 'proof-present' }, fixtureId: fixture.id })
    : null;
  const out = path.join(receiptDir, `${Date.now()}-${fixture.id}-${receipt.proof.integrity.contentHash.slice(0, 10)}.receipt.json`);
  fs.writeFileSync(out, JSON.stringify({ receipt, reconciliation }, null, 2) + '\n');
  return { ...receipt, reconciliation, file: out };
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
