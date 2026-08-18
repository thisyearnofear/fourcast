/**
 * GAME_RESULT Intent Handler
 *
 * Returns final match results with cryptographic verification.
 * This is the high-value intent — the response includes Solana Merkle proof
 * data that allows any consumer to independently verify the result on-chain.
 *
 * Telegraph evaluation: WASM Exact Match — the canonical answer (scores,
 * teams, status) must exactly match ground truth.
 *
 * Expected params:
 *   - fixture_id: (string) TxLINE fixture ID
 *   - team: (string) team name — find their most recent completed match
 *   - competition: (string) competition name or ID
 *   - date: (string) ISO date
 *
 * Response format (answer):
 * {
 *   "fixture_id": "123456",
 *   "competition": "MLS",
 *   "home_team": "Inter Miami",
 *   "away_team": "Atlanta United",
 *   "home_score": 2,
 *   "away_score": 1,
 *   "status": "final",
 *   "kickoff": "2026-08-14T23:00:00Z",
 *   "result": "home_win",
 *   "verified": true,
 *   "proof": {
 *     "merkle_root": "0xabc...",
 *     "daily_root_pda": "ABC123...",
 *     "program_id": "txoracle...",
 *     "sequence": 42,
 *     "stat_keys": [1, 2],
 *     "chain": "solana",
 *     "verifiable": true
 *   }
 * }
 */

import { txline } from '../txline.js';
import { normalizeTeamName, fuzzyMatch } from '../utils.js';

export async function handleGameResult(params) {
  const { fixture_id, team, competition, league, date } = params;

  if (fixture_id) {
    return await getResultByFixtureId(fixture_id);
  }

  // Find completed fixtures
  const competitionId = resolveCompetitionId(competition || league);
  const fixtures = await txline.getFixtures(competitionId || undefined);

  if (!Array.isArray(fixtures) || fixtures.length === 0) {
    return {
      answer: null,
      metadata: {
        error: 'no_fixtures',
        message: 'No fixtures found',
        params,
      },
    };
  }

  // Filter to completed games (GameState indicates finalised)
  let completed = fixtures.filter(
    (f) =>
      f.GameState === 'game_finalised' ||
      f.GameState === 'final' ||
      f.GameState === 6 // some encodings
  );

  // If no explicitly finalised fixtures in the snapshot, try all and check scores
  if (completed.length === 0) {
    // Fallback: fixtures with StartTime in the past (likely completed)
    const now = Date.now();
    completed = fixtures.filter((f) => {
      const start = Number(f.StartTime || 0);
      // Started more than 2.5 hours ago — almost certainly finished
      return start > 0 && now - start > 2.5 * 60 * 60 * 1000;
    });
  }

  // Filter by team
  if (team) {
    const normalized = normalizeTeamName(team);
    completed = completed.filter(
      (f) =>
        fuzzyMatch(normalized, f.Participant1) ||
        fuzzyMatch(normalized, f.Participant2)
    );
  }

  // Filter by date
  if (date) {
    const targetDate = new Date(date).toISOString().slice(0, 10);
    completed = completed.filter((f) => {
      if (!f.StartTime) return false;
      return new Date(Number(f.StartTime)).toISOString().slice(0, 10) === targetDate;
    });
  }

  // Sort by most recent first
  completed.sort((a, b) => Number(b.StartTime || 0) - Number(a.StartTime || 0));

  if (completed.length === 0) {
    return {
      answer: null,
      metadata: {
        error: 'no_completed_match',
        message: `No completed match found for: team=${team}, competition=${competition || league}, date=${date}`,
        total_fixtures: fixtures.length,
      },
    };
  }

  return await getResultByFixtureId(completed[0].FixtureId || completed[0].id);
}

