import { describe, expect, it } from 'vitest';
import { deriveReceiptStats } from '@/services/domain/decision/receiptStats.js';

function summaryWith({ sealed = true, decisions = [] } = {}) {
  return {
    proof: {
      ...(sealed ? { integrity: { algorithm: 'sha256', contentHash: 'a'.repeat(64) } } : {}),
      decisions,
    },
  };
}

describe('deriveReceiptStats', () => {
  it('returns zeros and null rates for empty input', () => {
    expect(deriveReceiptStats([])).toEqual({
      total: 0,
      sealedDecisions: 0,
      totalDecisions: 0,
      disciplineRate: null,
      policyAdherenceRate: null,
    });
    expect(deriveReceiptStats(undefined).total).toBe(0);
    expect(deriveReceiptStats(null).total).toBe(0);
  });

  it('counts only summaries with integrity metadata as sealed', () => {
    const stats = deriveReceiptStats([
      summaryWith({ sealed: true }),
      summaryWith({ sealed: false }),
      {},
      { proof: {} },
    ]);
    expect(stats.total).toBe(4);
    expect(stats.sealedDecisions).toBe(1);
  });

  it('derives discipline rate from PASS and REVIEW verdicts', () => {
    const stats = deriveReceiptStats([
      summaryWith({
        decisions: [
          { decision: { verdict: 'PASS' } },
          { decision: { verdict: 'REVIEW' } },
          { decision: { verdict: 'ALLOCATE', riskChecks: [{ passed: true }] } },
          { decision: { verdict: 'ALLOCATE', riskChecks: [{ passed: false }] } },
        ],
      }),
    ]);
    expect(stats.totalDecisions).toBe(4);
    expect(stats.disciplineRate).toBe(0.5);
  });

  it('derives adherence via shared policy semantics', () => {
    const stats = deriveReceiptStats([
      summaryWith({
        decisions: [
          { decision: { verdict: 'PASS' } },
          { decision: { verdict: 'ALLOCATE', riskChecks: [{ passed: true }] } },
          { decision: { verdict: 'ALLOCATE', riskChecks: [{ passed: false }] } },
          { decision: { verdict: 'ALLOCATE', riskChecks: [] } },
        ],
      }),
    ]);
    // PASS + fully-passing ALLOCATE are adherent; failed/empty checks are not.
    expect(stats.policyAdherenceRate).toBe(0.5);
  });

  it('skips entries without a decision object', () => {
    const stats = deriveReceiptStats([
      summaryWith({ decisions: [{}, null, { decision: { verdict: 'PASS' } }] }),
    ]);
    expect(stats.totalDecisions).toBe(1);
    expect(stats.disciplineRate).toBe(1);
  });
});
