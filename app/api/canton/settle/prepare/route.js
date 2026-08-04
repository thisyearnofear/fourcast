/**
 * POST /api/canton/settle/prepare
 *
 * Builds — WITHOUT submitting — the exact SettleAsHolder command payload for
 * a position: resolution cid, both escrowed CIP-56 allocation cids,
 * choice-context extraArgs and, on the BitSafe CBTC path, the disclosed
 * contracts the participant requires. The browser wallet then signs and
 * submits this payload with the holder's own key (the sovereignty lane).
 *
 * The server never signs or submits anything here — it only assembles the
 * same payload its own proven settle path would use.
 *
 * Body: { positionContractId, resolutionContractId?, holderPartyId }
 *   resolutionContractId may be omitted — it is discovered from the
 *   position's market. Escrow allocation cids are always discovered
 *   server-side.
 */
export const runtime = 'nodejs';

import {
  prepareSettleSubmission,
  getOpenPositions,
  getMarketResolutions,
  isCantonConfigured,
  queryTemplateId,
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
    const { positionContractId, holderPartyId } = body;
    let { resolutionContractId } = body;

    if (!positionContractId) {
      return Response.json({
        success: false,
        error: 'positionContractId is required',
      }, { status: 400 });
    }
    if (!holderPartyId) {
      return Response.json({
        success: false,
        error: 'holderPartyId is required — the wallet must say which party signs',
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

    const submission = await prepareSettleSubmission(positionContractId, {
      resolutionCid: resolutionContractId,
      lane: 'holder',
      holderPartyId,
    });

    // Wallet-facing commands reference the package by name (#fourcast:...),
    // which wallet gateways resolve — this is the same format the proven
    // Console Wallet path already uses, and it survives DAR re-uploads whose
    // package ids change.
    submission.commands[0].ExerciseCommand.templateId =
      queryTemplateId('Fourcast.PredictionPosition', 'PredictionPosition');

    return Response.json({
      success: true,
      submission,
      prepared: {
        positionContractId,
        resolutionContractId,
        lane: 'holder',
        choice: 'SettleAsHolder',
        chainOrigin: 'CANTON',
      },
    });
  } catch (error) {
    console.error('Canton settle-prepare API error:', error);
    const clientError = /required|not found|not visible|not fully allocated|must be resolved/.test(error.message);
    return Response.json({
      success: false,
      error: error.message,
    }, { status: clientError ? 400 : 500 });
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