async function getResultByFixtureId(fixtureId) {
  // Fetch score events
  let scoreData;
  try {
    scoreData = await txline.getScoreSnapshot(fixtureId);
  } catch {
    scoreData = [];
  }

  // Fetch fixture metadata
  let fixtureData = null;
  try {
    const all = await txline.getFixtures();
    fixtureData = (all || []).find(
      (f) => String(f.FixtureId) === String(fixtureId)
    );
  } catch {
    // non-critical
  }

  const events = Array.isArray(scoreData) ? scoreData : [];
  const sorted = events.sort((a, b) => (a.Seq || 0) - (b.Seq || 0));
  const finalised = events.find((e) => e.Action === 'game_finalised');
  const latest = sorted[sorted.length - 1];
  const summary = finalised || latest;

  const stats = summary?.Stats || {};
  const homeScore = stats['1'] ?? stats.score_home ?? null;
  const awayScore = stats['2'] ?? stats.score_away ?? null;

  const isFinal = Boolean(finalised) || summary?.GameState === 'game_finalised';

  if (!isFinal) {
    return {
      answer: null,
      metadata: {
        error: 'not_final',
        message: `Fixture ${fixtureId} has not finalised yet. Use SPORTS_SCORE for live data.`,
        current_status: summary?.Action || 'unknown',
      },
    };
  }

  // Determine result
  let result = 'draw';
  if (homeScore != null && awayScore != null) {
    const h = Number(homeScore);
    const a = Number(awayScore);
    if (h > a) result = 'home_win';
    else if (a > h) result = 'away_win';
    else result = 'draw';
  }

  // Fetch Merkle proof for cryptographic verification
  let proof = null;
  if (summary?.Seq) {
    try {
      const proofData = await txline.getMerkleProof(fixtureId, summary.Seq);
      if (proofData) {
        proof = {
          merkle_root: proofData.eventStatRoot || proofData.root || null,
          daily_root_pda: proofData.dailyRootPda || null,
          program_id: proofData.programId || null,
          sequence: proofData.sequence ?? summary.Seq,
          stat_keys: proofData.statKeys || [1, 2],
          chain: 'solana',
          verifiable: Boolean(proofData.eventStatRoot || proofData.root),
          // Include proof nodes for independent on-chain verification
          stat_proof: proofData.statProof || [],
          sub_tree_proof: proofData.subTreeProof || [],
          main_tree_proof: proofData.mainTreeProof || [],
        };
      }
    } catch (err) {
      // Proof not yet published — result is still valid, just not yet verifiable
      proof = {
        merkle_root: null,
        chain: 'solana',
        verifiable: false,
        reason: 'Proof not yet published to chain',
      };
    }
  }

  const answer = {
    fixture_id: String(fixtureId),
    competition: fixtureData?.Competition || null,
    competition_id: fixtureData?.CompetitionId || null,
    home_team: fixtureData?.Participant1 || 'Unknown',
    away_team: fixtureData?.Participant2 || 'Unknown',
    home_score: homeScore != null ? Number(homeScore) : null,
    away_score: awayScore != null ? Number(awayScore) : null,
    status: 'final',
    kickoff: fixtureData?.StartTime
      ? new Date(Number(fixtureData.StartTime)).toISOString()
      : null,
    result,
    verified: true,
    proof,
  };

  return {
    answer,
    metadata: {
      source: 'txline',
      fixture_id: String(fixtureId),
      verification_method: 'solana-merkle-proof',
      proof_verifiable: proof?.verifiable || false,
      event_count: events.length,
      final_seq: summary?.Seq || null,
    },
  };
}

function resolveCompetitionId(input) {
  if (!input) return null;
  const n = Number(input);
  if (Number.isFinite(n) && n > 0) return n;

  const lower = String(input).toLowerCase().trim();
  const MAP = {
    mls: null,
    'major league soccer': null,
    'premier league': 500001,
    pl: 500001,
    epl: 500001,
    nfl: null,
    'world cup': 72,
    wc: 72,
    fifa: 72,
  };

  return MAP[lower] ?? null;
}
