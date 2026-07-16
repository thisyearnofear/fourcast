/**
 * POST /api/canton/settle-transfer
 *
 * Operator endpoint to process pending SettlementObligations.
 * Executes CIP-56 token transfers for all outstanding obligations
 * and confirms them on-ledger.
 *
 * This is the off-chain settlement batch processor. The operator
 * calls this after market resolution to pay out winners.
 *
 * Body:
 *   { registryUrl, instrumentId? }
 *
 * The actual transfer is executed client-side via the Wallet SDK
 * (the operator's wallet must be connected). This endpoint validates
 * the request and returns the obligation list for the client to process.
 */
export const runtime = 'nodejs';

export async function POST(request) {
  try {
    const body = await request.json();
    const { registryUrl, instrumentId } = body;

    if (!registryUrl) {
      return Response.json(
        { success: false, error: 'registryUrl is required — the CIP-56 token registry URL' },
        { status: 400 }
      );
    }

    const darPackageId = process.env.NEXT_PUBLIC_CANTON_DAR_PACKAGE_ID || '';
    if (!darPackageId) {
      return Response.json(
        { success: false, error: 'Canton DAR package ID not configured' },
        { status: 500 }
      );
    }

    const obligationTemplateId = `${darPackageId}:Fourcast.PredictionPosition:SettlementObligation`;

    return Response.json({
      success: true,
      settlement: {
        chainOrigin: 'CANTON',
        obligationTemplateId,
        registryUrl,
        instrumentId: instrumentId || null,
        // Client should:
        //   1. cantonWallet.queryContracts([obligationTemplateId])
        //   2. For each obligation, call executeSettlementTransfer()
        //   3. Or call processPendingObligations() from cantonPublisher.js
        instructions: 'process-pending-obligations',
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Canton settle-transfer API error:', error);
    return Response.json(
      { success: false, error: 'Settlement transfer request failed', message: error.message },
      { status: 500 }
    );
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
