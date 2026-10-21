/**
 * EVENT_OUTCOME_RESOLUTION — did the event resolve, how is that resolution
 * evidenced, and did it resolve the way the bookmaker consensus expected?
 *
 * Telegraph P3. The intent exists on the network (18 miners, best score
 * 0.727 at the last survey) but our on-chain intent set is closed — adding
 * it needs updateMiner(148, …) on Base Sepolia, not registerMiner — so this
 * handler is *unregistered*: never advertised in /status, telegraph.yaml, or
 * /.well-known, and unreachable through /query. It is demoed by direct call
 * (scripts/demo-event-outcome.mjs) behind TELEGRAPH_INTENT_EVENT_OUTCOME,
 * default off.
 *
 * Resolution semantics reuse the main app's vocabulary rather than inventing
 * a second one: services/txline/reconciliationService.js RECONCILE_STATUS.
 * The result comes from the GAME_RESULT path (TxLINE first, ESPN/OpenLigaDB
 * fallback), so `verified: true` still means exactly one thing — a real
 * Solana Merkle root was returned, not "we believe it".
 *
 * The extra claim this intent adds: whether the outcome matched the
 * consensus. TxLINE's demargined 1X2 prices are the expectation; the final
 * score is the outcome; the cross-venue read (services/txline/
 * crossVenueEdge.js) is what Polymarket priced the same event at, when it
 * priced it at all. Each leg can independently be absent — each absence is
 * reported as absent, never zero.
 */

import { isEnabled } from '../flags.js';
import { txline } from '../txline.js';
import { handleGameResult } from './gameResult.js';
import { getCrossVenueEdge } from '../../../services/txline/crossVenueEdge.js';
import { normalizeOddsResponse } from '../../../services/txline/txlineService.js';
import { RECONCILE_STATUS } from '../../../services/txline/reconciliationService.js';

export const INTENT_NAME = 'EVENT_OUTCOME_RESOLUTION';
export const INTENT_FLAG = 'TELEGRAPH_INTENT_EVENT_OUTCOME';

export async function handleEventOutcomeResolution(params = {}) {
  if (!isEnabled(INTENT_FLAG)) {
    return noResult(
      'intent_disabled',
      `${INTENT_NAME} is compiled but not enabled (set ${INTENT_FLAG}=true). ` +
      'It is not in the on-chain intent set and is never advertised.',
    );
  }

  const resolved = await handleGameResult(params);
  if (!resolved.answer) return resolved;

  const { answer } = resolved;

  // The consensus expectation. Only a TxLINE-sourced fixture has one — an
  // ESPN/OpenLigaDB answer is still a valid resolution, just without a
  // market-expectation leg, and it says so.
  const consensus = await consensusFor(answer);

  // What Polymarket priced the same event at — the cross-venue read. Absent
  // when there is no market, no fixture, or the venue is down.
  const crossVenue = await crossVenueFor(answer, consensus?.implied);

  const expected = consensus ? expectedWinner(consensus.implied) : null;
  const expectedName = nameForSide(expected, answer);
  const actualName = answer.winner ?? null;
  const matches =
    expectedName == null || actualName == null
      ? null
      : expectedName === actualName;

  const status = answer.proof?.verifiable
    ? RECONCILE_STATUS.VERIFIED
    : RECONCILE_STATUS.PROOF_MISSING;

  answer.resolution = {
    status,
    expected_winner: expectedName,
    actual_winner: actualName,
    outcome_matches_consensus: matches,
    consensus: consensus ? { implied: consensus.implied, bookmaker: consensus.bookmaker, ts: consensus.ts } : null,
    cross_venue: crossVenue,
  };
  answer.summary = resolutionSummary(answer);

  return {
    answer,
    metadata: {
      ...resolved.metadata,
      resolution_status: status,
      expectation_source: consensus ? 'txline_demargined_1x2' : null,
    },
  };
}

function noResult(error, message, extra = {}) {
  return { answer: null, metadata: { error, message, ...extra } };
}

function nameForSide(side, answer) {
  if (side === 'home') return answer.home_team || null;
  if (side === 'away') return answer.away_team || null;
  if (side === 'draw') return 'draw';
  return null;
}

function expectedWinner(implied) {
  if (!implied) return null;
  const entries = Object.entries(implied).filter(([, p]) => Number.isFinite(p));
  if (!entries.length) return null;
  entries.sort((a, b) => b[1] - a[1]);
  return entries[0][0]; // 'home' | 'draw' | 'away'
}

/**
 * TxLINE demargined 1X2 consensus for the resolved fixture, or null.
 * Only attempted when the answer came from TxLINE — there is no honest
 * bookmaker consensus for an ESPN-sourced result.
 */
async function consensusFor(answer) {
  if (answer.source !== 'txline' || !answer.fixture_id) return null;
  try {
    const rows = await txline.getOddsSnapshot(answer.fixture_id);
    const { canonical } = normalizeOddsResponse(rows);
    return canonical?.implied ? canonical : null;
  } catch {
    return null;
  }
}

async function crossVenueFor(answer, implied) {
  if (!implied || !answer.home_team || !answer.away_team) return null;
  try {
    const edge = await getCrossVenueEdge({
      home: { name: answer.home_team },
      away: { name: answer.away_team },
      odds: { implied },
    });
    if (!edge?.found) return { found: false, reason: edge?.reason ?? 'no cross-venue market' };
    return {
      found: true,
      polymarket_yes_price: edge.polymarket?.yesPrice ?? null,
      market_url: edge.polymarket?.marketUrl ?? null,
      edge_points: edge.edge ? Math.round(edge.edge.magnitude * 10) / 10 : null,
      direction: edge.edge?.direction ?? null,
      summary: edge.edge?.summary ?? null,
    };
  } catch (err) {
    return { found: false, reason: err.message };
  }
}

/** "X beat Y 2-1 (final) — resolved as TxLINE consensus expected." */
function resolutionSummary(answer) {
  const base = answer.summary || 'Result resolved';
  const r = answer.resolution;
  if (r.status === RECONCILE_STATUS.VERIFIED) {
    const verdict =
      r.outcome_matches_consensus === true ? 'as TxLINE consensus expected'
      : r.outcome_matches_consensus === false ? `against the consensus (${r.expected_winner} was favoured)`
      : 'with the outcome verified on-chain';
    return `${base} — resolved ${verdict}.`;
  }
  if (r.outcome_matches_consensus === true) return `${base} — resolved as TxLINE consensus expected; no Merkle proof published, verified: false.`;
  if (r.outcome_matches_consensus === false) return `${base} — resolved against the consensus (${r.expected_winner} was favoured); no Merkle proof published, verified: false.`;
  return `${base} — outcome resolved; no Merkle proof published, verified: false.`;
}
