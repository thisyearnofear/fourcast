/**
 * POST /api/canton/settle
 *
 * Settles a prediction position atomically on Canton.
 * v2: exercise Settle (operator) or SettleAsHolder (holder) — the choice
 * executes/cancels the position's escrowed CIP-56 allocations in the same
 * transaction that archives the position. There is no post-hoc payout.
 *
 * Body: { positionContractId, resolutionContractId, lane?, holderPartyId? }
 *   resolutionContractId may be omitted — it is discovered from the position's
 *   market. Escrow allocation cids are discovered server-side either way.
 */
export const runtime = 'nodejs';

import {
  settlePositionV2,
  getOpenPositions,
  getMarketResolutions,
  isCantonConfigured,
  OPERATOR_PARTY_ID,
} from '@/services/cantonLedgerClient';

export async function POST(request) {
  try {
    if (!isCantonConfigured()) {
      return Response.json({
        success: false,
        error: 'Canton ledger not configured',
      }, { status: 503 });
    }

    const body = await request.json();
    let { positionContractId, resolutionContractId, lane, holderPartyId } = body;
    lane = lane === 'holder' ? 'holder' : 'operator';

    if (!positionContractId) {
      return Response.json({
        success: false,
        error: 'positionContractId is required',
      }, { status: 400 });
    }

    // Discover the resolution from the position's market if not provided
    if (!resolutionContractId) {
      const positions = await getOpenPositions(OPERATOR_PARTY_ID);
      const pos = positions.find((p) => p.contractId === positionContractId)?.payload;
      if (pos?.marketId) {
        const resolutions = await getMarketResolutions(OPERATOR_PARTY_ID);
        resolutionContractId = resolutions.find((r) => r.payload?.marketId === pos.marketId)?.contractId;
      }
    }
    if (!resolutionContractId) {
      return Response.json({
        success: false,
        error: 'resolutionContractId not found — the market must be resolved before settling',
      }, { status: 400 });
    }

    const result = await settlePositionV2(positionContractId, {
      resolutionCid: resolutionContractId,
      lane,
      holderPartyId: holderPartyId || undefined,
    });
    return Response.json({
      success: true,
      settlement: {
        positionContractId,
        resolutionContractId,
        atomic: true,
        lane,
        chainOrigin: 'CANTON',
        ...result,
      },
    });
  } catch (error) {
    console.error('Canton settle API error:', error);
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
