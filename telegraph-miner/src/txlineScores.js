/**
 * Read a TxLINE score-event stream, the way the live feed actually shapes it
 * (measured 2026-09-28 on NFL fixture 18041502):
 *
 *   - `Score.Participant1.Total.Score` / `Participant2` carry the totals;
 *     `Stats["1"]` / `Stats["2"]` carry the same numbers. Either is accepted.
 *   - Participant1/2 are *not* home/away: `Participant1IsHome` says which.
 *   - The event's own `GameState` can say "scheduled" on the finalised event;
 *     `Action === "game_finalised"` is the reliable signal.
 *   - Score snapshots outside the subscription tier answer 403 "Bundle access
 *     denied" — that is no access, not "no events yet".
 */

import { txline } from './txline.js';
import { sidesOf, participantScore } from './utils.js';

const NO_ACCESS = /\b403\b|access denied|no tickets/i;

/** Finished-state codes seen in the fixture snapshot. */
const FINISHED_STATES = new Set(['game_finalised', 'final', 6]);

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
