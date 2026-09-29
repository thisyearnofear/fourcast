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

/**
 * A cycle older than this is stalled — the arena worker runs every 5 min,
 * so 30 min of silence means six missed cycles (never a fake green lamp).
 */
export const CYCLE_STALE_AFTER_MS = 30 * 60 * 1000;

/**
 * Liveness for the rail lamp. `staleFlag` is the feed's own snapshot marker
 * (`stale: true` from /api/arena/feed): a snapshot-served feed is never live,
 * even when the newest timestamp looks recent.
 */
export function cycleLiveness({ timestamp, staleFlag = false, now = Date.now() } = {}) {
  const ageMs = timestamp ? Math.max(0, now - new Date(timestamp).getTime()) : null;
  const stalled = ageMs != null && ageMs > CYCLE_STALE_AFTER_MS;
  const stale = Boolean(staleFlag) || stalled;
  // Motion is reserved for genuinely-live state (design.md): a stalled feed
  // keeps the amber lamp but stops animating.
  return { ageMs, stalled, stale, animated: ageMs != null && !stale };
}

/**
 * The rail lamp in one place: label + token color + whether it may animate.
 * Grammar: **motion means the lane just cycled; color means semantics** —
 * STALE/STALLED stop animating entirely, while a fresh PAPER (dry-run) cycle
 * still pulses because the agent is genuinely running, just in simulation.
 */
export function railLamp({ timestamp, staleFlag = false, dryRun = false, now = Date.now() } = {}) {
  const liveness = cycleLiveness({ timestamp, staleFlag, now });
  const label = liveness.stale ? (liveness.stalled ? 'STALLED' : 'STALE') : dryRun ? 'PAPER' : 'LIVE';
  const color = liveness.stale || dryRun ? 'var(--color-sealed)' : 'var(--color-accent)';
  return { ...liveness, label, color };
}

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
