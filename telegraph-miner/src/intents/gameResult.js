/**
 * GAME_RESULT — the final result of a completed match.
 *
 * Sources, best evidence first:
 *   1. TxLINE  — result plus a Solana Merkle proof when one is published.
 *                The only independently verifiable answer this miner gives.
 *   2. ESPN    — free public scoreboards. Covers the history the free TxLINE
 *                tier does not (the reason Season I scored 0 here). Signed by
 *                this miner, but `verified: false`: nothing on-chain backs it.
 *
 * An answer is only ever about a *completed* game. A live or scheduled game is
 * not a result; it is reported as no result, with the reason.
 *
 * Returns { answer, metadata } — `answer: null` means no result, and
 * `metadata.message` says why.
 */

import { txline } from '../txline.js';
import { findGame } from '../espn.js';
import { normalizeTeamName, fuzzyMatch, txlineCompetitionId } from '../utils.js';
import { describe, resultFromScores, winnerFor } from '../answer.js';

export async function handleGameResult(params = {}) {
  const { fixture_id, team, opponent, competition, league, date } = params;
  const comp = competition || league;

  if (fixture_id && String(fixture_id).startsWith('espn:')) {
    return noResult('espn_fixture_lookup_unsupported',
      `Lookup by ESPN fixture id is not supported; ask by team and date instead (${fixture_id})`);
  }

  // 1. TxLINE — the verifiable path.
  let txlineOutcome;
  try {
    txlineOutcome = fixture_id
      ? await getTxlineResult(fixture_id)
      : await findTxlineResult({ team, competition: comp, date });
  } catch (err) {
    txlineOutcome = noResult('txline_unavailable', err.message);
  }
  if (txlineOutcome.answer) return txlineOutcome;
  if (fixture_id) return txlineOutcome; // a named TxLINE fixture has one right answer

  // 2. ESPN — free finals.
  const { answer, searched } = await findGame({ team, opponent, competition: comp, date, wantFinal: true });
  if (answer) {
    answer.summary = describe(answer);
    return {
      answer,
      metadata: {
        source: 'espn',
        verification: 'none',
        fallback_from: txlineOutcome.metadata?.error ?? null,
        fixture_id: answer.fixture_id,
      },
    };
  }

  return noResult(
    'no_completed_match',
    `No completed match found for ${describeAsk({ team, opponent, competition: comp, date })}`,
    { txline: txlineOutcome.metadata?.error ?? null, espn_searched: searched }
  );
}

function noResult(error, message, extra = {}) {
  return { answer: null, metadata: { error, message, ...extra } };
}

function describeAsk({ team, opponent, competition, date }) {
  return [
    team ? `team "${team}"` : null,
    opponent ? `vs "${opponent}"` : null,
    competition ? `in ${competition}` : null,
    date ? `on ${date}` : 'in the last few days',
  ].filter(Boolean).join(' ');
}

async function findTxlineResult({ team, competition, date }) {
  const fixtures = await txline.getFixtures(txlineCompetitionId(competition) || undefined);
  if (!Array.isArray(fixtures) || fixtures.length === 0) {
    return noResult('no_fixtures', 'TxLINE returned no fixtures');
  }

  let completed = fixtures.filter(
    (f) => f.GameState === 'game_finalised' || f.GameState === 'final' || f.GameState === 6
  );
  if (completed.length === 0) {
    // Snapshot carries no state: a kickoff more than 2.5h ago is a candidate,
    // confirmed (or not) by the score events below.
    const now = Date.now();
    completed = fixtures.filter((f) => {
      const start = Number(f.StartTime || 0);
      return start > 0 && now - start > 2.5 * 60 * 60 * 1000;
    });
  }
  if (team) {
    const n = normalizeTeamName(team);
    completed = completed.filter((f) => fuzzyMatch(n, f.Participant1) || fuzzyMatch(n, f.Participant2));
  }
  if (date) {
    const target = new Date(date).toISOString().slice(0, 10);
    completed = completed.filter(
      (f) => f.StartTime && new Date(Number(f.StartTime)).toISOString().slice(0, 10) === target
    );
  }
  completed.sort((a, b) => Number(b.StartTime || 0) - Number(a.StartTime || 0));
  if (completed.length === 0) return noResult('no_completed_match', 'TxLINE has no completed fixture for this ask');

  return getTxlineResult(completed[0].FixtureId || completed[0].id, fixtures);
}

