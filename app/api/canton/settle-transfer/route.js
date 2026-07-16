/**
 * GET /api/canton/settle-transfer
 *
 * Returns pending SettlementObligation contracts that need CIP-56 transfers.
 * The operator processes these after market resolution to pay out winners.
 *
 * The actual CIP-56 token transfer is executed via the NODERS wallet UI
 * (manual step for the hackathon demo). In production, this would be
 * automated via the Wallet SDK token transfer API.
 */
export const runtime = 'nodejs';

import { getPendingObligations, isCantonConfigured } from '@/services/cantonLedgerClient';

export async function GET() {
  try {
    if (!isCantonConfigured()) {
      return Response.json({
        success: false,
        error: 'Canton ledger not configured',
        obligations: [],
      }, { status: 503 });
    }

    const obligations = await getPendingObligations();
    return Response.json({
      success: true,
      obligations,
      count: obligations.length,
      instructions: 'Process each obligation via CIP-56 transfer in the NODERS wallet UI',
    });
  } catch (error) {
    console.error('Canton settle-transfer API error:', error);
    return Response.json({
      success: false,
      error: error.message,
      obligations: [],
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
