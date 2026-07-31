/**
 * GET /api/canton/settle-transfer
 *
 * DEPRECATED by canton-2.0.0 (atomic settlement).
 *
 * v1 returned SettlementObligation contracts that a human had to pay out via
 * the NODERS wallet UI. v2 removed that template entirely: Settle executes or
 * cancels the escrowed CIP-56 allocations in the settlement transaction
 * itself, so there is never anything outstanding to transfer afterwards.
 *
 * This endpoint now reports the escrow layer's current state: which positions
 * are awaiting funding (allocation legs), so the operator/holder know what
 * still needs allocating before settlement can execute.
 */
export const runtime = 'nodejs';

import {
  getOpenPositions,
  getAllocations,
  findPositionAllocations,
  isCantonConfigured,
  OPERATOR_PARTY_ID,
} from '@/services/cantonLedgerClient';

export async function GET() {
  try {
    if (!isCantonConfigured()) {
      return Response.json({
        success: false,
        error: 'Canton ledger not configured',
      }, { status: 503 });
    }

    const positions = await getOpenPositions(OPERATOR_PARTY_ID);
    const allocations = await getAllocations(OPERATOR_PARTY_ID);

    const escrow = await Promise.all(positions.map(async (p) => {
      const legs = await findPositionAllocations(p.payload);
      return {
        positionContractId: p.contractId,
        marketId: p.payload?.marketId,
        holder: p.payload?.holder,
        stake: p.payload?.stake,
        stakeLegAllocated: Boolean(legs.stakeAllocationCid),
        payoutLegAllocated: Boolean(legs.payoutAllocationCid),
        readyToSettle: Boolean(legs.stakeAllocationCid && legs.payoutAllocationCid),
      };
    }));

    return Response.json({
      success: true,
      deprecated: 'SettlementObligation contracts no longer exist (v2 atomic settlement)',
      escrow,
      activeAllocations: allocations.length,
      note: 'Funds move inside the Settle transaction — no manual wallet payout step.',
    });
  } catch (error) {
    console.error('Canton settle-transfer API error:', error);
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
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
