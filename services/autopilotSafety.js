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

/**
 * Statuses that count toward dedup/cap. Live mode counts only real trades;
 * dry-run mode ALSO counts prior DRY_RUN rows so a rehearsal exercises the
 * same rails (skip-repeat, cap-out) that live trading will hit.
 */
export function countedStatuses(dryRun) {
  return dryRun ? ['SUCCESS', 'DRY_RUN'] : ['SUCCESS'];
}

export function buildTradedTodaySet(executions, statuses = ['SUCCESS']) {
  return new Set(
    executions
      .filter((e) => statuses.includes(e.execution_status))
      .map((e) => e.market_id)
  );
}

export function computeSpentToday(executions, statuses = ['SUCCESS']) {
  return executions
    .filter((e) => statuses.includes(e.execution_status))
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
