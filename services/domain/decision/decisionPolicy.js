/**
 * Versioned policy gates for autonomous decisions.
 *
 * This is deliberately pure. The agent loop, UI, and any future execution
 * adapter must consume the same verdict instead of re-implementing thresholds.
 */

export const DECISION_POLICY_VERSION = 'decision-policy/v1';

export const DEFAULT_DECISION_POLICY = Object.freeze({
  version: DECISION_POLICY_VERSION,
  minAbsoluteEdge: 0.05,
  maxAllocationPct: 0.25,
  maxLossProbability: 0.75,
  simulationRuns: 10_000,
});

export function createDecisionPolicy(overrides = {}) {
  const policy = { ...DEFAULT_DECISION_POLICY, ...overrides };
  return Object.freeze({
    ...policy,
    minAbsoluteEdge: clamp(policy.minAbsoluteEdge, 0, 1),
    maxAllocationPct: clamp(policy.maxAllocationPct, 0, 1),
    maxLossProbability: clamp(policy.maxLossProbability, 0, 1),
    simulationRuns: Math.max(100, Math.min(Math.floor(Number(policy.simulationRuns) || 0), 100_000)),
  });
}

/**
 * Returns a terminal verdict and every gate considered. PASS is intentional:
 * a policy-bound refusal is a successful autonomous decision.
 */
export function evaluateDecision({ recommendation, simulation, policy = DEFAULT_DECISION_POLICY }) {
  const activePolicy = createDecisionPolicy(policy);
  const edge = Number(recommendation?.edge);
  const allocationPct = Number(recommendation?.sizePct);
  const marketOdds = Number(recommendation?.marketOdds);
  const probability = Number(recommendation?.aiProbability);
  const checks = [
    check('valid-inputs', Number.isFinite(probability) && probability > 0 && probability < 1 && Number.isFinite(marketOdds) && marketOdds > 0 && marketOdds < 1, 'A valid fair probability and market price are required.'),
    check('minimum-edge', Number.isFinite(edge) && Math.abs(edge) >= activePolicy.minAbsoluteEdge, `Absolute edge must be at least ${(activePolicy.minAbsoluteEdge * 100).toFixed(1)}%.`),
    check('positive-allocation', Number.isFinite(allocationPct) && allocationPct > 0, 'Kelly sizing must produce a positive allocation.'),
    check('allocation-cap', Number.isFinite(allocationPct) && allocationPct <= activePolicy.maxAllocationPct, `Allocation must not exceed ${(activePolicy.maxAllocationPct * 100).toFixed(1)}% of capital.`),
    check('tail-loss-limit', Number.isFinite(simulation?.lossProbability) && simulation.lossProbability <= activePolicy.maxLossProbability, `Simulated loss probability must not exceed ${(activePolicy.maxLossProbability * 100).toFixed(0)}%.`),
  ];

  const invalidInputs = !checks[0].passed;
  const riskFailure = checks.slice(2).some((item) => !item.passed);
  const edgeFailure = !checks[1].passed;
  const verdict = invalidInputs ? 'REVIEW' : (edgeFailure || riskFailure ? 'PASS' : 'ALLOCATE');

  return {
    verdict,
    allocationPct: verdict === 'ALLOCATE' ? allocationPct : 0,
    executionEligible: verdict === 'ALLOCATE',
    rationale: verdict === 'ALLOCATE'
      ? `Policy cleared: ${(allocationPct * 100).toFixed(1)}% allocation within risk limits.`
      : verdict === 'PASS'
        ? checks.filter((item) => !item.passed).map((item) => item.label).join(' · ')
        : 'Review required: incomplete or invalid market inputs.',
    riskChecks: checks,
  };
}

/** Shared adherence semantics for reconciliation and allocator reporting. */
export function isPolicyAdherentDecision(decision) {
  const verdict = String(decision?.verdict || '').toUpperCase();
  if (verdict === 'PASS' || verdict === 'REVIEW') return true;
  if (verdict !== 'ALLOCATE') return false;
  const checks = decision.riskChecks;
  return Array.isArray(checks) && checks.length > 0 && checks.every((check) => check?.passed === true);
}

function check(id, passed, description) {
  return { id, label: id.replace(/-/g, ' '), passed: Boolean(passed), description };
}

function clamp(value, minimum, maximum) {
  const number = Number(value);
  if (!Number.isFinite(number)) return minimum;
  return Math.min(maximum, Math.max(minimum, number));
}
