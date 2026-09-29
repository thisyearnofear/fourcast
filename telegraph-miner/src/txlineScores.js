/**
 * Read a TxLINE score-event stream, the way the live feed actually shapes it
 * (measured 2026-09-28 on NFL fixture 18041502):
 *
 *   - `Score.Participant1.Total.Score` / `Participant2` carry the totals;
 *     `Stats["1"]` / `Stats["2"]` carry the same numbers. Either is accepted.
 *   - Participant1/2 are *not* home/away: `Participant1IsHome` says which.
 *   - The event's own `GameState` can say "scheduled" on the finalised event;
 *     `Action === "game_finalised"` is the reliable signal.
 *   - Score snapshots for fixtures outside the subscribed league bundle answer
 *     403 "Bundle access denied" — that is no access, not "no events yet".
 *     Measured 2026-09-28: the free tier does cover NFL, MLS and the English
 *     Premier League as the docs claim. Careful — Competition "Premier
 *     League" is ambiguous: the Kazakh league shares the exact name and is
 *     NOT in the bundle (403), while Arsenal v Chelsea is (200).
 */

import { txline } from './txline.js';
import { sidesOf, participantScore } from './utils.js';

const NO_ACCESS = /\b403\b|access denied|no tickets/i;

/**
 * Finished-state codes seen in the fixture snapshot. Deliberately does NOT
 * include 6: the docs state the fixture GameState vocabulary is 1 =
 * scheduled, 6 = cancelled — measured history (state 6 on Chiefs/Dolphins,
 * an Arsenal U21) can't distinguish finished from abandoned, so it is not
 * evidence of a final score. gameResult's likely-over age branch covers
 * genuinely finished fixtures; readScores only trusts Action
 * === 'game_finalised'.
 */
const FINISHED_STATES = new Set(['game_finalised', 'final']);

function totalOf(event, which) {
  const t = event?.Score?.[`Participant${which}`]?.Total;
  const fromScore = t?.Score ?? t?.Goals ?? t?.Points;
  const fromStats = event?.Stats?.[String(which)];
  const v = fromScore ?? fromStats;
  return v == null || v === '' || !Number.isFinite(Number(v)) ? null : Number(v);
}

/**
 * @returns {Promise<{ access: boolean, events: object[], final: object|null, latest: object|null,
 *   p1: number|null, p2: number|null, error?: string }>}
 */
export async function readScores(fixtureId) {
  let events = [];
  try {
    const rows = await txline.getScoreSnapshot(fixtureId);
    events = Array.isArray(rows) ? rows : [];
  } catch (err) {
    if (NO_ACCESS.test(err.message)) return { access: false, events: [], final: null, latest: null, p1: null, p2: null, error: err.message };
    events = []; // 404: nothing published yet
  }
  if (!events.length) {
    // Snapshot window closed on older completed fixtures; the documented
    // historical replay still has the full sequence (measured 2026-09-28:
    // 3.4 MB of frames incl. game_finalised for a fixture /sequence 404s on).
    try {
      const rows = await txline.getHistoricalScores(fixtureId);
      if (Array.isArray(rows)) events = rows;
    } catch { /* still nothing: report empty, not failure */ }
  }
  const sorted = [...events].sort((a, b) => (a.Seq || 0) - (b.Seq || 0));
  const final = sorted.findLast((e) => e.Action === 'game_finalised') ?? null;
  // Latest event that carries a score; connection/comment events carry none.
  const latest = sorted.findLast((e) => totalOf(e, 1) != null || totalOf(e, 2) != null) ?? sorted.at(-1) ?? null;
  const src = final ?? latest;
  return { access: true, events: sorted, final, latest, p1: totalOf(src, 1), p2: totalOf(src, 2) };
}

/** Map participant totals onto home/away using the fixture's home flag. */
export function homeAway(fixture, scores) {
  const { home, away, swapped } = sidesOf(fixture);
  return {
    home_team: home,
    away_team: away,
    home_score: swapped ? scores.p2 : scores.p1,
    away_score: swapped ? scores.p1 : scores.p2,
  };
}

export function isFinishedState(fixture) {
  return FINISHED_STATES.has(fixture?.GameState);
}

/**
 * Fixtures for a team, best name match first, most recent first. Past-only
 * when `pastOnly`. An exact name beats "Arsenal U21" or "Arsenal de Sarandi".
 */
export function matchFixtures(fixtures, { team, opponent, date, pastOnly }) {
  const now = Date.now();
  const target = date ? new Date(date).toISOString().slice(0, 10) : null;
  const named = [];
  let bestName = 0;
  for (const f of fixtures) {
    let score = 1;
    if (team) {
      const a = participantScore(team, f.Participant1);
      const b = participantScore(team, f.Participant2);
      score = Math.max(a, b);
      if (!score) continue;
      if (opponent) {
        const o = participantScore(opponent, a >= b ? f.Participant2 : f.Participant1);
        if (!o) continue;
        score += o;
      }
    }
    bestName = Math.max(bestName, score);
    named.push({ f, score, start: Number(f.StartTime || 0) });
  }
  // A partial name ("Chiefs") that fits several different teams ("Kaizer
  // Chiefs", "Kansas City Chiefs") is not a lookup, it is a guess. Without an
  // exact name, it must point at exactly one team.
  if (team && !opponent && bestName < 4) {
    const teams = new Set();
    for (const x of named) {
      for (const p of [x.f.Participant1, x.f.Participant2]) if (participantScore(team, p)) teams.add(p);
    }
    if (teams.size > 1) return [];
  }
  // The best-named team is decided across the whole snapshot, *before* the
  // time filter: if senior Arsenal only has future fixtures, "Arsenal" must
  // not quietly become Arsenal U21's last game.
  return named
    .filter((x) => x.score === bestName)
    .filter((x) => !pastOnly || (x.start > 0 && x.start < now))
    .filter((x) => !target || (x.start && new Date(x.start).toISOString().slice(0, 10) === target))
    .sort((x, y) => y.start - x.start)
    .map((x) => x.f);
}
