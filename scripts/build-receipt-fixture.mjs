/**
 * Builds the deterministic pre-event decision receipts for fixture 18175981
 * (France 3-0 Sweden) using Person 1's canonical decision modules.
 *
 * Two fixtures are produced:
 *
 *   18175981.receipt.json        — ALLOCATE: edge clears the gate, agent acts.
 *   18175981.pass.receipt.json   — PASS:    edge below threshold, agent declines.
 *                                 Same fixture, same snapshot, but the agent's
 *                                 fair probability is lower so the policy gate
 *                                 fires. Demonstrates the policy-bound refusal
 *                                 path: a successful autonomous decision that
 *                                 chose NOT to act.
 *
 * Both are genuine buildDecisionReceipt() outputs — verifyDecisionReceipt
 * validates them — so when Person 1 wires the agent loop, these fixtures are
 * indistinguishable from live receipts of the same inputs.
 *
 * Run: node scripts/build-receipt-fixture.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { createDecisionPolicy, evaluateDecision } from '../services/domain/decision/decisionPolicy.js';
import { deriveSimulationSeed, simulateBinaryMarket } from '../services/domain/decision/simulation.js';
import { buildDecisionReceipt } from '../services/domain/decision/decisionReceipt.js';

const FIXTURE_ID = '18175981';
const REPLAY_DIR = path.join(process.cwd(), 'data', 'txline-replays');

const policy = createDecisionPolicy({
  minAbsoluteEdge: 0.05,
  maxAllocationPct: 0.03,
  maxLossProbability: 0.75,
  simulationRuns: 10_000,
});

const fixtureEvidence = {
  sources: ['txline'],
  fixture: {
    competition: 'World Cup',
    competitionId: 72,
    home: { id: 1999, name: 'France', isHome: true },
    away: { id: 3095, name: 'Sweden', isHome: false },
    kickoff: '2026-06-30T20:59:10.611Z',
  },
  snapshot: {
    provider: 'txline',
    capturedAt: '2026-06-30T18:30:00.000Z',
    mode: 'pre-match',
    consensusOdds: { home: 1.55, draw: 4.2, away: 6.0, implied: { home: 0.624, draw: 0.231, away: 0.162 } },
  },
};

function buildAndWrite({ suffix, recommendation, direction, marketId, marketTitle, createdAt, ledgerSummary }) {
  const seed = deriveSimulationSeed([`receipt-${FIXTURE_ID}-${suffix}`, marketId, policy.version]);
  const simulation = simulateBinaryMarket({
    probability: recommendation.aiProbability,
    marketOdds: recommendation.marketOdds,
    direction,
    runs: policy.simulationRuns,
    seed,
  });
  const decision = evaluateDecision({ recommendation, simulation, policy });

  const receipt = buildDecisionReceipt({
    id: `receipt-${FIXTURE_ID}-${suffix}-france-vs-sweden-2026-06-30`,
    createdAt,
    policy,
    evidence: fixtureEvidence,
    decisions: [
      {
        market: {
          id: marketId,
          fixtureId: FIXTURE_ID,
          side: 'home_win',
          title: marketTitle,
        },
        simulation,
        decision,
      },
    ],
    execution: { attempted: 0, completed: 0, failed: 0, dryRun: true },
    ledger: {
      fixtureId: FIXTURE_ID,
      summary: ledgerSummary,
    },
  });

  const out = path.join(REPLAY_DIR, `${FIXTURE_ID}.${suffix === 'allocate' ? 'receipt' : `${suffix}.receipt`}.json`);
  fs.writeFileSync(out, JSON.stringify(receipt, null, 2) + '\n');
  return { out, decision, simulation, receipt };
}

// 1. ALLOCATE — the flagship scenario. Edge 5.6% clears the 5% gate.
const allocate = buildAndWrite({
  suffix: 'allocate',
  recommendation: {
    aiProbability: 0.68,
    marketOdds: 0.624,
    edge: 0.056,
    sizePct: 0.021,
  },
  direction: 'BUY YES',
  marketId: 'wc-18175981-home-win',
  marketTitle: 'France to beat Sweden (World Cup 2026-06-30)',
  createdAt: '2026-06-30T18:31:00.000Z',
  ledgerSummary: { marketsScanned: 1, candidatesFiltered: 1, forecastsMade: 1, runMode: 'advisory' },
});

console.log('ALLOCATE →', allocate.out);
console.log('  verdict:', allocate.decision.verdict, '| executionEligible:', allocate.decision.executionEligible);
console.log('  winProbability:', allocate.simulation.winProbability, '| lossProbability:', allocate.simulation.lossProbability);
console.log('  contentHash:', allocate.receipt.proof.integrity.contentHash);
console.log('  riskChecks:', allocate.decision.riskChecks.map((c) => `${c.id}=${c.passed}`).join(', '));

// 2. PASS — same fixture, but the agent's fair probability is only 0.65 vs
//    implied 0.624, giving edge 0.026 — below the 5% threshold. The policy
//    gate fires and the agent declines to act. This is the policy-bound
//    refusal path: a successful autonomous decision that chose NOT to act.
const pass = buildAndWrite({
  suffix: 'pass',
  recommendation: {
    aiProbability: 0.65,
    marketOdds: 0.624,
    edge: 0.026,
    sizePct: 0,
  },
  direction: 'BUY YES',
  marketId: 'wc-18175981-home-win-pass',
  marketTitle: 'France to beat Sweden (World Cup 2026-06-30) — PASS scenario',
  createdAt: '2026-06-30T18:31:00.000Z',
  ledgerSummary: { marketsScanned: 1, candidatesFiltered: 1, forecastsMade: 0, runMode: 'advisory' },
});

console.log('\nPASS    →', pass.out);
console.log('  verdict:', pass.decision.verdict, '| executionEligible:', pass.decision.executionEligible);
console.log('  winProbability:', pass.simulation.winProbability, '| lossProbability:', pass.simulation.lossProbability);
console.log('  contentHash:', pass.receipt.proof.integrity.contentHash);
console.log('  riskChecks:', pass.decision.riskChecks.map((c) => `${c.id}=${c.passed}`).join(', '));
console.log('  rationale:', pass.decision.rationale);
