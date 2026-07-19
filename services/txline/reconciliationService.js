/**
 * Reconciliation Service — binds a pre-event DecisionReceipt to the verified
 * post-event outcome and computes the adherence signal.
 *
 * This is the commercial core of Person 2's scope: "Fourcast lets an allocator
 * independently check what the agent knew, how it was constrained, whether it
 * followed policy, and how outcomes resolved."
 *
 * Pure functions only — no I/O. The API layer loads the receipt + proof +
 * (optional) Solana verification result and calls reconcile(). This keeps the
 * state machine trivially testable and deterministic for judging.
 *
 * Consumes the normalized receipt view from receiptAdapter.accept() — it never
 * touches Person 1's canonical schema directly, so schema changes are absorbed
 * by the adapter alone.
 *
 * State machine:
 *
 *   pending → proof_available → verified → reconciled
 *                 │                │
 *                 ↓                ↓
 *            proof_missing    onchain_mismatch
 *
 *   decision_unverifiable is terminal when the receipt lacks the fields needed
 *   to compare against the outcome. On-chain settlement is recorded in
 *   chain.settlementTx; RECONCILED is the terminal "all-done" status reached
 *   once the decision-vs-outcome comparison completes.
 */

import { accept, verifyIntegrity } from './receiptAdapter.js';
import { isPolicyAdherentDecision } from '../domain/decision/decisionPolicy.js';

export const RECONCILE_STATUS = {
  PENDING: 'pending',
  PROOF_AVAILABLE: 'proof_available',
  VERIFIED: 'verified',
  SETTLED: 'settled',
  RECONCILED: 'reconciled',
  PROOF_MISSING: 'proof_missing',
  ONCHAIN_MISMATCH: 'onchain_mismatch',
  DECISION_UNVERIFIABLE: 'decision_unverifiable',
};

/**
 * Derive the match winner from a TxLINE proof's statToProve / statToProve2.
 * statToProve.key=1 is home goals, statToProve2.key=2 is away goals.
 * Returns 'home' | 'away' | 'draw' | null.
 */
export function winnerFromProof(proof) {
  if (!proof) return null;
  const home = Number(proof.statToProve?.value);
  const away = Number(proof.statToProve2?.value);
  if (!Number.isFinite(home) || !Number.isFinite(away)) return null;
  if (home > away) return 'home';
  if (away > home) return 'away';
  return 'draw';
}

/**
 * Map the agent's pre-event position to the match-winner vocabulary
 * ('home' | 'away' | 'draw' | 'none'). The receipt's primary decision carries:
 *   - decision.direction: 'BUY YES' | 'BUY NO' (binary market direction)
 *   - decision.marketSide: 'home_win' | 'away_win' | 'draw' (what the market is)
 * The adapter exposes these as decision.direction and decision.marketSide.
 * Returns null when the position can't be determined.
 */
export function positionDirectionFromReceipt(receipt) {
  const d = receipt?.decision || {};
  const verdict = (d.verdict || '').toString().toUpperCase();
  if (verdict === 'PASS' || verdict === 'REVIEW') return 'none';

  const side = (d.marketSide || '').toString().toLowerCase();
  const direction = (d.direction || '').toString().toUpperCase();

  if (side === 'home_win' || side === 'home') {
    return direction === 'BUY NO' ? 'away' : 'home';
  }
  if (side === 'away_win' || side === 'away') {
    return direction === 'BUY NO' ? 'home' : 'away';
  }
  if (side === 'draw') return 'draw';

  // Fallback: try a direct side field on the decision
  const direct = (d.side || d.position || '').toString().toLowerCase();
  if (direct.includes('home')) return 'home';
  if (direct.includes('away')) return 'away';
  if (direct.includes('draw')) return 'draw';

  return null;
}

/**
 * Did the agent's policy gates actually pass for the decision taken?
 * A PASS/REVIEW decision is "adherent" by definition (the agent declined to
 * act). An ALLOCATE decision is adherent only if every check in riskChecks
 * reports passed=true. Person 1's riskChecks use { passed } (not { ok }).
 */
export function policyAdhered(receipt) {
  return isPolicyAdherentDecision(receipt?.decision);
}

/**
 * Compute |predicted probability - actual outcome| for the position direction.
 * actual is 1 if the position won, 0 if it lost, 0.5 for a draw hedge.
 * Uses simulation.winProbability (Person 1's simulateBinaryMarket output).
 * Returns null when no probability estimate is available.
 */
export function calibrationError(receipt, winner) {
  const dir = positionDirectionFromReceipt(receipt);
  if (!dir || dir === 'none' || !winner) return null;
  const pred = Number(receipt?.simulation?.winProbability);
  if (!Number.isFinite(pred)) return null;
  const actual = dir === winner ? 1 : winner === 'draw' ? 0.5 : 0;
  return Math.abs(pred - actual);
}

