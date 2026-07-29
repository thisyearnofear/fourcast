import { isPolicyAdherentDecision } from './decisionPolicy.js';

/**
 * Aggregate trust metrics over stored agent-run summaries.
 *
 * Pure: takes already-parsed summary objects (the `summary` column of
 * agent_runs, JSON-parsed). Each summary is a DecisionReceipt: decisions
 * live at summary.proof.decisions and integrity metadata at
 * summary.proof.integrity.contentHash.
 */
export function deriveReceiptStats(summaries = []) {
  const list = Array.isArray(summaries) ? summaries : [];

  let sealedDecisions = 0;
  let totalDecisions = 0;
  let disciplined = 0;
  let adherent = 0;

  for (const summary of list) {
    const proof = summary?.proof;
    if (proof?.integrity?.contentHash) sealedDecisions += 1;

    const decisions = Array.isArray(proof?.decisions) ? proof.decisions : [];
    for (const entry of decisions) {
      const decision = entry?.decision;
      if (!decision) continue;
      totalDecisions += 1;
      const verdict = String(decision.verdict || '').toUpperCase();
      if (verdict === 'PASS' || verdict === 'REVIEW') disciplined += 1;
      if (isPolicyAdherentDecision(decision)) adherent += 1;
    }
  }

  return {
    total: list.length,
    sealedDecisions,
    totalDecisions,
    disciplineRate: totalDecisions > 0 ? disciplined / totalDecisions : null,
    policyAdherenceRate: totalDecisions > 0 ? adherent / totalDecisions : null,
  };
}

export default deriveReceiptStats;
