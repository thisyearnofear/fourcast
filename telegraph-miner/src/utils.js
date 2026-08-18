/**
 * Utility functions for the Telegraph miner.
 */

/**
 * Normalize a team name for fuzzy matching.
 * Strips common suffixes (FC, SC, United, City) and lowercases.
 */
export function normalizeTeamName(name) {
  if (!name) return '';
  return name
    .toLowerCase()
    .trim()
    .replace(/\b(fc|sc|cf|afc|utd)\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Fuzzy match a normalized search term against a TxLINE participant name.
 * Returns true if the search term is contained in the participant name
 * (after normalization) or vice versa.
 */
export function fuzzyMatch(normalizedSearch, participantName) {
  if (!normalizedSearch || !participantName) return false;
  const normalized = normalizeTeamName(participantName);
  // Exact match
  if (normalized === normalizedSearch) return true;
  // Containment (either direction)
  if (normalized.includes(normalizedSearch)) return true;
  if (normalizedSearch.includes(normalized)) return true;
  // Word-start match (e.g. "miami" matches "inter miami")
  const words = normalized.split(' ');
  if (words.some((w) => w.startsWith(normalizedSearch))) return true;
  const searchWords = normalizedSearch.split(' ');
  if (searchWords.some((w) => words.includes(w))) return true;
  return false;
}

/**
 * Format a TxLINE timestamp (ms epoch) to ISO string.
 */
export function toIso(ts) {
  if (!ts) return null;
  const n = Number(ts);
  if (!Number.isFinite(n) || n <= 0) return null;
  return new Date(n).toISOString();
}

/**
 * Get today's date as ISO date string (YYYY-MM-DD).
 */
export function todayIso() {
  return new Date().toISOString().slice(0, 10);
}