/**
 * The main entry point. Given a pre-event receipt (Person 1's canonical shape,
 * with the `proof` wrapper intact), a cached TxLINE proof, and an optional
 * on-chain verification result (from solanaVerify.verifyFixtureProof) and
 * optional settlement tx signature, produce the full reconciliation block.
 *
 * The receipt is accepted (normalized) internally for field access, but
 * integrity verification runs against the raw receipt so Person 1's
 * verifyDecisionReceipt hashes the original proof payload.
 *
 * All inputs are optional — the function degrades gracefully and reports the
 * most specific status it can. This is what makes the judge walkthrough
 * resilient: even if Solana RPC is down, the receipt + proof still tell a story.
 */
export function reconcile({ receipt, proof, verification = null, settlementTx = null, fixtureId = null } = {}) {
  const norm = receipt ? accept(receipt) : null;
  const fxId = fixtureId || norm?.fixtureId || proof?.fixtureId || null;
  const integrity = receipt ? verifyIntegrity(receipt) : null;
  const receiptHash = norm?.integrity?.contentHash || integrity?.actual || null;

  const winner = winnerFromProof(proof);
  const hasProof = Boolean(proof && proof.eventStatRoot && proof.statToProve);
  const verdict = verification?.verdict || null;

  // Chain status — most specific first.
  let status;
  if (!norm) {
    status = RECONCILE_STATUS.PROOF_MISSING;
  } else if (!hasProof) {
    status = RECONCILE_STATUS.PENDING;
  } else if (verdict === 'onchain-mismatch') {
    status = RECONCILE_STATUS.ONCHAIN_MISMATCH;
  } else if (verdict === 'verified') {
    status = RECONCILE_STATUS.VERIFIED;
  } else if (verdict === 'proof-present' || verdict === 'onchain-error') {
    // Proof complete; on-chain check inconclusive. Still reconcilable on the
    // proof alone — the on-chain anchor strengthens but is not required.
    status = RECONCILE_STATUS.PROOF_AVAILABLE;
  } else {
    status = RECONCILE_STATUS.PROOF_AVAILABLE;
  }

  // Decision-vs-outcome comparison.
  const dir = norm ? positionDirectionFromReceipt(norm) : null;
  const adhered = norm ? policyAdhered(norm) : null;
  const action = norm ? (norm.decision?.verdict || '').toString().toUpperCase() || null : null;

  let resolvedFavor = null;
  let decisionUnverifiable = false;
  if (receipt && hasProof) {
    if (dir === null) {
      decisionUnverifiable = true;
    } else if (dir === 'none') {
      resolvedFavor = null;
    } else if (winner) {
      resolvedFavor = dir === winner;
    }
  }

  if (decisionUnverifiable) {
    status = RECONCILE_STATUS.DECISION_UNVERIFIABLE;
  }

  // Promote to RECONCILED once the decision-vs-outcome comparison is complete.
  if (
    hasProof &&
    receipt &&
    !decisionUnverifiable &&
    (status === RECONCILE_STATUS.VERIFIED ||
      status === RECONCILE_STATUS.PROOF_AVAILABLE)
  ) {
    status = RECONCILE_STATUS.RECONCILED;
  }

  const calib = norm && winner ? calibrationError(norm, winner) : null;

  const outcome = hasProof
    ? {
        homeScore: Number(proof.statToProve?.value),
        awayScore: Number(proof.statToProve2?.value),
        winner,
        verifiedVia: verdict || 'proof-only',
        proofRef: receiptHash ? { receiptHash } : null,
        verificationTx: verification?.dailyRootPda ? { dailyRootPda: verification.dailyRootPda } : null,
        settlementTx: settlementTx || null,
      }
    : null;

  const decisionVsOutcome = norm
    ? {
        decisionType: action,
        positionDirection: dir,
        resolvedFavor,
        policyAdhered: adhered,
        allocationPct: norm.decision?.allocationPct ?? null,
        notes:
          dir === 'none'
            ? action === 'PASS'
              ? 'Agent declined to act; policy gate fired pre-event. No position to resolve.'
              : 'Agent flagged for review; no position taken.'
            : resolvedFavor === null
              ? 'Outcome not yet verified.'
              : resolvedFavor
                ? `Verified outcome favored the agent's ${dir} position.`
                : `Verified outcome went against the agent's ${dir} position.`,
      }
    : null;

  return {
    status,
    fixtureId: fxId,
    outcome,
    decisionVsOutcome,
    adherence: norm
      ? {
          policyAdhered: adhered,
          calibrationError: calib,
          policyAdherenceRate: adhered === null ? null : adhered ? 1 : 0,
        }
      : null,
    integrity: integrity
      ? {
          receiptHash,
          receiptIntact: integrity.ok,
          expectedHash: integrity.expected,
          actualHash: integrity.actual,
          reason: integrity.reason,
        }
      : null,
    chain: {
      receiptHash,
      proofPresent: hasProof,
      onchainVerdict: verdict,
      settlementTx: settlementTx || null,
    },
    updatedAt: new Date().toISOString(),
  };
}

const reconciliationService = {
  reconcile,
  winnerFromProof,
  positionDirectionFromReceipt,
  policyAdhered,
  calibrationError,
  RECONCILE_STATUS,
};

export default reconciliationService;
