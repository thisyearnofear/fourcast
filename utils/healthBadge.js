/**
 * Shared health-status appearance helpers.
 *
 * Two consumers use this so the header pill in AppShell
 * (`components/StatusBadge.js`) and the public status panel
 * (`app/status/page.js`) never disagree on what "degraded" looks like.
 *
 * Same green / yellow / red / gray palette across both surfaces. Adding a
 * new state only requires editing this file.
 *
 * Earlier: each surface defined its own inline color map. The pill used
 * emerald/amber; the panel used green/yellow. Drift bug — same audit-class
 * fix as utils/signalTier.js.
 */

/**
 * Per-provider status (a single external dependency is healthy / degraded /
 * unreachable / disabled / unknown).
 */
// Palette is mapped to design.md semantic tokens so the status surface reads
// as part of the same evidence workspace, not a generic dark theme:
//   healthy     → verification emerald (live/verified)
//   degraded    → sealed amber (caution)
//   unreachable → breach red (failure)
//   disabled    → ink-faint (dormant)
const PROVIDER_STATUS = {
  healthy:     { dot: 'bg-accent',     text: 'text-accent',     bg: 'bg-accent/10'     },
  degraded:    { dot: 'bg-sealed',     text: 'text-sealed',     bg: 'bg-sealed/10'     },
  unreachable: { dot: 'bg-breach',     text: 'text-breach',     bg: 'bg-breach/10'     },
  disabled:    { dot: 'bg-ink-faint',  text: 'text-ink-faint',  bg: 'bg-ink-faint/10'  },
};

/**
 * Aggregate summary — the rollup across all providers.
 * `loading` is for the initial pre-fetch state.
 */
const SUMMARY_STATUS = {
  all_healthy: { dot: 'bg-accent',    text: 'text-accent',    bg: 'bg-accent/10',    border: 'border-accent/20'    },
  degraded:    { dot: 'bg-sealed',    text: 'text-sealed',    bg: 'bg-sealed/10',    border: 'border-sealed/20'    },
  loading:     { dot: 'bg-ink-faint', text: 'text-ink-faint', bg: 'bg-ink-faint/10', border: 'border-ink-faint/20' },
};

/** Returns `{ dot, text, bg }` appearance for a per-provider status. */
export function getProviderStatusAppearance(status) {
  return PROVIDER_STATUS[status] || { dot: 'bg-ink-faint', text: 'text-ink-faint', bg: 'bg-ink-faint/10' };
}

/** Returns `{ dot, text, bg, border }` appearance for an aggregate summary. */
export function getSummaryAppearance(summary) {
  return SUMMARY_STATUS[summary] || SUMMARY_STATUS.loading;
}

/** Full human label for the aggregate summary (used in tooltips + page hero). */
export const SUMMARY_LABEL = {
  all_healthy: 'All Systems Operational',
  degraded:    'Degraded Performance',
  loading:     'Checking provider health…',
};

/** Compact one-line label for the header pill. */
export const SUMMARY_SHORT_LABEL = {
  all_healthy: 'All systems OK',
  degraded:    'Degraded',
  loading:     'Checking…',
};

/** Polling cadence (milliseconds). Shared by the header pill and the panel. */
export const HEALTH_POLL_MS = 30_000;
