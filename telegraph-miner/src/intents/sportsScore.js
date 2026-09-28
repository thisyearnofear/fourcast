/**
 * SPORTS_SCORE — the live or most recent score for a team, fixture or league.
 *
 * Sources: TxLINE first (a final can carry a Merkle proof), ESPN when TxLINE
 * has nothing live or final for the ask. A scheduled TxLINE fixture is only
 * returned when ESPN has nothing better, and it carries no score — a game that
 * has not started has no score, not 0-0.
 *
 * Returns { answer, metadata } — `answer: null` means no result, with a reason.
 */

import { txline } from '../txline.js';
import { findGame } from '../espn.js';
import { normalizeTeamName, fuzzyMatch, txlineCompetitionId } from '../utils.js';
import { describe, resultFromScores, winnerFor } from '../answer.js';

export async function handleSportsScore(params = {}) {
  const { fixture_id, team, opponent, competition, league, date } = params;
  const comp = competition || league;

  if (fixture_id && String(fixture_id).startsWith('espn:')) {
    return noResult('espn_fixture_lookup_unsupported',
      `Lookup by ESPN fixture id is not supported; ask by team instead (${fixture_id})`);
  }

  let tx;
  try {
    tx = fixture_id ? await getTxlineScore(fixture_id) : await findTxlineScore({ team, competition: comp, date });
  } catch (err) {
    tx = noResult('txline_unavailable', err.message);
  }
  if (fixture_id) return tx;
  if (tx.answer && (tx.answer.status === 'live' || tx.answer.status === 'final')) return tx;

  const { answer, searched } = await findGame({ team, opponent, competition: comp, date, wantFinal: false });
  if (answer) {
    answer.summary = describe(answer);
    return {
      answer,
      metadata: {
        source: 'espn',
        verification: 'none',
        fallback_from: tx.metadata?.error ?? (tx.answer ? `txline_${tx.answer.status}` : null),
        fixture_id: answer.fixture_id,
      },
    };
  }
  if (tx.answer) return tx;

  return noResult('no_match', `No game found for ${team ? `team "${team}"` : comp || 'this ask'}`, {
    txline: tx.metadata?.error ?? null,
    espn_searched: searched,
  });
}

function noResult(error, message, extra = {}) {
  return { answer: null, metadata: { error, message, ...extra } };
}

async function findTxlineScore({ team, competition, date }) {
  const fixtures = await txline.getFixtures(txlineCompetitionId(competition) || undefined);
  if (!Array.isArray(fixtures) || fixtures.length === 0) return noResult('no_fixtures', 'TxLINE returned no fixtures');

  let candidates = fixtures;
  if (team) {
    const n = normalizeTeamName(team);
    candidates = candidates.filter((f) => fuzzyMatch(n, f.Participant1) || fuzzyMatch(n, f.Participant2));
  }
  if (date) {
    const target = new Date(date).toISOString().slice(0, 10);
    candidates = candidates.filter(
      (f) => f.StartTime && new Date(Number(f.StartTime)).toISOString().slice(0, 10) === target
    );
  }
  if (candidates.length === 0) return noResult('no_match', 'TxLINE has no fixture for this ask');

  const now = Date.now();
  candidates.sort((a, b) => Math.abs(now - Number(a.StartTime || 0)) - Math.abs(now - Number(b.StartTime || 0)));
  const best = candidates[0];
  return getTxlineScore(best.FixtureId || best.fixture_id || best.id, fixtures);
}

async function getTxlineScore(fixtureId, knownFixtures) {
  let events = [];
  try {
    const scores = await txline.getScoreSnapshot(fixtureId);
    events = Array.isArray(scores) ? scores : [];
  } catch (err) {
    // A 403 is "our tier cannot see this fixture" — not "no events yet". Read
    // as empty, it turned every inaccessible fixture into a confident
    // "scheduled" answer.
    if (/\b403\b|access denied|no tickets/i.test(err.message)) {
      return noResult('txline_no_access', `TxLINE tier has no score access for fixture ${fixtureId}`);
    }
    events = []; // 404 etc.: a scheduled fixture has no score events yet
  }

  let fixture = null;
  try {
    const all = knownFixtures ?? (await txline.getFixtures());
    fixture = (all || []).find((f) => String(f.FixtureId) === String(fixtureId)) ?? null;
  } catch {
    // names reported as null
  }

  const sorted = [...events].sort((a, b) => (a.Seq || 0) - (b.Seq || 0));
  const finalised = sorted.find((e) => e.Action === 'game_finalised');
  const summary = finalised || sorted.at(-1);
  const stats = summary?.Stats || {};
  const rawHome = stats['1'] ?? stats.score_home ?? null;
  const rawAway = stats['2'] ?? stats.score_away ?? null;

  let status = 'scheduled';
  if (finalised) status = 'final';
  else if (summary?.Action === 'in_running' || summary?.GameState === 'in_running' || rawHome != null) status = 'live';

  const scored = status !== 'scheduled';
  const homeScore = scored && rawHome != null ? Number(rawHome) : null;
  const awayScore = scored && rawAway != null ? Number(rawAway) : null;
  const homeTeam = fixture?.Participant1 || null;
  const awayTeam = fixture?.Participant2 || null;
  const result = status === 'final' ? resultFromScores(homeScore, awayScore) : null;
  const minute = summary?.Data?.minute || summary?.Data?.matchTime || null;

  let proofRoot = null;
  if (status === 'final' && summary?.Seq) {
    try {
      const p = await txline.getMerkleProof(fixtureId, summary.Seq);
      proofRoot = p?.eventStatRoot || p?.root || null;
    } catch {
      // not published yet
    }
  }

  const answer = {
    fixture_id: String(fixtureId),
    competition: fixture?.Competition || null,
    competition_id: fixture?.CompetitionId || null,
    home_team: homeTeam,
    away_team: awayTeam,
    home_score: homeScore,
    away_score: awayScore,
    status,
    kickoff: fixture?.StartTime ? new Date(Number(fixture.StartTime)).toISOString() : null,
    minute: minute ? Number(minute) : null,
    result,
    winner: status === 'final' ? winnerFor(result, homeTeam, awayTeam) : null,
    source: 'txline',
    verified: Boolean(proofRoot),
    proof_available: Boolean(proofRoot),
    proof: proofRoot ? { merkle_root: proofRoot, chain: 'solana', verifiable: true, sequence: summary.Seq } : null,
  };
  answer.summary = describe(answer);

  return {
    answer,
    metadata: {
      source: 'txline',
      fixture_id: String(fixtureId),
      event_count: events.length,
      last_seq: summary?.Seq || null,
      verification: proofRoot ? 'solana-merkle-proof' : 'none',
    },
  };
}
