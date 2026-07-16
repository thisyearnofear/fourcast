/**
 * POST /api/canton/markets/resolve
 *
 * Resolves a prediction market on Canton (operator action).
 * Exercises the ResolveMarket choice on the PredictionMarket contract.
 *
 * Body: { marketContractId, outcome }
 *   outcome: 'ResolvedYes' | 'ResolvedNo' | 'Voided'
 */
export const runtime = 'nodejs';

import { resolveMarket, isCantonConfigured } from '@/services/cantonLedgerClient';

export async function POST(request) {
  try {
    if (!isCantonConfigured()) {
      return Response.json({
        success: false,
        error: 'Canton ledger not configured',
      }, { status: 503 });
    }

    const body = await request.json();
    const { marketContractId, outcome } = body;

    if (!marketContractId) {
      return Response.json({
        success: false,
        error: 'marketContractId is required',
      }, { status: 400 });
    }

    if (!outcome) {
      return Response.json({
        success: false,
        error: 'outcome is required (ResolvedYes, ResolvedNo, or Voided)',
      }, { status: 400 });
    }

    const result = await resolveMarket(marketContractId, outcome);
    return Response.json({
      success: true,
      resolution: {
        marketContractId,
        outcome,
        ...result,
      },
    });
  } catch (error) {
    console.error('Canton resolve error:', error);
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
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
