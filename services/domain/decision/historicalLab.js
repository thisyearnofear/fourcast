/**
 * Pure timing rules for Fourcast's historical agent lab.
 *
 * A historical run must not make an outcome available to the decision phase.
 * These helpers make that invariant explicit and independently testable.
 */

export function historicalTimeline({ fixture, boundReceipt, replay } = {}) {
  const snapshotAt = validTime(boundReceipt?.proof?.evidence?.snapshot?.capturedAt);
  const kickoffAt = validTime(boundReceipt?.proof?.evidence?.fixture?.kickoff || fixture?.kickoff);
  const outcomeAvailableAt = validTime(replay?.proof?.ts || replay?.finalScore?.ts);
  const decisionAvailableAt = snapshotAt || (kickoffAt ? new Date(kickoffAt.getTime() - 2 * 60 * 60 * 1000) : null);

  return {
    decisionAvailableAt: decisionAvailableAt?.toISOString() || null,
    outcomeAvailableAt: outcomeAvailableAt?.toISOString() || null,
    valid: Boolean(
      decisionAvailableAt &&
        outcomeAvailableAt &&
        decisionAvailableAt.getTime() < outcomeAvailableAt.getTime(),
    ),
  };
}

export function historicalPhase({ agentTime, timeline, hasReceipt = false, reconciled = false } = {}) {
  const now = validTime(agentTime);
  const decisionAt = validTime(timeline?.decisionAvailableAt);
  const outcomeAt = validTime(timeline?.outcomeAvailableAt);

  if (!now || !timeline?.valid || !decisionAt || !outcomeAt) return 'unavailable';
  if (!hasReceipt && now.getTime() >= decisionAt.getTime() && now.getTime() < outcomeAt.getTime()) return 'decide';
  if (hasReceipt && !reconciled && now.getTime() >= outcomeAt.getTime()) return 'reconcile';
  if (reconciled) return 'complete';
  return 'waiting';
}

export function assertNoLookahead({ receiptCreatedAt, timeline } = {}) {
  const createdAt = validTime(receiptCreatedAt);
  const outcomeAt = validTime(timeline?.outcomeAvailableAt);
  return Boolean(timeline?.valid && createdAt && outcomeAt && createdAt.getTime() < outcomeAt.getTime());
}

function validTime(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}
