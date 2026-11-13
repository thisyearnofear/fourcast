/**
 * Receipts a person opened or was sent. Local only. The home page
 * rechecks them and says when the resolution status changes.
 */
const KEY = 'fourcast:watched';
const MAX = 5;

export function readWatched() {
  if (typeof window === 'undefined') return [];
  try {
    const raw = JSON.parse(window.localStorage.getItem(KEY) || '[]');
    if (!Array.isArray(raw)) return [];
    return raw.filter((row) => row && row.fixtureId).slice(0, MAX);
  } catch {
    return [];
  }
}

export function watchReceipt(entry, { silent = false } = {}) {
  if (!entry?.fixtureId || typeof window === 'undefined') return readWatched();
  const fixtureId = String(entry.fixtureId);
  const prev = readWatched().find((row) => String(row.fixtureId) === fixtureId);
  const rest = readWatched().filter((row) => String(row.fixtureId) !== fixtureId);
  const next = [{
    fixtureId,
    home: entry.home || prev?.home || null,
    away: entry.away || prev?.away || null,
    hash: entry.hash || prev?.hash || null,
    status: entry.status !== undefined ? entry.status : (prev?.status || null),
    at: Date.now(),
  }, ...rest].slice(0, MAX);
  try {
    window.localStorage.setItem(KEY, JSON.stringify(next));
    if (!silent) window.dispatchEvent(new CustomEvent('fourcast:watched'));
  } catch {
    /* storage disabled */
  }
  return next;
}

/** mismatch before match: "onchain_mismatch" contains the letters of "match". */
export function receiptPhrase(status, changed) {
  const value = status ? String(status) : '';
  let line = 'Still sealed. Check back after it resolves.';
  if (value.includes('mismatch')) line = 'The receipt and the chain disagree.';
  else if (value) line = 'Resolved. Open it and see if the call held.';
  return changed ? `Updated. ${line}` : line;
}
