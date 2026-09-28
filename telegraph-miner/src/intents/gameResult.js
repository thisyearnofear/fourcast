/**
 * GAME_RESULT — the final result of a completed match.
 *
 * Sources, best evidence first:
 *   1. TxLINE  — result plus a Solana Merkle proof when one is published.
 *                The only independently verifiable answer this miner gives.
 *   2. ESPN    — free public scoreboards and team schedules. Signed by this
 *                miner, but `verified: false`: nothing on-chain backs it.
 *
 * An answer is only ever about a *completed* game. A live or scheduled game is
 * not a result; it is reported as no result, with the reason.
 *
 * Returns { answer, metadata } — `answer: null` means no result, and
 * `metadata.message` says why.
 */

import { txline } from '../txline.js';
import { findGame } from '../espn.js';
import { txlineCompetitionId } from '../utils.js';
import { describe, resultFromScores, winnerFor } from '../answer.js';
import { readScores, homeAway, isFinishedState, matchFixtures } from '../txlineScores.js';

/** Candidates to open score streams for; each is one API call. */
const MAX_CANDIDATES = 3;
/** A game that started this long ago is probably over; confirmed by its events. */
const LIKELY_OVER_MS = 2.5 * 60 * 60 * 1000;

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
      : await findTxlineResult({ team, opponent, competition: comp, date });
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

async function findTxlineResult({ team, opponent, competition, date }) {
  if (!team) return noResult('no_team', 'TxLINE lookup needs a team');
  const fixtures = await txline.getFixtures(txlineCompetitionId(competition) || undefined);
  if (!Array.isArray(fixtures) || fixtures.length === 0) return noResult('no_fixtures', 'TxLINE returned no fixtures');

  // Finished by the snapshot's state, or started long enough ago to be over.
  // The snapshot's state lags (the Broncos' finished game still said 3), so
  // the second test matters; the score events decide.
  const now = Date.now();
  const candidates = matchFixtures(fixtures, { team, opponent, date, pastOnly: true }).filter(
    (f) => isFinishedState(f) || now - Number(f.StartTime || 0) > LIKELY_OVER_MS
  );
  if (candidates.length === 0) return noResult('no_completed_match', 'TxLINE has no completed fixture for this ask');

  let last = null;
  for (const f of candidates.slice(0, MAX_CANDIDATES)) {
    last = await getTxlineResult(f.FixtureId, fixtures);
    if (last.answer) return last;
    if (last.metadata?.error === 'txline_no_access') return last; // same tier, same answer for older games
  }
  return last;
}

async function getTxlineResult(fixtureId, knownFixtures) {
  const scores = await readScores(fixtureId);
  if (!scores.access) return noResult('txline_no_access', `TxLINE tier has no score access for fixture ${fixtureId}`);

  let fixture = null;
  try {
    const all = knownFixtures ?? (await txline.getFixtures());
    fixture = (all || []).find((f) => String(f.FixtureId) === String(fixtureId)) ?? null;
  } catch {
    // Team names unknown; reported as null below, never guessed.
  }

  if (!scores.final) {
    return noResult('not_final', `TxLINE fixture ${fixtureId} has not finalised`, {
      current_status: scores.latest?.Action || 'no events',
    });
  }

  const sides = homeAway(fixture, scores);
  const result = resultFromScores(sides.home_score, sides.away_score);
  const proof = await fetchProof(fixtureId, scores.final.Seq);

  const answer = {
    fixture_id: String(fixtureId),
    competition: fixture?.Competition || null,
    competition_id: fixture?.CompetitionId || null,
    ...sides,
    status: 'final',
    kickoff: fixture?.StartTime ? new Date(Number(fixture.StartTime)).toISOString() : null,
    result,
    winner: winnerFor(result, sides.home_team, sides.away_team),
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
      event_count: scores.events.length,
      final_seq: scores.final.Seq ?? null,
    },
  };
}

/**
 * The TxLINE stat-validation proof, normalised, with the raw payload kept so
 * scripts/verify.mjs can re-check it without trusting our normalisation.
 * TxLINE answers 500 "Stat validation failed" for some fixtures; that is
 * reported as no proof, and the answer says verified: false.
 */
async function fetchProof(fixtureId, seq) {
  if (!seq) return { verifiable: false, reason: 'no final sequence number' };
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
    return { merkle_root: null, chain: 'solana', verifiable: false, reason: `Proof not available: ${err.message.replace(/^.*-> /, '').slice(0, 120)}` };
  }
}
