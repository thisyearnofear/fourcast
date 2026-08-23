/**
 * Shared arena/live-feed UI grammar — single source of truth.
 *
 * Used by AgentRail, /arena lanes, AgentTrackRecord. Verdict
 * color semantics come from tokens.css (design.md):
 *   ALLOCATE/emerald (acted), PASS/muted (declined), PAPER/violet (simulated),
 *   SETTLED/amber (reconciled), BREACH/red (violated).
 */

export const VERDICT_STYLE = {
  ALLOCATE: { color: 'var(--color-accent)', border: 'var(--color-accent)', label: 'ALLOCATE' },
  PASS: { color: 'var(--color-ink-faint)', border: 'var(--color-rule-strong)', label: 'PASS' },
  PAPER: { color: 'var(--color-review)', border: 'var(--color-review)', label: 'PAPER' },
  EXEC: { color: 'var(--color-accent)', border: 'var(--color-accent)', label: 'EXEC' },
  EXECUTED: { color: 'var(--color-accent)', border: 'var(--color-accent)', label: 'EXECUTED' },
  executed: { color: 'var(--color-accent)', border: 'var(--color-accent)', label: 'EXECUTED' },
  dry_run: { color: 'var(--color-ink-faint)', border: 'var(--color-rule-strong)', label: 'SIMULATED' },
  paper: { color: 'var(--color-review)', border: 'var(--color-review)', label: 'PAPER' },
  skipped_slippage: { color: 'var(--color-sealed)', border: 'var(--color-sealed)', label: 'SLIPPAGE-SKIP' },
};

export const VERDICT_COLORS = Object.fromEntries(
  Object.entries(VERDICT_STYLE).map(([k, v]) => [k, v.color])
);

/** Past-tense compact age: '12m', '3.2h', '2d' */
export function ago(ts) {
  const s = Math.max(0, (Date.now() - new Date(ts).getTime()) / 1000);
  if (s < 60) return `${Math.floor(s)}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${(s / 3600).toFixed(1)}h`;
  return `${Math.floor(s / 86400)}d`;
}

/** Past-tense with 'ago' suffix for sentence contexts: '12m ago' */
export function timeAgo(ts) {
  return `${ago(ts)} ago`;
}

/** Future-tense countdown: 'in 4h', 'settling' */
export function until(ts) {
  const s = (new Date(ts).getTime() - Date.now()) / 1000;
  if (s <= 0) return 'settling';
  if (s < 3600) return `in ${Math.floor(s / 60)}m`;
  return `in ${(s / 3600).toFixed(1)}h`;
}
