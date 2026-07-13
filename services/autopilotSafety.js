/**
 * Pure autopilot safety helpers.
 *
 * Encapsulates status resolution, daily per-market deduplication, and daily
 * spend-cap math so the cron autopilot loop stays testable and deterministic.
 */

export function getExecutionStatus(execution) {
  if (!execution) return 'FAILED';
  if (execution.dryRun === true) return 'DRY_RUN';
  if (execution.success) return 'SUCCESS';
  return 'FAILED';
}

export function buildTradedTodaySet(executions) {
  return new Set(
    executions
      .filter((e) => e.execution_status === 'SUCCESS')
      .map((e) => e.market_id)
  );
}

export function computeSpentToday(executions) {
  return executions
    .filter((e) => e.execution_status === 'SUCCESS')
    .reduce((sum, e) => sum + (e.size_pct || 0), 0);
}

export function shouldSkipDedup(rec, tradedToday) {
  return tradedToday.has(rec.marketID);
}

export function shouldSkipCap(rec, spentToday, dailyCapPct) {
  return spentToday + rec.sizePct > dailyCapPct;
}

export function formatDryRunMessage(rec) {
  return `DRY RUN: would execute ${rec.direction} ${(rec.sizePct * 100).toFixed(1)}%`;
}
