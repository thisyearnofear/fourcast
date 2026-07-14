/**
 * GET /api/canton/positions
 *
 * Returns Canton position query configuration.
 * Actual position queries are client-side via Console Wallet SDK
 * (the extension queries the Canton participant node for the user's
 * private contract state).
 *
 * This endpoint provides template IDs for the client to filter by.
 */
export const runtime = 'nodejs';

export async function GET() {
  const darPackageId = process.env.NEXT_PUBLIC_CANTON_DAR_PACKAGE_ID || '';
  const operatorPartyId = process.env.CANTON_OPERATOR_PARTY_ID || '';
  const network = process.env.NEXT_PUBLIC_CANTON_NETWORK || 'localnet';

  const templateIds = darPackageId
    ? {
        predictionPosition: `${darPackageId}:Fourcast.PredictionPosition:PredictionPosition`,
        positionSettled: `${darPackageId}:Fourcast.PredictionPosition:PositionSettled`,
        settlementObligation: `${darPackageId}:Fourcast.PredictionPosition:SettlementObligation`,
        predictionMarket: `${darPackageId}:Fourcast.PredictionMarket:PredictionMarket`,
        marketResolution: `${darPackageId}:Fourcast.PredictionMarket:MarketResolution`,
      }
    : {};

  return Response.json({
    success: true,
    canton: {
      operatorPartyId,
      network,
      templateIds,
      // Client should call:
      //   cantonWallet.queryContracts([templateIds.predictionPosition])
      //   cantonWallet.queryContracts([templateIds.positionSettled])
      queryMethod: 'client-side',
    },
    timestamp: new Date().toISOString(),
  });
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
