/**
 * SPORTS_SCORE — the live or most recent score for a team, fixture or league.
 *
 * Sources: TxLINE first (a final can carry a Merkle proof), ESPN when TxLINE
 * has nothing live or final for the ask, OpenLigaDB (keyless community
 * finals) when both miss. A scheduled TxLINE fixture is only
 * returned when ESPN has nothing better, and it carries no score — a game that
 * has not started has no score, not 0-0.
 *
 * Returns { answer, metadata } — `answer: null` means no result, with a reason.
 */

import { txline } from '../txline.js';
import { findGame } from '../espn.js';
import { findOpenLigaGame } from '../openLigaDb.js';
import { txlineCompetitionId } from '../utils.js';
import { describe, resultFromScores, winnerFor } from '../answer.js';
import { readScores, homeAway, matchFixtures } from '../txlineScores.js';

export async function handleSportsScore(params = {}) {
  const { fixture_id, team, opponent, competition, league, date } = params;
  const comp = competition || league;

  if (fixture_id && String(fixture_id).startsWith('espn:')) {
    return noResult('espn_fixture_lookup_unsupported',
      `Lookup by ESPN fixture id is not supported; ask by team instead (${fixture_id})`);
  }

  let tx;
  try {
    tx = fixture_id ? await getTxlineScore(fixture_id) : await findTxlineScore({ team, opponent, competition: comp, date });
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

  // OpenLigaDB — keyless community finals for German-league asks TxLINE and
  // ESPN both miss. Same honesty rule: verified: false, proof: null.
  const openLiga = await findOpenLigaGame({ team, opponent, competition: comp, date }).catch(() => null);
  if (openLiga?.answer) {
    openLiga.answer.summary = describe(openLiga.answer);
    return {
      answer: openLiga.answer,
      metadata: {
        source: 'openligadb',
        verification: 'none',
        fallback_from: tx.metadata?.error ?? (tx.answer ? `txline_${tx.answer.status}` : null),
        fixture_id: openLiga.answer.fixture_id,
      },
    };
  }
  if (tx.answer) return tx;

  return noResult('no_match', `No game found for ${team ? `team "${team}"` : comp || 'this ask'}`, {
    txline: tx.metadata?.error ?? null,
    espn_searched: searched,
    openliga_searched: openLiga?.searched ?? null,
  });
}

function noResult(error, message, extra = {}) {
  return { answer: null, metadata: { error, message, ...extra } };
}

async function findTxlineScore({ team, opponent, competition, date }) {
  if (!team) return noResult('no_team', 'TxLINE lookup needs a team');
  const fixtures = await txline.getFixtures(txlineCompetitionId(competition) || undefined);
  if (!Array.isArray(fixtures) || fixtures.length === 0) return noResult('no_fixtures', 'TxLINE returned no fixtures');

  const candidates = matchFixtures(fixtures, { team, opponent, date, pastOnly: false });
  if (candidates.length === 0) return noResult('no_match', 'TxLINE has no fixture for this ask');
  // Closest to now: a live game, else the latest final or the next kickoff.
  const now = Date.now();
  candidates.sort((x, y) => Math.abs(now - Number(x.StartTime || 0)) - Math.abs(now - Number(y.StartTime || 0)));
  return getTxlineScore(candidates[0].FixtureId, fixtures);
}

async function getTxlineScore(fixtureId, knownFixtures) {
  const scores = await readScores(fixtureId);
  if (!scores.access) return noResult('txline_no_access', `TxLINE tier has no score access for fixture ${fixtureId}`);

  let fixture = null;
  try {
    const all = knownFixtures ?? (await txline.getFixtures());
    fixture = (all || []).find((f) => String(f.FixtureId) === String(fixtureId)) ?? null;
  } catch {
    // names reported as null
  }

  const hasScore = scores.p1 != null || scores.p2 != null;
  let status = 'scheduled';
  if (scores.final) status = 'final';
  else if (hasScore || scores.events.some((e) => e.Action === 'in_running' || e.GameState === 'in_running')) status = 'live';

  const sides = homeAway(fixture, status === 'scheduled' ? { p1: null, p2: null } : scores);
  const result = status === 'final' ? resultFromScores(sides.home_score, sides.away_score) : null;
  const src = scores.final ?? scores.latest;
  const minute = src?.Data?.minute || src?.Data?.matchTime || null;

  let proofRoot = null;
  if (status === 'final' && scores.final?.Seq) {
    try {
      const p = await txline.getMerkleProof(fixtureId, scores.final.Seq);
      proofRoot = p?.eventStatRoot || p?.root || null;
    } catch {
      // not published / validation failed: reported as unverified
    }
  }

  const answer = {
    fixture_id: String(fixtureId),
    competition: fixture?.Competition || null,
    competition_id: fixture?.CompetitionId || null,
    ...sides,
    status,
    kickoff: fixture?.StartTime ? new Date(Number(fixture.StartTime)).toISOString() : null,
    minute: minute ? Number(minute) : null,
    result,
    winner: status === 'final' ? winnerFor(result, sides.home_team, sides.away_team) : null,
    source: 'txline',
    verified: Boolean(proofRoot),
    proof_available: Boolean(proofRoot),
    proof: proofRoot ? { merkle_root: proofRoot, chain: 'solana', verifiable: true, sequence: scores.final.Seq } : null,
  };
  answer.summary = describe(answer);

  return {
    answer,
    metadata: {
      source: 'txline',
      fixture_id: String(fixtureId),
      event_count: scores.events.length,
      last_seq: src?.Seq || null,
      verification: proofRoot ? 'solana-merkle-proof' : 'none',
    },
  };
}
