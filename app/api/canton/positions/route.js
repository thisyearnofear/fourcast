/**
 * GET /api/canton/positions
 *
 * Returns open positions and settled positions from the Canton ledger.
 * All queries are server-side via the direct JSON Ledger API.
 *
 * Query params:
 *   ?type=open      — open PredictionPosition contracts (default)
 *   ?type=settled   — PositionSettled contracts
 *   ?type=obligations — pending SettlementObligation contracts
 *   ?type=resolutions — MarketResolution contracts
 */
export const runtime = 'nodejs';

import {
  getOpenPositions,
  getSettledPositions,
  getPendingObligations,
  getMarketResolutions,
  isCantonConfigured,
} from '@/services/cantonLedgerClient';

export async function GET(request) {
  try {
    if (!isCantonConfigured()) {
      return Response.json({
        success: false,
        error: 'Canton ledger not configured',
        positions: [],
      }, { status: 503 });
    }

    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || 'open';

    let results;
    switch (type) {
      case 'settled':
        results = await getSettledPositions();
        break;
      case 'obligations':
        results = await getPendingObligations();
        break;
      case 'resolutions':
        results = await getMarketResolutions();
        break;
      case 'open':
      default:
        results = await getOpenPositions();
        break;
    }

    return Response.json({
      success: true,
      type,
      positions: results,
      count: results.length,
    });
  } catch (error) {
    console.error('Canton positions GET error:', error);
    return Response.json({
      success: false,
      error: error.message,
      positions: [],
    }, { status: 500 });
  }
}

export async function OPTIONS() {
  return new Response(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
