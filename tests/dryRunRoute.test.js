import { describe, it, expect } from 'vitest';
import { POST } from '../app/api/agent/dry-run/route';

function mockRequest(body) {
  return {
    json: async () => body,
    headers: new Map(),
  };
}

describe('POST /api/agent/dry-run', () => {
  it('returns the canonical receipt shape for the demo fixture with default policy', async () => {
    const res = await POST(mockRequest({}));
    const json = await res.json();

    expect(json.success).toBe(true);
    // Fixture resolved to France v Sweden
    expect(json.fixture.id).toBe('18175981');
    expect(json.fixture.home.name).toBe('France');
    expect(json.fixture.away.name).toBe('Sweden');
    // Policy is the versioned decision policy
    expect(json.policy.version).toBe('decision-policy/v1');
    expect(json.policy.minAbsoluteEdge).toBe(0.05);
    expect(json.policy.maxAllocationPct).toBe(0.03);
    // Recommendation is derived from the canonical odds (home 0.61 + forcedEdge 0.056)
    expect(json.recommendation.marketOdds).toBeCloseTo(0.61, 5);
    expect(json.recommendation.aiProbability).toBeCloseTo(0.666, 3);
    expect(json.recommendation.edge).toBeCloseTo(0.056, 5);
    // Simulation ran
    expect(json.simulation.valid).toBe(true);
    expect(json.simulation.runs).toBe(10_000);
    expect(json.simulation.winProbability).toBeGreaterThan(0);
    expect(json.simulation.lossProbability).toBeGreaterThan(0);
    // Decision has a verdict and gate checks
    expect(['ALLOCATE', 'PASS', 'REVIEW']).toContain(json.decision.verdict);
    expect(json.decision.riskChecks.length).toBe(5);
    // Receipt has integrity hash
    expect(json.receipt.proof.integrity.algorithm).toBe('sha256');
    expect(json.receipt.proof.integrity.contentHash).toMatch(/^[0-9a-f]{64}$/);
    // Dry-run never executes
    expect(json.receipt.proof.execution.dryRun).toBe(true);
    expect(json.receipt.proof.execution.attempted).toBe(0);
  });

  it('respects a custom policy — raising min edge forces PASS when edge < min', async () => {
    // Edge is ~0.056. Setting minAbsoluteEdge to 0.10 should fail the
    // minimum-edge gate and produce a PASS verdict.
    const res = await POST(
      mockRequest({
        fixtureId: '18175981',
        minAbsoluteEdge: 0.10,
        maxAllocationPct: 0.03,
        maxLossProbability: 0.75,
        simulationRuns: 1000,
      }),
    );
    const json = await res.json();

    expect(json.success).toBe(true);
    expect(json.policy.minAbsoluteEdge).toBe(0.10);
    expect(json.decision.verdict).toBe('PASS');
    expect(json.decision.allocationPct).toBe(0);
    const minEdgeGate = json.decision.riskChecks.find((g) => g.id === 'minimum-edge');
    expect(minEdgeGate.passed).toBe(false);
  });

  it('respects a custom policy — lowering max loss probability forces PASS when loss > limit', async () => {
    // Loss probability for a 0.666 fair prob is ~0.334. Setting maxLossProbability
    // to 0.20 should fail the tail-loss gate and produce PASS.
    const res = await POST(
      mockRequest({
        fixtureId: '18175981',
        minAbsoluteEdge: 0.05,
        maxAllocationPct: 0.03,
        maxLossProbability: 0.20,
        simulationRuns: 1000,
      }),
    );
    const json = await res.json();

    expect(json.success).toBe(true);
    expect(json.decision.verdict).toBe('PASS');
    const tailGate = json.decision.riskChecks.find((g) => g.id === 'tail-loss-limit');
    expect(tailGate.passed).toBe(false);
  });

  it('returns 404 for an unknown fixture id', async () => {
    const res = await POST(mockRequest({ fixtureId: '99999999' }));
    const json = await res.json();

    expect(res.status).toBe(404);
    expect(json.success).toBe(false);
    expect(json.error).toContain('99999999');
  });

  it('clamps invalid policy values to safe bounds', async () => {
    const res = await POST(
      mockRequest({
        fixtureId: '18175981',
        minAbsoluteEdge: -1, // clamps to 0
        maxAllocationPct: 5, // clamps to 1
        maxLossProbability: 2, // clamps to 1
        simulationRuns: 10, // clamps to 100
      }),
    );
    const json = await res.json();

    expect(json.success).toBe(true);
    expect(json.policy.minAbsoluteEdge).toBe(0);
    expect(json.policy.maxAllocationPct).toBe(1);
    expect(json.policy.maxLossProbability).toBe(1);
    expect(json.policy.simulationRuns).toBe(100);
  });
});
