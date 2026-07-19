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
const PROVIDER_STATUS = {
  healthy:     { dot: 'bg-green-500',  text: 'text-green-300',  bg: 'bg-green-500/10'  },
  degraded:    { dot: 'bg-yellow-500', text: 'text-yellow-300', bg: 'bg-yellow-500/10' },
  unreachable: { dot: 'bg-red-500',    text: 'text-red-300',    bg: 'bg-red-500/10'    },
  disabled:    { dot: 'bg-gray-500',   text: 'text-gray-400',   bg: 'bg-gray-500/10'   },
};

/**
 * Aggregate summary — the rollup across all providers.
 * `loading` is for the initial pre-fetch state.
 */
const SUMMARY_STATUS = {
  all_healthy: { dot: 'bg-green-500',  text: 'text-green-300',  bg: 'bg-green-500/10',  border: 'border-green-500/20'  },
  degraded:    { dot: 'bg-yellow-500', text: 'text-yellow-300', bg: 'bg-yellow-500/10', border: 'border-yellow-500/20' },
  loading:     { dot: 'bg-gray-500',   text: 'text-gray-400',   bg: 'bg-gray-500/10',   border: 'border-gray-500/20'   },
};

/** Returns `{ dot, text, bg }` appearance for a per-provider status. */
export function getProviderStatusAppearance(status) {
  return PROVIDER_STATUS[status] || { dot: 'bg-gray-500', text: 'text-gray-400', bg: 'bg-gray-500/10' };
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
