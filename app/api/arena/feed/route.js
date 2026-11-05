/**
 * GET /api/arena/feed — public read of the arena cycle feed.
 * { latest, runs[] } newest-first, edge-cached briefly.
 */

import { getArenaFeed } from '@/lib/arenaStore';
import { CANONICAL_RECEIPT } from '@/constants/canonicalReceipt';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * FORECAST_REPLAY=1 — when the store is empty, serve one synthesized demo
 * cycle built from the canonical sealed receipt so every surface (rail,
 * arena, landing) has real, auditable content instead of a void. All values
 * come from the actual France v Sweden fixture — nothing invented.
 */
function replayFeed() {
  const ts = new Date('2026-06-21T18:00:00Z').toISOString();
  const decision = {
    verdict: 'ALLOCATE',
    outcome: 'France',
    question: `Will France beat Sweden? — ${CANONICAL_RECEIPT.stage}`,
    yourProb: 0.62,
    marketProb: 0.48,
    edge: 0.14,
    source: 'replay:canonical',
    category: 'sports',
    shares: 18.4,
    reasoning: 'Replay fixture — sealed before kickoff, reconciled against the verified 3–0 result.',
    gates: [
      { label: 'slippage', passed: true },
      { label: 'mandate', passed: true },
      { label: 'risk-cap', passed: true },
      { label: 'liquidity', passed: true },
      { label: 'cooldown', passed: true },
    ],
  };
  const execution = {
    status: 'executed',
    outcome: 'France',
    question: decision.question,
    shares: 18.4,
    cost: 8.83,
    txHash: CANONICAL_RECEIPT.tx,
  };
  const run = {
    timestamp: ts,
    decisions: [decision],
    executions: [execution],
    positions: [],
    balances: { tokenBalance: 91.17, tokenSymbol: 'TST' },
    summary: { tradesExecuted: 1, tradesPaper: 0, dryRun: false },
  };
  return { latest: run, runs: [run], stale: false };
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const limit = Math.min(100, Math.max(1, Number(searchParams.get('limit')) || 40));
  try {
    let feed = await getArenaFeed({ limit });
    if (
      process.env.FORECAST_REPLAY === '1' &&
      (!feed || !feed.latest) &&
      !(feed?.runs?.length > 0)
    ) {
      feed = replayFeed();
    }
    // Server-advertised lane mode. 'paused' (ARENA_LANE_MODE=paused) is the
    // honest steady state when no worker is cycling: the rail reads PAUSED
    // instead of implying a stuck lane will recover. Default: 'live'.
    const laneMode = process.env.ARENA_LANE_MODE === 'paused' ? 'paused' : 'live';
    return Response.json(
      { success: true, laneMode, ...feed },
      { headers: { 'Cache-Control': 's-maxage=10, stale-while-revalidate=30' } }
    );
  } catch (err) {
    return Response.json({ success: false, error: err.message }, { status: 500 });
  }
}