async function getTxlineResult(fixtureId, knownFixtures) {
  let events = [];
  try {
    const scores = await txline.getScoreSnapshot(fixtureId);
    events = Array.isArray(scores) ? scores : [];
  } catch {
    events = [];
  }

  let fixture = null;
  try {
    const all = knownFixtures ?? (await txline.getFixtures());
    fixture = (all || []).find((f) => String(f.FixtureId) === String(fixtureId)) ?? null;
  } catch {
    // Team names unknown; reported as null below, never guessed.
  }

  const sorted = [...events].sort((a, b) => (a.Seq || 0) - (b.Seq || 0));
  const finalised = sorted.find((e) => e.Action === 'game_finalised');
  const summary = finalised || sorted.at(-1);
  if (!(finalised || summary?.GameState === 'game_finalised')) {
    return noResult('not_final', `TxLINE fixture ${fixtureId} has not finalised`, {
      current_status: summary?.Action || 'no events',
    });
  }

  const stats = summary?.Stats || {};
  const rawHome = stats['1'] ?? stats.score_home ?? null;
  const rawAway = stats['2'] ?? stats.score_away ?? null;
  const homeScore = rawHome != null ? Number(rawHome) : null;
  const awayScore = rawAway != null ? Number(rawAway) : null;
  const homeTeam = fixture?.Participant1 || null;
  const awayTeam = fixture?.Participant2 || null;
  const result = resultFromScores(homeScore, awayScore);

  const proof = summary?.Seq ? await fetchProof(fixtureId, summary.Seq) : null;

  const answer = {
    fixture_id: String(fixtureId),
    competition: fixture?.Competition || null,
    competition_id: fixture?.CompetitionId || null,
    home_team: homeTeam,
    away_team: awayTeam,
    home_score: homeScore,
    away_score: awayScore,
    status: 'final',
    kickoff: fixture?.StartTime ? new Date(Number(fixture.StartTime)).toISOString() : null,
    result,
    winner: winnerFor(result, homeTeam, awayTeam),
    source: 'txline',
    // Verified means: a Merkle proof exists that a third party can check.
    // Not "we believe it".
    verified: Boolean(proof?.verifiable),
    proof_available: Boolean(proof?.verifiable),
    proof,
  };
  answer.summary = describe(answer);

  return {
    answer,
    metadata: {
      source: 'txline',
      fixture_id: String(fixtureId),
      verification: proof?.verifiable ? 'solana-merkle-proof' : 'none',
      proof_verifiable: Boolean(proof?.verifiable),
      event_count: events.length,
      final_seq: summary?.Seq || null,
    },
  };
}

/**
 * The TxLINE stat-validation proof, normalised, with the raw payload kept so
 * scripts/verify.mjs can re-check it without trusting our normalisation.
 */
async function fetchProof(fixtureId, seq) {
  try {
    const p = await txline.getMerkleProof(fixtureId, seq);
    if (!p) return { verifiable: false, reason: 'TxLINE returned no proof' };
    const root = p.eventStatRoot || p.root || null;
    return {
      merkle_root: root,
      daily_root_pda: p.dailyRootPda || null,
      program_id: p.programId || null,
      sequence: p.sequence ?? seq,
      stat_keys: p.statKeys || [1, 2],
      chain: 'solana',
      verifiable: Boolean(root),
      source_payload: p,
    };
  } catch (err) {
    return { merkle_root: null, chain: 'solana', verifiable: false, reason: `Proof not published: ${err.message}` };
  }
}
