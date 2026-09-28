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

/**
 * TxLINE competition id for a name/alias, or null for "no filter".
 * Unknown names are null too: filtering on a guess would hide the fixture.
 *
 * Ids read from the live snapshot 2026-09-28. 500001 is NFL — it was mapped
 * to "premier league" before, which sent every PL ask to NFL fixtures.
 */
export function txlineCompetitionId(input) {
  if (!input) return null;
  const n = Number(input);
  if (Number.isFinite(n) && n > 0) return n;
  const MAP = {
    'premier league': 8,
    pl: 8,
    epl: 8,
    'english premier league': 8,
    mls: 33,
    'major league soccer': 33,
    nfl: 500001,
    'national football league': 500001,
  };
  return MAP[String(input).toLowerCase().trim()] ?? null;
}

/**
 * How well a search names a TxLINE participant (0 = not this team). Every
 * word of the search must appear, so "Manchester City" never matches
 * Manchester United; an exact name outranks a containing one ("Arsenal" over
 * "Arsenal U21").
 */
export function participantScore(search, participant) {
  const s = normalizeTeamName(search);
  const p = normalizeTeamName(participant);
  if (!s || !p) return 0;
  if (p === s) return 4;
  const words = new Set(p.split(' '));
  const need = s.split(' ').filter(Boolean);
  if (!need.every((w) => words.has(w))) return 0;
  return need.length === words.size ? 4 : 3 - Math.min(2, words.size - need.length) * 0.5;
}

/** Home/away from a TxLINE fixture, honouring Participant1IsHome. */
export function sidesOf(fixture) {
  const p1 = fixture?.Participant1 || null;
  const p2 = fixture?.Participant2 || null;
  return fixture?.Participant1IsHome === false ? { home: p2, away: p1, swapped: true } : { home: p1, away: p2, swapped: false };
}
