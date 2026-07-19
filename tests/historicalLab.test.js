import { assertNoLookahead, historicalPhase, historicalTimeline } from '../services/domain/decision/historicalLab.js';

describe('historical agent lab timing', () => {
  const timeline = historicalTimeline({
    fixture: { kickoff: '2026-06-30T20:59:10.611Z' },
    boundReceipt: { proof: { evidence: { snapshot: { capturedAt: '2026-06-30T18:30:00.000Z' } } } },
    replay: { proof: { ts: 1782859997246 } },
  });

  it('derives a valid pre-outcome timeline from persisted TxLINE artifacts', () => {
    expect(timeline).toEqual({
      decisionAvailableAt: '2026-06-30T18:30:00.000Z',
      outcomeAvailableAt: '2026-06-30T22:53:17.246Z',
      valid: true,
    });
  });

  it('does not reveal the proof while a decision can be made', () => {
    expect(historicalPhase({ agentTime: '2026-06-30T18:30:00.000Z', timeline })).toBe('decide');
    expect(historicalPhase({ agentTime: '2026-06-30T22:00:00.000Z', timeline, hasReceipt: true })).toBe('waiting');
    expect(historicalPhase({ agentTime: '2026-06-30T22:53:17.246Z', timeline, hasReceipt: true })).toBe('reconcile');
  });

  it('rejects a receipt created after the outcome became available', () => {
    expect(assertNoLookahead({ receiptCreatedAt: '2026-06-30T18:30:00.000Z', timeline })).toBe(true);
    expect(assertNoLookahead({ receiptCreatedAt: '2026-06-30T22:53:17.246Z', timeline })).toBe(false);
  });
});
