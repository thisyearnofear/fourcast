/**
 * Market edge & confidence utilities — single source of truth.
 *
 * Every surface that derives a confidence label or tint from an edge score
 * (landing instrument, market cards, signals) imports from here so the
 * thresholds never drift across consumers.
 *
 * Edge is a signed number in [-1, 1]:
 *   > 0  → BUY YES has the edge
 *   < 0  → BUY NO has the edge
 *   0    → no edge
 *
 * Confidence bands:
 *   |edge| >= 0.15 → HIGH   (emerald / accent)
 *   |edge| >= 0.08 → MED    (amber / sealed)
 *   otherwise      → LOW    (violet / review)
 */

export const EDGE_THRESHOLD_HIGH = 0.15;
export const EDGE_THRESHOLD_MED = 0.08;

export const CONFIDENCE_LABELS = {
  HIGH: 'HIGH',
  MED: 'MED',
  LOW: 'LOW',
};

export const CONFIDENCE_TINTS = {
  HIGH: 'fc-status--positive',
  MED: 'fc-status--sealed',
  LOW: 'fc-status--review',
};

/**
 * Confidence label for a signed edge value.
 * @param {number|null|undefined} edge - signed edge in [-1, 1].
 * @returns {string} 'HIGH' | 'MED' | 'LOW' | '—'
 */
export function confidenceLabel(edge) {
  if (edge == null || Number.isNaN(edge)) return '—';
  const abs = Math.abs(edge);
  if (abs >= EDGE_THRESHOLD_HIGH) return CONFIDENCE_LABELS.HIGH;
  if (abs >= EDGE_THRESHOLD_MED) return CONFIDENCE_LABELS.MED;
  return CONFIDENCE_LABELS.LOW;
}

/**
 * CSS class for the confidence pill tint.
 * @param {number|null|undefined} edge - signed edge in [-1, 1].
 * @returns {string} fc-status--* class name.
 */
export function confidenceTint(edge) {
  if (edge == null || Number.isNaN(edge)) return CONFIDENCE_TINTS.LOW;
  const abs = Math.abs(edge);
  if (abs >= EDGE_THRESHOLD_HIGH) return CONFIDENCE_TINTS.HIGH;
  if (abs >= EDGE_THRESHOLD_MED) return CONFIDENCE_TINTS.MED;
  return CONFIDENCE_TINTS.LOW;
}

/**
 * Direction label for a signed edge.
 * @param {number|null|undefined} edge - signed edge in [-1, 1].
 * @returns {string} 'BUY YES' | 'BUY NO' | '—'
 */
export function directionFor(edge) {
  if (edge == null || Number.isNaN(edge)) return '—';
  return edge >= 0 ? 'BUY YES' : 'BUY NO';
}

/**
 * Derive a signal string from a market's real edge data.
 * Returns null when there is no usable edge to surface (|edge| < 0.05).
 *
 * @param {{ title?: string, platform?: string, edgeScore?: number }} market
 * @returns {string|null} e.g. 'EDGE · POLYMARKET · Bitcoin $150k · +16.0%'
 */
export function signalFor(market) {
  const edge = market.edgeScore;
  if (typeof edge !== 'number' || Number.isNaN(edge) || Math.abs(edge) < 0.05) return null;
  const title = (market.title || '').replace(/\?$/, '').slice(0, 32);
  const sign = edge >= 0 ? '+' : '';
  const pct = (edge * 100).toFixed(1);
  const platform = (market.platform || 'polymarket').toUpperCase();
  return `EDGE · ${platform} · ${title} · ${sign}${pct}%`;
}

/**
 * Count markets with a meaningful edge (|edge| >= 0.05).
 * @param {Array<{ edgeScore?: number }>} markets
 * @returns {number}
 */
export function countEdges(markets) {
  return markets.filter(
    (m) => typeof m.edgeScore === 'number' && Math.abs(m.edgeScore) >= 0.05,
  ).length;
}
