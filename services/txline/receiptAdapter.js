/**
 * Decision Receipt Adapter — the stable boundary between Person 1's canonical
 * DecisionReceipt (services/domain/decision/) and the World Cup proof /
 * reconciliation loop.
 *
 * Person 1 owns the receipt schema, canonicalization, and hashing. This adapter
 * DELEGATES all integrity primitives to services/domain/decision/decisionReceipt.js
 * and only adds the World-Cup-specific binding: extracting a fixtureId, mapping
 * Person 1's `decisions[]` array into the single-decision shape the
 * reconciliation state machine consumes, and normalizing field-name drift so
 * the reconciliation layer never touches the receipt schema directly.
 *
 * The agent loop emits buildDecisionReceipt() output through the persisted run
 * ledger; this adapter consumes that shape without downstream translation.
 *
 * Canonical Person 1 receipt shape:
 *   {
 *     ...ledger,                    // denormalized run summary (optional)
 *     fixtureId?,                   // World-Cup binding (this adapter's concern)
 *     proof: {
 *       schemaVersion: 'decision-receipt/v1',
 *       id, createdAt,
 *       policy,                     // createDecisionPolicy() output
 *       evidence,                   // { sources, fixture?, ... }
 *       decisions: [{               // ARRAY of per-market decisions
 *         market: { id, ... },
 *         simulation,               // simulateBinaryMarket() output
 *         decision: {               // evaluateDecision() output
 *           verdict, allocationPct, executionEligible, rationale, riskChecks[]
 *         },
 *       }],
 *       execution: { attempted, ... },
 *       integrity: { algorithm, canonicalization, contentHash },
 *     },
 *   }
 */

import {
  canonicalize as canonicalizeReceipt,
  hashCanonical,
  buildDecisionReceipt,
  verifyDecisionReceipt,
  DECISION_RECEIPT_VERSION,
} from '../domain/decision/decisionReceipt.js';

// Re-export Person 1's integrity primitives so callers (and tests) have one
// import surface for the whole proof-of-decision chain. These are NOT
// re-implementations — they are the canonical functions.
export {
  canonicalizeReceipt,
  hashCanonical,
  buildDecisionReceipt,
  verifyDecisionReceipt,
  DECISION_RECEIPT_VERSION,
};

/**
 * Accept any receipt-shaped input (Person 1's canonical shape, or a partial)
 * and return a normalized view the reconciliation layer can consume without
 * knowing the schema. Tolerant of:
 *   - the `proof` wrapper being present or absent (legacy agent_runs.summary)
 *   - `decisions` being an array or a single object
 *   - direction living in simulation.direction or decision.direction
 */
export function accept(input) {
  const src = input || {};
  const proof = src.proof || src;
  const decisions = Array.isArray(proof.decisions) ? proof.decisions : proof.decisions ? [proof.decisions] : [];
  const primary = decisions[0] || {};
  const decision = primary.decision || {};
  const simulation = primary.simulation || {};
  const market = primary.market || {};

  return {
    id: proof.id || src.id || null,
    schemaVersion: proof.schemaVersion || DECISION_RECEIPT_VERSION,
    createdAt: proof.createdAt || src.createdAt || null,
    fixtureId: src.fixtureId || proof.fixtureId || market.fixtureId || null,
    policy: proof.policy || src.policy || {},
    evidence: proof.evidence || src.evidence || {},
    decisions,
    execution: proof.execution || src.execution || {},
    integrity: proof.integrity || src.integrity || null,
    // Convenience views for the reconciliation layer (single-decision projection):
    decision: {
      verdict: decision.verdict || null,
      allocationPct: decision.allocationPct ?? null,
      executionEligible: decision.executionEligible ?? null,
      rationale: decision.rationale || null,
      riskChecks: decision.riskChecks || [],
      marketId: market.id || null,
      marketSide: market.side || market.marketSide || null,
      direction: simulation.direction || decision.direction || null,
    },
    simulation: {
      winProbability: simulation.winProbability ?? null,
      lossProbability: simulation.lossProbability ?? null,
      expectedReturn: simulation.expectedReturn ?? null,
      interval: simulation.interval || null,
      runs: simulation.runs ?? null,
      seed: simulation.seed ?? null,
      direction: simulation.direction || null,
    },
  };
}

/**
 * Verify a receipt's integrity by delegating to Person 1's verifyDecisionReceipt.
 * Returns { ok, expected, actual, reason } in the shape the reconciliation
 * layer and UI expect, mapped from Person 1's { valid, expectedHash, actualHash, reason }.
 */
export function verifyIntegrity(receipt) {
  const result = verifyDecisionReceipt(receipt);
  return {
    ok: Boolean(result.valid),
    expected: result.expectedHash || null,
    actual: result.actualHash || null,
    reason: result.reason || null,
    algorithm: receipt?.proof?.integrity?.algorithm || 'sha256',
    canonicalization: receipt?.proof?.integrity?.canonicalization || null,
  };
}

/**
 * The receipt content hash — the "proof of decision" commitment. Delegates to
 * Person 1's hashCanonical over the canonical receipt payload.
 */
export function hash(receipt) {
  const proof = receipt?.proof || receipt;
  if (!proof) return null;
  const { integrity, ...payload } = proof;
  return hashCanonical(payload);
}

const receiptAdapter = {
  accept,
  verifyIntegrity,
  hash,
  canonicalizeReceipt,
  hashCanonical,
  buildDecisionReceipt,
  verifyDecisionReceipt,
  DECISION_RECEIPT_VERSION,
};

export default receiptAdapter;
