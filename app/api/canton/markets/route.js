/**
 * GET /api/canton/markets
 *   Returns open prediction markets from the Canton ledger.
 *
 * POST /api/canton/markets
 *   Creates a prediction market on Canton (operator action).
 *   Body: { marketId, question, settlementAsset, deadline }
 *
 * Query params (GET):
 *   ?partyId=X — optional party ID to query as (defaults to operator)
 *
 * All operations are server-side via the direct JSON Ledger API.
 */
export const runtime = 'nodejs';

import { getOpenMarkets, createMarket, isCantonConfigured, OPERATOR_PARTY_ID } from '@/services/cantonLedgerClient';

export async function GET(request) {
  try {
    if (!isCantonConfigured()) {
      return Response.json({
        success: false,
        error: 'Canton ledger not configured',
        markets: [],
      }, { status: 503 });
    }

    const { searchParams } = new URL(request.url);
    const partyId = searchParams.get('partyId') || OPERATOR_PARTY_ID;

    const markets = await getOpenMarkets(partyId);
    return Response.json({
      success: true,
      markets,
      partyId,
      count: markets.length,
    });
  } catch (error) {
    console.error('Canton markets GET error:', error);
    return Response.json({
      success: false,
      error: error.message,
      markets: [],
    }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    if (!isCantonConfigured()) {
      return Response.json({
        success: false,
        error: 'Canton ledger not configured',
      }, { status: 503 });
    }

    const body = await request.json();
    if (!body.question) {
      return Response.json({
        success: false,
        error: 'question is required',
      }, { status: 400 });
    }

    const result = await createMarket(body);
    return Response.json({
      success: true,
      market: {
        marketId: body.marketId || body.event_id || body.id,
        question: body.question,
        settlementAsset: body.settlementAsset || 'CBTC',
        ...result,
      },
    });
  } catch (error) {
    console.error('Canton markets POST error:', error);
    return Response.json({
      success: false,
      error: error.message,
    }, { status: 500 });
  }
}

export async function OPTIONS() {
  return new Response(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
