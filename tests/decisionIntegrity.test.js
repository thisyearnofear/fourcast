import { describe, expect, it } from 'vitest';
import { createDecisionPolicy, evaluateDecision, isPolicyAdherentDecision } from '../services/domain/decision/decisionPolicy.js';
import { deriveSimulationSeed, simulateBinaryMarket } from '../services/domain/decision/simulation.js';
import { buildDecisionReceipt, canonicalize, verifyDecisionReceipt } from '../services/domain/decision/decisionReceipt.js';

describe('decision integrity', () => {
  const policy = createDecisionPolicy({ simulationRuns: 1_000 });
  const recommendation = {
    aiProbability: 0.65,
    marketOdds: 0.5,
    edge: 0.15,
    sizePct: 0.08,
  };

  it('replays an identical simulation from the same seed', () => {
    const seed = deriveSimulationSeed(['run-1', 'market-1', policy.version]);
    const first = simulateBinaryMarket({ probability: 0.65, marketOdds: 0.5, direction: 'BUY YES', runs: 1_000, seed });
    const second = simulateBinaryMarket({ probability: 0.65, marketOdds: 0.5, direction: 'BUY YES', runs: 1_000, seed });
    expect(first).toEqual(second);
  });

  it('returns an ALLOCATE verdict only when every policy gate passes', () => {
    const simulation = simulateBinaryMarket({ probability: 0.65, marketOdds: 0.5, direction: 'BUY YES', runs: 1_000, seed: 42 });
    const result = evaluateDecision({ recommendation, simulation, policy });
    expect(result.verdict).toBe('ALLOCATE');
    expect(result.executionEligible).toBe(true);
    expect(result.riskChecks.every((check) => check.passed)).toBe(true);
  });

  it('records PASS as a successful policy refusal for an insufficient edge', () => {
    const simulation = simulateBinaryMarket({ probability: 0.52, marketOdds: 0.5, direction: 'BUY YES', runs: 1_000, seed: 7 });
    const result = evaluateDecision({
      recommendation: { ...recommendation, aiProbability: 0.52, edge: 0.02, sizePct: 0 },
      simulation,
      policy,
    });
    expect(result.verdict).toBe('PASS');
    expect(result.executionEligible).toBe(false);
    expect(isPolicyAdherentDecision(result)).toBe(true);
  });

  it('does not call an allocation adherent when its risk evidence is missing', () => {
    expect(isPolicyAdherentDecision({ verdict: 'ALLOCATE', riskChecks: [] })).toBe(false);
  });

  it('uses canonical key ordering and detects receipt tampering', () => {
    expect(canonicalize({ b: 2, a: 1 })).toBe(canonicalize({ a: 1, b: 2 }));
    const simulation = simulateBinaryMarket({ probability: 0.65, marketOdds: 0.5, direction: 'BUY YES', runs: 1_000, seed: 42 });
    const receipt = buildDecisionReceipt({
      id: 'run-test',
      createdAt: '2026-07-19T00:00:00.000Z',
      policy,
      evidence: { sources: ['Polymarket'] },
      decisions: [{ market: { id: 'market-1' }, simulation, decision: evaluateDecision({ recommendation, simulation, policy }) }],
      execution: { attempted: 0 },
    });
    expect(verifyDecisionReceipt(receipt).valid).toBe(true);
    receipt.proof.decisions[0].market.id = 'tampered-market';
    expect(verifyDecisionReceipt(receipt).valid).toBe(false);
  });
});
